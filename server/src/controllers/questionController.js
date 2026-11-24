const mongoose = require('mongoose');
const { Quiz, Question, Attempt } = require('../models');
const quizService = require('../utils/quizService');
const { parseQuestionsCSV, parseQuestionsJSON } = require('../utils/questionCsvParser');

/**
 * Helper: Validates ownership or admin access for a quiz.
 * Attaches req.quiz if not already present.
 */
async function resolveQuizContext(req, res) {
  const quizId = req.params.quizId;
  if (!quizId || !mongoose.Types.ObjectId.isValid(quizId)) {
    res.status(400).json({
      success: false,
      message: 'Invalid or missing Quiz ID',
    });
    return null;
  }

  const quiz = req.quiz || (await Quiz.findById(quizId));
  if (!quiz) {
    res.status(404).json({
      success: false,
      message: 'Quiz not found',
    });
    return null;
  }

  const creatorId = quiz.createdBy._id ? quiz.createdBy._id.toString() : quiz.createdBy.toString();
  const isOwner = creatorId === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: You do not have access to this quiz',
    });
    return null;
  }

  req.quiz = quiz;
  return quiz;
}

/**
 * Helper: Enforces modification locks for question mutations.
 * - Archived quizzes are read-only (HTTP 400).
 * - Published quizzes with existing attempts are locked (HTTP 409).
 */
async function checkModificationLock(quiz, res) {
  if (quiz.status === 'archived') {
    res.status(400).json({
      success: false,
      message: 'Archived quizzes are read-only. Question bank cannot be modified.',
    });
    return false;
  }

  if (quiz.status === 'published') {
    const attemptsCount = await Attempt.countDocuments({ quizId: quiz._id });
    if (attemptsCount > 0) {
      res.status(409).json({
        success: false,
        message:
          'Cannot add, edit, or delete questions for a published quiz with existing student attempts. Archive the quiz instead.',
        attemptsCount,
      });
      return false;
    }
  }

  return true;
}

/**
 * 1. CREATE QUESTION
 *
 * Rules:
 * - Only permitted if quiz allows question modifications.
 * - Supports 'multiple-choice' and 'true-false'.
 * - Validates options array (minimum 2 options) and optionId mapping.
 * - Ensures correctOptionId references an existing option.
 * - Validates subset marks consistency if questionsPerStudent > 0.
 * - Automatically recalculates and persists Quiz.totalMarks.
 */
const createQuestion = async (req, res) => {
  try {
    const quiz = await resolveQuizContext(req, res);
    if (!quiz) return;

    const canModify = await checkModificationLock(quiz, res);
    if (!canModify) return;

    const { questionText, questionType = 'multiple-choice', options, correctOptionId, marks = 1 } = req.body;

    // Validate Question Text
    if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Question text is required',
      });
    }

    // Validate Question Type
    if (!['multiple-choice', 'true-false'].includes(questionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question type. Supported types: "multiple-choice", "true-false"',
      });
    }

    // Validate & Normalize Options
    let formattedOptions = [];
    if (questionType === 'true-false') {
      formattedOptions = [
        { optionId: 'opt_1', text: 'True' },
        { optionId: 'opt_2', text: 'False' },
      ];
    } else {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Multiple choice questions must have at least two options',
        });
      }

      for (let i = 0; i < options.length; i++) {
        const item = options[i];
        const optText = typeof item === 'string' ? item.trim() : item?.text?.trim();
        const optId = item?.optionId || `opt_${i + 1}`;

        if (!optText) {
          return res.status(400).json({
            success: false,
            message: `Option ${i + 1} text cannot be empty`,
          });
        }

        formattedOptions.push({
          optionId: optId,
          text: optText,
        });
      }
    }

    // Validate Correct Option ID
    let resolvedCorrectId = (correctOptionId || '').trim();
    if (questionType === 'true-false') {
      const lower = resolvedCorrectId.toLowerCase();
      if (lower === 'true' || lower === 't' || lower === '1' || lower === 'opt_1') {
        resolvedCorrectId = 'opt_1';
      } else if (lower === 'false' || lower === 'f' || lower === '2' || lower === 'opt_2') {
        resolvedCorrectId = 'opt_2';
      }
    } else {
      // Allow 'A' -> 'opt_1', 'B' -> 'opt_2', etc.
      const letterMatch = resolvedCorrectId.match(/^[A-E]$/i);
      if (letterMatch) {
        const idx = letterMatch[0].toUpperCase().charCodeAt(0) - 64;
        resolvedCorrectId = `opt_${idx}`;
      }
    }

    const optionExists = formattedOptions.some((opt) => opt.optionId === resolvedCorrectId);
    if (!optionExists) {
      return res.status(400).json({
        success: false,
        message: `correctOptionId "${correctOptionId}" does not match any valid option in this question`,
      });
    }

    // Validate Marks
    const parsedMarks = Number(marks);
    if (isNaN(parsedMarks) || parsedMarks < 0.5) {
      return res.status(400).json({
        success: false,
        message: 'Marks must be a positive number of at least 0.5',
      });
    }

    // Subset Marks Consistency Invariant
    if (quiz.questionsPerStudent > 0) {
      const existingQuestions = await Question.find({ quizId: quiz._id }).select('marks');
      if (existingQuestions.length > 0) {
        const baselineMark = existingQuestions[0].marks;
        if (parsedMarks !== baselineMark) {
          return res.status(400).json({
            success: false,
            message: `All questions must have identical marks (${baselineMark}) when subset allocation is enabled (received ${parsedMarks})`,
          });
        }
      }
    }

    // Create question
    const question = new Question({
      quizId: quiz._id,
      questionText: questionText.trim(),
      questionType,
      options: formattedOptions,
      correctOptionId: resolvedCorrectId,
      marks: parsedMarks,
    });

    await question.save();

    // Recalculate Quiz Total Marks dynamically; roll back question on recalculation failure
    let recalculation;
    try {
      recalculation = await quizService.recalculateQuizTotalMarks(quiz._id);
    } catch (recalcErr) {
      await Question.findByIdAndDelete(question._id).catch(() => {});
      throw new Error(`Failed to recalculate total marks: ${recalcErr.message}. Question creation rolled back.`);
    }

    return res.status(201).json({
      success: true,
      message: 'Question created successfully',
      question,
      totalMarks: recalculation.totalMarks,
      questionCount: recalculation.questionCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create question',
      error: error.message,
    });
  }
};

