// Kept in step with the server allowlist in src/server/models/Reaction.js.
// The server is the authority; this list only drives the picker UI.
export const ALLOWED_EMOJI = [
  '👍', '👎', '❤️', '🎉', '🔥', '👀', '😄', '😮', '😢', '🙏', '🚀', '💡', '✅', '🤔'
];

/** Starting points for the GIF picker when the user has not typed a query. */
export const GIF_SUGGESTIONS = [
  'celebrate', 'thumbs up', 'shipped it', 'thinking', 'nice work', 'oops', 'lets go', 'deadline'
];
