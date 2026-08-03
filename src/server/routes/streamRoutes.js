import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { addClient, removeClient } from '../services/sse.js';

const HEARTBEAT_MS = 25000;

const router = express.Router();

router.get('/stream', requireAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected', userId: req.user.id })}\n\n`);
  addClient(req.user.id, res);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(req.user.id, res);
  });
});

export default router;