/**
 * 2. LIST QUESTIONS FOR FACULTY/ADMIN
 *
 * Rules:
 * - Only authorized Faculty owner or Admin can access.
 * - Explicitly retrieves correctOptionId using .select('+correctOptionId') for faculty management.
 * - Supports pagination with page & limit.
 */
const getQuestions = async (req, res) => {
  try {
    const quiz = await resolveQuizContext(req, res);
    if (!quiz) return;

    const { page, limit } = req.query;

    let query = Question.find({ quizId: quiz._id })
      .select('+correctOptionId') // Explicit answer-key projection for authorized faculty management
      .sort({ createdAt: 1 });

    let pagination = null;
    const total = await Question.countDocuments({ quizId: quiz._id });

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      query = query.skip(skip).limit(limitNum);
      pagination = {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      };
    }

    const questions = await query;

    return res.status(200).json({
      success: true,
      count: questions.length,
      pagination: pagination || { total, page: 1, limit: total, totalPages: 1 },
      questions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve questions',
      error: error.message,
    });
  }
};

/**
 * 3. GET SINGLE QUESTION BY ID
 *
 * Rules:
 * - Verified Faculty owner or Admin access only.
 * - Selects +correctOptionId for authoring faculty review.
 */
const getQuestionById = async (req, res) => {
  try {
    const quiz = await resolveQuizContext(req, res);
    if (!quiz) return;

    const { questionId } = req.params;
    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing Question ID',
      });
    }

    const question = await Question.findOne({
      _id: questionId,
      quizId: quiz._id,
    }).select('+correctOptionId');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found in this quiz',
      });
    }

    return res.status(200).json({
      success: true,
      question,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve question',
      error: error.message,
    });
  }
};

/**
 * 4. UPDATE QUESTION
 *
 * Rules:
 * - Checks quiz modification lock (blocked if published with attempts or archived).
 * - Validates updated fields.
 * - Updates question and recalculates Quiz.totalMarks dynamically.
 */
