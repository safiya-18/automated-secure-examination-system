const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  login,
  logout,
  getMe,
  changePassword,
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

// Login Validation Rules
const loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// Change Password Validation Rules
const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
];

// Routes
router.post('/login', loginRules, validate, login);
router.post('/logout', logout);
router.get('/me', verifyToken, getMe);
router.post('/change-password', verifyToken, changePasswordRules, validate, changePassword);

module.exports = router;

