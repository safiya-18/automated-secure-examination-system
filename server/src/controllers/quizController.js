const mongoose = require('mongoose');
const { Quiz, Question, Attempt } = require('../models');
const quizService = require('../utils/quizService');

/**
 * 1. CREATE QUIZ
 *
 * Rules:
 * - Creates quiz in 'draft' status only.
 * - Sets createdBy from authenticated req.user._id.
 * - Ignores/rejects createdBy, status, and totalMarks if supplied in req.body.
 * - Supports questionsPerStudent, randomizeQuestions, randomizeOptions, and proctoringSettings.
 * - Validates title, duration, dates, and allocation settings.
 */
const createQuiz = async (req, res) => {
  try {
    const {
      title,
      description,
      duration,
      startTime,
      endTime,
      maxAttempts,
      randomizeQuestions,
      randomizeOptions,
      questionsPerStudent,
      proctoringSettings,
    } = req.body;

    // Title validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Quiz title is required',
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Quiz title cannot exceed 200 characters',
      });
    }

    // Duration validation
    const durationNum = parseInt(duration, 10);
    if (isNaN(durationNum) || durationNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quiz duration must be an integer of at least 1 minute',
      });
    }

    // Date validations
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Quiz availability startTime and endTime are required',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format for startTime or endTime',
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'Quiz endTime must be later than startTime',
      });
    }

    // Allocation validation
    let parsedQuestionsPerStudent = 0;
    if (questionsPerStudent !== undefined) {
      parsedQuestionsPerStudent = parseInt(questionsPerStudent, 10);
      if (isNaN(parsedQuestionsPerStudent) || parsedQuestionsPerStudent < 0) {
        return res.status(400).json({
          success: false,
          message: 'questionsPerStudent must be a non-negative integer',
        });
      }
    }

    let parsedMaxAttempts = 1;
    if (maxAttempts !== undefined) {
      parsedMaxAttempts = parseInt(maxAttempts, 10);
      if (isNaN(parsedMaxAttempts) || parsedMaxAttempts < 1) {
        return res.status(400).json({
          success: false,
          message: 'maxAttempts must be an integer >= 1',
        });
      }
    }

    // Safe extraction: createdBy, status, totalMarks are strictly managed by backend
    const quiz = new Quiz({
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      createdBy: req.user._id,
      duration: durationNum,
      totalMarks: 0,
      startTime: start,
      endTime: end,
      maxAttempts: parsedMaxAttempts,
      status: 'draft',
      randomizeQuestions: randomizeQuestions !== undefined ? Boolean(randomizeQuestions) : true,
      randomizeOptions: randomizeOptions !== undefined ? Boolean(randomizeOptions) : true,
      questionsPerStudent: parsedQuestionsPerStudent,
      proctoringSettings: {
        maxViolationsAllowed:
          proctoringSettings?.maxViolationsAllowed !== undefined
            ? Math.max(1, parseInt(proctoringSettings.maxViolationsAllowed, 10) || 3)
            : 3,
        autoSubmitOnMaxViolations:
          proctoringSettings?.autoSubmitOnMaxViolations !== undefined
            ? Boolean(proctoringSettings.autoSubmitOnMaxViolations)
            : true,
        requireCamera:
          proctoringSettings?.requireCamera !== undefined
            ? Boolean(proctoringSettings.requireCamera)
            : false,
        requireMicrophone:
          proctoringSettings?.requireMicrophone !== undefined
            ? Boolean(proctoringSettings.requireMicrophone)
            : false,
      },
    });

    await quiz.save();

    return res.status(201).json({
      success: true,
      message: 'Quiz created successfully in draft mode',
      quiz,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create quiz',
      error: error.message,
    });
  }
};

/**
 * 2. LIST QUIZZES
 *
 * Rules:
 * - Faculty sees only quizzes they created (createdBy: req.user._id).
 * - Admin sees all quizzes.
 * - Returns questionCount and attemptsCount per quiz.
 * - Validated pagination with count, total, page, totalPages.
 */
