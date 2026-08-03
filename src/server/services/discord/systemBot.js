import { createBot, INTENTS } from './botClient.js';

/** Channel lifecycle only. This bot never posts on a user's behalf. */
export const systemBot = createBot({
  name: 'System Bot',
  key: 'system',
  intents: INTENTS.system
});
