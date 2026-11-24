const { User } = require('../models');
const { parseStudentCSV } = require('../utils/csvParser');

/**
 * Register a single Faculty account
 */
const createFaculty = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `An account with email "${normalizedEmail}" already exists`,
      });
    }

    const faculty = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'faculty',
      isPasswordTemporary: true, // Refinement 4: Requires password change on first login
      accountStatus: 'active',
    });

    await faculty.save();

    return res.status(201).json({
      success: true,
      message: 'Faculty account registered successfully',
      user: faculty.toJSON(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create faculty account',
      error: error.message,
    });
  }
};

/**
 * Register a single Student account
 */
const createStudent = async (req, res) => {
  try {
    const { name, email, usn, password } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsn = usn.toUpperCase().trim();

    // Check duplicate email
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: `An account with email "${normalizedEmail}" already exists`,
      });
    }

    // Check duplicate USN
    const existingUsn = await User.findOne({ usn: normalizedUsn });
    if (existingUsn) {
      return res.status(409).json({
        success: false,
        message: `A student with USN "${normalizedUsn}" is already registered`,
      });
    }

    const student = new User({
      name: name.trim(),
      email: normalizedEmail,
      usn: normalizedUsn,
      password,
      role: 'student',
      isPasswordTemporary: true, // Refinement 4: Requires password change on first login
      accountStatus: 'active',
    });

    await student.save();

    return res.status(201).json({
      success: true,
      message: 'Student account registered successfully',
      user: student.toJSON(),
    });
  } catch (error) {
    if (error.code === 11000) {
      const isUsn = error.keyPattern && error.keyPattern.usn;
      return res.status(409).json({
        success: false,
        message: isUsn
          ? 'A student with this USN is already registered'
          : 'An account with this email already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create student account',
      error: error.message,
    });
  }
};

/**
 * Bulk Student Registration Engine
 * Refinement 3: Supports both JSON array payload AND raw CSV text payload
 */
const bulkCreateStudents = async (req, res) => {
  try {
    let rawStudents = [];
    let formatErrors = [];

    // 1. Detect if payload is CSV format
    if (req.body.csv && typeof req.body.csv === 'string') {
      try {
        const parsed = parseStudentCSV(req.body.csv);
        rawStudents = parsed.students;
        formatErrors = parsed.errors;
      } catch (parseErr) {
        return res.status(400).json({
          success: false,
          message: `CSV parsing error: ${parseErr.message}`,
        });
      }
    } else if (Array.isArray(req.body.students)) {
      // JSON array payload
      rawStudents = req.body.students;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body. Expected { students: [...] } array or { csv: "..." } string',
      });
    }

    if (rawStudents.length === 0 && formatErrors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No student records provided',
      });
    }

    if (rawStudents.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Bulk registration batch exceeds maximum limit of 500 records per request',
      });
    }

    // 2. Intra-batch deduplication
    const seenEmails = new Set();
    const seenUsns = new Set();
    const candidates = [];
    const skippedDetails = [];

    for (const record of rawStudents) {
      const email = (record.email || '').toLowerCase().trim();
      const usn = (record.usn || '').toUpperCase().trim();
      const name = (record.name || '').trim();
      const password = record.password || '';

      if (!usn || !email || !name || !password || password.length < 6) {
        skippedDetails.push({
          usn: usn || 'N/A',
          email: email || 'N/A',
          reason: 'Missing required field or password shorter than 6 characters',
        });
        continue;
      }

      if (seenEmails.has(email)) {
        skippedDetails.push({ usn, email, reason: 'Duplicate email within submitted batch' });
        continue;
      }

      if (seenUsns.has(usn)) {
        skippedDetails.push({ usn, email, reason: 'Duplicate USN within submitted batch' });
        continue;
      }

      seenEmails.add(email);
      seenUsns.add(usn);
      candidates.push({ name, email, usn, password });
    }

    // 3. Database collision check
    const existingUsers = await User.find({
      $or: [
        { email: { $in: Array.from(seenEmails) } },
        { usn: { $in: Array.from(seenUsns) } },
      ],
    }).select('email usn');

    const dbEmails = new Set(existingUsers.map((u) => u.email));
    const dbUsns = new Set(existingUsers.filter((u) => u.usn).map((u) => u.usn));

    const toInsert = [];
    for (const candidate of candidates) {
      if (dbEmails.has(candidate.email)) {
        skippedDetails.push({
          usn: candidate.usn,
          email: candidate.email,
          reason: 'Email already registered in database',
        });
      } else if (dbUsns.has(candidate.usn)) {
        skippedDetails.push({
          usn: candidate.usn,
          email: candidate.email,
          reason: 'USN already registered in database',
        });
      } else {
        toInsert.push(candidate);
      }
    }

    // 4. Batch creation (individual item protection against runtime duplicate-key collision)
    const createdUsers = [];
    for (const item of toInsert) {
      try {
        const student = new User({
          name: item.name,
          email: item.email,
          usn: item.usn,
          password: item.password,
          role: 'student',
          isPasswordTemporary: true, // Refinement 4
          accountStatus: 'active',
        });
        await student.save();
        createdUsers.push(student.toJSON());
      } catch (saveErr) {
        if (saveErr.code === 11000) {
          const isUsn = saveErr.keyPattern && saveErr.keyPattern.usn;
          skippedDetails.push({
            usn: item.usn,
            email: item.email,
            reason: isUsn
              ? 'Database-level conflict: USN already exists'
              : 'Database-level conflict: Email already exists',
          });
        } else {
          skippedDetails.push({
            usn: item.usn,
            email: item.email,
            reason: saveErr.message,
          });
        }
      }
    }

    const totalRecords = rawStudents.length + formatErrors.length;

    return res.status(200).json({
      success: true,
      message: `Processed ${totalRecords} records. Created ${createdUsers.length}, skipped ${skippedDetails.length + formatErrors.length}.`,
      totalRecords,
      createdCount: createdUsers.length,
      skippedCount: skippedDetails.length + formatErrors.length,
      formatErrors,
      skippedDetails,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Bulk registration error',
      error: error.message,
    });
  }
};

/**
 * Get all users with optional filtering by role and pagination
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;

    const query = {};
    if (role && ['admin', 'faculty', 'student'].includes(role)) {
      query.role = role;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message,
    });
  }
};

module.exports = {
  createFaculty,
  createStudent,
  bulkCreateStudents,
  getAllUsers,
};

