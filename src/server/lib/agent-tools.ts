/**
 * Tool definitions for AI Chat Agent
 *
 * Tools extracted from previous WebSocket DO implementation
 * Adapted for Cloudflare Agents SDK pattern
 */

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, desc, asc } from 'drizzle-orm';
import { memories } from '../../../database/schema/memories';
import { getCurrentAgent } from 'agents';
import type { Chat } from '../agents/chat-agent';

/**
 * Query Memories Tool
 * Searches user's business memories stored in Neon database
 * Executes automatically without human confirmation
 */
export const queryMemories = tool({
  description: "Search the user's business memories and context. Use this to recall previous conversations, business information, goals, strategies, or any other stored information about the user.",
  inputSchema: z.object({
    query: z.string().describe("Search query to find relevant memories (e.g., 'business goals', 'pricing strategy', 'target audience')")
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

      console.info('Querying memories', { query, userId, organizationId });

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

      // Filter memories by query (case-insensitive text matching on key and value)
      const queryLower = query.toLowerCase();
      const relevantMemories = userMemories.filter(mem => {
        const keyMatch = mem.key.toLowerCase().includes(queryLower);
        const valueMatch = mem.value.toLowerCase().includes(queryLower);
        return keyMatch || valueMatch;
      });

      // Format results
      if (relevantMemories.length === 0) {
        return `No memories found matching "${query}".`;
      }

      let result = `Found ${relevantMemories.length} relevant memories:\n\n`;
      relevantMemories.forEach(mem => {
        result += `- ${mem.key}: ${mem.value}\n`;
      });

      console.info('Memory query completed', { matchCount: relevantMemories.length });
      return result;

    } catch (error) {
      console.error('Failed to query memories', { error });
      return `Error querying memories: ${error instanceof Error ? error.message : String(error)}`;
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
