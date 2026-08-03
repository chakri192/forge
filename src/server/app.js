import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initSchema } from './db/database.js';
import { authenticateUser } from './middleware/auth.js';
import { uploadsDir } from './middleware/upload.js';
import { errorHandler, jsonSyntaxErrorHandler, spaFallback } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import hallOfFameRoutes from './routes/hallOfFameRoutes.js';
import leaderRoutes from './routes/leaderRoutes.js';
import notificationRoutes from './routes/notifications.js';
import activityRoutes from './routes/activity.js';
import { TaskModel } from './models/Task.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB Schema
initSchema();

export const app = express();

app.use(cors());
app.use(express.json());
app.use(jsonSyntaxErrorHandler);

const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));

// Authenticate user for all incoming requests
app.use(authenticateUser);

// Mount API Routes
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', taskRoutes);
app.use('/api', teamRoutes);
app.use('/api', hallOfFameRoutes);
app.use('/api', leaderRoutes);
app.use('/api', notificationRoutes);
app.use('/api', activityRoutes);

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
