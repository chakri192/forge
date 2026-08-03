import crypto from 'crypto';

/**
 * Minimal structured logger. Emits one JSON object per line in production so
 * log aggregators can parse it, and a readable line in development.
 *
 * Deliberately dependency-free: the value here is the request id and the
 * consistent shape, not the library.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'test' ? LEVELS.error : LEVELS.info);
const asJson = process.env.NODE_ENV === 'production';

/** Values that must never reach a log line, whatever the caller passes. */
const REDACTED = new Set(['password', 'token', 'authorization', 'password_hash', 'jwt', 'secret']);

function scrub(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = REDACTED.has(key.toLowerCase()) ? '[redacted]' : scrub(val, depth + 1);
  }
  return out;
}

function emit(level, message, context = {}) {
  if (LEVELS[level] < threshold) return;
  const entry = { level, time: new Date().toISOString(), message, ...scrub(context) };

  if (asJson) {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
    return;
  }
  const detail = Object.keys(context).length ? ` ${JSON.stringify(scrub(context))}` : '';
  const line = `[${level}] ${message}${detail}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg, ctx) => emit('debug', msg, ctx),
  info: (msg, ctx) => emit('info', msg, ctx),
  warn: (msg, ctx) => emit('warn', msg, ctx),
  error: (msg, ctx) => emit('error', msg, ctx),
  /** Returns a logger that stamps every line with the same context. */
  child: (base) => ({
    debug: (msg, ctx) => emit('debug', msg, { ...base, ...ctx }),
    info: (msg, ctx) => emit('info', msg, { ...base, ...ctx }),
    warn: (msg, ctx) => emit('warn', msg, { ...base, ...ctx }),
    error: (msg, ctx) => emit('error', msg, { ...base, ...ctx })
  })
};

/**
 * Attaches a request id and logs completion with duration, so a production
 * failure can be traced to one request rather than guessed at.
 */
export function requestLogger(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('X-Request-Id', req.id);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    // Health checks are noise at info level.
    if (level === 'info' && req.path === '/healthz') return;
    logger[level]('request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(ms * 10) / 10,
      userId: req.user ? req.user.id : null
    });
  });

  next();
}
