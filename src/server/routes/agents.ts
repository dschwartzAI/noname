/**
 * Agents API Routes - Tool/Agent Management
 *
 * Handles tool/agent CRUD operations for organization-specific AI assistants:
 * - List organization's tools (for tool selector)
 * - Create/update/delete tools (Owner only)
 * - Multi-tenant isolation via organizations
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { requireAuth } from '../middleware/auth'
import { injectOrganization } from '../middleware/organization'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, and, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import * as schema from '../../../database/schema'

// Types
type Env = {
  DATABASE_URL: string
}

type Variables = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
    isGod: boolean
  }
  organizationId?: string
  organizationRole?: string
}

const agentsApp = new Hono<{ Bindings: Env; Variables: Variables }>()

// Debug logging
agentsApp.use('*', async (c, next) => {
  console.log('🔍 Agents route hit:', c.req.method, c.req.path)
  await next()
})

// Apply auth middleware to all routes
agentsApp.use('*', requireAuth)
agentsApp.use('*', injectOrganization)

// Validation schemas
const createAgentSchema = z.object({
  name: z.string().min(1).max(100).describe('Agent name'),
  description: z.string().max(500).optional().describe('Agent description'),
  instructions: z.string().min(1).describe('System prompt/instructions for the agent'),
  icon: z.string().max(10).optional().describe('Emoji or icon identifier (legacy)'),
  avatar: z.object({
    source: z.enum(['emoji', 'url', 'upload']),
    value: z.string(),
  }).optional().describe('Agent avatar (emoji or uploaded image URL)'),

  // AI Configuration
  provider: z.enum(['openai', 'anthropic', 'xai', 'bedrock']).describe('AI provider'),
  model: z.string().min(1).describe('Model identifier (e.g., gpt-4o, claude-3-5-sonnet)'),

  // Knowledge Base (RAG)
  knowledgeBaseId: z.string().uuid().nullable().optional().describe('Knowledge base ID for RAG'),

  // Model parameters
  temperature: z.number().min(0).max(2).optional().describe('Temperature (0-2)'),
  topP: z.number().min(0).max(1).optional().describe('Top P (0-1)'),
  maxTokens: z.number().min(1).max(128000).optional().describe('Max tokens'),

  // Access control
  tier: z.enum(['free', 'pro', 'enterprise']).optional().describe('Required tier to use this tool'),
  published: z.boolean().optional().describe('Whether tool is visible to members'),

  // Artifacts configuration
  artifactsEnabled: z.boolean().optional().describe('Whether this agent can generate artifacts'),
  artifactInstructions: z.string().optional().describe('Instructions for artifact generation'),

  // Tools (for future)
  tools: z.array(z.string()).optional().describe('Tool IDs enabled for this agent'),
})

const updateAgentSchema = createAgentSchema.partial()

const agentIdSchema = z.object({
  id: z.string().describe('Agent ID'),
})

/**
 * GET /api/v1/agents - List organization's tools
 *
 * Returns all agents/tools available to the current user
 * Filters by tier if user doesn't have access
 */
agentsApp.get('/', async (c) => {
  try {
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('📋 List agents:', { userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Get all published agents for this organization
    const agents = await db.query.agents.findMany({
      where: and(
        eq(schema.agents.organizationId, organizationId),
        eq(schema.agents.published, true)
      ),
      orderBy: [desc(schema.agents.usageCount), desc(schema.agents.createdAt)],
    })

    console.log(`✅ Retrieved ${agents.length} agents`)

    return c.json({
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        avatar: agent.avatar, // Include avatar for UI display
        provider: agent.provider,
        model: agent.model,
        tier: agent.tier,
        published: agent.published,
        isSystem: agent.isSystem,
        usageCount: agent.usageCount,
        createdAt: agent.createdAt,
      })),
    })

  } catch (error) {
    console.error('❌ List agents error:', error)
    return c.json({ error: 'Failed to list agents' }, 500)
  }
})

/**
 * GET /api/v1/agents/:id - Get agent details
 *
 * Returns full agent configuration
 */
