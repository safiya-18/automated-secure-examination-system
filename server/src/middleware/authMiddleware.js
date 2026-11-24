const { verifyJwtToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Verify authentication token from cookie or Authorization: Bearer header.
 * Attaches fresh user document (excluding password) to req.user.
 */
const verifyToken = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HTTP-Only cookie first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Fall back to Authorization: Bearer header (enables Postman and programmatic clients)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
      });
    }

    // 3. Verify JWT
    const decoded = verifyJwtToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
      });
    }

    // 4. Retrieve fresh user profile from DB using minimal claim { id }
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}. Please contact the administrator.`,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication processing error',
      error: error.message,
    });
  }
};

/**
 * Role-based authorization guard.
 * Strict HTTP 403 response for unauthorized role access.
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${roles.join(', ')}] roles.`,
      });
    }
    next();
  };
};

/**
 * Mandatory Password Change Guard.
 * Refinement 4: Blocks operational actions if a student/faculty user still has a temporary password.
 */
const enforcePasswordChange = (req, res, next) => {
  if (req.user && req.user.isPasswordTemporary) {
    return res.status(403).json({
      success: false,
      mustChangePassword: true,
      message: 'Mandatory password change required before accessing this feature.',
    });
  }
  next();
};

module.exports = {
  verifyToken,
  authorizeRoles,
  enforcePasswordChange,
};