const getQuizzes = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = {};

    // Role-based visibility scoping
    if (req.user.role !== 'admin') {
      query.createdBy = req.user._id;
    }

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      query.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      query.title = { $regex: search.trim(), $options: 'i' };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [rawQuizzes, total] = await Promise.all([
      Quiz.find(query)
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Quiz.countDocuments(query),
    ]);

    const quizIds = rawQuizzes.map((q) => q._id);

    // Compute question and attempt counts efficiently
    const [questionCounts, attemptCounts] = await Promise.all([
      Question.aggregate([
        { $match: { quizId: { $in: quizIds } } },
        { $group: { _id: '$quizId', count: { $sum: 1 } } },
      ]),
      Attempt.aggregate([
        { $match: { quizId: { $in: quizIds } } },
        { $group: { _id: '$quizId', count: { $sum: 1 } } },
      ]),
    ]);

    const questionCountMap = new Map(questionCounts.map((item) => [item._id.toString(), item.count]));
    const attemptCountMap = new Map(attemptCounts.map((item) => [item._id.toString(), item.count]));

    const quizzes = rawQuizzes.map((q) => ({
      ...q,
      questionCount: questionCountMap.get(q._id.toString()) || 0,
      attemptsCount: attemptCountMap.get(q._id.toString()) || 0,
    }));

    return res.status(200).json({
      success: true,
      count: quizzes.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      quizzes,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve quizzes',
      error: error.message,
    });
  }
};

/**
 * 3. GET QUIZ DETAILS
 *
 * Rules:
 * - Enforce ownership (creator) or Admin access.
 * - Return questionCount and attempt statistics.
 * - Never expose correctOptionId or answer keys.
 */
const getQuizById = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing Quiz ID',
      });
    }

    const quiz = req.quiz || (await Quiz.findById(quizId).populate('createdBy', 'name email role'));
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }

    const creatorId = quiz.createdBy._id ? quiz.createdBy._id.toString() : quiz.createdBy.toString();
    const isOwner = creatorId === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to this quiz',
      });
    }

    const [questionCount, attemptsCount, attemptStats] = await Promise.all([
      Question.countDocuments({ quizId: quiz._id }),
      Attempt.countDocuments({ quizId: quiz._id }),
      Attempt.aggregate([
        { $match: { quizId: quiz._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgScore: { $avg: '$score' },
          },
        },
      ]),
    ]);

    const stats = {
      questionCount,
      attemptsCount,
      byStatus: {},
    };

    attemptStats.forEach((s) => {
      stats.byStatus[s._id] = {
        count: s.count,
        avgScore: Math.round((s.avgScore || 0) * 100) / 100,
      };
    });

    return res.status(200).json({
      success: true,
      quiz,
      statistics: stats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve quiz details',
      error: error.message,
    });
  }
};

/**
 * 4. UPDATE QUIZ
 *
 * Rules:
 * - Archived quizzes are read-only (HTTP 400).
 * - When attempts exist:
 *   - Only benign changes permitted (description, extending endTime, proctoring autoSubmit flag).
 *   - Strictly blocks duration reduction, randomizeQuestions, randomizeOptions, and questionsPerStudent (HTTP 409).
 * - When 0 attempts exist:
 *   - Can update metadata, duration, times, randomization, and allocation.
 *   - Validates subset marks consistency when questionsPerStudent is altered.
 *   - Dynamically recomputes totalMarks.
 */
