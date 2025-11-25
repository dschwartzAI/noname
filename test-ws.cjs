const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8788/agents/chat/test-memory-query?agentId=agent_HeZLWxIhjy7XaXmzUyNmD&userId=RbQBtdGE6d1bEDQGEw3eKPQRyHAHyyvr&organizationId=soloos-org-id-2025&model=gpt-4o');

ws.on('open', function open() {
  console.log('✅ WebSocket connected');
  
  const message = {
    type: 'cf_agent_use_chat_request',
    init: {
      method: 'POST',
      body: JSON.stringify({
        messages: [{
          id: 'test-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: "What's my birthday?" }],
          metadata: {
            createdAt: new Date().toISOString(),
            userId: 'RbQBtdGE6d1bEDQGEw3eKPQRyHAHyyvr',
            organizationId: 'soloos-org-id-2025',
            agentId: 'agent_HeZLWxIhjy7XaXmzUyNmD',
            conversationId: 'test-memory-query',
            model: 'gpt-4o'
          }
        }]
      })
    }
  };
  
  console.log('📤 Sending message...');
  ws.send(JSON.stringify(message));
});

let msgCount = 0;
ws.on('message', function message(data) {
  msgCount++;
  const msg = data.toString();
  try {
    const json = JSON.parse(msg);
    if (json.type === 'cf_agent_use_chat_response' && json.body) {
      try {
        const body = JSON.parse(json.body);
        const preview = body.delta || body.toolName || body.toolCallId || '';
        console.log(`📥 [${msgCount}] ${body.type}${preview ? ': ' + String(preview).substring(0, 40) : ''}`);
      } catch {
        console.log(`📥 [${msgCount}] Body: ${json.body.substring(0, 60)}`);
      }
    } else {
      console.log(`📥 [${msgCount}] ${json.type || 'unknown'}`);
    }
  } catch (e) {
    console.log(`📥 [${msgCount}] Raw: ${msg.substring(0, 60)}`);
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket closed after', msgCount, 'messages');
  process.exit(0);
});

setTimeout(() => {
  console.log('⏰ Timeout - closing');
  ws.close();
}, 45000);
