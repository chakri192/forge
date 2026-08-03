// Appearance: choose a theme, then place one accent on a colour wheel and let
// a harmony rule derive the other two.
import {
  PRESETS, HARMONIES, applyTheme, saveTheme, resetAccents, getPreset, getHarmony,
  resolveAccents, contrastRatio, readableOn, readableFill, textOn, hexToHsl
} from '../services/themes.js';
import { createColorWheel } from '../components/colorWheel.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/dom.js';

const ROLES = [
  { key: 'primary', label: 'Primary', hint: 'Buttons, active states, links' },
  { key: 'secondary', label: 'Secondary', hint: 'Meters, highlights, charts' },
  { key: 'tertiary', label: 'Tertiary', hint: 'Avatars and decorative marks' }
];

export function renderAppearanceView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to change your appearance settings.</p></div>`;
  }

  const preset = getPreset();
  const harmony = getHarmony();
  const accents = resolveAccents();

  return `
    <div class="page__inner appearance">
      <header class="page__head">
        <div>
          <h1 class="title">Appearance</h1>
          <p class="subtitle">Only you see these changes. They apply the moment you make them.</p>
        </div>
        <button class="btn btn--subtle" id="btnResetAccents">Reset to defaults</button>
      </header>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Theme</h2>
        </div>
        <div class="theme-grid" id="presetGrid">
          ${Object.entries(PRESETS).map(([id, t]) => presetCard(id, t, id === preset)).join('')}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Accent</h2>
          <p class="section__sub">
            Drag the large handle to choose your colour. The two smaller ones follow
            the harmony rule, so the set stays balanced.
          </p>
        </div>

        <div class="accent-layout">
          <div class="accent-layout__wheel">
            <div id="wheelMount"></div>
            <label class="slider" for="lightnessRange">
              <span class="slider__label">Brightness</span>
              <input type="range" id="lightnessRange" min="22" max="78" step="1"
                value="${Math.round((hexToHsl(accents.primary) || { l: 50 }).l)}" />
            </label>
          </div>

          <div class="accent-layout__side">
            <fieldset class="harmony">
              <legend class="field__label">Harmony</legend>
              ${Object.entries(HARMONIES).map(([id, h]) => harmonyOption(id, h, id === harmony)).join('')}
            </fieldset>

            <div class="swatch-list" id="swatchList"></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Readability</h2>
          <p class="section__sub">
            Every accent has to work twice: printed as text, and as a fill behind a
            label. Both are measured against this theme and quietly corrected if
            they fall short of WCAG AA.
          </p>
        </div>
        <div id="contrastReport"></div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Preview</h2>
        </div>
        <div class="panel preview">
          <div class="preview__row">
            <button class="btn btn--primary" type="button">Primary action</button>
            <button class="btn" type="button">Secondary</button>
            <button class="btn btn--ghost" type="button">Ghost</button>
          </div>
          <div class="preview__row">
            <span class="chip chip--accent">Accent</span>
            <span class="chip chip--solid">Solid</span>
            <span class="chip chip--success">Success</span>
            <span class="chip chip--warning">Warning</span>
            <span class="chip chip--danger">Danger</span>
          </div>
          <p class="preview__text">
            Body copy at rest, with an <a href="#/appearance" onclick="return false">inline link</a>
            to check that it separates from ordinary text without shouting.
          </p>
          <div class="preview__meters">
            <div class="meter"><div class="meter__fill" style="width:72%"></div></div>
            <div class="meter"><div class="meter__fill meter__fill--2" style="width:46%"></div></div>
            <div class="meter"><div class="meter__fill meter__fill--3" style="width:28%"></div></div>
          </div>
        </div>
      </section>
    </div>`;
}

/**
 * A miniature of the actual interface, painted in the theme's own tokens.
 * Three dots told you nothing about what a theme feels like to use.
 */
function presetCard(id, theme, isActive) {
  const v = theme.vars;
  const accent = theme.accent;
  return `
    <button class="theme-card ${isActive ? 'is-active' : ''}" data-preset="${id}"
      aria-pressed="${isActive}" aria-label="${escapeHtml(theme.label)} theme">
      <span class="theme-card__mock" style="background:${v['--bg']};border-color:${v['--line']}">
        <span class="theme-card__bar" style="background:${v['--bg-elevated']};border-color:${v['--line-faint']}">
          <span class="theme-card__dot" style="background:${accent}"></span>
          <span class="theme-card__rule" style="background:${v['--text-faint']};width:34%"></span>
        </span>
        <span class="theme-card__body">
          <span class="theme-card__panel" style="background:${v['--surface-1']};border-color:${v['--line-faint']}">
            <span class="theme-card__rule" style="background:${v['--text']};width:62%"></span>
            <span class="theme-card__rule" style="background:${v['--text-faint']};width:88%"></span>
            <span class="theme-card__rule" style="background:${v['--text-faint']};width:45%"></span>
          </span>
          <span class="theme-card__btn" style="background:${accent};color:${textOn(accent)}">Aa</span>
        </span>
      </span>
      <span class="theme-card__meta">
        <span class="theme-card__name">${escapeHtml(theme.label)}${isActive ? ' <span class="theme-card__tick">Active</span>' : ''}</span>
        <span class="theme-card__desc">${escapeHtml(theme.description)}</span>
      </span>
    </button>`;
}

function harmonyOption(id, harmony, isActive) {
  return `
    <label class="harmony__option ${isActive ? 'is-active' : ''}">
      <input type="radio" name="harmony" value="${id}" ${isActive ? 'checked' : ''} />
      <span class="harmony__text">
        <span class="harmony__name">${escapeHtml(harmony.label)}</span>
        <span class="harmony__hint">${escapeHtml(harmony.hint)}</span>
      </span>
    </label>`;
}

export function attachAppearanceEvents(state) {
  if (!state.currentUser) return;

  const rerender = () => {
    const main = document.getElementById('appView');
    main.innerHTML = renderAppearanceView(state);
    attachAppearanceEvents(state);
  };

  const accents = resolveAccents();
  let live = accents;

  const wheel = createColorWheel({
    mount: document.getElementById('wheelMount'),
    accent: accents.primary,
    harmony: getHarmony(),
    lightness: (hexToHsl(accents.primary) || { l: 50 }).l,
    onChange: (set) => {
      live = set;
      applyTheme({ accents: set });
      paintSwatches(set);
      paintReport(set);
    },
    // Persist on release rather than on every frame of a drag.
    onCommit: (set) => saveTheme({ accents: set })
  });

  function paintSwatches(set) {
    const host = document.getElementById('swatchList');
    if (!host) return;
    host.innerHTML = ROLES.map(
      (role) => `
        <div class="swatch">
          <span class="swatch__chip" style="background:${set[role.key]}"></span>
          <span class="swatch__text">
            <span class="swatch__name">${role.label}</span>
            <span class="swatch__hint">${role.hint}</span>
          </span>
          <code class="swatch__hex">${set[role.key]}</code>
        </div>`
    ).join('');
  }

  function paintReport(set) {
    const host = document.getElementById('contrastReport');
    if (!host) return;
    const bg = PRESETS[getPreset()].vars['--bg'];

    host.innerHTML = `
      <div class="readout">
        ${ROLES.map((role) => {
          const chosen = set[role.key];
          const asText = readableOn(chosen, bg);
          const fill = readableFill(chosen);
          const label = textOn(fill);
          const textFixed = asText.toLowerCase() !== chosen.toLowerCase();
          const fillFixed = fill.toLowerCase() !== chosen.toLowerCase();
          return `
            <div class="readout__row">
              <span class="readout__role">${role.label}</span>
              <span class="readout__sample" style="color:${asText}">Text sample</span>
              ${badge(contrastRatio(asText, bg), textFixed)}
              <span class="readout__sample readout__sample--fill"
                style="background:${fill};color:${label}">Button</span>
              ${badge(contrastRatio(label, fill), fillFixed)}
            </div>`;
        }).join('')}
      </div>`;
  }

  function badge(ratio, adjusted) {
    return `<span class="readout__badge ${adjusted ? 'is-adjusted' : 'is-pass'}">
      ${ratio.toFixed(2)}:1${adjusted ? ' · adjusted' : ''}
    </span>`;
  }

  // Scoped to the grid: an unscoped [data-preset] also matches the root
  // element, which would turn every click in the app into a theme change.
  document.querySelectorAll('#presetGrid [data-preset]').forEach((card) => {
    card.addEventListener('click', () => {
      // A preset carries its own accent, so switching theme starts fresh
      // rather than dragging the previous theme's colour along.
      saveTheme({ preset: card.dataset.preset, accents: null });
      showToast({ title: `${PRESETS[card.dataset.preset].label}`, message: 'Theme applied.', type: 'success' });
      rerender();
    });
  });

  document.querySelectorAll('input[name="harmony"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      saveTheme({ harmony: radio.value });
      wheel.setHarmony(radio.value);
      document.querySelectorAll('.harmony__option').forEach((el) =>
        el.classList.toggle('is-active', el.contains(radio) && radio.checked)
      );
    });
  });

  const lightness = document.getElementById('lightnessRange');
  lightness.addEventListener('input', () => wheel.setLightness(Number(lightness.value)));
  lightness.addEventListener('change', () => wheel.commit());

  document.getElementById('btnResetAccents').addEventListener('click', () => {
    resetAccents();
    showToast({ title: 'Reset', message: 'Back to the theme defaults.', type: 'info' });
    rerender();
  });

  paintSwatches(live);
  paintReport(live);
}