const updateQuiz = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing Quiz ID',
      });
    }

    const quiz = req.quiz || (await Quiz.findById(quizId));
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }

    const isOwner = quiz.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this quiz',
      });
    }

    if (quiz.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Archived quizzes are read-only and cannot be updated',
      });
    }

    if (req.body.status !== undefined && req.body.status !== quiz.status) {
      return res.status(400).json({
        success: false,
        message: 'Quiz status cannot be modified via PUT. Use PATCH /api/faculty/quizzes/:quizId/status',
      });
    }

    const attemptsCount = await Attempt.countDocuments({ quizId: quiz._id });

    const {
      title,
      description,
      duration,
      startTime,
      endTime,
      maxAttempts,
      randomizeQuestions,
      randomizeOptions,
      questionsPerStudent,
      proctoringSettings,
    } = req.body;

    // SCENARIO A: Existing student attempts lock structural changes
    if (attemptsCount > 0) {
      const attemptedDuration = duration !== undefined ? parseInt(duration, 10) : undefined;
      if (attemptedDuration !== undefined && attemptedDuration < quiz.duration) {
        return res.status(409).json({
          success: false,
          message: 'Cannot reduce quiz duration after student attempts have commenced',
          attemptsCount,
        });
      }

      if (
        (randomizeQuestions !== undefined && Boolean(randomizeQuestions) !== quiz.randomizeQuestions) ||
        (randomizeOptions !== undefined && Boolean(randomizeOptions) !== quiz.randomizeOptions) ||
        (questionsPerStudent !== undefined && parseInt(questionsPerStudent, 10) !== quiz.questionsPerStudent)
      ) {
        return res.status(409).json({
          success: false,
          message: 'Cannot modify randomization or question allocation settings after student attempts exist',
          attemptsCount,
        });
      }

      if (startTime !== undefined) {
        const newStart = new Date(startTime);
        if (newStart.getTime() !== new Date(quiz.startTime).getTime()) {
          return res.status(409).json({
            success: false,
            message: 'Cannot change quiz start time after student attempts exist',
            attemptsCount,
          });
        }
      }

      if (endTime !== undefined) {
        const newEnd = new Date(endTime);
        if (newEnd < new Date(quiz.endTime)) {
          return res.status(409).json({
            success: false,
            message: 'Cannot shorten or advance quiz end time when attempts exist (extensions only permitted)',
            attemptsCount,
          });
        }
      }

      // Apply benign updates permitted during active/attempted quiz
      if (description !== undefined) {
        quiz.description = typeof description === 'string' ? description.trim() : '';
      }
      if (endTime !== undefined) {
        const newEnd = new Date(endTime);
        if (!isNaN(newEnd.getTime()) && newEnd > quiz.startTime) {
          quiz.endTime = newEnd;
        }
      }
      if (attemptedDuration !== undefined && attemptedDuration >= quiz.duration) {
        quiz.duration = attemptedDuration;
      }
      if (proctoringSettings && typeof proctoringSettings === 'object') {
        if (proctoringSettings.autoSubmitOnMaxViolations !== undefined) {
          quiz.proctoringSettings.autoSubmitOnMaxViolations = Boolean(proctoringSettings.autoSubmitOnMaxViolations);
        }
      }

      await quiz.save();
      return res.status(200).json({
        success: true,
        message: 'Quiz updated with permitted modifications',
        quiz,
      });
    }

    // SCENARIO B: 0 attempts exist (Draft or Published without attempts)
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
        return res.status(400).json({
          success: false,
          message: 'Title must be non-empty and at most 200 characters',
        });
      }
      quiz.title = title.trim();
    }

    if (description !== undefined) {
      quiz.description = typeof description === 'string' ? description.trim() : '';
    }

    if (duration !== undefined) {
      const dur = parseInt(duration, 10);
      if (isNaN(dur) || dur < 1) {
        return res.status(400).json({
          success: false,
          message: 'Duration must be an integer of at least 1 minute',
        });
      }
      quiz.duration = dur;
    }

    const proposedStart = startTime !== undefined ? new Date(startTime) : quiz.startTime;
    const proposedEnd = endTime !== undefined ? new Date(endTime) : quiz.endTime;

    if (startTime !== undefined || endTime !== undefined) {
      if (isNaN(proposedStart.getTime()) || isNaN(proposedEnd.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format for startTime or endTime',
        });
      }
      if (proposedEnd <= proposedStart) {
        return res.status(400).json({
          success: false,
          message: 'endTime must be later than startTime',
        });
      }
      quiz.startTime = proposedStart;
      quiz.endTime = proposedEnd;
    }

    if (maxAttempts !== undefined) {
      const ma = parseInt(maxAttempts, 10);
      if (isNaN(ma) || ma < 1) {
        return res.status(400).json({
          success: false,
          message: 'maxAttempts must be an integer >= 1',
        });
      }
      quiz.maxAttempts = ma;
    }

    if (randomizeQuestions !== undefined) {
      quiz.randomizeQuestions = Boolean(randomizeQuestions);
    }

    if (randomizeOptions !== undefined) {
      quiz.randomizeOptions = Boolean(randomizeOptions);
    }

    if (questionsPerStudent !== undefined) {
      const qps = parseInt(questionsPerStudent, 10);
      if (isNaN(qps) || qps < 0) {
        return res.status(400).json({
          success: false,
          message: 'questionsPerStudent must be a non-negative integer',
        });
      }

      const questionCount = await Question.countDocuments({ quizId: quiz._id });
      if (questionCount > 0 && qps > 0) {
        if (qps > questionCount) {
          return res.status(400).json({
            success: false,
            message: `questionsPerStudent (${qps}) cannot exceed available questions (${questionCount})`,
          });
        }
        const consistency = await quizService.validateSubsetMarksConsistency(quiz._id, qps);
        if (!consistency.valid) {
          return res.status(400).json({
            success: false,
            message: consistency.message,
          });
        }
      }
      quiz.questionsPerStudent = qps;
    }

    if (proctoringSettings && typeof proctoringSettings === 'object') {
      if (proctoringSettings.maxViolationsAllowed !== undefined) {
        quiz.proctoringSettings.maxViolationsAllowed = Math.max(1, parseInt(proctoringSettings.maxViolationsAllowed, 10) || 3);
      }
      if (proctoringSettings.autoSubmitOnMaxViolations !== undefined) {
        quiz.proctoringSettings.autoSubmitOnMaxViolations = Boolean(proctoringSettings.autoSubmitOnMaxViolations);
      }
      if (proctoringSettings.requireCamera !== undefined) {
        quiz.proctoringSettings.requireCamera = Boolean(proctoringSettings.requireCamera);
      }
      if (proctoringSettings.requireMicrophone !== undefined) {
        quiz.proctoringSettings.requireMicrophone = Boolean(proctoringSettings.requireMicrophone);
      }
    }

    await quiz.save();

    // Dynamically update total marks if questions exist
    const qCount = await Question.countDocuments({ quizId: quiz._id });
    if (qCount > 0) {
      const recalculation = await quizService.recalculateQuizTotalMarks(quiz._id);
      quiz.totalMarks = recalculation.totalMarks;
    }

    return res.status(200).json({
      success: true,
      message: 'Quiz updated successfully',
      quiz,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update quiz',
      error: error.message,
    });
  }
};

