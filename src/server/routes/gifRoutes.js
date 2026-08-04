import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { publicRateLimiter } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const searchSchema = z.object({
  q: z.string().trim().min(1).max(60),
  limit: z.coerce.number().int().min(1).max(24).default(16)
});

/**
 * Two providers, because Google closed Tenor to new API clients in January
 * 2026. Existing Tenor keys keep working and take precedence; anyone setting
 * this up now uses Giphy. Both are normalised to { id, description, preview,
 * url } so the client never learns which one answered.
 */
const PROVIDERS = {
  tenor: {
    env: 'TENOR_API_KEY',
    url(query, limit, key) {
      const url = new URL('https://tenor.googleapis.com/v2/search');
      url.searchParams.set('q', query);
      url.searchParams.set('key', key);
      url.searchParams.set('client_key', 'forge');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('media_filter', 'tinygif,gif');
      url.searchParams.set('contentfilter', 'high');
      return url;
    },
    normalise: (body) =>
      (body.results || []).map((item) => ({
        id: item.id,
        description: item.content_description || 'GIF',
        preview: item.media_formats?.tinygif?.url || null,
        url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || null
      }))
  },

  giphy: {
    env: 'GIPHY_API_KEY',
    url(query, limit, key) {
      const url = new URL('https://api.giphy.com/v1/gifs/search');
      url.searchParams.set('q', query);
      url.searchParams.set('api_key', key);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('rating', 'g');
      url.searchParams.set('lang', 'en');
      return url;
    },
    normalise: (body) =>
      (body.data || []).map((item) => ({
        id: item.id,
        description: item.title || 'GIF',
        preview: item.images?.fixed_width_small?.url || item.images?.preview_gif?.url || null,
        url: item.images?.downsized?.url || item.images?.original?.url || null
      }))
  }
};

/**
 * The first provider with a key configured. Tenor is checked first: if someone
 * still holds a working key, silently moving them to Giphy would be a change
 * they never asked for.
 */
function activeProvider() {
  for (const [name, provider] of Object.entries(PROVIDERS)) {
    const key = process.env[provider.env];
    if (key) return { name, provider, key };
  }
  return null;
}

/**
 * Proxied so the API key stays server-side and clients never talk to the GIF
 * host directly. With no key configured the endpoint reports that clearly
 * instead of failing silently — the picker then offers its paste-a-link
 * fallback.
 */
router.get('/search', requireAuth, publicRateLimiter, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'A search term is required.' });
  }

  const active = activeProvider();
  if (!active) {
    return res.json({
      results: [],
      configured: false,
      message: 'GIF search is not set up. Paste a GIF link below instead.'
    });
  }

  const { name, provider, key } = active;
  const url = provider.url(parsed.data.q, parsed.data.limit, key);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const upstream = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!upstream.ok) throw new Error(`${name} responded ${upstream.status}`);
    const body = await upstream.json();

    // A result missing either URL can be neither shown nor sent.
    const results = provider.normalise(body).filter((r) => r.url && r.preview);

    res.json({ results, configured: true });
  } catch (err) {
    logger.warn('gif_search_failed', { provider: name, message: err.message });
    res.status(502).json({ error: 'GIF search is unavailable right now.' });
  }
});

export default router;
