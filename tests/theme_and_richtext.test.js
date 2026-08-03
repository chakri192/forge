import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio, readableOn, readableFill, textOn, PRESETS,
  HARMONIES, deriveAccents, hexToHsl, hslToHex
} from '../src/public/js/services/themes.js';
import { isEmbeddableMedia, renderMessageBody } from '../src/public/js/utils/richText.js';

describe('Theme contrast correction', () => {
  it('computes known WCAG ratios', () => {
    assert.equal(Math.round(contrastRatio('#ffffff', '#000000')), 21);
    assert.equal(Math.round(contrastRatio('#ffffff', '#ffffff')), 1);
  });

  it('leaves an already-readable accent untouched', () => {
    const accent = '#8ab4ff';
    assert.ok(contrastRatio(accent, '#0d0e12') >= 4.5);
    assert.equal(readableOn(accent, '#0d0e12'), accent);
  });

  it('lightens a dark accent until it passes AA on a dark background', () => {
    const chosen = '#1a3a8f';
    assert.ok(contrastRatio(chosen, '#0d0e12') < 4.5, 'precondition: too dark to read');
    const fixed = readableOn(chosen, '#0d0e12');
    assert.ok(contrastRatio(fixed, '#0d0e12') >= 4.5, 'corrected colour must clear AA');
  });

  it('darkens a light accent on a light background', () => {
    const chosen = '#ffe066';
    const fixed = readableOn(chosen, '#faf8f5');
    assert.ok(contrastRatio(fixed, '#faf8f5') >= 4.5);
  });

  it('survives every preset background for a full sweep of hues', () => {
    for (const theme of Object.values(PRESETS)) {
      const bg = theme.vars['--bg'];
      for (let hue = 0; hue < 360; hue += 30) {
        // Deliberately mid-saturation values, the ones most likely to fail.
        const accent = hslHex(hue, 0.6, 0.45);
        const fixed = readableOn(accent, bg);
        assert.ok(
          contrastRatio(fixed, bg) >= 4.4,
          `${theme.label}: hue ${hue} produced ${contrastRatio(fixed, bg).toFixed(2)}:1`
        );
      }
    }
  });

  it('picks button text that is readable on an already-safe fill', () => {
    for (const fill of ['#000000', '#ffffff', '#ffe066']) {
      assert.ok(contrastRatio(textOn(fill), fill) >= 4.5, `text on ${fill} must be readable`);
    }
  });

  it('nudges a fill that no text colour can sit on', () => {
    // #2f7fc4 manages only 3.2:1 with white and 4.2:1 with black — the exact
    // trap that makes a nice-looking accent fail on a button.
    const stuck = '#2f7fc4';
    assert.ok(contrastRatio(textOn(stuck), stuck) < 4.5, 'precondition: neither text colour works');
    const fill = readableFill(stuck);
    assert.ok(contrastRatio(textOn(fill), fill) >= 4.5, 'the corrected fill must carry a label');
  });

  it('gives every hue a usable button fill', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      for (const lightness of [0.35, 0.5, 0.65]) {
        const fill = readableFill(hslHex(hue, 0.7, lightness));
        assert.ok(
          contrastRatio(textOn(fill), fill) >= 4.4,
          `hue ${hue} at L=${lightness} produced ${contrastRatio(textOn(fill), fill).toFixed(2)}:1`
        );
      }
    }
  });

  it('leaves a fill alone when it already works', () => {
    assert.equal(readableFill('#000000'), '#000000');
    assert.equal(readableFill('#ffffff'), '#ffffff');
  });

  it('rejects malformed input instead of producing garbage', () => {
    assert.equal(contrastRatio('nope', '#000000'), 1);
    assert.equal(readableOn('nope', '#000000'), 'nope');
  });
});

