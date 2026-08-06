// Theme engine: built-in presets plus a three-colour custom accent set.
//
// The important part is that a user-chosen accent is never applied blindly.
// Any colour bright enough to sit behind white button text is usually too dark
// to read as text on a dark surface, and vice versa. Each accent is therefore
// split into a fill and a text variant, and the text variant is nudged until
// it clears WCAG AA against the theme's own background.

const PRESET_KEY = 'forge_theme_preset';
const ACCENT_KEY = 'forge_theme_accents';
const HARMONY_KEY = 'forge_theme_harmony';

export const PRESETS = {
  'forge-dark': {
    label: 'Forge Dark',
    description: 'The default. Deep slate with a cool blue accent.',
    swatch: ['#0d0e12', '#2f7fc4', '#6f9ff0'],
    vars: {
      '--bg': '#0d0e12', '--bg-elevated': '#121319',
      '--surface-1': 'rgba(255,255,255,.032)', '--surface-2': 'rgba(255,255,255,.055)',
      '--surface-3': 'rgba(255,255,255,.085)',
      '--line-faint': 'rgba(255,255,255,.06)', '--line': 'rgba(255,255,255,.11)',
      '--line-strong': 'rgba(255,255,255,.2)',
      '--text': '#f2f3f7', '--text-muted': '#a4a8b8', '--text-faint': '#7f8496'
    },
    accent: '#2f7fc4',
    dark: true
  },
  midnight: {
    label: 'Midnight',
    description: 'Near-black with a violet cast, for low-light rooms.',
    swatch: ['#08080c', '#6d4aff', '#a78bfa'],
    vars: {
      '--bg': '#08080c', '--bg-elevated': '#0e0e16',
      '--surface-1': 'rgba(255,255,255,.028)', '--surface-2': 'rgba(255,255,255,.05)',
      '--surface-3': 'rgba(255,255,255,.08)',
      '--line-faint': 'rgba(255,255,255,.055)', '--line': 'rgba(255,255,255,.1)',
      '--line-strong': 'rgba(255,255,255,.19)',
      '--text': '#f4f2fb', '--text-muted': '#a9a4bd', '--text-faint': '#837e99'
    },
    accent: '#6d4aff',
    dark: true
  },
  forest: {
    label: 'Forest',
    description: 'Warm charcoal with green, easier on long sessions.',
    swatch: ['#101410', '#2f8f5b', '#5fd39a'],
    vars: {
      '--bg': '#101410', '--bg-elevated': '#151b15',
      '--surface-1': 'rgba(255,255,255,.03)', '--surface-2': 'rgba(255,255,255,.055)',
      '--surface-3': 'rgba(255,255,255,.085)',
      '--line-faint': 'rgba(255,255,255,.06)', '--line': 'rgba(255,255,255,.11)',
      '--line-strong': 'rgba(255,255,255,.2)',
      '--text': '#f0f4f0', '--text-muted': '#a3b0a5', '--text-faint': '#7d8a80'
    },
    accent: '#2f8f5b',
    dark: true
  },
  editorial: {
    label: 'Editorial',
    description: 'Warm paper and ink. Typographic and quiet.',
    swatch: ['#faf8f5', '#3730a3', '#16151a'],
    vars: {
      '--bg': '#faf8f5', '--bg-elevated': '#ffffff',
      '--surface-1': '#ffffff', '--surface-2': '#f3f0eb', '--surface-3': '#efece6',
      '--line-faint': '#efeae2', '--line': '#e5e0d8', '--line-strong': '#d5cfc4',
      '--text': '#16151a', '--text-muted': '#55535e', '--text-faint': '#6b6875'
    },
    accent: '#3730a3',
    dark: false
  },
  contrast: {
    label: 'High contrast',
    description: 'Maximum separation for low-vision use.',
    swatch: ['#000000', '#ffd400', '#ffffff'],
    vars: {
      '--bg': '#000000', '--bg-elevated': '#0a0a0a',
      '--surface-1': 'rgba(255,255,255,.06)', '--surface-2': 'rgba(255,255,255,.1)',
      '--surface-3': 'rgba(255,255,255,.16)',
      '--line-faint': 'rgba(255,255,255,.25)', '--line': 'rgba(255,255,255,.45)',
      '--line-strong': 'rgba(255,255,255,.7)',
      '--text': '#ffffff', '--text-muted': '#e6e6e6', '--text-faint': '#c9c9c9'
    },
    accent: '#b58900',
    dark: true
  }
};

