const { User } = require('../models');
const { generateToken } = require('../utils/jwt');
const {
  getAuthCookieOptions,
  getCsrfCookieOptions,
  getClearCookieOptions,
  getClearCsrfCookieOptions,
} = require('../utils/cookieOptions');
const { generateCsrfToken } = require('../middleware/csrfMiddleware');

/**
 * User Login (Admin, Faculty, Student)
 * Issues HTTP-Only JWT Cookie + CSRF Cookie + JSON response with Bearer token
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email and explicitly select password hash
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 2. Check account status
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.accountStatus}. Please contact the administrator.`,
      });
    }

    // 3. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 4. Generate minimal claims JWT token and CSRF token
    const token = generateToken(user);
    const csrfToken = generateCsrfToken();

    // 5. Set cookies with consistent lifecycle options (JWT is strictly in HttpOnly cookie)
    res.cookie('token', token, getAuthCookieOptions());
    res.cookie('xsrf-token', csrfToken, getCsrfCookieOptions());

    // 6. Return response with sanitized user and temporary password indicator
    // SECURITY FIX: JWT is NOT returned in the JSON body, keeping it safe from XSS.
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      csrfToken, // Exposed for client to send as X-XSRF-TOKEN header in state-changing requests
      mustChangePassword: Boolean(user.isPasswordTemporary),
      user: user.toJSON(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Login error',
      error: error.message,
    });
  }
};

/**
 * User Logout
 * Clears authentication and CSRF cookies using identical path/domain/samesite options
 */
const logout = (req, res) => {
  res.clearCookie('token', getClearCookieOptions());
  res.clearCookie('xsrf-token', getClearCsrfCookieOptions());

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * Get current authenticated user session
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
    mustChangePassword: Boolean(req.user.isPasswordTemporary),
  });
};

/**
 * Mandatory Password Change for First-Time or Temporary Passwords
 * Refinement 4: Removes temporary flag and updates password hash
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from the current password',
      });
    }

    // Retrieve user with password hash
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found',
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password does not match',
      });
    }

    // Update password and clear temporary flag
    user.password = newPassword;
    user.isPasswordTemporary = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully. Temporary flag removed.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Password change error',
      error: error.message,
    });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
};

