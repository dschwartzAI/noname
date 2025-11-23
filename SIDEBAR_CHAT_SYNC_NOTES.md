Sidebar Chat Sync Fix
=====================

Context
-------
- New chats were not appearing/selected in the sidebar until an artifact completed. The URL sometimes stayed on `?new=…`, so the sidebar could not highlight the active conversation.
- Backend save logic wrote to the `database/schema` tables while the API/read side uses `better-auth-schema`, so new conversations were invisible to the sidebar query.

Backend Changes (src/server/agents/chat-agent.ts)
-------------------------------------------------
- Persist conversations/messages into `authSchema.conversation` and `authSchema.message` (same tables the `/api/v1/chat` list/read routes use).
- Upsert conversation with the agent/tool id and model, generating an id if missing so the frontend can reuse it.
- Wrapped the AI stream `onFinish` to always call `saveConversationToDatabase` before returning, ensuring persistence runs after each exchange.

Frontend Changes (src/routes/_authenticated/ai-chat/index.tsx)
--------------------------------------------------------------
- If no `conversationId` is in the URL, immediately push the generated id (`effectiveConversationId`) so the sidebar can highlight the active chat.
- Added a post-stream effect: when loading/streaming ends and at least one message exists, call `invalidateConversations()` so the sidebar list refreshes after every message, not only artifacts.

Usage/Testing Notes
-------------------
- Start a new chat via the tool selector, send a message, and the sidebar should immediately show and select the conversation with the correct agent icon.
- Legacy conversations still load because reads remain unchanged; only the save target was aligned.***
