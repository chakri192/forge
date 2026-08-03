// Appearance: pick a built-in theme, or set three custom accent colours.
import {
  PRESETS, applyTheme, saveTheme, resetAccents, getPreset, getAccents,
  contrastRatio, readableOn, readableFill, textOn
} from '../services/themes.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/dom.js';

const ACCENT_ROLES = [
  { key: 'primary', label: 'Primary', hint: 'Buttons and active states' },
  { key: 'secondary', label: 'Secondary', hint: 'Highlights and progress' },
  { key: 'tertiary', label: 'Tertiary', hint: 'Decorative marks' }
];

export function renderAppearanceView(state) {
  if (!state.currentUser) {
    return `<div class="empty"><p class="empty__text">Sign in to change your appearance settings.</p></div>`;
  }

  const preset = getPreset();
  const accents = getAccents() || {};
  const active = PRESETS[preset];

  return `
    <div class="page__inner">
      <header class="page__head">
        <div>
          <h1 class="title">Appearance</h1>
          <p class="subtitle">Pick a theme, then tune the accent colours to taste. Changes apply instantly and only affect you.</p>
        </div>
        <button class="btn btn--subtle" id="btnResetAccents">Reset accents</button>
      </header>

      <section class="section">
        <span class="eyebrow" style="margin-bottom:var(--sp-3)">Theme</span>
        <div class="grid grid--2" id="presetGrid">
          ${Object.entries(PRESETS).map(([id, t]) => presetCard(id, t, id === preset)).join('')}
        </div>
      </section>

      <section class="section">
        <span class="eyebrow" style="margin-bottom:var(--sp-3)">Accent colours</span>
        <p class="text-muted" style="margin-bottom:var(--sp-4);max-width:60ch">
          Each accent does two jobs: it fills buttons and it prints as text. Both
          are checked against <strong>${escapeHtml(active.label)}</strong> and
          nudged if they fall short of WCAG AA, so a colour you like never turns
          into a label nobody can read.
        </p>
        <div class="grid grid--3">
          ${ACCENT_ROLES.map((role) => accentField(role, accents, active)).join('')}
        </div>
        <div id="contrastReport" style="margin-top:var(--sp-5)"></div>
      </section>

      <section class="section">
        <span class="eyebrow" style="margin-bottom:var(--sp-3)">Preview</span>
        <div class="panel">
          <div class="row row--wrap" style="margin-bottom:var(--sp-4)">
            <button class="btn btn--primary" type="button">Primary action</button>
            <button class="btn" type="button">Secondary</button>
            <button class="btn btn--ghost" type="button">Ghost</button>
            <span class="chip chip--accent">Accent chip</span>
            <span class="chip chip--success">Success</span>
            <span class="chip chip--warning">Warning</span>
          </div>
          <p style="margin-bottom:var(--sp-2)">
            Body text with an <a href="#/appearance" onclick="return false">inline link</a> to check readability.
          </p>
          <div class="meter" style="margin-top:var(--sp-3)"><div class="meter__fill" style="width:62%"></div></div>
        </div>
      </section>
    </div>`;
}

function presetCard(id, theme, isActive) {
  return `
    <button class="panel" data-preset="${id}" style="text-align:left;cursor:pointer;${
      isActive ? 'border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-wash, rgba(127,127,200,.18))' : ''
    }">
      <span class="row" style="margin-bottom:var(--sp-3)">
        ${theme.swatch.map((c) => `<span style="width:22px;height:22px;border-radius:6px;background:${c};border:1px solid rgba(127,127,140,.35)"></span>`).join('')}
        <span class="spacer"></span>
        ${isActive ? '<span class="chip chip--accent">Active</span>' : ''}
      </span>
      <strong style="display:block">${escapeHtml(theme.label)}</strong>
      <span class="text-muted" style="font-size:.8125rem">${escapeHtml(theme.description)}</span>
    </button>`;
}

function accentField(role, accents, theme) {
  const value = accents[role.key] || theme.accent;
  return `
    <div class="field">
      <label class="field__label" for="accent_${role.key}">${role.label}</label>
      <div class="row row--tight">
        <input type="color" id="accent_${role.key}" value="${value}" data-role="${role.key}"
          style="width:52px;height:40px;padding:2px;border:1px solid var(--line, #ccc);border-radius:var(--r-md, 8px);background:none;cursor:pointer" />
        <input class="input mono" id="accentHex_${role.key}" value="${value}" maxlength="7"
          data-role="${role.key}" aria-label="${role.label} hex value" />
      </div>
      <span class="field__hint">${role.hint}</span>
    </div>`;
}

