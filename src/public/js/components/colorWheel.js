// An HSL colour wheel: hue around the circumference, saturation from the
// centre out. The primary handle is dragged; the two derived accents ride
// along as satellites joined to the centre, so the harmony rule is visible
// rather than something you have to take on faith.
import { hexToHsl, hslToHex, deriveAccents, HARMONIES } from '../services/themes.js';

const SIZE = 240;
const RING = 8; // padding between the wheel edge and the canvas edge

export function createColorWheel({ mount, accent, harmony, lightness, onChange, onCommit }) {
  const state = {
    hue: 0,
    sat: 70,
    lightness: lightness ?? 50,
    harmony: harmony || 'analogous',
    dragging: null
  };

  const seed = hexToHsl(accent) || { h: 210, s: 70, l: 50 };
  state.hue = seed.h;
  state.sat = seed.s;
  state.lightness = lightness ?? seed.l;

  mount.innerHTML = `
    <div class="wheel">
      <canvas class="wheel__canvas" width="${SIZE * 2}" height="${SIZE * 2}"
        style="width:${SIZE}px;height:${SIZE}px" role="application"
        aria-label="Colour wheel. Arrow keys change hue, hold Shift for saturation." tabindex="0"></canvas>
      <svg class="wheel__overlay" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" aria-hidden="true"></svg>
    </div>`;

  const canvas = mount.querySelector('.wheel__canvas');
  const overlay = mount.querySelector('.wheel__overlay');
  const ctx = canvas.getContext('2d');

  paintWheel();

  /** The wheel image only depends on lightness, so it is repainted rarely. */
  function paintWheel() {
    const px = SIZE * 2;
    const radius = px / 2 - RING * 2;
    const image = ctx.createImageData(px, px);
    const data = image.data;
    const cx = px / 2;
    const cy = px / 2;

    for (let y = 0; y < px; y += 1) {
      for (let x = 0; x < px; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const i = (y * px + x) * 4;
        if (dist > radius) continue;

        const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        const sat = Math.min(100, (dist / radius) * 100);
        const [r, g, b] = hslToRgb(hue, sat, state.lightness);
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        // Feather the outer pixel ring so the circle does not look jagged.
        data[i + 3] = dist > radius - 2 ? 255 * (radius - dist) / 2 : 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function accents() {
    const primary = hslToHex(state.hue, state.sat, state.lightness);
    return state.harmony === 'custom'
      ? { primary, secondary: state.customSecondary || primary, tertiary: state.customTertiary || primary }
      : deriveAccents(primary, state.harmony);
  }

  function positionFor(hex, primaryHex) {
    const hsl = hexToHsl(hex);
    const radius = SIZE / 2 - RING;
    const angle = ((hsl.h - 90) * Math.PI) / 180;
    let dist = (hsl.s / 100) * radius;

    // Under Monochrome the accents differ only in lightness, so all three
    // would land on the same point. Spread them along the radius, where the
    // offset reads as depth rather than as a different colour.
    if (primaryHex) {
      const base = hexToHsl(primaryHex);
      if (Math.abs(base.h - hsl.h) < 0.5 && Math.abs(base.s - hsl.s) < 0.5) {
        dist += hsl.l > base.l ? 26 : -26;
      }
    }
    dist = Math.max(6, Math.min(radius, dist));
    return { x: SIZE / 2 + Math.cos(angle) * dist, y: SIZE / 2 + Math.sin(angle) * dist };
  }

  function drawHandles() {
    const set = accents();
    const roles = ['primary', 'secondary', 'tertiary'];
    const centre = SIZE / 2;

    overlay.innerHTML = roles
      .map((role, i) => {
        const isPrimary = i === 0;
        const p = positionFor(set[role], isPrimary ? null : set.primary);
        const r = isPrimary ? 13 : 9;
        return `
          <line x1="${centre}" y1="${centre}" x2="${p.x}" y2="${p.y}"
            stroke="rgba(128,128,140,.45)" stroke-width="1" stroke-dasharray="${isPrimary ? '' : '3 3'}" />
          <circle cx="${p.x}" cy="${p.y}" r="${r + 2}" fill="rgba(0,0,0,.35)" />
          <circle class="wheel__handle" data-role="${role}" cx="${p.x}" cy="${p.y}" r="${r}"
            fill="${set[role]}" stroke="#fff" stroke-width="${isPrimary ? 3 : 2}" />`;
      })
      .join('');
  }

  function emit(commit) {
    drawHandles();
    const set = accents();
    onChange?.(set, { hue: state.hue, sat: state.sat, lightness: state.lightness });
    if (commit) onCommit?.(set);
  }

  /** Map a pointer position onto hue and saturation. */
  function pick(event, role = 'primary') {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const radius = rect.width / 2 - RING;
    const hue = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
    const sat = Math.max(0, Math.min(100, (Math.hypot(x, y) / radius) * 100));

    if (role === 'primary') {
      state.hue = hue;
      state.sat = sat;
    } else if (state.harmony === 'custom') {
      const hex = hslToHex(hue, sat, state.lightness);
      if (role === 'secondary') state.customSecondary = hex;
      else state.customTertiary = hex;
    }
  }

  overlay.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.wheel__handle');
    // Only the primary handle moves under a harmony rule; the others are
    // computed, so dragging them would silently contradict the rule.
    state.dragging = handle && state.harmony === 'custom' ? handle.dataset.role : 'primary';
    overlay.setPointerCapture(e.pointerId);
    pick(e, state.dragging);
    emit(false);
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    pick(e, state.dragging);
    emit(false);
  });

  const release = (e) => {
    if (!state.dragging) return;
    state.dragging = null;
    if (e.pointerId !== undefined && overlay.hasPointerCapture?.(e.pointerId)) {
      overlay.releasePointerCapture(e.pointerId);
    }
    emit(true);
  };
  overlay.addEventListener('pointerup', release);
  overlay.addEventListener('pointercancel', release);

  canvas.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 5 : 1;
    const moves = {
      ArrowRight: () => (state.hue = (state.hue + step * 3) % 360),
      ArrowLeft: () => (state.hue = (state.hue - step * 3 + 360) % 360),
      ArrowUp: () => (state.sat = Math.min(100, state.sat + step * 2)),
      ArrowDown: () => (state.sat = Math.max(0, state.sat - step * 2))
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    moves[e.key]();
    emit(true);
  });

  drawHandles();

  return {
    setHarmony(next) {
      state.harmony = next;
      if (next === 'custom') {
        const set = accents();
        state.customSecondary = state.customSecondary || set.secondary;
        state.customTertiary = state.customTertiary || set.tertiary;
      }
      emit(true);
    },
    setLightness(next) {
      state.lightness = next;
      paintWheel();
      emit(false);
    },
    commit() {
      emit(true);
    },
    setAccent(hex) {
      const hsl = hexToHsl(hex);
      if (!hsl) return;
      state.hue = hsl.h;
      state.sat = hsl.s;
      state.lightness = hsl.l;
      paintWheel();
      emit(true);
    },
    current: accents,
    lightness: () => state.lightness
  };
}

function hslToRgb(h, s, l) {
  const hex = hslToHex(h, s, l);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

export const HARMONY_LIST = Object.entries(HARMONIES).map(([id, h]) => ({ id, ...h }));
