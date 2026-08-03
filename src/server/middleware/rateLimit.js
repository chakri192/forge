import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Key by user id when authenticated, otherwise by IP.
 *
 * The IP branch must go through `ipKeyGenerator`: a raw `req.ip` gives every
 * address in an IPv6 /64 its own bucket, so a single client could rotate
 * addresses and bypass the limit entirely.
 */
function userOrIpKey(req) {
  return req.user ? `u:${req.user.id}` : ipKeyGenerator(req.ip);
}

const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('test'));

export const authRateLimiter = rateLimit({
  windowMs: isTest ? 2000 : 15 * 60 * 1000,
  max: isTest ? 5 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later'
    });
  }
});

/**
 * Applies to every state-changing request. Auth already has its own tighter
 * limiter; this covers everything else — voting, forum posts, submissions,
 * quiz attempts — which were previously unthrottled.
 *
 * Keyed by user id when authenticated so one member on a shared NAT cannot
 * exhaust the allowance for everybody behind it.
 */
export const mutationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many requests, please slow down' });
  }
});

/**
 * Quiz grading is the one endpoint where unlimited retries are a correctness
 * problem, not just load: without a cap, answers can simply be guessed.
 */
export const quizAttemptRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many attempts, please wait a moment' });
  }
});

/** Unauthenticated public surfaces (profiles) get a conservative IP cap. */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many requests' });
  }
});
