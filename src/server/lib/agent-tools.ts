/**
 * Tool definitions for AI Chat Agent
 *
 * Tools for:
 * - queryMemories: Search user's personal/business memories
 * - searchKnowledgeBase: Search organization's RAG knowledge base
 * - createDocument: Generate artifacts (documents, code, etc.)
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc, asc, or, ilike } from 'drizzle-orm';
import { memories } from '../../../database/schema/memories';
import { getCurrentAgent } from 'agents';
import type { Chat } from '../agents/chat-agent';

/**
 * Query Memories Tool
 * Searches user's personal and business memories stored in Neon database
 * Use this for personal questions like birthday, preferences, business info, goals
 */
export const queryMemories = tool({
  description: `Search the user's stored memories and personal information. 
USE THIS TOOL WHEN:
- User asks about their birthday, age, or personal dates
- User asks about their business, company, or work
- User asks about their goals, challenges, or preferences
- User mentions "my" followed by any personal attribute
- User asks "do you remember" or "what did I tell you about"
- User references past conversations or stored information

Examples of when to use:
- "What's my birthday?" → queryMemories("birthday")
- "What's my business about?" → queryMemories("business")
- "What are my goals?" → queryMemories("goals")
- "Do you remember my target audience?" → queryMemories("target audience")`,
  inputSchema: z.object({
    query: z.string().describe("Search query - can be a keyword like 'birthday', 'business', 'goals' or a phrase")
  }),
  execute: async ({ query }) => {
    try {
      // Get agent context from ALS (AsyncLocalStorage)
      const { agent, env } = getCurrentAgent<Chat>();

      if (!agent) {
        return 'Error: Agent context not available';
      }

      // Get user context from agent
      const userId = agent.getUserId?.() || '';
      const organizationId = agent.getOrganizationId?.() || '';

      if (!userId || !organizationId) {
        return 'Error: User or organization context not available';
      }

      console.info('🔍 Querying memories', { query, userId, organizationId });

      // Check if DATABASE_URL is available
      if (!env.DATABASE_URL) {
        console.error('DATABASE_URL not available');
        return `Error: Database connection not configured`;
      }

      // Initialize database connection
      const sqlClient = neon(env.DATABASE_URL);
      const db = drizzle(sqlClient, { schema: { memories } });

      // Query all user memories
      const userMemories = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.userId, userId),
            eq(memories.organizationId, organizationId)
          )
        )
        .orderBy(asc(memories.category), desc(memories.createdAt));

      // Enhanced filtering - check key, value, and category
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      const relevantMemories = userMemories.filter(mem => {
        const keyLower = mem.key.toLowerCase();
        const valueLower = mem.value.toLowerCase();
        const categoryLower = mem.category.toLowerCase();
        
        // Direct match on key or value
        if (keyLower.includes(queryLower) || valueLower.includes(queryLower)) {
          return true;
        }
        
        // Match on category (e.g., "personal" matches "personal_info")
        if (categoryLower.includes(queryLower.replace(' ', '_'))) {
          return true;
        }
        
        // Match any query word
        return queryWords.some(word => 
          keyLower.includes(word) || valueLower.includes(word) || categoryLower.includes(word)
        );
      });

      // If no specific matches, return ALL memories (user might be asking broadly)
      const memoriesToReturn = relevantMemories.length > 0 ? relevantMemories : userMemories;

      // Format results
      if (memoriesToReturn.length === 0) {
        return `No memories found. The user hasn't stored any information yet.`;
      }

      // Group by category for better readability
      const grouped: Record<string, { key: string; value: string }[]> = {};
      memoriesToReturn.forEach(mem => {
        if (!grouped[mem.category]) {
          grouped[mem.category] = [];
        }
        grouped[mem.category].push({ key: mem.key, value: mem.value });
      });

      let result = relevantMemories.length > 0 
        ? `Found ${relevantMemories.length} memories matching "${query}":\n\n`
        : `No exact match for "${query}", but here are all stored memories:\n\n`;
      
      const categoryLabels: Record<string, string> = {
        'personal_info': 'Personal Information',
        'business_info': 'Business Information',
        'target_audience': 'Target Audience',
        'offers': 'Products & Offers',
        'current_projects': 'Current Projects',
        'challenges': 'Challenges',
        'goals': 'Goals'
      };

      for (const [category, items] of Object.entries(grouped)) {
        const label = categoryLabels[category] || category;
        result += `**${label}:**\n`;
        items.forEach(item => {
          result += `- ${item.key}: ${item.value}\n`;
        });
        result += '\n';
      }

      console.info('✅ Memory query completed', { 
        query, 
        matchCount: relevantMemories.length,
        totalReturned: memoriesToReturn.length 
      });
      
      return result;

    } catch (error) {
      console.error('Failed to query memories', { error });
      return `Error querying memories: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

/**
 * Search Knowledge Base Tool
 * Searches organization's RAG knowledge base using Cloudflare AutoRAG
 */
export const searchKnowledgeBase = tool({
  description: `Search the organization's knowledge base for relevant information using Cloudflare AutoRAG.
USE THIS TOOL WHEN:
- User asks about company policies, procedures, or documentation
- User needs information that might be in uploaded documents
- User asks about topics that require referencing stored knowledge
- User asks technical questions that might have documented answers

NOTE: This tool only works if the organization has AutoRAG configured.`,
  inputSchema: z.object({
    query: z.string().describe("Search query to find relevant documents and information")
  }),
  execute: async ({ query }) => {
    try {
      const { env } = getCurrentAgent<Chat>();
      
      // Check if AutoRAG is configured
      if (!env.AUTORAG) {
        console.info('📚 AutoRAG not configured, skipping knowledge base search');
        return `Knowledge base (AutoRAG) is not configured for this organization. The user may need to enable it in their Cloudflare settings.`;
      }
      
      console.info('🔍 Searching knowledge base with AutoRAG:', { query });
      
      // Use Cloudflare AutoRAG for semantic search
      const results = await env.AUTORAG.search(query, { 
        limit: 5,
        threshold: 0.7 
      });
      
      if (!results || results.length === 0) {
        return `No relevant documents found in the knowledge base for: "${query}"`;
      }
      
      // Format results for the AI
      let response = `Found ${results.length} relevant documents:\n\n`;
      
      results.forEach((result: any, index: number) => {
        const title = result.metadata?.title || result.metadata?.source || `Document ${index + 1}`;
        const score = result.metadata?.score ? ` (relevance: ${(result.metadata.score * 100).toFixed(0)}%)` : '';
        response += `**${title}**${score}\n${result.content}\n\n---\n\n`;
      });
      
      console.info('✅ Knowledge base search completed', { resultCount: results.length });
      return response;
      
    } catch (error) {
      console.error('Failed to search knowledge base', { error });
      return `Error searching knowledge base: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
});

