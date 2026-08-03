import jwt from 'jsonwebtoken';

const DEV_FALLBACK_SECRET = 'forge_jwt_secret_key_2026_dev';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * A hardcoded fallback secret is fine for local development and fatal in
 * production: anyone who has read the repository could mint an admin token.
 * Refuse to boot rather than start in a silently compromised state.
 */
function resolveSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (isProduction) {
    throw new Error(
      'JWT_SECRET must be set to at least 32 characters in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  if (fromEnv) {
    console.warn('[auth] JWT_SECRET is shorter than 32 characters; using it anyway outside production.');
    return fromEnv;
  }
  console.warn('[auth] JWT_SECRET is not set — using the insecure development fallback.');
  return DEV_FALLBACK_SECRET;
}

const JWT_SECRET = resolveSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function generateToken(user) {
  if (!user || !user.id) {
    throw new Error('User object with id is required to generate JWT token');
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
