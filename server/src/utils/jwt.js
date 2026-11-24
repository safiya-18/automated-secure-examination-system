const jwt = require('jsonwebtoken');

const getJwtSecret = () => process.env.JWT_SECRET || 'temporary_development_secret_change_in_production';
const getJwtExpiresIn = () => process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT with strictly MINIMAL claims: { id, role }
 * Refinement 2: Minimizes token footprint, avoids stale profile data in payload.
 */
const generateToken = (user) => {
  const payload = {
    id: user._id.toString(),
    role: user.role,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
};

/**
 * Synchronously verify and decode token
 */
const verifyJwtToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyJwtToken,
};

