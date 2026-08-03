import { createBot, INTENTS } from './botClient.js';

/** Posts for members. Deliberately lower permissions: cannot pin. */
export const messengerBot = createBot({
  name: 'Messenger Bot',
  key: 'messenger',
  intents: INTENTS.poster
});
