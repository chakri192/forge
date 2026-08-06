// Emoji catalogue for the picker.
//
// The server's allowlist in models/Reaction.js is the authority — it decides
// what may be stored. This file adds what a picker needs and the server does
// not care about: grouping and search keywords. A test asserts the two stay in
// step, so drift fails the build rather than silently offering a reaction the
// server would reject.

/** @type {Array<{group: string, emoji: string, keywords: string[]}>} */
export const EMOJI = [
  // Reactions — what people reach for on a message.
  { group: 'Reactions', emoji: '👍', keywords: ['thumbs up', 'yes', 'agree', 'ok', 'good'] },
  { group: 'Reactions', emoji: '👎', keywords: ['thumbs down', 'no', 'disagree', 'bad'] },
  { group: 'Reactions', emoji: '❤️', keywords: ['heart', 'love', 'like'] },
  { group: 'Reactions', emoji: '🔥', keywords: ['fire', 'hot', 'lit', 'great'] },
  { group: 'Reactions', emoji: '🎉', keywords: ['party', 'celebrate', 'congrats', 'shipped'] },
  { group: 'Reactions', emoji: '👀', keywords: ['eyes', 'looking', 'watching', 'interesting'] },
  { group: 'Reactions', emoji: '✅', keywords: ['check', 'done', 'complete', 'tick'] },
  { group: 'Reactions', emoji: '❌', keywords: ['cross', 'no', 'wrong', 'failed'] },
  { group: 'Reactions', emoji: '💯', keywords: ['hundred', 'perfect', 'full marks'] },
  { group: 'Reactions', emoji: '🙏', keywords: ['thanks', 'please', 'grateful'] },
  { group: 'Reactions', emoji: '🤝', keywords: ['handshake', 'deal', 'agree', 'teamwork'] },
  { group: 'Reactions', emoji: '👏', keywords: ['clap', 'applause', 'well done', 'bravo'] },

  // Faces
  { group: 'Faces', emoji: '😄', keywords: ['smile', 'happy', 'grin'] },
  { group: 'Faces', emoji: '😂', keywords: ['laugh', 'lol', 'crying laughing', 'funny'] },
  { group: 'Faces', emoji: '🙂', keywords: ['slight smile', 'fine', 'ok'] },
  { group: 'Faces', emoji: '😉', keywords: ['wink'] },
  { group: 'Faces', emoji: '😍', keywords: ['heart eyes', 'love', 'adore'] },
  { group: 'Faces', emoji: '🤔', keywords: ['thinking', 'hmm', 'consider', 'unsure'] },
  { group: 'Faces', emoji: '😅', keywords: ['sweat smile', 'phew', 'nervous', 'close call'] },
  { group: 'Faces', emoji: '😬', keywords: ['grimace', 'awkward', 'yikes'] },
  { group: 'Faces', emoji: '😮', keywords: ['wow', 'surprised', 'shocked'] },
  { group: 'Faces', emoji: '😢', keywords: ['sad', 'cry', 'tear', 'upset'] },
  { group: 'Faces', emoji: '😴', keywords: ['sleep', 'tired', 'zzz', 'bored'] },
  { group: 'Faces', emoji: '🤯', keywords: ['mind blown', 'exploding head', 'wow'] },
  { group: 'Faces', emoji: '🥳', keywords: ['party face', 'celebrate', 'birthday'] },
  { group: 'Faces', emoji: '😎', keywords: ['cool', 'sunglasses', 'smooth'] },
  { group: 'Faces', emoji: '🙃', keywords: ['upside down', 'irony', 'sarcasm'] },

  // Work — the vocabulary of a build community.
  { group: 'Work', emoji: '🚀', keywords: ['rocket', 'ship', 'launch', 'deploy', 'fast'] },
  { group: 'Work', emoji: '💡', keywords: ['idea', 'lightbulb', 'suggestion', 'insight'] },
  { group: 'Work', emoji: '🐛', keywords: ['bug', 'defect', 'issue', 'broken'] },
  { group: 'Work', emoji: '🛠️', keywords: ['tools', 'fix', 'build', 'wip'] },
  { group: 'Work', emoji: '📌', keywords: ['pin', 'important', 'sticky'] },
  { group: 'Work', emoji: '📝', keywords: ['note', 'write', 'memo', 'docs'] },
  { group: 'Work', emoji: '📚', keywords: ['books', 'study', 'learn', 'reading'] },
  { group: 'Work', emoji: '⏰', keywords: ['clock', 'deadline', 'time', 'reminder'] },
  { group: 'Work', emoji: '⚡', keywords: ['fast', 'quick', 'energy', 'zap'] },
  { group: 'Work', emoji: '🧠', keywords: ['brain', 'smart', 'clever', 'think'] },
  { group: 'Work', emoji: '🎯', keywords: ['target', 'goal', 'bullseye', 'focus'] },
  { group: 'Work', emoji: '🧪', keywords: ['test', 'experiment', 'lab', 'trying'] },
  { group: 'Work', emoji: '🔍', keywords: ['search', 'find', 'investigate', 'review'] },

  // Status
  { group: 'Status', emoji: '🟢', keywords: ['green', 'go', 'online', 'good'] },
  { group: 'Status', emoji: '🟡', keywords: ['yellow', 'warning', 'caution', 'waiting'] },
  { group: 'Status', emoji: '🔴', keywords: ['red', 'stop', 'blocked', 'urgent'] },
  { group: 'Status', emoji: '⚠️', keywords: ['warning', 'careful', 'caution'] },
  { group: 'Status', emoji: '🚧', keywords: ['roadblock', 'wip', 'under construction'] },
  { group: 'Status', emoji: '🆘', keywords: ['help', 'sos', 'stuck', 'urgent'] },
  { group: 'Status', emoji: '🔒', keywords: ['lock', 'private', 'secure', 'closed'] },
  { group: 'Status', emoji: '🏁', keywords: ['finish', 'done', 'complete', 'flag'] },

  // Things
  { group: 'Things', emoji: '☕', keywords: ['coffee', 'break', 'tea'] },
  { group: 'Things', emoji: '🍕', keywords: ['pizza', 'food', 'lunch'] },
  { group: 'Things', emoji: '🎮', keywords: ['game', 'play', 'controller'] },
  { group: 'Things', emoji: '🎵', keywords: ['music', 'song', 'note'] },
  { group: 'Things', emoji: '🌱', keywords: ['plant', 'growth', 'new', 'seedling'] },
  { group: 'Things', emoji: '⭐', keywords: ['star', 'favourite', 'great'] },
  { group: 'Things', emoji: '🏆', keywords: ['trophy', 'win', 'first', 'champion'] },
  { group: 'Things', emoji: '🎁', keywords: ['gift', 'present', 'reward'] }
];

