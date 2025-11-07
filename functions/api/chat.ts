import { streamText } from 'ai';
import { getModel, MODELS } from '../../src/lib/ai-providers';
import { requireAuth } from '../../server/middleware/auth';
import type { Env } from '../../worker';

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}) {
  // Check authentication
  const authResponse = await requireAuth({
    req: context.request,
    env: context.env,
    json: (data: any, status?: number) => new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }),
    set: () => {},
  } as any);

  if (authResponse) return authResponse;

  try {
    const { messages, model = MODELS.GPT_4O, conversationId } = await context.request.json();

    // Get the AI model (supports GPT-4o, Claude, Grok)
    const aiModel = getModel({
      ANTHROPIC_API_KEY: context.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: context.env.OPENAI_API_KEY,
      XAI_API_KEY: context.env.XAI_API_KEY,
    }, model);

    // Generate response
    const result = await streamText({
      model: aiModel,
      messages,
      temperature: 0.7,
      maxTokens: 2048,
      onFinish: async ({ text, usage }) => {
        // Store message in D1 if conversationId is provided
        if (conversationId) {
          try {
            await context.env.DB.prepare(
              `INSERT INTO messages (id, conversation_id, role, content, model, tokens_used) 
               VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              crypto.randomUUID(),
              conversationId,
              'assistant',
              text,
              model,
              usage?.totalTokens || 0
            ).run();
            
            // Update conversation
            await context.env.DB.prepare(
              `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`
            ).bind(conversationId).run();
          } catch (error) {
            console.error('Failed to store message:', error);
          }
        }
      },
    });
    
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process chat request' 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}