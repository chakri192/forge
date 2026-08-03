// Server-Sent Events transport. Holds open response streams per user and
// pushes JSON payloads ({ type: 'message' | 'notification' | 'vote', ... }).
const clients = new Map();

export function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

export function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
}

export function publish(userIds, event) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const userId of new Set(ids)) {
    for (const res of clients.get(userId) || []) {
      res.write(payload);
    }
  }
}

export function publishAll(event) {
  publish([...clients.keys()], event);
}

export function connectedUserIds() {
  return [...clients.keys()];
}
