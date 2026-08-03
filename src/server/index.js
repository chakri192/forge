import path from 'path';
import { fileURLToPath } from 'url';
import { app } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const PORT = process.env.PORT || 3001;

let serverInstance = null;

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    serverInstance = app.listen(port, () => {
      console.log(`⚡ Forge Server running on http://localhost:${port}`);
      resolve(serverInstance);
    });
  });
}

export function stopServer() {
  if (serverInstance) serverInstance.close();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (process.env.NODE_ENV !== 'test' && isMain) {
  startServer(PORT);
}
