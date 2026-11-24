const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  updateQuizStatus,
  deleteQuiz,
} = require('../controllers/quizController');

const {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
} = require('../controllers/questionController');

const {
  verifyToken,
  authorizeRoles,
  enforcePasswordChange,
} = require('../middleware/authMiddleware');

const {
  verifyQuizOwnership,
  checkQuestionModificationLock,
  checkQuizDeletionLock,
} = require('../middleware/quizMiddleware');

const validate = require('../middleware/validate');

// =============================================================================
// GLOBAL ROUTER MIDDLEWARE (Order is strictly enforced)
// 1. verifyToken: Decodes JWT from cookie/Bearer, attaches fresh user
// 2. authorizeRoles: Restricts access to 'faculty' and 'admin' roles (HTTP 403)
// 3. enforcePasswordChange: Blocks access if user holds temporary password (HTTP 403)
// =============================================================================
router.use(verifyToken);
router.use(authorizeRoles('faculty', 'admin'));
router.use(enforcePasswordChange);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

// Parameter validations
const quizIdParam = [
  param('quizId').isMongoId().withMessage('Invalid Quiz ID format'),
];

const questionIdParams = [
  param('quizId').isMongoId().withMessage('Invalid Quiz ID format'),
  param('questionId').isMongoId().withMessage('Invalid Question ID format'),
];

// Query validations for listing quizzes / questions
const listQuizRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be one of: "draft", "published", "archived"'),
  query('search').optional().trim(),
];