const updateQuestion = async (req, res) => {
  try {
    const quiz = await resolveQuizContext(req, res);
    if (!quiz) return;

    const canModify = await checkModificationLock(quiz, res);
    if (!canModify) return;

    const { questionId } = req.params;
    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing Question ID',
      });
    }

    const question = await Question.findOne({
      _id: questionId,
      quizId: quiz._id,
    }).select('+correctOptionId');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found in this quiz',
      });
    }

    // Snapshot previous question state for rollback on recalculation failure
    const previousSnapshot = {
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options ? [...question.options.map(o => ({ optionId: o.optionId, text: o.text }))] : [],
      correctOptionId: question.correctOptionId,
      marks: question.marks,
    };

    const { questionText, questionType, options, correctOptionId, marks } = req.body;

    if (questionText !== undefined) {
      if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Question text cannot be empty',
        });
      }
      question.questionText = questionText.trim();
    }

    if (questionType !== undefined) {
      if (!['multiple-choice', 'true-false'].includes(questionType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid question type. Supported: "multiple-choice", "true-false"',
        });
      }
      question.questionType = questionType;
    }

    const currentType = questionType !== undefined ? questionType : question.questionType;

    // Update Options
    if (options !== undefined || questionType !== undefined) {
      if (currentType === 'true-false') {
        question.options = [
          { optionId: 'opt_1', text: 'True' },
          { optionId: 'opt_2', text: 'False' },
        ];
      } else if (options !== undefined) {
        if (!Array.isArray(options) || options.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Multiple-choice questions must provide at least two options',
          });
        }

        const newOptions = [];
        for (let i = 0; i < options.length; i++) {
          const item = options[i];
          const optText = typeof item === 'string' ? item.trim() : item?.text?.trim();
          const optId = item?.optionId || `opt_${i + 1}`;

          if (!optText) {
            return res.status(400).json({
              success: false,
              message: `Option ${i + 1} text cannot be empty`,
            });
          }
          newOptions.push({ optionId: optId, text: optText });
        }
        question.options = newOptions;
      }
    }

    // Update Correct Option ID
    if (correctOptionId !== undefined) {
      let resolvedCorrectId = (correctOptionId || '').trim();
      if (currentType === 'true-false') {
        const lower = resolvedCorrectId.toLowerCase();
        if (lower === 'true' || lower === 't' || lower === '1' || lower === 'opt_1') {
          resolvedCorrectId = 'opt_1';
        } else if (lower === 'false' || lower === 'f' || lower === '2' || lower === 'opt_2') {
          resolvedCorrectId = 'opt_2';
        }
      } else {
        const letterMatch = resolvedCorrectId.match(/^[A-E]$/i);
        if (letterMatch) {
          const idx = letterMatch[0].toUpperCase().charCodeAt(0) - 64;
          resolvedCorrectId = `opt_${idx}`;
        }
      }

      const optionExists = question.options.some((opt) => opt.optionId === resolvedCorrectId);
      if (!optionExists) {
        return res.status(400).json({
          success: false,
          message: `correctOptionId "${correctOptionId}" does not reference an existing option`,
        });
      }
      question.correctOptionId = resolvedCorrectId;
    }

    // Update Marks
    if (marks !== undefined) {
      const parsedMarks = Number(marks);
      if (isNaN(parsedMarks) || parsedMarks < 0.5) {
        return res.status(400).json({
          success: false,
          message: 'Marks must be a positive number of at least 0.5',
        });
      }

      if (quiz.questionsPerStudent > 0) {
        const otherQuestions = await Question.find({
          quizId: quiz._id,
          _id: { $ne: question._id },
        }).select('marks');

        if (otherQuestions.length > 0 && otherQuestions[0].marks !== parsedMarks) {
          return res.status(400).json({
            success: false,
            message: `All questions must have identical marks (${otherQuestions[0].marks}) in subset mode`,
          });
        }
      }

      question.marks = parsedMarks;
    }

    await question.save();

    // Recalculate Quiz Total Marks dynamically; roll back question on recalculation failure
    let recalculation;
    try {
      recalculation = await quizService.recalculateQuizTotalMarks(quiz._id);
    } catch (recalcErr) {
      Object.assign(question, previousSnapshot);
      await question.save().catch(() => {});
      throw new Error(`Failed to recalculate total marks: ${recalcErr.message}. Question update rolled back.`);
    }

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      question,
      totalMarks: recalculation.totalMarks,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update question',
      error: error.message,
    });
  }
};

/**
 * 5. DELETE QUESTION
 *
 * Rules:
 * - Checks quiz modification lock (blocked if published with attempts or archived).
 * - Deletes question and recalculates Quiz.totalMarks dynamically.
 * - Rolls back deleted question if total marks recalculation fails.
 */
