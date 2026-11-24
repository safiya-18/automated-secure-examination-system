const crypto = require('crypto');
const { Quiz, Question } = require('../models');

/**
 * Cryptographically secure Fisher-Yates shuffle using Node.js crypto.randomInt
 * Unbiased and uniform permutation of elements.
 */
function secureShuffle(array) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Cryptographically secure partial Fisher-Yates reservoir sampling
 * Selects exactly k elements uniformly at random from an array of size n.
 */
function secureSample(array, k) {
  if (!Array.isArray(array) || k <= 0) return [];
  const n = array.length;
  if (k >= n) return secureShuffle(array);

  const arr = [...array];
  for (let i = 0; i < k; i++) {
    const j = crypto.randomInt(i, n);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}

/**
 * Validates question mark uniformity for subset allocation and determines total marks.
 *
 * Invariant: When questionsPerStudent is configured (subset allocation mode), every student
 * must have the exact same maximum possible score regardless of which random subset is assigned.
 * Therefore, all questions in the bank must have identical mark values.
 *
 * @param {string|mongoose.Types.ObjectId} quizId - The quiz ID to inspect.
 * @param {number} [questionsPerStudent] - Optional override; defaults to quiz.questionsPerStudent.
 * @returns {Promise<{ valid: boolean, message?: string, isSubset?: boolean, questionCount: number, allocation?: number, marksPerQuestion?: number, totalMarks?: number }>}
 */
async function validateSubsetMarksConsistency(quizId, questionsPerStudent) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    return {
      valid: false,
      message: 'Quiz not found',
      questionCount: 0,
    };
  }

  const allocation =
    questionsPerStudent !== undefined
      ? Number(questionsPerStudent)
      : Number(quiz.questionsPerStudent || 0);

  // Validate allocation number
  if (isNaN(allocation) || allocation < 0 || !Number.isInteger(allocation)) {
    return {
      valid: false,
      message: 'Questions per student must be a non-negative integer',
      questionCount: 0,
    };
  }

  const questions = await Question.find({ quizId }).select('marks');
  const questionCount = questions.length;

  // Case 1: Empty Question Bank
  if (questionCount === 0) {
    if (allocation > 0) {
      return {
        valid: false,
        message: 'Question bank is empty; cannot allocate questions for students',
        questionCount: 0,
      };
    }
    return {
      valid: true,
      isSubset: false,
      questionCount: 0,
      allocation: 0,
      totalMarks: 0,
    };
  }

  // Case 2: Allocation exceeds total available questions in pool
  if (allocation > questionCount) {
    return {
      valid: false,
      message: `Questions per student (${allocation}) exceeds available questions in the question bank (${questionCount})`,
      questionCount,
      allocation,
    };
  }

  // Case 3: Subset Allocation Mode (allocation > 0 and allocation < questionCount)
  if (allocation > 0 && allocation < questionCount) {
    const baselineMark = questions[0].marks;
    const hasDisparateMarks = questions.some((q) => q.marks !== baselineMark);

    if (hasDisparateMarks) {
      return {
        valid: false,
        isSubset: true,
        questionCount,
        allocation,
        message:
          'All questions in the question bank must have identical marks when subset allocation is enabled to guarantee equal maximum possible scores for all students',
      };
    }

    const calculatedTotalMarks = allocation * baselineMark;

    return {
      valid: true,
      isSubset: true,
      questionCount,
      allocation,
      marksPerQuestion: baselineMark,
      totalMarks: calculatedTotalMarks,
    };
  }

  // Case 4: Full Question Mode (allocation === 0 or allocation === questionCount)
  const fullTotalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  return {
    valid: true,
    isSubset: false,
    questionCount,
    allocation: questionCount,
    totalMarks: fullTotalMarks,
  };
}

/**
 * Recomputes and updates the parent Quiz.totalMarks dynamically.
 *
 * Rules:
 * - Empty question bank: totalMarks = 0
 * - Full mode (questionsPerStudent === 0 or equals question count): sum of all question marks
 * - Subset mode (questionsPerStudent > 0 and < question count): questionsPerStudent * markPerQuestion
 *
 * @param {string|mongoose.Types.ObjectId} quizId - The quiz to recalculate.
 * @returns {Promise<{ totalMarks: number, questionCount: number, mode: 'empty'|'full'|'subset' }>}
 */