/** The flat allowlist the picker offers; must match the server's. */
export const ALLOWED_EMOJI = EMOJI.map((e) => e.emoji);

export const EMOJI_GROUPS = [...new Set(EMOJI.map((e) => e.group))];

/** Substring match over the emoji itself, its keywords and its group. */
export function searchEmoji(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return EMOJI;
  return EMOJI.filter(
    (e) => e.emoji === q || e.keywords.some((k) => k.includes(q)) || e.group.toLowerCase().startsWith(q)
  );
}

/* --- recently used ------------------------------------------------------- */

const RECENT_KEY = 'forge_recent_emoji';
const RECENT_MAX = 16;

export function recentEmoji() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY));
    // Filtered against the current list, so a retired emoji cannot linger and
    // be offered after the server would refuse it.
    return Array.isArray(stored) ? stored.filter((e) => ALLOWED_EMOJI.includes(e)) : [];
  } catch (_) {
    return [];
  }
}

export function rememberEmoji(emoji) {
  if (!ALLOWED_EMOJI.includes(emoji)) return;
  const next = [emoji, ...recentEmoji().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (_) {}
}

/* --- GIF ----------------------------------------------------------------- */

/** Shown before anyone types, so the picker is never an empty box. */
export const GIF_CATEGORIES = [
  'celebrate', 'thumbs up', 'shipped it', 'thinking',
  'nice work', 'oops', 'lets go', 'deadline',
  'high five', 'facepalm', 'applause', 'mind blown'
];

const GIF_RECENT_KEY = 'forge_recent_gifs';
const GIF_RECENT_MAX = 8;

export function recentGifs() {
  try {
    const stored = JSON.parse(localStorage.getItem(GIF_RECENT_KEY));
    return Array.isArray(stored) ? stored.slice(0, GIF_RECENT_MAX) : [];
  } catch (_) {
    return [];
  }
}

export function rememberGif(gif) {
  if (!gif?.url) return;
  const next = [gif, ...recentGifs().filter((g) => g.url !== gif.url)].slice(0, GIF_RECENT_MAX);
  try {
    localStorage.setItem(GIF_RECENT_KEY, JSON.stringify(next));
  } catch (_) {}
}