const deleteQuestion = async (req, res) => {
  try {
    const quiz = await resolveQuizContext(req, res);
    if (!quiz) return;

    const canModify = await checkModificationLock(quiz, res);
    if (!canModify) return;

    const { questionId } = req.params;
    if (!questionId || !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing Question ID',
      });
    }

    const question = await Question.findOneAndDelete({
      _id: questionId,
      quizId: quiz._id,
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found in this quiz',
      });
    }

    // Recalculate Quiz Total Marks dynamically; restore question on recalculation failure
    let recalculation;
    try {
      recalculation = await quizService.recalculateQuizTotalMarks(quiz._id);
    } catch (recalcErr) {
      const restoredDoc = new Question(question.toObject ? question.toObject() : question);
      await restoredDoc.save().catch(() => {});
      throw new Error(`Failed to recalculate total marks: ${recalcErr.message}. Question deletion rolled back.`);
    }

    return res.status(200).json({
      success: true,
      message: 'Question deleted successfully',
      totalMarks: recalculation.totalMarks,
      questionCount: recalculation.questionCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete question',
      error: error.message,
    });
  }
};

/**
 * 6. BULK IMPORT QUESTIONS (CSV & JSON)
 *
 * Rules:
 * - Checks quiz modification lock.
 * - Detects CSV string or JSON array from request.
 * - Parses payload with row-level validation errors.
 * - Validates subset marks consistency.
 * - Inserts all valid questions and recalculates Quiz.totalMarks dynamically.
 */
const bulkImportQuestions = async (req, res) => {
  try {
    const quiz = await resolveQuizContext(req, res);
    if (!quiz) return;

    const canModify = await checkModificationLock(quiz, res);
    if (!canModify) return;

    let parseResult = null;

    // Detect CSV input
    if (typeof req.body === 'string' || (req.body && typeof req.body.csv === 'string')) {
      const csvData = typeof req.body === 'string' ? req.body : req.body.csv;
      parseResult = parseQuestionsCSV(csvData);
    } else if (Array.isArray(req.body) || (req.body && Array.isArray(req.body.questions))) {
      const jsonData = Array.isArray(req.body) ? req.body : req.body.questions;
      parseResult = parseQuestionsJSON(jsonData);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload format. Expected CSV string or JSON array of questions',
      });
    }

    const { questions: validQuestions, errors, totalReceived, errorCount } = parseResult;

    if (!validQuestions || validQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid questions found in import payload',
        totalReceived,
        errorCount,
        errors,
      });
    }

    // Validate Subset Marks Uniformity across batch & existing pool
    if (quiz.questionsPerStudent > 0) {
      const existingQuestions = await Question.find({ quizId: quiz._id }).select('marks');
      const baselineMark = existingQuestions.length > 0 ? existingQuestions[0].marks : validQuestions[0].marks;

      const hasDisparate = validQuestions.some((q) => q.marks !== baselineMark);
      if (hasDisparate) {
        return res.status(400).json({
          success: false,
          message: `All imported questions must have uniform marks (${baselineMark}) when subset allocation is enabled`,
          totalReceived,
          errorCount,
          errors,
        });
      }
    }

    // Attach parent quizId to each question
    const docsToInsert = validQuestions.map((q) => ({
      ...q,
      quizId: quiz._id,
    }));

    // Multi-document transaction session handling
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

    let inserted = [];
    let recalculation = null;

    try {
      if (transactionActive && session) {
        inserted = await Question.insertMany(docsToInsert, { session });
        recalculation = await quizService.recalculateQuizTotalMarks(quiz._id);
        await session.commitTransaction();
      } else {
        // Standalone MongoDB without replica set: insertMany alone is NOT transactionally atomic.
        // We track inserted documents and apply compensating rollback if recalculation fails.
        inserted = await Question.insertMany(docsToInsert);
        try {
          recalculation = await quizService.recalculateQuizTotalMarks(quiz._id);
        } catch (recalcErr) {
          // Compensating rollback: delete inserted questions to prevent corrupted question count / marks
          if (inserted.length > 0) {
            const insertedIds = inserted.map((d) => d._id);
            await Question.deleteMany({ _id: { $in: insertedIds } }).catch(() => {});
            await quizService.recalculateQuizTotalMarks(quiz._id).catch(() => {});
          }
          throw recalcErr;
        }
      }
    } catch (insertError) {
      if (transactionActive && session) {
        await session.abortTransaction().catch(() => {});
      }
      throw insertError;
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
    }

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${inserted.length} questions into question bank`,
      importedCount: inserted.length,
      totalReceived,
      errorCount,
      errors,
      totalMarks: recalculation.totalMarks,
      questionCount: recalculation.questionCount,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk import questions',
      error: error.message,
    });
  }
};

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  bulkImportQuestions,
};