async function recalculateQuizTotalMarks(quizId) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const validation = await validateSubsetMarksConsistency(quizId);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const newTotalMarks = validation.totalMarks || 0;

  // Persist updated total marks on Quiz document
  await Quiz.findByIdAndUpdate(
    quizId,
    { totalMarks: newTotalMarks },
    { new: true, runValidators: true }
  );

  return {
    totalMarks: newTotalMarks,
    questionCount: validation.questionCount,
    mode: validation.questionCount === 0 ? 'empty' : validation.isSubset ? 'subset' : 'full',
  };
}

/**
 * Generates randomized question allocation and option ordering for a student attempt.
 *
 * Core Requirements:
 * 1. Configurable per-student question count (arbitrary positive integer or 0 for full pool).
 * 2. Unbiased Fisher-Yates partial shuffle with Node.js crypto randomness.
 * 3. Tries to assign distinct question combinations across students when combinations remain.
 * 4. Gracefully permits overlap when permutations are exhausted or pool is small (never fails/crashes).
 * 5. Independent question order shuffling when randomizeQuestions is enabled.
 * 6. Independent option order shuffling when randomizeOptions is enabled, preserving original option IDs.
 * 7. Matches the existing Attempt schema: assignedQuestionOrder, assignedOptionOrder, totalMarksPossible.
 *
 * @param {object} quiz - Quiz document or object with configuration fields.
 * @param {Array<object>} allQuestions - Array of question documents belonging to the quiz.
 * @param {Set<string>|Array<string>} [existingSignatures] - Optional set of combination signatures already used.
 * @returns {{ assignedQuestionOrder: Array<any>, assignedOptionOrder: Array<{ questionId: any, shuffledOptionIds: Array<string> }>, totalMarksPossible: number, combinationSignature: string }}
 */
function generateStudentExamAllocation(quiz, allQuestions, existingSignatures) {
  if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
    throw new Error('Cannot generate exam allocation for an empty question bank');
  }

  const allocation = Number(quiz.questionsPerStudent || 0);

  // Validate allocation number
  if (isNaN(allocation) || allocation < 0 || !Number.isInteger(allocation)) {
    throw new Error('Questions per student must be a non-negative integer');
  }

  if (allocation > allQuestions.length) {
    throw new Error(
      `Questions per student (${allocation}) exceeds available question bank size (${allQuestions.length})`
    );
  }

  const isSubset = allocation > 0 && allocation < allQuestions.length;
  let totalMarksPossible = 0;

  // Marks Calculation & Uniformity Validation
  if (isSubset) {
    const baselineMark = allQuestions[0].marks;
    const hasDisparateMarks = allQuestions.some((q) => q.marks !== baselineMark);
    if (hasDisparateMarks) {
      throw new Error(
        'All questions in question bank must have identical marks in subset mode to ensure equal maximum scores'
      );
    }
    totalMarksPossible = allocation * baselineMark;
  } else {
    // Full question bank mode
    totalMarksPossible = allQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
  }

  // 1. Question Subset Selection
  let selectedQuestions = [];

  if (isSubset) {
    const signaturesSet = existingSignatures
      ? existingSignatures instanceof Set
        ? existingSignatures
        : new Set(existingSignatures)
      : null;

    // Sample with collision-avoidance retries (up to 50 attempts to find an unseen combination)
    let bestSample = null;
    let foundUnique = false;
    const maxRetries = 50;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const candidateSample = secureSample(allQuestions, allocation);
      const signature = candidateSample
        .map((q) => q._id.toString())
        .sort()
        .join(',');

      if (!signaturesSet || !signaturesSet.has(signature)) {
        bestSample = candidateSample;
        foundUnique = true;
        break;
      }

      if (!bestSample) {
        bestSample = candidateSample;
      }
    }

    // If combinations are exhausted, bestSample is used gracefully (allows overlap without failing)
    selectedQuestions = bestSample;
  } else {
    // Full question bank mode
    selectedQuestions = [...allQuestions];
  }

  const combinationSignature = selectedQuestions
    .map((q) => q._id.toString())
    .sort()
    .join(',');

  // 2. Question Order Randomization
  let orderedQuestions = [];
  if (quiz.randomizeQuestions !== false) {
    orderedQuestions = secureShuffle(selectedQuestions);
  } else {
    orderedQuestions = [...selectedQuestions];
  }

  const assignedQuestionOrder = orderedQuestions.map((q) => q._id);

  // 3. Option Order Randomization
  const assignedOptionOrder = [];
  for (const q of orderedQuestions) {
    let optionsToOrder = Array.isArray(q.options) ? [...q.options] : [];

    if (quiz.randomizeOptions !== false && optionsToOrder.length > 1) {
      optionsToOrder = secureShuffle(optionsToOrder);
    }

    assignedOptionOrder.push({
      questionId: q._id,
      shuffledOptionIds: optionsToOrder.map((opt) => opt.optionId),
    });
  }

  return {
    assignedQuestionOrder,
    assignedOptionOrder,
    totalMarksPossible,
    combinationSignature,
  };
}

