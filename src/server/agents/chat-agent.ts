/**
 * Chat Agent implementation using Cloudflare Agents SDK
 *
 * Adapted from cloudflare/agents-starter with:
 * - Multi-tenant support (organizationId, userId)
 * - Neon Postgres persistence
 * - Custom tools (queryMemories, createDocument)
 * - Agent context loading (memories, RAG, instructions)
 * - Artifact streaming (like Vercel AI Chatbot)
 */

import { AIChatAgent } from 'agents/ai-chat-agent';
import type { StreamTextOnFinishCallback, ToolSet, UIMessageStreamWriter } from 'ai';
import {
  streamText,
  smoothStream,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse
} from 'ai';
import { getModel } from '../../lib/ai-providers';
import { processToolCalls, cleanupMessages } from '../lib/agent-utils';
import { tools, executions } from '../lib/agent-tools';
import { loadAgentContext } from '../lib/agent-context';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, asc } from 'drizzle-orm';
import * as authSchema from '../../../database/better-auth-schema';
import type { Env } from '../types/env';

/**
 * Artifact kind to content generation prompt mapping
 */
const ARTIFACT_PROMPTS: Record<string, string> = {
  document: 'Write about the given topic. Use markdown formatting with headings, lists, and emphasis where appropriate. Be thorough and well-structured.',
  code: 'Write clean, well-commented code for the given task. Include imports, type definitions if using TypeScript, and example usage.',
  html: 'Create a complete HTML page for the given task. Include proper HTML5 structure, inline CSS for styling, and any necessary JavaScript.',
  react: 'Create a React component for the given task. Use modern React patterns (hooks, functional components). Include TypeScript types and proper prop handling.',
};

/**
 * Chat Agent class
 * Handles real-time AI chat interactions with multi-tenant support
 */
export class Chat extends AIChatAgent<Env> {
  // Store user context for the session
  private userId?: string;
  private organizationId?: string;
  private agentId?: string;
  private conversationId?: string;

  /**
   * Helper methods to get user context
   * Used by tools via getCurrentAgent()
   */
  getUserId() {
    return this.userId;
  }

  getOrganizationId() {
    return this.organizationId;
  }

  /**
   * Generate artifact content and stream it to the frontend
   * Similar to Vercel AI Chatbot's artifact streaming pattern
   */
  private async generateArtifact(
    writer: UIMessageStreamWriter<any>,
    artifactId: string,
    title: string,
    kind: 'document' | 'code' | 'html' | 'react',
    description: string | undefined,
    modelName: string
  ): Promise<string> {
    console.log('🎨 [Artifact] Starting generation:', { artifactId, title, kind });
    
    // Send artifact metadata first (opens the panel)
    writer.write({
      type: 'data',
      data: [{
        type: 'artifact-start',
        artifactId,
        title,
        kind,
      }]
    });
    
    let fullContent = '';
    const prompt = description || title;
    const systemPrompt = ARTIFACT_PROMPTS[kind] || ARTIFACT_PROMPTS.document;
    
    try {
      const model = getModel(this.env, modelName);
      
      const { fullStream } = streamText({
        model,
        system: systemPrompt,
        prompt,
        ...(typeof smoothStream === 'function' ? {
          experimental_transform: smoothStream({ chunking: 'word' })
        } : {})
      });
      
      for await (const chunk of fullStream) {
        if (chunk.type === 'text-delta') {
          // AI SDK v5.0 uses chunk.text for text-delta chunks
          const textDelta = chunk.text || (chunk as any).textDelta || '';
          fullContent += textDelta;
          
          // Stream delta to frontend
          writer.write({
            type: 'data',
            data: [{
              type: 'artifact-delta',
              artifactId,
              delta: textDelta,
            }]
          });
        }
      }
      
      // Send completion
      writer.write({
        type: 'data',
        data: [{
          type: 'artifact-complete',
          artifactId,
          title,
          kind,
          content: fullContent,
        }]
      });
      
      console.log('✅ [Artifact] Generation complete:', { artifactId, contentLength: fullContent.length });
      
    } catch (error) {
      console.error('❌ [Artifact] Generation failed:', error);
      writer.write({
        type: 'data',
        data: [{
          type: 'artifact-error',
          artifactId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }]
      });
    }
    
    return fullContent;
  }

