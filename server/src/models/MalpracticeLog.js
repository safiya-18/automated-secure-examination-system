const mongoose = require('mongoose');

const malpracticeLogSchema = new mongoose.Schema(
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
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      required: [true, 'Attempt reference is required'],
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      enum: {
        values: [
          'TAB_SWITCH',
          'PAGE_HIDDEN',
          'WINDOW_BLUR',
          'FULLSCREEN_EXIT',
          'DEVTOOLS_OPEN',
          'MULTIPLE_FACES',
          'NO_FACE',
          'AUDIO_ANOMALY',
          'OTHER',
        ],
        message: '{VALUE} is not a recognized malpractice event type',
      },
    },
    eventDescription: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    severity: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        message: '{VALUE} is not a valid severity level',
      },
      default: 'MEDIUM',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast retrieval by faculty during malpractice review
malpracticeLogSchema.index({ attemptId: 1, timestamp: -1 });
malpracticeLogSchema.index({ quizId: 1, studentId: 1 });
malpracticeLogSchema.index({ severity: 1 });

const MalpracticeLog = mongoose.model('MalpracticeLog', malpracticeLogSchema);

module.exports = MalpracticeLog;

