/**
 * Chat Agent implementation using Cloudflare Agents SDK
 *
 * Adapted from cloudflare/agents-starter with:
 * - Multi-tenant support (organizationId, userId)
 * - Neon Postgres persistence
 * - Custom tools (queryMemories, createDocument)
 * - Agent context loading (memories, RAG, instructions)
 */

import { AIChatAgent } from 'agents/ai-chat-agent';
import type { StreamTextOnFinishCallback, ToolSet } from 'ai';
import {
  streamText,
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
          
          this.conversationId = conversationId;
          this.userId = userId;
          this.organizationId = organizationId;
          
          // Load history if not already in memory
          if (!this.messages || this.messages.length === 0) {
            await this.loadHistoryFromDb(conversationId, organizationId);
          }
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
        // Convert DB messages to AI SDK CoreMessage format
        const coreMessages = messages.map(msg => {
          // Parse tool calls if present
          let toolCalls = undefined;
          if (msg.toolCalls) {
            try {
              toolCalls = typeof msg.toolCalls === 'string' 
                ? JSON.parse(msg.toolCalls) 
                : msg.toolCalls;
            } catch (e) { console.error('Failed to parse tool calls', e); }
          }

          // Construct message
          const coreMsg: any = {
            id: msg.id,
            role: msg.role as any,
            content: msg.content || '',
            createdAt: msg.createdAt,
          };

          if (toolCalls) {
            // If it has tool calls, we might need to structure it differently for AI SDK v5
            // But basic content + parts usually works.
            // For now, we'll trust the base agent to handle standard properties.
            // Note: AIChatAgent uses `this.messages` which expects CoreMessage or UIMessage.
          }
          
          return coreMsg;
        });

        // Update Agent state
        // Use saveMessages to update state (it persists to DO storage usually)
        // Or just set this.messages if saveMessages appends
        // this.messages = coreMessages; // Direct set might be safer for "initial load"
        
        // We need to be careful not to duplicate if DO storage already has them.
        // But we checked if (this.messages.length === 0).
        
        // Note: AIChatAgent likely expects specific format. 
        // We'll use a protected method if available, or just set the property.
        (this as any).messages = coreMessages;
        
        console.log(`✅ Loaded ${coreMessages.length} messages into Agent memory`);
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

      // Create UI message stream
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          // Clean up incomplete tool calls to prevent API errors
          const cleanedMessages = cleanupMessages(this.messages);

          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools
          const processedMessages = await processToolCalls({
            messages: cleanedMessages,
            dataStream: writer,
            tools: allTools,
            executions
          });

          // Configure AI model with correct provider
          const modelName = agentContext.model;

          console.log('🔑 API Keys check:', {
            hasAnthropicKey: !!this.env.ANTHROPIC_API_KEY,
            hasOpenAIKey: !!this.env.OPENAI_API_KEY,
            hasXAIKey: !!this.env.XAI_API_KEY,
            modelName
          });

          // Use helper function that properly handles Cloudflare Workers env
          const model = getModel(this.env, modelName);

          // Stream text with tools
          const result = streamText({
            system: agentContext.systemPrompt,
            messages: convertToModelMessages(processedMessages),
            model,
            tools: allTools,
            // Type boundary: streamText expects specific tool types, but base class uses ToolSet
            // This is safe because our tools satisfy ToolSet interface
            onFinish: wrappedOnFinish as unknown as StreamTextOnFinishCallback<
              typeof allTools
            >,
            stopWhen: stepCountIs(10) // Max 10 agent loop steps
          });

          // Merge the AI stream into the UI writer
          writer.merge(result.toUIMessageStream());
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

      console.log('Saving conversation to database', {
        conversationId: convId,
        messageCount: this.messages.length,
        agentId: this.agentId
      });

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
      for (const msg of this.messages) {
        // Extract text content
        const textContent = msg.parts
          ?.filter(p => p.type === 'text')
          .map(p => (p as any).text)
          .join('\n') || '';

        // Extract tool calls and results
        const toolCalls = msg.parts
          ?.filter(p => p.type.startsWith('tool-'))
          .map(p => ({
            toolName: p.type.replace('tool-', ''),
            toolCallId: (p as any).toolCallId,
            input: (p as any).input,
            output: (p as any).output
          })) || [];

        // Save message (upsert by id)
        await db.insert(authSchema.message).values({
          id: msg.id,
          conversationId: convId!,
          organizationId: this.organizationId,
          content: textContent,
          role: msg.role,
          toolCalls: toolCalls.length > 0 ? toolCalls : null,
          createdAt: msg.metadata?.createdAt
            ? new Date(msg.metadata.createdAt as any)
            : new Date()
        }).onConflictDoUpdate({
          target: authSchema.message.id,
          set: {
            content: textContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : null
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
