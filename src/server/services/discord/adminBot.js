import { createBot, INTENTS } from './botClient.js';

/** Posts for admin, teacher and leader roles. Holds ManageMessages, so it pins. */
export const adminBot = createBot({
  name: 'Admin Bot',
  key: 'admin',
  intents: INTENTS.poster
});
