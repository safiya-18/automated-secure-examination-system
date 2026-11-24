const mongoose = require('mongoose');

const submittedAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedOptionId: {
      type: String,
      default: null,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      default: null,
    },
    marksAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

// Preserves the deterministic shuffled order of options for each question
const optionOrderSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    shuffledOptionIds: [
      {
        type: String,
        required: true,
      },
    ],
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz reference is required'],
    },
    attemptNumber: {
      type: Number,
      default: 1,
      min: [1, 'Attempt number must be at least 1'],
    },
    // CRITICAL REQUIREMENT:
    // Assigned question and option order are stored permanently when the student starts.
    // Even if the student reloads the page, the order remains consistent.
    assignedQuestionOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
      },
    ],
    assignedOptionOrder: [optionOrderSchema],
    submittedAnswers: [submittedAnswerSchema],
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMarksPossible: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    startTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['in-progress', 'completed', 'terminated-malpractice'],
        message: '{VALUE} is not a valid attempt status',
      },
      default: 'in-progress',
    },
    submissionReason: {
      type: String,
      enum: {
        values: ['student-submit', 'timer-expiry', 'proctor-terminated'],
        message: '{VALUE} is not a valid submission reason',
      },
      default: 'student-submit',
    },
    // Cryptographic hash of the active exam session token (SHA-256)
    // Avoids storing raw tokens in the database; strictly hidden from queries by default.
    sessionTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    violationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find student attempts per quiz and prevent unauthorized duplicate active attempts
attemptSchema.index({ studentId: 1, quizId: 1, attemptNumber: 1 });
attemptSchema.index({ status: 1 });

/**
 * Clean serialization: ensures internal sensitive fields like sessionTokenHash are never exposed in JSON responses.
 */
attemptSchema.methods.toJSON = function () {
  const attemptObject = this.toObject();
  delete attemptObject.sessionTokenHash;
  delete attemptObject.__v;
  return attemptObject;
};

const Attempt = mongoose.model('Attempt', attemptSchema);

module.exports = Attempt;