export const DEFAULT_PRESET = 'forge-dark';
export const DEFAULT_HARMONY = 'analogous';

/**
 * Asking someone to pick three colours that work together is asking them to do
 * the one part of this that is actually hard. So they pick one, and the other
 * two are derived by a classic harmony rule. "Custom" is the escape hatch for
 * people who do want to place all three by hand.
 */
export const HARMONIES = {
  mono: {
    label: 'Monochrome',
    hint: 'One hue, three depths. The safest choice.',
    offsets: [0, 0, 0],
    shift: [0, -14, 14]
  },
  analogous: {
    label: 'Analogous',
    hint: 'Neighbouring hues. Calm and cohesive.',
    offsets: [0, -28, 28],
    shift: [0, -6, 6]
  },
  complement: {
    label: 'Complementary',
    hint: 'Opposite hues. High contrast, more energy.',
    offsets: [0, 180, 150],
    shift: [0, -4, 10]
  },
  triad: {
    label: 'Triadic',
    hint: 'Three evenly spaced hues. Bold and playful.',
    offsets: [0, 120, 240],
    shift: [0, 0, 0]
  },
  custom: {
    label: 'Custom',
    hint: 'Place all three by hand.',
    offsets: [0, 0, 0],
    shift: [0, 0, 0]
  }
};

/* ------------------------------------------------------------ colour maths */

