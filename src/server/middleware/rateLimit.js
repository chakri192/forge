import rateLimit from 'express-rate-limit';

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
