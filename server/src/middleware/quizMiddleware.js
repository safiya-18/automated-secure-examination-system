const mongoose = require('mongoose');
const { Quiz, Attempt } = require('../models');

/**
 * Middleware: verifyQuizOwnership
 *
 * Verifies that the requested quiz exists and that the authenticated user
 * is either the creator (Faculty) or an authorized Admin.
 *
 * Crucial Security Rule:
 * Executes BEFORE any question queries or answer projections, ensuring
 * unauthorized users can never cause correctOptionId to be retrieved or leaked.
 */
const verifyQuizOwnership = async (req, res, next) => {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: 'Quiz ID parameter is required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Quiz ID format',
      });
    }

    // Find quiz without exposing questions or sensitive data
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }

    // Verify ownership: must be the creator OR an authorized Admin
    const isOwner = quiz.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this quiz.',
      });
    }

    // Attach verified quiz to request object for downstream middleware and controllers
    req.quiz = quiz;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error verifying quiz ownership',
      error: error.message,
    });
  }
};

/**
 * Middleware: checkQuestionModificationLock
 *
 * Applied strictly to question-mutating routes (create, update, delete, bulk import).
 *
 * State Rules:
 * 1. 'archived': Quizzes in archived state are completely read-only (HTTP 400).
 * 2. 'published' with existing attempts: Question mutations are strictly locked (HTTP 409 Conflict)
 *    to guarantee grading integrity.
 * 3. 'published' with 0 attempts: Permitted.
 * 4. 'draft': Permitted.
 *
 * Note: Benign quiz metadata updates (e.g. extending schedule endTime in emergencies)
 * are handled separately by quizController and not blocked by this question lock.
 */
const checkQuestionModificationLock = async (req, res, next) => {
  try {
    const quiz = req.quiz;
    if (!quiz) {
      return res.status(500).json({
        success: false,
        message: 'Quiz context missing from request. Ensure verifyQuizOwnership precedes this check.',
      });
    }

    // Rule 1: Archived quizzes are strictly read-only
    if (quiz.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Archived quizzes are read-only. Question bank cannot be modified.',
      });
    }

    // Rule 2: Published quiz attempt lock check
    if (quiz.status === 'published') {
      const attemptsCount = await Attempt.countDocuments({ quizId: quiz._id });
      if (attemptsCount > 0) {
        return res.status(409).json({
          success: false,
          message:
            'Cannot add, edit, or delete questions for a published quiz with existing student attempts. Archive the quiz instead.',
          attemptsCount,
        });
      }
    }

    // Draft or published with 0 attempts -> allow mutation
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking question modification lock',
      error: error.message,
    });
  }
};

/**
 * Middleware: checkQuizDeletionLock
 *
 * Applied to DELETE /api/faculty/quizzes/:quizId.
 *
 * Preservation Invariant:
 * Under no circumstances may a quiz with existing student attempts be deleted.
 * Historical attempts, scores, and malpractice audit logs must be permanently preserved.
 */
const checkQuizDeletionLock = async (req, res, next) => {
  try {
    const quiz = req.quiz;
    if (!quiz) {
      return res.status(500).json({
        success: false,
        message: 'Quiz context missing from request. Ensure verifyQuizOwnership precedes this check.',
      });
    }

    const attemptsCount = await Attempt.countDocuments({ quizId: quiz._id });
    if (attemptsCount > 0) {
      return res.status(409).json({
        success: false,
        message:
          'Cannot delete a quiz with existing student attempts. Historical attempts, scores, and malpractice audit records must be preserved.',
        attemptsCount,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking quiz deletion lock',
      error: error.message,
    });
  }
};

module.exports = {
  verifyQuizOwnership,
  checkQuestionModificationLock,
  checkQuizDeletionLock,
};