/**
 * 5. QUIZ LIFECYCLE
 *
 * Rules:
 * - draft -> published:
 *   - Requires at least 1 question.
 *   - Validates startTime and endTime (endTime > startTime and endTime > Date.now()).
 *   - Validates questionsPerStudent and equal marks consistency.
 *   - Recalculates totalMarks using quizService.
 * - published -> archived:
 *   - Retains all data in read-only mode.
 * - published -> draft:
 *   - Blocked with HTTP 409 if attempts exist.
 * - archived -> any:
 *   - Blocked with HTTP 400.
 */
const updateQuizStatus = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const { status } = req.body;

    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing Quiz ID',
      });
    }

    if (!status || !['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Permitted values: "draft", "published", "archived"',
      });
    }

    const quiz = req.quiz || (await Quiz.findById(quizId));
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }

    const isOwner = quiz.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this quiz',
      });
    }

    if (quiz.status === status) {
      return res.status(200).json({
        success: true,
        message: `Quiz is already in "${status}" status`,
        quiz,
      });
    }

    // Invariant: Archived quizzes cannot be reopened
    if (quiz.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Archived quizzes cannot be reopened or transitioned back to draft or published',
      });
    }

    // Invariant: Published quiz cannot be reverted to draft (strict unidirectional lifecycle: draft -> published -> archived)
    if (quiz.status === 'published' && status === 'draft') {
      return res.status(400).json({
        success: false,
        message:
          'Invalid status transition: A published quiz cannot be reverted to draft. Quizzes follow a strict unidirectional lifecycle: draft -> published -> archived. To withdraw a published quiz, archive it.',
      });
    }

    // TRANSITION: -> PUBLISHED
    if (status === 'published') {
      const questionCount = await Question.countDocuments({ quizId: quiz._id });
      if (questionCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish quiz: Question bank is empty. Add at least one question first.',
        });
      }

      const now = new Date();
      if (!quiz.startTime || !quiz.endTime) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish quiz: Start time and end time are required',
        });
      }
      if (new Date(quiz.endTime) <= new Date(quiz.startTime)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish quiz: End time must be later than start time',
        });
      }
      if (new Date(quiz.endTime) <= now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish quiz: Quiz end time is already in the past',
        });
      }
      if (!quiz.duration || quiz.duration < 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish quiz: Duration must be an integer of at least 1 minute',
        });
      }

      // Explicitly validate questionsPerStudent against question bank size
      if (quiz.questionsPerStudent > questionCount) {
        return res.status(400).json({
          success: false,
          message: `Cannot publish quiz: questionsPerStudent (${quiz.questionsPerStudent}) exceeds available questions in the question bank (${questionCount})`,
        });
      }

      const consistency = await quizService.validateSubsetMarksConsistency(quiz._id, quiz.questionsPerStudent);
      if (!consistency.valid) {
        return res.status(400).json({
          success: false,
          message: `Cannot publish quiz: ${consistency.message}`,
        });
      }

      const recalculation = await quizService.recalculateQuizTotalMarks(quiz._id);
      quiz.totalMarks = recalculation.totalMarks;
      quiz.status = 'published';
      await quiz.save();

      return res.status(200).json({
        success: true,
        message: 'Quiz successfully published and ready for student attempts',
        quiz,
      });
    }

    // TRANSITION: -> ARCHIVED
    if (status === 'archived') {
      quiz.status = 'archived';
      await quiz.save();

      return res.status(200).json({
        success: true,
        message: 'Quiz successfully archived. It is now read-only.',
        quiz,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update quiz status',
      error: error.message,
    });
  }
};

