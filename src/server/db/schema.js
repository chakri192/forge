import { runMigrations } from './migrator.js';

export function initSchema(db) {
  runMigrations(db);
}
