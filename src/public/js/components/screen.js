// The page shell every view composes: title, one factual line, and a toolbar.
//
// Views used to invent their own header markup, which is why titles, spacing
// and action placement drifted between screens. There is one shape now.
import { escapeHtml } from '../utils/dom.js';
import { renderToolbar } from './toolbar.js';

/**
 * @param {object} config
 * @param {string} config.title
 * @param {string} [config.subtitle]  one line, factual — not a tagline
 * @param {object} [config.toolbar]   passed straight to renderToolbar
 * @param {string} config.body        the screen's own markup
 */
export function renderScreen({ title, subtitle, toolbar, body = '' }) {
  return `
    <div class="screen">
      <header class="screen__header">
        <div class="screen__heading">
          <h1 class="screen__title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="screen__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${toolbar ? renderToolbar(toolbar) : ''}
      </header>
      <div class="screen__body">${body}</div>
    </div>`;
}

/** A labelled group inside a screen body. */
export function block(label, content) {
  return `
    <section class="block">
      ${label ? `<h2 class="block__label">${escapeHtml(label)}</h2>` : ''}
      ${content}
    </section>`;
}
