// Import and export the Hono app directly
import app, { AIChatWebSocket, VoiceAIWebSocket, UserSysDO, Chat } from './src/server/index';

export default app;
export { AIChatWebSocket, VoiceAIWebSocket, UserSysDO, Chat };
// Debug: Force reload to fix TTS base64 audio handling
