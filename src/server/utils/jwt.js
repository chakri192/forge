import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'forge_jwt_secret_key_2026_dev';
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