const listQuestionRules = [
  param('quizId').isMongoId().withMessage('Invalid Quiz ID format'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

// Create Quiz schema
const createQuizRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Quiz title is required')
    .isLength({ max: 200 })
    .withMessage('Quiz title cannot exceed 200 characters'),
  body('description').optional().trim(),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Quiz duration must be an integer of at least 1 minute'),
  body('startTime').isISO8601().withMessage('Valid ISO8601 startTime is required'),
  body('endTime')
    .isISO8601()
    .withMessage('Valid ISO8601 endTime is required')
    .custom((value, { req }) => {
      if (req.body.startTime && new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('Quiz endTime must be later than startTime');
      }
      return true;
    }),
  body('maxAttempts')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxAttempts must be an integer >= 1'),
  body('randomizeQuestions')
    .optional()
    .isBoolean()
    .withMessage('randomizeQuestions must be a boolean'),
  body('randomizeOptions')
    .optional()
    .isBoolean()
    .withMessage('randomizeOptions must be a boolean'),
  body('questionsPerStudent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('questionsPerStudent must be a non-negative integer'),
  body('status')
    .not()
    .exists()
    .withMessage('Initial quiz status cannot be supplied; quizzes are always created in draft mode'),
  body('createdBy')
    .not()
    .exists()
    .withMessage('createdBy cannot be supplied; author identity is assigned from authenticated session'),
  body('totalMarks')
    .not()
    .exists()
    .withMessage('totalMarks cannot be supplied; marks are calculated dynamically'),
];

// Update Quiz schema (PUT)
const updateQuizRules = [
  param('quizId').isMongoId().withMessage('Invalid Quiz ID format'),
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Quiz title cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Quiz title cannot exceed 200 characters'),
  body('description').optional().trim(),
  body('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quiz duration must be an integer of at least 1 minute'),
  body('startTime').optional().isISO8601().withMessage('Valid ISO8601 startTime required'),
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('Valid ISO8601 endTime required')
    .custom((value, { req }) => {
      if (req.body.startTime && new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('endTime must be later than startTime');
      }
      return true;
    }),
  body('maxAttempts')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxAttempts must be an integer >= 1'),
  body('randomizeQuestions')
    .optional()
    .isBoolean()
    .withMessage('randomizeQuestions must be a boolean'),
  body('randomizeOptions')
    .optional()
    .isBoolean()
    .withMessage('randomizeOptions must be a boolean'),
  body('questionsPerStudent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('questionsPerStudent must be a non-negative integer'),
  body('status')
    .not()
    .exists()
    .withMessage('Quiz status cannot be modified via PUT. Use PATCH /api/faculty/quizzes/:quizId/status'),
];

// Status transition schema (PATCH)
const updateStatusRules = [
  param('quizId').isMongoId().withMessage('Invalid Quiz ID format'),
  body('status')
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be one of: "draft", "published", "archived"'),
];

// Create Question schema
const createQuestionRules = [
  param('quizId').isMongoId().withMessage('Invalid Quiz ID format'),
  body('questionText')
    .trim()
    .notEmpty()
    .withMessage('Question text is required'),
  body('questionType')
    .optional()
    .isIn(['multiple-choice', 'true-false'])
    .withMessage('Invalid question type. Supported: "multiple-choice", "true-false"'),
  body('correctOptionId')
    .trim()
    .notEmpty()
    .withMessage('correctOptionId is required for automatic evaluation'),
  body('marks')
    .optional()
    .isFloat({ min: 0.5 })
    .withMessage('Marks must be a positive number of at least 0.5'),
];

// Update Question schema
const updateQuestionRules = [
  param('quizId').isMongoId().withMessage('Invalid Quiz ID format'),
  param('questionId').isMongoId().withMessage('Invalid Question ID format'),
  body('questionText')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Question text cannot be empty'),
  body('questionType')
    .optional()
    .isIn(['multiple-choice', 'true-false'])
    .withMessage('Invalid question type. Supported: "multiple-choice", "true-false"'),
  body('correctOptionId')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('correctOptionId cannot be empty'),
  body('marks')
    .optional()
    .isFloat({ min: 0.5 })
    .withMessage('Marks must be a positive number of at least 0.5'),
];

// =============================================================================
// QUIZ MANAGEMENT ENDPOINTS
// =============================================================================

// POST / — Create new draft quiz
router.post('/', createQuizRules, validate, createQuiz);

// GET / — List faculty quizzes (or all if admin) with pagination
router.get('/', listQuizRules, validate, getQuizzes);

// GET /:quizId — Get quiz details and statistics (requires ownership or admin)
router.get('/:quizId', quizIdParam, validate, verifyQuizOwnership, getQuizById);

// PUT /:quizId — Update quiz metadata (permits benign updates during attempts; blocks structural changes)
router.put('/:quizId', updateQuizRules, validate, verifyQuizOwnership, updateQuiz);

// PATCH /:quizId/status — Lifecycle state transition (draft -> published -> archived)
router.patch('/:quizId/status', updateStatusRules, validate, verifyQuizOwnership, updateQuizStatus);

// DELETE /:quizId — Delete quiz and associated questions (blocked with HTTP 409 if attempts exist)
router.delete('/:quizId', quizIdParam, validate, verifyQuizOwnership, checkQuizDeletionLock, deleteQuiz);

// =============================================================================
// QUESTION BANK MANAGEMENT ENDPOINTS
//
// NOTE: /:quizId/questions/bulk MUST be declared BEFORE /:quizId/questions/:questionId
// to prevent the parameter route from capturing the literal "bulk" token.
// =============================================================================

// POST /:quizId/questions — Add question (MCQ or True/False)
router.post(
  '/:quizId/questions',
  createQuestionRules,
  validate,
  verifyQuizOwnership,
  checkQuestionModificationLock,
  createQuestion
);

// GET /:quizId/questions — List questions with +correctOptionId for verified owner/admin
router.get(
  '/:quizId/questions',
  listQuestionRules,
  validate,
  verifyQuizOwnership,
  getQuestions
);

// POST /:quizId/questions/bulk — Batch import questions from CSV or JSON array
router.post(
  '/:quizId/questions/bulk',
  quizIdParam,
  validate,
  verifyQuizOwnership,
  checkQuestionModificationLock,
  bulkImportQuestions
);

// GET /:quizId/questions/:questionId — Get single question with +correctOptionId for owner/admin
router.get(
  '/:quizId/questions/:questionId',
  questionIdParams,
  validate,
  verifyQuizOwnership,
  getQuestionById
);

// PUT /:quizId/questions/:questionId — Update question text, options, answer key, or marks
router.put(
  '/:quizId/questions/:questionId',
  updateQuestionRules,
  validate,
  verifyQuizOwnership,
  checkQuestionModificationLock,
  updateQuestion
);

// DELETE /:quizId/questions/:questionId — Delete question from question bank
router.delete(
  '/:quizId/questions/:questionId',
  questionIdParams,
  validate,
  verifyQuizOwnership,
  checkQuestionModificationLock,
  deleteQuestion
);

module.exports = router;

