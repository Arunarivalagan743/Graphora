import express from 'express';
import {
  uploadHandler,
  uploadStreamHandler,
  getLogsHandler,
  clearLogsHandler,
  clearNodesHandler,
  generateSchemaHandler,
  dbDiagnosticsHandler,
  healthHandler
} from '../controllers/uploadController.js';

export function createUploadRoutes() {
  const router = express.Router();

  router.post('/api/upload', uploadHandler);
  router.post('/api/upload-stream', uploadStreamHandler);
  router.get('/api/logs', getLogsHandler);
  router.post('/api/logs/clear', clearLogsHandler);
  router.post('/api/clear-nodes', clearNodesHandler);
  router.post('/api/generate-schema', generateSchemaHandler);
  router.get('/api/db-diagnostics', dbDiagnosticsHandler);
  router.get('/health', healthHandler);

  return router;
}