export function attachAppearanceEvents(state) {
  if (!state.currentUser) return;

  const readAccents = () => ({
    primary: document.getElementById('accent_primary').value,
    secondary: document.getElementById('accent_secondary').value,
    tertiary: document.getElementById('accent_tertiary').value
  });

  function refreshContrastReport() {
    const report = document.getElementById('contrastReport');
    if (!report) return;
    const theme = PRESETS[getPreset()];
    const bg = theme.vars['--bg'];
    const accents = readAccents();

    report.innerHTML = `
      <div class="panel panel--sunken">
        <span class="eyebrow" style="margin-bottom:var(--sp-2)">Readability</span>
        <p class="text-muted" style="font-size:.8125rem;margin-bottom:var(--sp-3)">
          Two separate checks: the accent used as text on the page, and a button
          label sitting on the accent. Either can be adjusted independently.
        </p>
        ${ACCENT_ROLES.map((role) => {
          const chosen = accents[role.key];
          const asText = readableOn(chosen, bg);
          const fill = readableFill(chosen);
          const label = textOn(fill);
          const textAdjusted = asText.toLowerCase() !== chosen.toLowerCase();
          const fillAdjusted = fill.toLowerCase() !== chosen.toLowerCase();
          return `
            <div class="row row--wrap" style="padding:var(--sp-2) 0;border-top:1px solid var(--line-faint)">
              <span style="width:96px;font-weight:600">${role.label}</span>
              <span style="color:${asText};font-weight:650">As text</span>
              <span class="chip ${textAdjusted ? 'chip--warning' : 'chip--success'}">
                <span class="mono">${contrastRatio(asText, bg).toFixed(2)}:1</span>${textAdjusted ? ' adjusted' : ''}
              </span>
              <span class="spacer"></span>
              <span style="background:${fill};color:${label};padding:.25rem .7rem;border-radius:var(--r-md,8px);font-weight:650;font-size:.8125rem">
                As a button
              </span>
              <span class="chip ${fillAdjusted ? 'chip--warning' : 'chip--success'}">
                <span class="mono">${contrastRatio(label, fill).toFixed(2)}:1</span>${fillAdjusted ? ' adjusted' : ''}
              </span>
            </div>`;
        }).join('')}
      </div>`;
  }

  // Live preview on every change; persistence only on release so dragging a
  // colour picker does not write to storage on every frame.
  for (const role of ACCENT_ROLES) {
    const picker = document.getElementById(`accent_${role.key}`);
    const hex = document.getElementById(`accentHex_${role.key}`);

    picker.addEventListener('input', () => {
      hex.value = picker.value;
      applyTheme({ accents: readAccents() });
      refreshContrastReport();
    });
    picker.addEventListener('change', () => {
      saveTheme({ accents: readAccents() });
      showToast({ title: 'Accents updated', type: 'success' });
    });

    hex.addEventListener('input', () => {
      const value = hex.value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(value)) return;
      picker.value = value;
      applyTheme({ accents: readAccents() });
      refreshContrastReport();
    });
    hex.addEventListener('blur', () => {
      if (!/^#[0-9a-f]{6}$/i.test(hex.value.trim())) {
        hex.value = picker.value;
        return;
      }
      saveTheme({ accents: readAccents() });
    });
  }

  document.querySelectorAll('[data-preset]').forEach((card) => {
    card.addEventListener('click', () => {
      saveTheme({ preset: card.dataset.preset });
      showToast({ title: `${PRESETS[card.dataset.preset].label} applied`, type: 'success' });
      // Re-render so swatches, active state and the report match the new theme.
      const main = document.getElementById('appView');
      main.innerHTML = renderAppearanceView(state);
      attachAppearanceEvents(state);
    });
  });

  document.getElementById('btnResetAccents').addEventListener('click', () => {
    resetAccents();
    showToast({ title: 'Accents reset', message: 'Back to the theme defaults.', type: 'info' });
    const main = document.getElementById('appView');
    main.innerHTML = renderAppearanceView(state);
    attachAppearanceEvents(state);
  });

  refreshContrastReport();
}
