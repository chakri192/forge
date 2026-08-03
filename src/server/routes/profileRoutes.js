import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { publicRateLimiter } from '../middleware/rateLimit.js';
import { ProfileService } from '../services/profileService.js';

/**
 * Split into two routers: `publicProfileRouter` is mounted BEFORE the auth
 * middleware and must stay free of anything that assumes a signed-in user.
 */
export const publicProfileRouter = express.Router();

publicProfileRouter.get('/api/public/profile/:slug', publicRateLimiter, (req, res, next) => {
  try {
    const profile = ProfileService.publicBySlug(req.params.slug);
    // 404 for both "unknown" and "not published" so the endpoint cannot be
    // used to enumerate members.
    if (!profile) throw { status: 404, message: 'Profile not found' };
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ profile });
  } catch (err) { next(err); }
});

const settingsRouter = express.Router();

settingsRouter.get('/profile/settings', requireAuth, validate({}), (req, res, next) => {
  try {
    res.json(ProfileService.settingsFor(req.user.id));
  } catch (err) { next(err); }
});

settingsRouter.patch(
  '/profile/settings',
  requireAuth,
  validate({
    body: z.object({
      is_public: z.boolean().optional(),
      slug: z.string().trim().min(2).max(40).nullable().optional()
    })
  }),
  (req, res, next) => {
    try {
      res.json(
        ProfileService.updateSettings(req.user, {
          isPublic: req.body.is_public,
          slug: req.body.slug
        })
      );
    } catch (err) { next(err); }
  }
);

export default settingsRouter;
