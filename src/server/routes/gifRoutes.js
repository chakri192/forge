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
 * Proxied so the API key stays server-side and clients never talk to Tenor
 * directly. Without a key the endpoint reports that clearly instead of
 * failing silently — users can still paste a GIF URL into the composer.
 */
router.get('/search', requireAuth, publicRateLimiter, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'A search term is required.' });
  }

  const key = process.env.TENOR_API_KEY;
  if (!key) {
    return res.json({
      results: [],
      configured: false,
      message: 'GIF search is not configured. Paste a GIF link into the composer instead.'
    });
  }

  const url = new URL('https://tenor.googleapis.com/v2/search');
  url.searchParams.set('q', parsed.data.q);
  url.searchParams.set('key', key);
  url.searchParams.set('client_key', 'forge');
  url.searchParams.set('limit', String(parsed.data.limit));
  url.searchParams.set('media_filter', 'tinygif,gif');
  url.searchParams.set('contentfilter', 'high');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const upstream = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!upstream.ok) throw new Error(`Tenor responded ${upstream.status}`);
    const body = await upstream.json();

    const results = (body.results || [])
      .map((item) => ({
        id: item.id,
        description: item.content_description || 'GIF',
        preview: item.media_formats?.tinygif?.url || null,
        url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || null
      }))
      .filter((r) => r.url && r.preview);

    res.json({ results, configured: true });
  } catch (err) {
    logger.warn('gif_search_failed', { message: err.message });
    res.status(502).json({ error: 'GIF search is unavailable right now.' });
  }
});

export default router;
