import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initSchema } from './db/database.js';
import { authenticateUser } from './middleware/auth.js';
import { uploadsDir } from './middleware/upload.js';
import { errorHandler, jsonSyntaxErrorHandler, spaFallback } from './middleware/errorHandler.js';
import { mutationRateLimiter } from './middleware/rateLimit.js';
import { requestLogger, logger } from './utils/logger.js';
import healthRoutes from './routes/healthRoutes.js';
import gifRoutes from './routes/gifRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import gameRoutes from './routes/gameRoutes.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import hallOfFameRoutes from './routes/hallOfFameRoutes.js';
import leaderRoutes from './routes/leaderRoutes.js';
import notificationRoutes from './routes/notifications.js';
import activityRoutes from './routes/activity.js';
import messageRoutes from './routes/messageRoutes.js';
import announcementRoutes from './routes/announcementRoutes.js';
import streamRoutes from './routes/streamRoutes.js';
import progressionRoutes from './routes/progressionRoutes.js';
import forumRoutes from './routes/forumRoutes.js';
import cohortRoutes from './routes/cohortRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import profileRoutes, { publicProfileRouter } from './routes/profileRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import { seedProgression } from './db/seedProgression.js';
import { TaskModel } from './models/Task.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB Schema
initSchema();

// Badges and achievements are reference data, not user data — seed them on
// every boot so new definitions appear without a manual migration step.
try {
  seedProgression();
} catch (err) {
  logger.error('Reference-data seed failed', { error: err.message });
}

export const app = express();

app.use(requestLogger);
app.use(cors());
app.use(express.json());
app.use(jsonSyntaxErrorHandler);

app.use(healthRoutes);
app.use(publicProfileRouter);

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));

// Authenticate user for all incoming requests
app.use(authenticateUser);

// Throttle every mutation. Auth keeps its own tighter limiter; this catches
// voting, posting, submitting and everything else that was unbounded.
app.use('/api', mutationRateLimiter);

// Mount API Routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', taskRoutes);
app.use('/api', teamRoutes);
app.use('/api', hallOfFameRoutes);
app.use('/api', leaderRoutes);
app.use('/api', notificationRoutes);
app.use('/api', activityRoutes);
app.use('/api', messageRoutes);
app.use('/api', announcementRoutes);
app.use('/api', streamRoutes);
app.use('/api', progressionRoutes);
app.use('/api', forumRoutes);
app.use('/api', cohortRoutes);
app.use('/api', reviewRoutes);
app.use('/api', profileRoutes);
app.use('/api', searchRoutes);
app.use('/api', leaderboardRoutes);
app.use('/api', gameRoutes);
app.use('/api/gifs', gifRoutes);

// Auto-seed initial demo tasks/teams if database is empty (disabled during test runs)
const isTestEnvironment = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));
if (!isTestEnvironment) {
  try {
    const tasksGrouped = TaskModel.getAllGrouped();
    const totalCount = tasksGrouped.teamTasks.length + tasksGrouped.challenges.length + tasksGrouped.marketplace.length;
    if (totalCount === 0) {
      import('./db/seed.js').then(m => m.seedDatabase()).catch(console.error);
    }
  } catch (e) {
    // Ignore seed check errors
  }
}

// Error handling & SPA Fallback
app.use(errorHandler);
app.get('*', spaFallback(publicDir));