/**
 * Create Document Tool
 * Generates artifacts (documents, code, HTML, React components)
 * Executes automatically without human confirmation
 */
export const createDocument = tool({
  description: "Create an artifact like a document, code snippet, HTML page, or React component. This will generate the content and display it in the artifact panel. Use this when the user asks you to create, write, or generate something substantial.",
  inputSchema: z.object({
    title: z.string().describe("Title of the artifact (e.g., 'Business Plan', 'Landing Page')"),
    kind: z.enum(['document', 'code', 'html', 'react']).describe("Type of artifact to create"),
    description: z.string().optional().describe("Brief description of what to generate")
  }),
  execute: async ({ title, kind, description }) => {
    // Tool approved - return the parameters to trigger artifact creation
    console.log('Creating artifact:', { title, kind, description });
    return {
      message: `Creating ${kind} artifact: "${title}"`,
      title,
      kind,
      description
    };
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  queryMemories,
  searchKnowledgeBase,
  createDocument
} satisfies ToolSet;

/**
 * Tool Execution Handlers
 *
 * This object contains the actual implementation for tools that require human approval
 * (tools defined above without an execute function)
 *
 * NOTE: Artifact creation currently uses streamObject, which requires streaming.
 * This execution handler is a placeholder - actual artifact generation happens
 * in the agent's onChatMessage handler using the Vercel AI SDK's streamObject.
 */
export const executions = {
  createDocument: async ({ title, kind, description }: {
    title: string;
    kind: 'document' | 'code' | 'html' | 'react';
    description?: string;
  }) => {
    // This is called when the user confirms the tool invocation
    // Actual artifact streaming will be handled by the agent
    return {
      message: `Creating ${kind} artifact: "${title}"`,
      title,
      kind,
      description
    };
  }
};

/**
 * Type export for tool executions
 */
export type ToolExecutions = typeof executions;
