const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const {
  createFaculty,
  createStudent,
  bulkCreateStudents,
  getAllUsers,
} = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

// All admin routes strictly require authentication and 'admin' role
router.use(verifyToken);
router.use(authorizeRoles('admin'));

// Validation Rules
const facultyRules = [
  body('name').trim().notEmpty().withMessage('Faculty name is required'),
  body('email').isEmail().withMessage('Valid faculty email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

const studentRules = [
  body('name').trim().notEmpty().withMessage('Student name is required'),
  body('email').isEmail().withMessage('Valid student email is required').normalizeEmail(),
  body('usn').trim().notEmpty().withMessage('Student USN is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

// Routes
router.post('/users/faculty', facultyRules, validate, createFaculty);
router.post('/users/student', studentRules, validate, createStudent);
router.post('/users/students/bulk', bulkCreateStudents);
router.get('/users', getAllUsers);

module.exports = router;