/**
 * Sanitizes questions for student view based on the attempt's assigned ordering.
 *
 * Strict Student Answer Security:
 * Uses an explicit allowlist of student-visible fields:
 * - _id, questionText, questionType, marks, options: [{ optionId, text }]
 * - NEVER includes correctOptionId, even if present on the input document.
 *
 * @param {Array<object>} allQuestions - Pool of questions.
 * @param {Array<any>} assignedQuestionOrder - Ordered array of question IDs.
 * @param {Array<{ questionId: any, shuffledOptionIds: Array<string> }>} assignedOptionOrder - Ordered options mapping.
 * @returns {Array<object>} Sanitized student-visible questions array.
 */
function sanitizeQuestionsForStudent(allQuestions, assignedQuestionOrder, assignedOptionOrder) {
  if (!Array.isArray(allQuestions) || !Array.isArray(assignedQuestionOrder)) {
    return [];
  }

  // Create fast lookup maps
  const questionMap = new Map();
  for (const q of allQuestions) {
    questionMap.set(q._id.toString(), q);
  }

  const optionOrderMap = new Map();
  if (Array.isArray(assignedOptionOrder)) {
    for (const entry of assignedOptionOrder) {
      optionOrderMap.set(entry.questionId.toString(), entry.shuffledOptionIds);
    }
  }

  const sanitizedList = [];

  for (const qId of assignedQuestionOrder) {
    const rawQuestion = questionMap.get(qId.toString());
    if (!rawQuestion) continue;

    const shuffledIds = optionOrderMap.get(qId.toString());
    let arrangedOptions = [];

    if (Array.isArray(shuffledIds) && shuffledIds.length > 0) {
      // Re-order options according to attempt's assignedOptionOrder
      const rawOptionsMap = new Map();
      for (const opt of rawQuestion.options || []) {
        rawOptionsMap.set(opt.optionId, opt.text);
      }
      arrangedOptions = shuffledIds
        .filter((optId) => rawOptionsMap.has(optId))
        .map((optId) => ({
          optionId: optId,
          text: rawOptionsMap.get(optId),
        }));
    } else {
      // Fallback to original option order if no custom order specified
      arrangedOptions = (rawQuestion.options || []).map((opt) => ({
        optionId: opt.optionId,
        text: opt.text,
      }));
    }

    // Explicit allowlist projection — correctOptionId is strictly omitted
    sanitizedList.push({
      _id: rawQuestion._id,
      questionText: rawQuestion.questionText,
      questionType: rawQuestion.questionType,
      marks: rawQuestion.marks,
      options: arrangedOptions,
    });
  }

  return sanitizedList;
}

module.exports = {
  secureShuffle,
  secureSample,
  validateSubsetMarksConsistency,
  recalculateQuizTotalMarks,
  generateStudentExamAllocation,
  sanitizeQuestionsForStudent,
};