/**
 * 6. DELETE QUIZ
 *
 * Rules:
 * - Block deletion if student attempts exist (HTTP 409).
 * - Preserves historical attempts, scores, and malpractice logs.
 * - When permitted (0 attempts), cascades deletion of questions and quiz.
 * - Uses MongoDB transaction where supported; cleans up safely if unsupported.
 */
const deleteQuiz = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing Quiz ID',
      });
    }

    const quiz = req.quiz || (await Quiz.findById(quizId));
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found',
      });
    }

    const isOwner = quiz.createdBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this quiz',
      });
    }

    // Check attempts preservation invariant
    const attemptsCount = await Attempt.countDocuments({ quizId: quiz._id });
    if (attemptsCount > 0) {
      return res.status(409).json({
        success: false,
        message:
          'Cannot delete a quiz with existing student attempts. Historical attempts, scores, and malpractice audit records must be preserved.',
        attemptsCount,
      });
    }

    // Check associated questions count
    const questionCount = await Question.countDocuments({ quizId: quiz._id });

    if (questionCount === 0) {
      // Case 1: No questions exist. Single-document deletion is natively atomic in MongoDB.
      await Quiz.findByIdAndDelete(quiz._id);
      return res.status(200).json({
        success: true,
        message: 'Quiz deleted successfully',
      });
    }

    // Case 2: Multi-collection cascade delete. Requires ACID transaction to prevent orphaned questions.
    let session = null;
    let transactionActive = false;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        transactionActive = true;
      } catch (sessionErr) {
        session = null;
        transactionActive = false;
      }
    }

    // Invariant: Never silently perform an unsafe, non-transactional partial deletion.
    if (!transactionActive || !session) {
      return res.status(500).json({
        success: false,
        message:
          'Atomic cascade deletion is unavailable because the database environment does not support multi-document transactions (requires a replica set). Please delete questions from the question bank before deleting the quiz to prevent orphaned question records.',
      });
    }

    try {
      await Question.deleteMany({ quizId: quiz._id }, { session });
      await Quiz.findByIdAndDelete(quiz._id, { session });
      await session.commitTransaction();
    } catch (deleteErr) {
      if (session) {
        await session.abortTransaction();
      }
      throw deleteErr;
    } finally {
      if (session) {
        await session.endSession();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Quiz and all associated questions deleted successfully via atomic transaction',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete quiz',
      error: error.message,
    });
  }
};

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  updateQuizStatus,
  deleteQuiz,
};