describe('Accent harmony', () => {
  it('round-trips hex through HSL', () => {
    for (const hex of ['#2f7fc4', '#ffe066', '#000000', '#ffffff', '#7c37bb']) {
      const { h, s, l } = hexToHsl(hex);
      assert.equal(hslToHex(h, s, l), hex);
    }
  });

  it('keeps the primary exactly as chosen under every rule', () => {
    for (const rule of Object.keys(HARMONIES)) {
      assert.equal(deriveAccents('#2f7fc4', rule).primary, '#2f7fc4', `${rule} must not move the primary`);
    }
  });

  it('gives monochrome one hue at different depths', () => {
    const set = deriveAccents('#2f7fc4', 'mono');
    const hues = [set.primary, set.secondary, set.tertiary].map((c) => hexToHsl(c).h);
    // Not exactly equal: a round trip through 8-bit hex moves the hue by a
    // fraction of a degree, which is invisible but not zero.
    assert.ok(Math.max(...hues) - Math.min(...hues) < 1.5, `hues drifted: ${hues.join(', ')}`);
    const lights = [set.primary, set.secondary, set.tertiary].map((c) => hexToHsl(c).l);
    assert.ok(lights[1] < lights[0] && lights[2] > lights[0], 'one darker, one lighter');
  });

  it('spaces triadic hues evenly', () => {
    const set = deriveAccents('#2f7fc4', 'triad');
    const [a, b, c] = [set.primary, set.secondary, set.tertiary].map((x) => hexToHsl(x).h);
    assert.ok(Math.abs((((b - a) % 360) + 360) % 360 - 120) < 1);
    assert.ok(Math.abs((((c - a) % 360) + 360) % 360 - 240) < 1);
  });

  it('puts the complement opposite the primary', () => {
    const set = deriveAccents('#2f7fc4', 'complement');
    const delta = (((hexToHsl(set.secondary).h - hexToHsl(set.primary).h) % 360) + 360) % 360;
    assert.ok(Math.abs(delta - 180) < 1, `expected ~180 degrees, got ${delta}`);
  });

  it('produces three usable accents for every rule and every hue', () => {
    for (const rule of Object.keys(HARMONIES)) {
      for (let hue = 0; hue < 360; hue += 20) {
        const set = deriveAccents(hslToHex(hue, 65, 50), rule);
        for (const role of ['primary', 'secondary', 'tertiary']) {
          assert.match(set[role], /^#[0-9a-f]{6}$/, `${rule} at hue ${hue} produced ${set[role]}`);
          const fill = readableFill(set[role]);
          assert.ok(
            contrastRatio(textOn(fill), fill) >= 4.4,
            `${rule} hue ${hue} ${role}: label only reaches ${contrastRatio(textOn(fill), fill).toFixed(2)}:1`
          );
        }
      }
    }
  });

  it('degrades gracefully on malformed input', () => {
    const set = deriveAccents('not-a-colour', 'triad');
    assert.equal(set.primary, 'not-a-colour');
    assert.equal(set.secondary, 'not-a-colour');
  });
});

describe('Message rich text', () => {
  it('escapes markup before anything else', () => {
    const { html } = renderMessageBody('<img src=x onerror=alert(1)>');
    assert.ok(!html.includes('<img'), 'raw markup must not survive');
    assert.ok(html.includes('&lt;img'));
  });

  it('linkifies plain URLs with a safe rel', () => {
    const { html } = renderMessageBody('see https://example.com/docs please');
    assert.ok(html.includes('rel="noopener noreferrer nofollow"'));
    assert.ok(html.includes('target="_blank"'));
  });

  it('embeds media only from allowlisted https hosts', () => {
    assert.equal(isEmbeddableMedia('https://media.tenor.com/abc/cat.gif'), true);
    assert.equal(isEmbeddableMedia('https://i.imgur.com/abc.png'), true);
    assert.equal(isEmbeddableMedia('http://media.tenor.com/abc/cat.gif'), false, 'http must not embed');
    assert.equal(isEmbeddableMedia('https://evil.example/cat.gif'), false, 'unknown host must not embed');
    assert.equal(isEmbeddableMedia('https://media.tenor.com/abc/page.html'), false, 'non-image must not embed');
    assert.equal(isEmbeddableMedia('javascript:alert(1)'), false);
    assert.equal(isEmbeddableMedia('not a url'), false);
  });

  it('pulls an embeddable GIF out of the text and leaves other links inline', () => {
    const { html, media } = renderMessageBody('lol https://media.tenor.com/x/y.gif and https://example.com');
    assert.deepEqual(media, ['https://media.tenor.com/x/y.gif']);
    assert.ok(!html.includes('tenor'), 'the embedded URL should not also render as text');
    assert.ok(html.includes('example.com'));
  });

  it('caps how many images one message can embed', () => {
    const urls = Array.from({ length: 8 }, (_, i) => `https://i.imgur.com/${i}.gif`).join(' ');
    const { media } = renderMessageBody(urls);
    assert.equal(media.length, 3);
  });

  it('handles empty and null bodies', () => {
    assert.deepEqual(renderMessageBody(null), { html: '', media: [] });
    assert.deepEqual(renderMessageBody(''), { html: '', media: [] });
  });
});

function hslHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}
