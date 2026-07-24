import express from 'express';
import {
  chatHandler,
  getChatHistoryHandler,
  clearChatHistoryHandler,
  getChatStatusHandler,
  getChatInsightsHandler,
} from '../controllers/chatController.js';
import { chatRateLimiter } from '../ai/utils/rateLimiter.js';

export function createChatRoutes() {
  const router = express.Router();

  router.post('/api/chat', chatRateLimiter.middleware(), chatHandler);
  router.get('/api/chat/history', getChatHistoryHandler);
  router.delete('/api/chat', clearChatHistoryHandler);
  router.get('/api/chat/status', getChatStatusHandler);
  router.get('/api/chat/insights', getChatInsightsHandler);

  return router;
}
