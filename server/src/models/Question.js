const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: [true, 'Option identifier is required (e.g. opt_1, opt_2)'],
      trim: true,
    },
    text: {
      type: String,
      required: [true, 'Option text is required'],
      trim: true,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz reference is required'],
    },
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    questionType: {
      type: String,
      enum: {
        values: ['multiple-choice', 'true-false'],
        message: '{VALUE} is not a supported question type',
      },
      default: 'multiple-choice',
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: function (opts) {
          return Array.isArray(opts) && opts.length >= 2;
        },
        message: 'A question must provide at least two options',
      },
    },
    // CRITICAL SECURITY REQUIREMENT:
    // select: false ensures the correct answer is NEVER exposed in student queries.
    // Only backend evaluation logic will explicitly select this field using .select('+correctOptionId').
    correctOptionId: {
      type: String,
      required: [true, 'Correct option ID is required for automatic evaluation'],
      trim: true,
      select: false,
    },
    marks: {
      type: Number,
      required: [true, 'Marks are required'],
      default: 1,
      min: [0.5, 'Marks must be at least 0.5'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
questionSchema.index({ quizId: 1 });

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;

