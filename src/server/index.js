import path from 'path';
import { fileURLToPath } from 'url';
import { app } from './app.js';
import { attachChatSocket, closeChatSocket } from './services/discord/chatSocket.js';
import { startDiscordBridge, stopDiscordBridge } from './services/discord/index.js';

const __filename = fileURLToPath(import.meta.url);
const PORT = process.env.PORT || 3001;

let serverInstance = null;

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    serverInstance = app.listen(port, async () => {
      console.log(`⚡ Forge Server running on http://localhost:${port}`);
      // Socket.io shares the HTTP server rather than taking a second port.
      attachChatSocket(serverInstance);
      // The bridge is optional; a missing token logs and moves on.
      await startDiscordBridge();
      resolve(serverInstance);
    });
  });
}

export async function stopServer() {
  closeChatSocket();
  await stopDiscordBridge();
  if (serverInstance) serverInstance.close();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (process.env.NODE_ENV !== 'test' && isMain) {
  startServer(PORT);
}