agentsApp.get('/:id', zValidator('param', agentIdSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const organizationId = c.get('organizationId')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    console.log('🔍 Get agent:', { id, userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    const agent = await db.query.agents.findFirst({
      where: and(
        eq(schema.agents.id, id),
        eq(schema.agents.organizationId, organizationId)
      ),
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    console.log('✅ Retrieved agent:', agent.name)

    return c.json({ agent })

  } catch (error) {
    console.error('❌ Get agent error:', error)
    return c.json({ error: 'Failed to get agent' }, 500)
  }
})

/**
 * POST /api/v1/agents - Create new agent
 *
 * Creates a new agent/tool (Owner only)
 */
agentsApp.post('/', zValidator('json', createAgentSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    // Check if user is owner
    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can create agents' }, 403)
    }

    console.log('➕ Create agent:', { userId: user.id, organizationId, name: data.name })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    const agentId = `agent_${nanoid()}`

    await db.insert(schema.agents).values({
      id: agentId,
      organizationId: organizationId,
      createdBy: user.id,
      name: data.name,
      description: data.description || null,
      instructions: data.instructions,
      icon: data.icon || null,
      avatar: data.avatar || null,
      provider: data.provider,
      model: data.model,
      knowledgeBaseId: data.knowledgeBaseId || null,
      parameters: {
        temperature: data.temperature ?? 0.7,
        topP: data.topP ?? 1.0,
        maxTokens: data.maxTokens ?? 4096,
      },
      artifactsEnabled: data.artifactsEnabled ?? false,
      artifactInstructions: data.artifactInstructions || null,
      tools: data.tools || [],
      tier: data.tier || 'free',
      published: data.published ?? true,
      isSystem: false,
      version: 1,
      usageCount: 0,
    })

    console.log('✅ Agent created:', agentId)

    return c.json({ id: agentId, success: true })

  } catch (error) {
    console.error('❌ Create agent error:', error)
    return c.json({ error: 'Failed to create agent' }, 500)
  }
})

/**
 * PATCH /api/v1/agents/:id - Update agent
 *
 * Updates existing agent configuration (Owner only)
 */
agentsApp.patch('/:id', zValidator('param', agentIdSchema), zValidator('json', updateAgentSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const updates = c.req.valid('json')
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    // Check if user is owner
    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can update agents' }, 403)
    }

    console.log('✏️ Update agent:', { id, userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify agent exists and belongs to this organization
    const agent = await db.query.agents.findFirst({
      where: and(
        eq(schema.agents.id, id),
        eq(schema.agents.organizationId, organizationId)
      ),
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Build update object
    const updateData: any = { updatedAt: new Date() }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.instructions !== undefined) updateData.instructions = updates.instructions
    if (updates.icon !== undefined) updateData.icon = updates.icon
    if (updates.avatar !== undefined) updateData.avatar = updates.avatar
    if (updates.provider !== undefined) updateData.provider = updates.provider
    if (updates.model !== undefined) updateData.model = updates.model
    if (updates.knowledgeBaseId !== undefined) updateData.knowledgeBaseId = updates.knowledgeBaseId
    if (updates.tier !== undefined) updateData.tier = updates.tier
    if (updates.published !== undefined) updateData.published = updates.published
    if (updates.artifactsEnabled !== undefined) updateData.artifactsEnabled = updates.artifactsEnabled
    if (updates.artifactInstructions !== undefined) updateData.artifactInstructions = updates.artifactInstructions
    if (updates.tools !== undefined) updateData.tools = updates.tools

    // Update parameters if any model params provided
    if (updates.temperature !== undefined || updates.topP !== undefined || updates.maxTokens !== undefined) {
      updateData.parameters = {
        ...agent.parameters,
        ...(updates.temperature !== undefined && { temperature: updates.temperature }),
        ...(updates.topP !== undefined && { topP: updates.topP }),
        ...(updates.maxTokens !== undefined && { maxTokens: updates.maxTokens }),
      }
    }

    // Update agent
    await db.update(schema.agents)
      .set(updateData)
      .where(eq(schema.agents.id, id))

    console.log('✅ Agent updated')

    return c.json({ success: true })

  } catch (error) {
    console.error('❌ Update agent error:', error)
    return c.json({ error: 'Failed to update agent' }, 500)
  }
})

/**
 * DELETE /api/v1/agents/:id - Delete agent
 *
 * Permanently removes an agent (Owner only)
 */
agentsApp.delete('/:id', zValidator('param', agentIdSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const organizationId = c.get('organizationId')
    const organizationRole = c.get('organizationRole')

    if (!organizationId) {
      return c.json({ error: 'No organization context' }, 403)
    }

    // Check if user is owner
    if (organizationRole !== 'owner' && !user.isGod) {
      return c.json({ error: 'Only organization owners can delete agents' }, 403)
    }

    console.log('🗑️ Delete agent:', { id, userId: user.id, organizationId })

    const sqlClient = neon(c.env.DATABASE_URL)
    const db = drizzle(sqlClient, { schema })

    // Verify agent exists and belongs to this organization
    const agent = await db.query.agents.findFirst({
      where: and(
        eq(schema.agents.id, id),
        eq(schema.agents.organizationId, organizationId)
      ),
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Delete agent
    await db.delete(schema.agents)
      .where(eq(schema.agents.id, id))

    console.log('✅ Agent deleted')

    return c.json({ success: true })

  } catch (error) {
    console.error('❌ Delete agent error:', error)
    return c.json({ error: 'Failed to delete agent' }, 500)
  }
})

export default agentsApp
