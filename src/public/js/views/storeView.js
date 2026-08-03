// Cosmetics store. Points buy things here; XP never does.
import { fetchStore, buyCosmetic, equipCosmetic } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';

const SAFE_COLOUR = /^#[0-9a-f]{6}$/i;

export function renderStoreView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to visit the store.</p></div>`;
  }
  return `
    <div class="page__inner">
      <header class="page__head">
        <div>
          <h1 class="title">Store</h1>
          <p class="subtitle">
            Spend points on how you look. XP is your standing and is never spent.
          </p>
        </div>
      </header>
      <div id="storeRoot">${renderSkeleton('card', { className: '' })}</div>
    </div>`;
}

export function attachStoreEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('storeRoot');

  async function load() {
    try {
      paint(await fetchStore());
    } catch (_) {
      root.innerHTML = `<div class="empty"><p class="empty__text">The store could not be loaded.</p></div>`;
    }
  }

  function paint(data) {
    const byKind = data.kinds
      .map((kind) => {
        const items = data.items.filter((i) => i.kind === kind.id);
        if (!items.length) return '';
        return `
          <section class="section">
            <h2 class="section__title">${escapeHtml(kind.label)}</h2>
            <p class="section__sub">${escapeHtml(kind.blurb)}</p>
            <div class="store-grid">${items.map(itemHtml).join('')}</div>
          </section>`;
      })
      .join('');

    root.innerHTML = `
      <div class="wallet">
        <div class="wallet__row">
          <span class="wallet__label">Points to spend</span>
          <strong class="wallet__value">${data.balance.toLocaleString()}</strong>
        </div>
        <p class="wallet__hint">
          ${
            data.earned
              ? `${data.earned.toLocaleString()} earned in total. Points come from completing challenges.`
              : 'Complete a challenge to earn your first points.'
          }
        </p>
      </div>
      ${byKind}`;

    root.querySelectorAll('[data-buy]').forEach((btn) =>
      btn.addEventListener('click', () => buy(btn.dataset.buy, btn))
    );
    root.querySelectorAll('[data-equip]').forEach((btn) =>
      btn.addEventListener('click', () => equip(btn.dataset.equip, btn.dataset.on === 'true'))
    );
  }

  function itemHtml(item) {
    // The colour came from the database, so it is checked again here before it
    // is ever written into a style attribute.
    const swatch = SAFE_COLOUR.test(item.value) ? item.value : 'transparent';
    return `
      <article class="store-item ${item.equipped ? 'is-equipped' : ''}">
        <span class="store-item__preview store-item__preview--${item.kind}"
          style="--cosmetic:${swatch}" aria-hidden="true">
          ${item.kind === 'title' ? `<span style="color:${swatch}">${escapeHtml(item.name)}</span>` : ''}
        </span>
        <span class="store-item__body">
          <strong class="store-item__name">${escapeHtml(item.name)}</strong>
          <span class="store-item__desc">${escapeHtml(item.description || '')}</span>
        </span>
        <span class="store-item__foot">
          ${
            item.owned
              ? `<button class="btn btn--sm ${item.equipped ? '' : 'btn--primary'}"
                   data-equip="${item.id}" data-on="${!item.equipped}">
                   ${item.equipped ? 'Remove' : 'Wear'}
                 </button>`
              : `<span class="store-item__cost ${item.affordable ? '' : 'is-short'}">
                   ${item.cost.toLocaleString()} pts
                 </span>
                 <button class="btn btn--sm btn--primary" data-buy="${item.id}"
                   ${item.affordable ? '' : 'disabled'}>
                   ${item.affordable ? 'Buy' : 'Too pricey'}
                 </button>`
          }
        </span>
      </article>`;
  }

  async function buy(id, btn) {
    btn.disabled = true;
    try {
      const res = await buyCosmetic(id);
      showToast({ title: 'Bought', message: `${res.balance.toLocaleString()} points left.`, type: 'success' });
      load();
    } catch (_) {
      btn.disabled = false;
    }
  }

  async function equip(id, on) {
    try {
      await equipCosmetic(id, on);
      load();
    } catch (_) {}
  }

  load();
}
