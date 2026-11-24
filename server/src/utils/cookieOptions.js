/**
 * Centralized cookie configuration to guarantee consistency across login and logout.
 */
const isProduction = process.env.NODE_ENV === 'production';

// HTTP-Only JWT Cookie options
const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction, // HTTPS only in production
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});

// CSRF Cookie options (accessible by client JavaScript for double-submit header attachment)
const getCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000,
});

// Options for clearing cookies on logout
const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
});

const getClearCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
});

module.exports = {
  getAuthCookieOptions,
  getCsrfCookieOptions,
  getClearCookieOptions,
  getClearCsrfCookieOptions,
};

