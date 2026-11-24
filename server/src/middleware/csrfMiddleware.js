const crypto = require('crypto');

/**
 * Generate a cryptographically strong CSRF token
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Double-submit cookie CSRF validation middleware.
 * Refinement 1: Protects state-changing operations when using cookie sessions,
 * while allowing seamless Bearer token authentication for Postman / programmatic clients.
 */
const csrfProtection = (req, res, next) => {
  // Safe HTTP read methods are exempt from CSRF
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt public auth entry points that do not require an active session yet
  const exemptPaths = ['/api/auth/login', '/api/health'];
  if (exemptPaths.includes(req.path)) {
    return next();
  }

  // If request authenticates via Bearer header, browser ambient cookie CSRF does not apply
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // If request uses cookie session, enforce CSRF token verification
  const sessionCookie = req.cookies && req.cookies.token;
  if (sessionCookie) {
    const csrfCookie = req.cookies['xsrf-token'];
    const csrfHeader = req.headers['x-xsrf-token'] || req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return res.status(403).json({
        success: false,
        message: 'CSRF validation failed: Invalid or missing CSRF token in request headers',
      });
    }
  }

  next();
};

module.exports = {
  generateCsrfToken,
  csrfProtection,
};