  /**
   * Handle WebSocket connection request
   * Overrides default fetch to load conversation history from DB
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const upgradeHeader = request.headers.get('Upgrade');
      
      // Only intercept WebSocket upgrades to load history
      if (upgradeHeader === 'websocket') {
        // Try to get conversationId from query params (if passed by client)
        let conversationId = url.searchParams.get('conversationId');
        
        // Fallback: Extract from URL path (convention /api/agents/chat/:name)
        if (!conversationId) {
          const pathParts = url.pathname.split('/');
          const potentialId = pathParts[pathParts.length - 1];
          // Avoid using 'chat' if it's the agent name alias without an ID
          if (potentialId && potentialId !== 'chat' && potentialId !== 'websocket') {
            conversationId = potentialId;
          }
        }

        const userId = url.searchParams.get('userId');
        const organizationId = url.searchParams.get('organizationId');
        
        if (conversationId && userId && organizationId) {
          console.log('🔌 WebSocket connection with context:', { conversationId, userId, organizationId });
          
          // Check if this is a different conversation than what's in memory
          // If so, we need to clear and reload from DB
          const isDifferentConversation = this.conversationId !== conversationId;
          
          this.conversationId = conversationId;
          this.userId = userId;
          this.organizationId = organizationId;
          
          // ALWAYS reload from DB for each WebSocket connection
          // This ensures we have the correct, persisted state
          // The SDK's this.messages can get corrupted with intermediate streaming states
          console.log('📖 Clearing in-memory messages and reloading from DB', {
            hadMessages: this.messages?.length || 0,
            isDifferentConversation
          });
          (this as any).messages = []; // Clear any stale messages
          await this.loadHistoryFromDb(conversationId, organizationId);
        } else {
          console.warn('⚠️ WebSocket connection missing context:', { 
            hasConversationId: !!conversationId, 
            hasUserId: !!userId, 
            hasOrgId: !!organizationId,
            path: url.pathname
          });
        }
      }
      
      // Call super.fetch to handle the actual WebSocket upgrade and Agent logic
      // @ts-ignore - AIChatAgent extends DurableObject but types might not be exposed perfectly
      return super.fetch(request);
    } catch (error) {
      console.error('Error in Chat.fetch:', error);
      // Fallback to super.fetch even on error to ensure connection
      // @ts-ignore
      return super.fetch(request);
    }
  }

  /**
   * Load conversation history from Postgres
   */
  private async loadHistoryFromDb(conversationId: string, organizationId: string) {
    try {
      console.log('📖 Loading history from DB for:', conversationId);
      const sqlClient = neon(this.env.DATABASE_URL);
      const db = drizzle(sqlClient, { schema: authSchema }); // Use shared auth schema

      const messages = await db
        .select()
        .from(authSchema.message)
        .where(
          and(
            eq(authSchema.message.conversationId, conversationId),
            eq(authSchema.message.organizationId, organizationId)
          )
        )
        .orderBy(asc(authSchema.message.createdAt));

      if (messages.length > 0) {
        // Convert DB messages to AI SDK UIMessage format with proper parts array
        const uiMessages = messages.map(msg => {
          // Parse tool calls if present
          let toolCalls: any[] = [];
          if (msg.toolCalls) {
            try {
              toolCalls = typeof msg.toolCalls === 'string' 
                ? JSON.parse(msg.toolCalls) 
                : msg.toolCalls;
              
              // Debug: Log raw tool calls from DB
              console.log('📦 [loadHistoryFromDb] Raw tool calls from DB:', {
                messageId: msg.id,
                role: msg.role,
                toolCallCount: toolCalls.length,
                toolCalls: toolCalls.map(tc => ({
                  toolName: tc.toolName,
                  hasInput: !!tc.input,
                  hasArgs: !!tc.args,
                  hasOutput: !!tc.output,
                  inputKeys: tc.input ? Object.keys(tc.input) : [],
                }))
              });
            } catch (e) { 
              console.error('Failed to parse tool calls', e); 
              toolCalls = [];
            }
          }

          // Build parts array for UI message format
          const parts: any[] = [];
          
          // Add text content as a text part
          if (msg.content && msg.content.trim()) {
            parts.push({
              type: 'text',
              text: msg.content
            });
          }

          // For assistant messages with tool calls, add them as tool-invocation parts
          // This is the format AI SDK v5 expects for historical tool calls
          if (msg.role === 'assistant' && toolCalls.length > 0) {
            for (const tc of toolCalls) {
              // Skip tool calls without a valid toolName
              if (!tc.toolName) {
                console.warn('Skipping tool call without toolName:', tc);
                continue;
              }
              
              // Tool calls need to be in 'tool-invocation' format with proper state
              // The AI SDK expects: { type: 'tool-invocation', toolCallId, toolName, args, result, state }
              // CRITICAL: 'args' must NEVER be undefined - Claude API requires 'input' field
              const toolArgs = tc.input || tc.args || {};
              
              parts.push({
                type: 'tool-invocation',
                toolCallId: tc.toolCallId || `tc-${crypto.randomUUID().slice(0, 8)}`,
                toolName: tc.toolName,
                args: toolArgs, // Ensure args is never undefined
                result: tc.output,
                state: tc.output ? 'result' : 'call' // If we have output, it's completed
              });
            }
          }

          // Construct UIMessage
          const uiMsg: any = {
            id: msg.id,
            role: msg.role as any,
            content: msg.content || '',
            parts: parts.length > 0 ? parts : undefined,
            createdAt: msg.createdAt,
          };
          
          return uiMsg;
        });

        // Filter out any messages that would cause API errors
        // (empty assistant messages or incomplete tool calls)
        const validMessages = uiMessages.filter(msg => {
          // User messages need content
          if (msg.role === 'user') {
            return msg.content?.trim() || msg.parts?.some((p: any) => p.type === 'text' && p.text?.trim());
          }
          // Assistant messages need content or valid tool invocations
          if (msg.role === 'assistant') {
            const hasText = msg.content?.trim() || msg.parts?.some((p: any) => p.type === 'text' && p.text?.trim());
            const hasValidToolCalls = msg.parts?.some((p: any) => 
              p.type === 'tool-invocation' && p.toolCallId && p.toolName && p.args !== undefined
            );
            
            // Debug: Log tool invocations for assistant messages
            const toolInvocations = msg.parts?.filter((p: any) => p.type === 'tool-invocation') || [];
            if (toolInvocations.length > 0) {
              console.log('🔍 [loadHistoryFromDb] Assistant message tool invocations:', {
                messageId: msg.id,
                toolInvocations: toolInvocations.map((ti: any) => ({
                  toolName: ti.toolName,
                  toolCallId: ti.toolCallId,
                  hasArgs: ti.args !== undefined,
                  argsType: typeof ti.args,
                  argsKeys: ti.args ? Object.keys(ti.args) : [],
                  hasResult: ti.result !== undefined,
                  state: ti.state
                }))
              });
            }
            
            return hasText || hasValidToolCalls;
          }
          return true;
        });

        // Update Agent state
        (this as any).messages = validMessages;
        
        console.log(`✅ Loaded ${validMessages.length} messages into Agent memory (${messages.length - validMessages.length} filtered)`);
      }
    } catch (error) {
      console.error('❌ Failed to load history from DB:', error);
    }
  }

  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    try {
      console.log('🎯 [Backend] onChatMessage called!', {
        messageCount: this.messages.length,
        hasMessages: this.messages.length > 0,
        firstMessageHasMetadata: !!this.messages[0]?.metadata
      });

      // Extract context from initial message metadata
      // This is passed from the frontend when opening a conversation
      const initialMessage = this.messages[0];

      console.log('📨 [Backend] Initial message:', {
        exists: !!initialMessage,
        role: initialMessage?.role,
        hasMetadata: !!initialMessage?.metadata,
        metadata: initialMessage?.metadata
      });

      if (initialMessage?.metadata) {
        this.userId = (initialMessage.metadata as any).userId;
        this.organizationId = (initialMessage.metadata as any).organizationId;
        this.agentId = (initialMessage.metadata as any).agentId;
        this.conversationId = (initialMessage.metadata as any).conversationId;
      }

      console.log('💬 [Backend] Chat message received', {
        userId: this.userId,
        organizationId: this.organizationId,
        agentId: this.agentId,
        conversationId: this.conversationId,
        messageCount: this.messages.length
      });

      // Validate required context
      if (!this.userId || !this.organizationId || !this.agentId) {
        throw new Error('Missing required context: userId, organizationId, or agentId');
      }

      // Get the last user message for RAG search
      const lastUserMessage = this.messages
        .filter(m => m.role === 'user')
        .slice(-1)[0];
      const userQuery = lastUserMessage?.parts
        ?.find(p => p.type === 'text')
        ?.text || '';

      // Load agent context (instructions, memories, RAG)
      const agentContext = await loadAgentContext(
        this.agentId,
        this.userId,
        this.organizationId,
        userQuery,
        this.env.DATABASE_URL,
        this.env.AI
      );

      console.log('Agent context loaded', {
        model: agentContext.model,
        agentName: agentContext.agentName,
        promptLength: agentContext.systemPrompt.length
      });

      // Collect all tools (including MCP if configured)
      const allTools = {
        ...tools,
        ...this.mcp.getAITools()
      };

      // Wrap onFinish so we can persist the conversation/messages before returning
      const wrappedOnFinish: StreamTextOnFinishCallback<ToolSet> = async (event) => {
        try {
          await this.saveConversationToDatabase(event);
        } catch (error) {
          console.error('Failed to save conversation', { error });
        }

        if (onFinish) {
          await (onFinish as any)(event);
        }
      };

      // Store reference for artifact generation
      const self = this;
      const modelName = agentContext.model;

      // Create UI message stream
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          // Clean up incomplete tool calls to prevent API errors
          const cleanedMessages = cleanupMessages(self.messages);

          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools
          const processedMessages = await processToolCalls({
            messages: cleanedMessages,
            dataStream: writer,
            tools: allTools,
            executions
          });

          console.log('🔑 API Keys check:', {
            hasAnthropicKey: !!self.env.ANTHROPIC_API_KEY,
            hasOpenAIKey: !!self.env.OPENAI_API_KEY,
            hasXAIKey: !!self.env.XAI_API_KEY,
            modelName
          });
          
          // Debug: Log processed messages before conversion with FULL detail
          console.log('📋 [Chat Agent] Processed messages before convertToModelMessages:', {
            messageCount: processedMessages.length,
            messages: processedMessages.map((m: any, idx: number) => ({
              idx,
              id: m.id,
              role: m.role,
              hasContent: !!m.content,
              contentLength: m.content?.length || 0,
              partsCount: m.parts?.length || 0,
              parts: m.parts?.map((p: any) => {
                if (p.type === 'tool-invocation') {
                  return {
                    type: p.type,
                    toolName: p.toolName,
                    toolCallId: p.toolCallId,
                    hasArgs: p.args !== undefined,
                    argsType: typeof p.args,
                    argsValue: JSON.stringify(p.args)?.slice(0, 200), // Show actual args
                    argsIsEmpty: p.args && Object.keys(p.args).length === 0,
                    hasResult: p.result !== undefined,
                    state: p.state
                  }
                } else if (p.type === 'text') {
                  return {
                    type: p.type,
                    textLength: p.text?.length || 0,
                    textPreview: p.text?.slice(0, 50)
                  }
                }
                return { type: p.type }
              })
            }))
          });
          
          // CRITICAL: Log raw messages from SDK to see what we're actually getting
          console.log('🔍 [Chat Agent] RAW this.messages from SDK:', {
            count: self.messages.length,
            messages: self.messages.map((m: any, idx: number) => ({
              idx,
              id: m.id?.slice(0, 20),
              role: m.role,
              partsTypes: m.parts?.map((p: any) => p.type),
              hasToolInvocations: m.parts?.some((p: any) => p.type === 'tool-invocation'),
              // DETAILED: Log all parts with their full structure
              partsDetail: m.parts?.map((p: any) => {
                if (p.type === 'tool-invocation' || p.type === 'tool-call' || p.type === 'tool-result') {
                  return {
                    type: p.type,
                    toolName: p.toolName,
                    toolCallId: p.toolCallId,
                    hasArgs: p.args !== undefined,
                    argsKeys: p.args ? Object.keys(p.args) : null,
                    hasInput: p.input !== undefined,
                    inputKeys: p.input ? Object.keys(p.input) : null,
                    hasResult: p.result !== undefined,
                    state: p.state
                  }
                }
                if (p.type === 'text') {
                  return { type: 'text', textLength: p.text?.length || 0 }
                }
                return { type: p.type }
              })
            }))
          });

          // Use helper function that properly handles Cloudflare Workers env
          const model = getModel(self.env, modelName);

          // Track if we need to generate an artifact after streaming
          let pendingArtifact: {
            id: string;
            title: string;
            kind: 'document' | 'code' | 'html' | 'react';
            description?: string;
          } | null = null;

          // Convert messages before passing to streamText
          // This is where errors can occur if messages are malformed
          let modelMessages;
          try {
            modelMessages = convertToModelMessages(processedMessages);
            
            // FIX FOR ANTHROPIC API: Ensure tool_result immediately follows tool_use
            // The AI SDK's convertToModelMessages may create a message order where:
            // 1. assistant (with tool_use)
            // 2. tool (with tool_result)
            // 3. user (with text)
            // But Claude requires tool_result to IMMEDIATELY follow tool_use.
            // When the Anthropic provider merges tool + user messages, 
            // it must put tool_result parts BEFORE user text parts.
            // We fix this by reordering the content in user messages that have both.
            modelMessages = modelMessages.map((m: any) => {
              if (m.role === 'user' && Array.isArray(m.content)) {
                // Separate tool-result parts from other parts
                const toolResultParts = m.content.filter((c: any) => c.type === 'tool-result');
                const otherParts = m.content.filter((c: any) => c.type !== 'tool-result');
                
                if (toolResultParts.length > 0 && otherParts.length > 0) {
                  console.log('🔧 [Chat Agent] Reordering user message: tool_result parts moved to front');
                  return {
                    ...m,
                    content: [...toolResultParts, ...otherParts]
                  };
                }
              }
              return m;
            });

            console.log('✅ [Chat Agent] convertToModelMessages succeeded:', {
              inputCount: processedMessages.length,
              outputCount: modelMessages.length
            });
            
            // Log each model message in detail
            modelMessages.forEach((m: any, idx: number) => {
              console.log(`📤 [Model Message ${idx}]:`, JSON.stringify({
                role: m.role,
                contentCount: Array.isArray(m.content) ? m.content.length : 1,
                contentTypes: Array.isArray(m.content) 
                  ? m.content.map((c: any) => c.type || 'text')
                  : ['text'],
                content: Array.isArray(m.content) 
                  ? m.content.map((c: any) => {
                      if (c.type === 'tool-call') {
                        return { type: c.type, toolName: c.toolName, toolCallId: c.toolCallId, hasArgs: !!c.args }
                      }
                      if (c.type === 'tool-result') {
                        return { 
                          type: c.type, 
                          toolCallId: c.toolCallId, 
                          hasOutput: c.output !== undefined,
                          outputType: c.output?.type,
                          outputValue: JSON.stringify(c.output?.value)?.slice(0, 200)
                        }
                      }
                      if (c.type === 'text') {
                        return { type: 'text', length: c.text?.length || 0 }
                      }
                      return { type: c.type }
                    })
                  : [{ type: 'text', length: m.content?.length || 0 }]
              }, null, 2));
            });
          } catch (conversionError) {
            console.error('❌ [Chat Agent] convertToModelMessages FAILED:', {
              error: conversionError,
              processedMessages: JSON.stringify(processedMessages, null, 2).slice(0, 2000)
            });
            throw conversionError;
          }

          // Stream text with tools
          let result;
          try {
            result = streamText({
              system: agentContext.systemPrompt,
              messages: modelMessages,
              model,
              tools: allTools,
              // Type boundary: streamText expects specific tool types, but base class uses ToolSet
              // This is safe because our tools satisfy ToolSet interface
              onFinish: wrappedOnFinish as unknown as StreamTextOnFinishCallback<
                typeof allTools
              >,
              stopWhen: stepCountIs(10), // Max 10 agent loop steps
              // Word-by-word streaming for smooth UX (AI SDK v5.0.89+)
              ...(typeof smoothStream === 'function' ? {
                experimental_transform: smoothStream({ chunking: 'word' })
              } : {})
            });
          } catch (streamError) {
            console.error('❌ [Chat Agent] streamText FAILED:', {
              error: streamError,
              modelName
            });
            throw streamError;
          }

          // Instead of merge(), iterate through fullStream to intercept tool results
          // This allows us to generate artifacts inline when createDocument is called
          console.log('🔄 [Chat Agent] Starting fullStream iteration');
          for await (const chunk of result.fullStream) {
            console.log('📦 [Chat Agent] Chunk received:', chunk.type);
            // Forward all chunks to the UI writer
            if (chunk.type === 'text-start') {
              // Forward text-start to begin a new text block
              writer.write({ type: 'text-start' });
            } else if (chunk.type === 'text-delta') {
              // AI SDK v5 fullStream uses 'text' property, not 'textDelta'
              const textContent = (chunk as any).text || chunk.textDelta || '';
              if (textContent) {
                // AI SDK v5 UIMessageChunk expects 'delta' property
                writer.write({ type: 'text-delta', delta: textContent });
              }
            } else if (chunk.type === 'text-end') {
              // Forward text-end to close the text block
              writer.write({ type: 'text-end' });
            } else if (chunk.type === 'tool-call') {
              writer.write({ 
                type: 'tool-call', 
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.args 
              });
            } else if (chunk.type === 'tool-result') {
              // AI SDK 5.x uses 'output' for tool results, not 'result'
              const toolOutput = (chunk as any).output ?? (chunk as any).result;
              console.log('🔧 [Chat Agent] Tool result received:', {
                toolName: chunk.toolName,
                toolCallId: chunk.toolCallId,
                hasOutput: !!toolOutput,
                outputKeys: toolOutput ? Object.keys(toolOutput) : [],
              });
              
              // Forward the tool result first
              writer.write({ 
                type: 'tool-result', 
                toolCallId: chunk.toolCallId,
                result: toolOutput 
              });
              
              // Check if this is createDocument - if so, generate artifact
              if (chunk.toolName === 'createDocument' && toolOutput) {
                const toolResult = toolOutput as any;
                console.log('🎨 [Chat Agent] createDocument detected, generating artifact:', toolResult);
                
                const artifactId = `artifact-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
                const title = toolResult.title || 'Untitled';
                const kind = toolResult.kind || 'document';
                const description = toolResult.description;
                
                // Generate artifact inline (this will stream artifact-start, artifact-delta, artifact-complete)
                await self.generateArtifact(
                  writer,
                  artifactId,
                  title,
                  kind,
                  description,
                  modelName
                );
              }
            } else if (chunk.type === 'step-start') {
              writer.write({ type: 'start-step' });
            } else if (chunk.type === 'step-finish') {
              writer.write({ type: 'finish-step' });
            } else if (chunk.type === 'finish') {
              writer.write({ type: 'finish', finishReason: chunk.finishReason });
            }
            // Other chunk types are forwarded as-is if needed
          }
        }
      });

      return createUIMessageStreamResponse({ stream });

    } catch (error) {
      console.error('Chat message handler failed', { error });
      throw error;
    }
  }

  /**
   * Save conversation and messages to Neon Postgres
   */
  private async saveConversationToDatabase(event: any) {
    try {
      if (!this.userId || !this.organizationId || !this.agentId) {
        console.warn('Cannot save: missing context');
        return;
      }

      let convId = this.conversationId || crypto.randomUUID();
      this.conversationId = convId;

      // The onFinish event contains the assistant's response
      // We need to add it to this.messages before saving
      const assistantResponse = event.response?.messages?.[0] || event.response;
      
      console.log('Saving conversation to database', {
        conversationId: convId,
        messageCount: this.messages.length,
        agentId: this.agentId,
        hasAssistantResponse: !!assistantResponse,
        eventKeys: Object.keys(event || {})
      });
      
      // If we have an assistant response from the event, create a message for it
      // The event.text contains the full text response
      if (event.text && event.text.trim()) {
        const assistantMessage = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, text: event.text }],
          metadata: { createdAt: new Date().toISOString() }
        };
        
        // Check if we already have this message (avoid duplicates)
        const hasAssistantMsg = this.messages.some(m => 
          m.role === 'assistant' && 
          m.parts?.some(p => p.type === 'text' && (p as any).text === event.text)
        );
        
        if (!hasAssistantMsg) {
          console.log('Adding assistant message to save queue', {
            textLength: event.text.length
          });
          // Add to messages array for saving
          this.messages.push(assistantMessage as any);
        }
      }

      // Initialize database connection
      const sqlClient = neon(this.env.DATABASE_URL);
      const db = drizzle(sqlClient, { schema: authSchema });

      // Create or update conversation using the same table the API queries
      const conversationData = {
        id: convId,
        userId: this.userId,
        organizationId: this.organizationId,
        toolId: this.agentId, // Keep backwards-compatible naming
        metadata: { agentId: this.agentId },
        title: 'New conversation',
        model: this.messages?.[0]?.metadata?.model || 'gpt-4o-mini',
      };

      await db.insert(authSchema.conversation).values(conversationData)
        .onConflictDoUpdate({
          target: authSchema.conversation.id,
          set: {
            updatedAt: new Date(),
            toolId: this.agentId,
            model: conversationData.model,
          },
        });

      // Save all messages
      // Note: In a production system, you'd want to track which messages are new
      // For now, we'll just ensure all messages are saved (idempotent)
      
      // CRITICAL DEBUG: Log what we're about to save
      console.log('💾 [Chat Agent] Messages to save:', {
        count: this.messages.length,
        messages: this.messages.map((m: any, idx: number) => ({
          idx,
          id: m.id?.slice(0, 20),
          role: m.role,
          partsCount: m.parts?.length || 0,
          partsTypes: m.parts?.map((p: any) => p.type),
          toolInvocations: m.parts?.filter((p: any) => p.type === 'tool-invocation').map((p: any) => ({
            toolName: p.toolName,
            toolCallId: p.toolCallId?.slice(0, 20),
            hasArgs: p.args !== undefined,
            argsKeys: p.args ? Object.keys(p.args) : [],
            hasResult: p.result !== undefined
          }))
        }))
      });
      
      for (const msg of this.messages) {
        // Extract text content
        const textContent = msg.parts
          ?.filter(p => p.type === 'text')
          .map(p => (p as any).text)
          .join('\n') || '';

        // Extract tool calls and results from message parts
        // AI SDK v5 uses tool-{toolName} type parts with toolCallId, input, and output
        const toolParts = msg.parts?.filter((p: any) => 
          p.type?.startsWith('tool-') && p.type !== 'tool-result'
        ) || [];
        
        // Format for database schema: { id, name, arguments }
        const toolCalls = toolParts.map((p: any) => ({
          id: p.toolCallId,
          name: p.toolName || p.type?.replace('tool-', ''), // Extract tool name from type
          arguments: p.input || p.args || {},
        }));
        
        // Format tool results for database schema: { toolCallId, result }
        const toolResults = toolParts
          .filter((p: any) => p.output !== undefined || p.result !== undefined)
          .map((p: any) => ({
            toolCallId: p.toolCallId,
            result: p.output || p.result,
          }));
        
        console.log('💾 [Chat Agent] Saving message:', {
          messageId: msg.id?.slice(0, 20),
          role: msg.role,
          toolCallsCount: toolCalls.length,
          toolResultsCount: toolResults.length,
          toolCalls: toolCalls.map(tc => ({ id: tc.id?.slice(0, 20), name: tc.name })),
        });

        // Save message (upsert by id)
        await db.insert(authSchema.message).values({
          id: msg.id,
          conversationId: convId!,
          organizationId: this.organizationId,
          content: textContent,
          role: msg.role,
          toolCalls: toolCalls.length > 0 ? toolCalls : null,
          toolResults: toolResults.length > 0 ? toolResults : null,
          createdAt: msg.metadata?.createdAt
            ? new Date(msg.metadata.createdAt as any)
            : new Date()
        }).onConflictDoUpdate({
          target: authSchema.message.id,
          set: {
            content: textContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : null,
            toolResults: toolResults.length > 0 ? toolResults : null,
          }
        });
      }

      console.log('Conversation saved successfully', {
        conversationId: convId,
        messagesSaved: this.messages.length
      });

    } catch (error) {
      console.error('Failed to save conversation to database', { error });
      // Don't throw - we don't want to break the chat stream
    }
  }

  /**
   * Execute scheduled task (optional feature)
   * This is called when a scheduled task runs
   */
  async executeTask(description: string, _task: any) {
    try {
      console.log('Executing scheduled task', { description });

      // Add task execution message to conversation
      await this.saveMessages([
        ...this.messages,
        {
          id: `task-${Date.now()}`,
          role: "user",
          parts: [
            {
              type: "text",
              text: `Running scheduled task: ${description}`
            }
          ],
          metadata: {
            createdAt: new Date()
          }
        }
      ]);

      console.log('Scheduled task executed', { description });
    } catch (error) {
      console.error('Failed to execute scheduled task', { error });
    }
  }
}
