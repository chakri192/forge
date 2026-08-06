// Cosmetics store. Points buy things here; XP never does.
import { fetchStore, buyCosmetic, equipCosmetic } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { renderSkeleton } from '../components/spinner.js';
import { escapeHtml } from '../utils/dom.js';
import { renderScreen } from '../components/screen.js';
import { attachToolbar } from '../components/toolbar.js';

const SAFE_COLOUR = /^#[0-9a-f]{6}$/i;

export function renderStoreView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to visit the store.</p></div>`;
  }
  return renderScreen({
    title: 'Store',
    subtitle: 'Points buy cosmetics. XP is your standing and is not spent here.',
    toolbar: {
      groups: [
        {
          actions: [
            { id: 'all', label: 'All', pressed: true },
            { id: 'owned', label: 'Owned', pressed: false }
          ]
        },
        {
          collapsible: true,
          actions: [{ id: 'refresh', label: 'Refresh', icon: 'refresh', iconOnly: true }]
        }
      ]
    },
    body: `<div id="storeRoot" class="stack">${renderSkeleton('card', { className: '' })}</div>`
  });
}

export function attachStoreEvents(state) {
  if (!state.currentUser) return;
  const root = document.getElementById('storeRoot');
  let filter = 'all';

  async function load() {
    try {
      paint(await fetchStore());
    } catch (_) {
      root.innerHTML = `<div class="empty"><p class="empty__text">The store could not be loaded.</p></div>`;
    }
  }

  function paint(data) {
    const shown = filter === 'owned' ? data.items.filter((i) => i.owned) : data.items;

    const byKind = data.kinds
      .map((kind) => {
        const items = shown.filter((i) => i.kind === kind.id);
        if (!items.length) return '';
        return `
          <section class="block">
            <h2 class="block__label">${escapeHtml(kind.label)}</h2>
            <div class="store-grid">${items.map(itemHtml).join('')}</div>
          </section>`;
      })
      .join('');

    root.innerHTML = `
      <div class="wallet">
        <div class="wallet__row">
          <span class="wallet__label">Balance</span>
          <strong class="wallet__value">${data.balance.toLocaleString()}<small> points</small></strong>
        </div>
      </div>
      ${byKind || '<p class="screen__subtitle">Nothing owned yet.</p>'}`;

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

  attachToolbar(document.querySelector('.screen__header'), {
    all: (e) => setFilter('all', e),
    owned: (e) => setFilter('owned', e),
    refresh: load
  });

  function setFilter(next, event) {
    filter = next;
    document
      .querySelectorAll('.screen__header [data-action="all"], .screen__header [data-action="owned"]')
      .forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.action === next)));
    void event;
    load();
  }

  load();
}
