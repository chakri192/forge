// Rendering for message bodies: links, inline images and GIFs.
//
// Everything is escaped first and only then selectively re-marked, so no user
// input can ever reach the DOM as markup.
import { escapeHtml } from './dom.js';

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;
const IMAGE_RE = /\.(gif|png|jpe?g|webp|avif)(\?[^\s]*)?$/i;

/** Trusted media hosts. Anything else renders as a plain link. */
const MEDIA_HOSTS = [
  'media.giphy.com', 'i.giphy.com', 'media0.giphy.com', 'media1.giphy.com',
  'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com',
  'media.tenor.com', 'c.tenor.com',
  'media1.tenor.com', 'media2.tenor.com', 'media3.tenor.com', 'media4.tenor.com',
  'i.imgur.com',
  'user-images.githubusercontent.com', 'raw.githubusercontent.com'
];

export function isEmbeddableMedia(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (_) {
    return false;
  }
  // https only: an http embed would downgrade the page and leak in the clear.
  if (url.protocol !== 'https:') return false;
  if (!IMAGE_RE.test(url.pathname)) return false;
  return MEDIA_HOSTS.includes(url.hostname.toLowerCase());
}

/**
 * Escape, then linkify, then pull any embeddable media out for separate
 * rendering below the text.
 *
 * @returns {{ html: string, media: string[] }}
 */
/** Matches the server's rule in utils/mentions.js. Kept in step by a test. */
const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_]{2,32})\b/g;

/**
 * @param {string} text
 * @param {string} [viewerUsername] highlights mentions of the reader differently
 */
export function renderMessageBody(text, viewerUsername = null) {
  const media = [];
  const safe = escapeHtml(text || '');

  const withMentions = safe.replace(MENTION_RE, (_match, before, name) => {
    const isYou = viewerUsername && name.toLowerCase() === String(viewerUsername).toLowerCase();
    return `${before}<span class="mention${isYou ? ' is-you' : ''}">@${name}</span>`;
  });

  const html = withMentions.replace(URL_RE, (match) => {
    // escapeHtml turned & into &amp;; undo that for the actual href.
    const href = match.replace(/&amp;/g, '&');
    if (isEmbeddableMedia(href)) {
      if (media.length < 3 && !media.includes(href)) media.push(href);
      return '';
    }
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(
      href.length > 60 ? `${href.slice(0, 57)}…` : href
    )}</a>`;
  });

  return { html: html.trim(), media };
}

/**
 * Embedded media is third-party: loading it reveals the reader's IP to that
 * host. `referrerpolicy` and lazy loading limit what leaks and when.
 */
export function mediaHtml(urls) {
  if (!urls.length) return '';
  return `<div class="msg-media">${urls
    .map(
      (u) =>
        `<img src="${escapeHtml(u)}" alt="Shared media" loading="lazy" decoding="async"
           referrerpolicy="no-referrer" class="msg-media__item" />`
    )
    .join('')}</div>`;
}
