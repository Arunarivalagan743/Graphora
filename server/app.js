import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUploadRoutes } from './routes/uploadRoutes.js';
import { createChatRoutes } from './routes/chatRoutes.js';
import { PORT } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(createUploadRoutes());
  app.use(createChatRoutes());

  return app;
}

export function startServer() {
  const app = createApp();
  app.listen(PORT, () => {
    console.log('=================================================');
    console.log('  Graphora Express Engine is running!');
    console.log(`  Port: ${PORT}`);
    console.log('  Endpoints:');
    console.log(`    - POST http://localhost:${PORT}/api/upload`);
    console.log(`    - POST http://localhost:${PORT}/api/chat`);
    console.log(`    - GET  http://localhost:${PORT}/api/chat/history`);
    console.log(`    - GET  http://localhost:${PORT}/api/chat/status`);
    console.log(`    - GET  http://localhost:${PORT}/api/logs`);
    console.log('=================================================');
  });
}