function hexToRgb(hex) {
  const clean = String(hex).replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance([r, g, b]) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return 1;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h, s, l) {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

/** Derive the secondary and tertiary accents from one chosen colour. */
export function deriveAccents(primary, harmony = DEFAULT_HARMONY) {
  const rule = HARMONIES[harmony] || HARMONIES[DEFAULT_HARMONY];
  const base = hexToHsl(primary);
  if (!base) return { primary, secondary: primary, tertiary: primary };
  const at = (i) => hslToHex(base.h + rule.offsets[i], base.s, base.l + rule.shift[i]);
  return { primary, secondary: at(1), tertiary: at(2) };
}

function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})` : hex;
}

function mix(hex, target, amount) {
  const c = hexToRgb(hex);
  const t = hexToRgb(target);
  if (!c || !t) return hex;
  return rgbToHex(c.map((v, i) => v + (t[i] - v) * amount));
}

/**
 * Walk an accent toward white (on dark themes) or black (on light) until it
 * clears the target ratio against the background. Returns the original colour
 * if it already passes, and gives up gracefully at the extreme.
 */
export function readableOn(accent, background, target = 4.5) {
  if (!hexToRgb(accent) || !hexToRgb(background)) return accent;
  if (contrastRatio(accent, background) >= target) return accent;

  const towardLight = relativeLuminance(hexToRgb(background)) < 0.5;
  const destination = towardLight ? '#ffffff' : '#000000';

  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(accent, destination, step / 20);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return destination;
}

/** White or near-black, whichever reads better on the given fill. */
export function textOn(fill) {
  return contrastRatio('#ffffff', fill) >= contrastRatio('#16151a', fill) ? '#ffffff' : '#16151a';
}

/**
 * A solid fill is only usable behind a button label if some text colour clears
 * AA on it, and plenty of perfectly nice mid-tones clear neither — the default
 * Forge blue #2f7fc4 manages 3.2:1 with white and 4.2:1 with black. So the fill
 * itself is nudged, keeping the hue, until its best text option passes.
 *
 * Both directions are tried and the smaller change wins, so a light accent
 * stays light and a dark one stays dark.
 */
export function readableFill(accent, target = 4.5) {
  if (!hexToRgb(accent)) return accent;
  if (contrastRatio(textOn(accent), accent) >= target) return accent;

  let darker = null;
  let lighter = null;
  for (let step = 1; step <= 20 && (!darker || !lighter); step += 1) {
    if (!darker) {
      const candidate = mix(accent, '#000000', step / 20);
      if (contrastRatio('#ffffff', candidate) >= target) darker = { candidate, step };
    }
    if (!lighter) {
      const candidate = mix(accent, '#ffffff', step / 20);
      if (contrastRatio('#16151a', candidate) >= target) lighter = { candidate, step };
    }
  }

  if (darker && lighter) return darker.step <= lighter.step ? darker.candidate : lighter.candidate;
  if (darker) return darker.candidate;
  if (lighter) return lighter.candidate;
  return accent;
}

/* ------------------------------------------------------------- application */

export function getPreset() {
  const stored = localStorage.getItem(PRESET_KEY);
  return PRESETS[stored] ? stored : DEFAULT_PRESET;
}

export function getHarmony() {
  const stored = localStorage.getItem(HARMONY_KEY);
  return HARMONIES[stored] ? stored : DEFAULT_HARMONY;
}

export function getAccents() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACCENT_KEY));
    if (stored && stored.primary) return stored;
  } catch (_) {}
  return null;
}

/**
 * The accents actually in force: a stored set if the user has one, otherwise
 * the current preset's own accent run through the active harmony.
 */
export function resolveAccents({ preset = getPreset(), harmony = getHarmony() } = {}) {
  const stored = getAccents();
  if (stored) return stored;
  const theme = PRESETS[preset] || PRESETS[DEFAULT_PRESET];
  return deriveAccents(theme.accent, harmony);
}

/**
 * Apply a preset plus optional custom accents. The three accents map to:
 *   primary   — fills: buttons, active states
 *   secondary — supporting highlights and meters
 *   tertiary  — decorative marks, avatar gradients
 */
export function applyTheme({ preset = getPreset(), accents = resolveAccents() } = {}) {
  const theme = PRESETS[preset] || PRESETS[DEFAULT_PRESET];
  const root = document.documentElement;

  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value);
  }

  // The editorial stylesheet speaks a second vocabulary (--paper / --ink /
  // --rule) and hardcodes light values in :root. Presets have to drive both
  // names or the shell keeps painting near-black ink on a dark background.
  const alias = {
    '--paper': '--bg',
    '--paper-raised': '--bg-elevated',
    '--paper-sunken': '--surface-2',
    '--paper-tint': '--surface-3',
    '--ink': '--text',
    '--ink-muted': '--text-muted',
    '--ink-faint': '--text-faint',
    '--rule': '--line',
    '--rule-strong': '--line-strong'
  };
  for (const [name, source] of Object.entries(alias)) {
    if (theme.vars[source]) root.style.setProperty(name, theme.vars[source]);
  }

  // The oldest stylesheet has its own light/dark pair keyed off a class the
  // preset system no longer sets, which left dropdowns and cards painting the
  // wrong shade. Drive those from the preset too.
  // Status colours were tuned for paper and stayed dark under every dark
  // preset. Derive them from the preset's polarity instead.
  const status = theme.dark
    ? { positive: '#4ade80', caution: '#fbbf24', critical: '#f87171', info: '#a78bfa' }
    : { positive: '#1a7f4b', caution: '#8a5a00', critical: '#b3261e', info: '#6d28d9' };
  for (const [name, value] of Object.entries(status)) {
    root.style.setProperty(`--${name}`, value);
    root.style.setProperty(`--${name}-soft`, rgba(value, theme.dark ? 0.16 : 0.12));
    root.style.setProperty(`--${name}-line`, rgba(value, theme.dark ? 0.32 : 0.28));
  }
  root.style.setProperty('--success', status.positive);
  root.style.setProperty('--warning', status.caution);
  root.style.setProperty('--danger', status.critical);
  root.style.setProperty('--success-wash', rgba(status.positive, theme.dark ? 0.16 : 0.12));
  root.style.setProperty('--warning-wash', rgba(status.caution, theme.dark ? 0.16 : 0.12));
  root.style.setProperty('--danger-wash', rgba(status.critical, theme.dark ? 0.16 : 0.12));

  root.style.setProperty('--card-bg', theme.vars['--bg-elevated']);
  root.style.setProperty('--text-main', theme.vars['--text']);
  root.style.setProperty('--border-color', theme.vars['--line']);
  root.setAttribute('data-theme', theme.dark ? 'dark' : 'light');
  root.setAttribute('data-theme-preset', preset);

  const background = theme.vars['--bg'];
  const primary = (accents && accents.primary) || theme.accent;
  const secondary = (accents && accents.secondary) || primary;
  const tertiary = (accents && accents.tertiary) || secondary;

  // Three derived values per accent, because one colour cannot do all three
  // jobs: --accent is the button fill (nudged until its label is readable),
  // --accent-on is that label, and --accent-text is the accent used as text on
  // the page background. --accent-raw preserves exactly what the user picked,
  // for swatches and decoration where contrast is irrelevant.
  const fill = readableFill(primary);
  root.style.setProperty('--accent-raw', primary);
  root.style.setProperty('--accent', fill);
  root.style.setProperty('--accent-hover', mix(fill, theme.dark ? '#ffffff' : '#000000', 0.12));
  root.style.setProperty('--accent-text', readableOn(primary, background));
  root.style.setProperty('--accent-on', textOn(fill));
  root.style.setProperty('--accent-2', readableFill(secondary));
  root.style.setProperty('--accent-2-raw', secondary);
  root.style.setProperty('--accent-2-text', readableOn(secondary, background));
  root.style.setProperty('--accent-3', readableFill(tertiary));
  root.style.setProperty('--accent-3-raw', tertiary);
  root.style.setProperty('--accent-3-text', readableOn(tertiary, background));

  // Tinted washes for chips, active rows and hover states. These are defined
  // statically in the stylesheet, so without recomputing them here a custom
  // accent would leave every "accent" surface showing the old default blue.
  root.style.setProperty('--accent-wash', rgba(fill, theme.dark ? 0.14 : 0.1));
  root.style.setProperty('--accent-line', rgba(fill, theme.dark ? 0.3 : 0.26));
  root.style.setProperty('--accent-soft', rgba(fill, theme.dark ? 0.16 : 0.12));

  // Legacy aliases still referenced by the older stylesheet.
  root.style.setProperty('--accent-color', fill);
  root.style.setProperty('--accent-1', fill);

  return { preset, accents: { primary, secondary, tertiary } };
}

export function saveTheme({ preset, accents, harmony }) {
  if (preset && PRESETS[preset]) localStorage.setItem(PRESET_KEY, preset);
  if (harmony && HARMONIES[harmony]) localStorage.setItem(HARMONY_KEY, harmony);
  if (accents) localStorage.setItem(ACCENT_KEY, JSON.stringify(accents));
  else if (accents === null) localStorage.removeItem(ACCENT_KEY);

  const nextPreset = preset || getPreset();
  return applyTheme({
    preset: nextPreset,
    accents: accents === null ? resolveAccents({ preset: nextPreset }) : accents || resolveAccents({ preset: nextPreset })
  });
}

export function resetAccents() {
  localStorage.removeItem(ACCENT_KEY);
  localStorage.removeItem(HARMONY_KEY);
  return applyTheme({ preset: getPreset(), accents: resolveAccents({ preset: getPreset() }) });
}

export function initThemes() {
  applyTheme({ preset: getPreset(), accents: resolveAccents() });
}
