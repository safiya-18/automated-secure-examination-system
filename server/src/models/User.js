const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Prevents password from being returned in standard queries
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'faculty', 'student'],
        message: '{VALUE} is not a valid role',
      },
      default: 'student',
    },
    usn: {
      type: String,
      trim: true,
      uppercase: true,
      // sparse: true ensures unique index applies only to documents where USN is present
      sparse: true,
      unique: true,
      // Conditional required: strictly mandatory if role is 'student'
      required: [
        function () {
          return this.role === 'student';
        },
        'USN is required for student accounts',
      ],
    },
    accountStatus: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'suspended'],
        message: '{VALUE} is not a valid account status',
      },
      default: 'active',
    },
    isPasswordTemporary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Explicit index definitions for fast lookup and uniqueness guarantee
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ usn: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });

/**
 * Pre-save middleware to automatically hash passwords securely using bcrypt.
 * Modern Mongoose async/await pattern (no next callback required).
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Method to compare an entered plaintext password with the hashed password.
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Clean serialization: ensures sensitive fields like password are never exposed in JSON output.
 */
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
