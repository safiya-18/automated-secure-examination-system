const { verifyExamSessionToken, hashSessionToken, calculateExamExpiry } = require('../utils/examToken');
const { Attempt, Quiz, User } = require('../models');

/**
 * Exam Session Authentication Middleware.
 *
 * Dedicated strictly to student in-exam operations (PATCH /answers, POST /telemetry, POST /submit).
 * Completely separate from user session JWT middleware (verifyToken).
 *
 * Security & Integrity Guarantees:
 * 1. Extracts token from `Authorization: Bearer <token>` or `x-exam-session` header.
 * 2. Cryptographically verifies token signature, expiration, and payload type ('exam_session').
 * 3. Enforces that URL/body `attemptId` strictly matches the token's `attemptId`.
 * 4. Loads the Attempt from database with `sessionTokenHash` explicitly selected.
 * 5. Reconciles token hash against stored `attempt.sessionTokenHash` (token invalidation / rotation safety).
 * 6. Confirms attempt belongs to the token's studentId and quizId.
 * 7. Verifies student exists and is active.
 * 8. Rejects completed, terminated, or non-in-progress attempts.
 * 9. Reconciles authoritative server-side expiry:
 *      examExpiresAt = Math.min(attempt.startTime + quiz.duration, quiz.endTime)
 *    and attaches timing metadata to request object for downstream controllers.
 * 10. Attaches `req.examAttempt`, `req.examQuiz`, `req.examStudent`, and `req.examTiming`.
 */
const verifyExamSession = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization: Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fall back to custom x-exam-session header
    if (!token && req.headers['x-exam-session']) {
      token = req.headers['x-exam-session'];
    }

    // 3. Fall back to cookies (if exam session cookie is used)
    if (!token && req.cookies && req.cookies['exam-session']) {
      token = req.cookies['exam-session'];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Exam session authentication required. No session token provided.',
      });
    }

    // 4. Verify cryptographic signature, structure, and expiration
    const decoded = verifyExamSessionToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired exam session token.',
      });
    }

    const { attemptId, studentId, quizId } = decoded;

    // 5. Ensure request parameters/body attemptId (if supplied) match token claim
    const targetAttemptId = req.params.attemptId || req.body.attemptId;
    if (targetAttemptId && targetAttemptId.toString() !== attemptId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: Exam session token does not match the requested attempt ID.',
      });
    }

    // 6. Fetch attempt from database with sessionTokenHash explicitly selected
    const attempt = await Attempt.findById(attemptId).select('+sessionTokenHash');
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Exam attempt record not found.',
      });
    }

    // 7. Verify attempt ownership matches token student and quiz
    if (
      attempt.studentId.toString() !== studentId.toString() ||
      attempt.quizId.toString() !== quizId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Security violation: Attempt ownership mismatch.',
      });
    }

    // 8. Verify attempt status is strictly 'in-progress'
    if (attempt.status !== 'in-progress') {
      return res.status(409).json({
        success: false,
        message: `Attempt is no longer active. Current status: ${attempt.status}.`,
        status: attempt.status,
      });
    }

    // 9. Verify token hash against stored sessionTokenHash if present
    if (attempt.sessionTokenHash) {
      const incomingHash = hashSessionToken(token);
      if (incomingHash !== attempt.sessionTokenHash) {
        return res.status(401).json({
          success: false,
          message: 'Exam session has been invalidated or superseded by a newer session.',
        });
      }
    }

    // 10. Verify parent Quiz exists and load timing
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Associated quiz not found.',
      });
    }

    // 11. Verify student account status
    const student = await User.findById(studentId);
    if (!student || student.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Student account is inactive or not found.',
      });
    }

    // 12. Calculate authoritative server-side expiry:
    // examExpiresAt = Math.min(attempt.startTime + quiz.duration, quiz.endTime)
    const examExpiresAt = calculateExamExpiry(attempt.startTime, quiz.duration, quiz.endTime);
    const now = Date.now();
    const isExpired = now > examExpiresAt.getTime();
    const remainingMs = Math.max(0, examExpiresAt.getTime() - now);

    // Attach contextual models and timing to request
    req.examAttempt = attempt;
    req.examQuiz = quiz;
    req.examStudent = student;
    req.examTiming = {
      startTime: attempt.startTime,
      durationMinutes: quiz.duration,
      quizEndTime: quiz.endTime,
      examExpiresAt,
      isExpired,
      remainingMs,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate exam session.',
      error: error.message,
    });
  }
};

module.exports = {
  verifyExamSession,
};

