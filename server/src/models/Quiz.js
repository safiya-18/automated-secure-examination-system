const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
      maxlength: [200, 'Quiz title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty reference (createdBy) is required'],
    },
    duration: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [1, 'Duration must be at least 1 minute'],
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: [0, 'Total marks cannot be negative'],
    },
    startTime: {
      type: Date,
      required: [true, 'Quiz availability start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'Quiz availability end time is required'],
      validate: {
        validator: function (value) {
          return this.startTime ? value > this.startTime : true;
        },
        message: 'End time must be later than start time',
      },
    },
    maxAttempts: {
      type: Number,
      default: 1,
      min: [1, 'Maximum attempts must be at least 1'],
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: '{VALUE} is not a valid quiz status',
      },
      default: 'draft',
    },
    // Randomization settings
    randomizeQuestions: {
      type: Boolean,
      default: true,
    },
    randomizeOptions: {
      type: Boolean,
      default: true,
    },
    // When greater than 0, allocates a random subset of N questions per student
    questionsPerStudent: {
      type: Number,
      default: 0,
      min: [0, 'Questions per student cannot be negative'],
    },
    // Proctoring & security configuration
    proctoringSettings: {
      maxViolationsAllowed: {
        type: Number,
        default: 3,
        min: [1, 'Max violations allowed must be at least 1'],
      },
      autoSubmitOnMaxViolations: {
        type: Boolean,
        default: true,
      },
      requireCamera: {
        type: Boolean,
        default: false,
      },
      requireMicrophone: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for querying active/published quizzes within schedule window
quizSchema.index({ status: 1, startTime: 1, endTime: 1 });
quizSchema.index({ createdBy: 1 });

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;

