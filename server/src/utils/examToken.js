const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Secret used strictly for signing and verifying ephemeral exam session tokens.
 * Kept completely separate from the general user authentication JWT secret.
 */
const getExamSessionSecret = () => {
  return (
    process.env.EXAM_SESSION_SECRET ||
    (process.env.JWT_SECRET ? `${process.env.JWT_SECRET}_exam_session` : 'exam_session_secret_default_fallback')
  );
};

/**
 * Computes SHA-256 hash of a session token for secure database storage.
 *
 * @param {string} token
 * @returns {string} Hex-encoded SHA-256 digest
 */
const hashSessionToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Calculates authoritative exam expiration timestamp based on attempt start time,
 * quiz duration, and absolute quiz window end time.
 *
 * Formula: examExpiresAt = Math.min(attempt.startTime + quiz.duration, quiz.endTime)
 *
 * @param {Date|number|string} attemptStartTime
 * @param {number} quizDurationMinutes
 * @param {Date|number|string} quizEndTime
 * @returns {Date}
 */
const calculateExamExpiry = (attemptStartTime, quizDurationMinutes, quizEndTime) => {
  const startMs = new Date(attemptStartTime).getTime();
  const durationMs = Number(quizDurationMinutes) * 60 * 1000;
  const durationLimitMs = startMs + durationMs;

  const windowEndMs = new Date(quizEndTime).getTime();

  // If quizEndTime is a valid date, take the minimum of both bounds
  if (!isNaN(windowEndMs) && windowEndMs > 0) {
    return new Date(Math.min(durationLimitMs, windowEndMs));
  }

  return new Date(durationLimitMs);
};

/**
 * Generates an ephemeral, cryptographically unpredictable, time-limited exam session token.
 *
 * The payload is strictly scoped to one specific attempt:
 * - attemptId: string
 * - studentId: string
 * - quizId: string
 * - type: 'exam_session' (distinguishes from user auth tokens)
 * - jti: 128-bit cryptographically secure random nonce
 *
 * @param {object} params
 * @param {string|mongoose.Types.ObjectId} params.attemptId
 * @param {string|mongoose.Types.ObjectId} params.studentId
 * @param {string|mongoose.Types.ObjectId} params.quizId
 * @param {Date|number} params.expiresAt - Authoritative expiry time (can include small buffer for grace)
 * @returns {{ token: string, tokenHash: string, expiresAt: Date }}
 */
const generateExamSessionToken = ({ attemptId, studentId, quizId, expiresAt }) => {
  if (!attemptId || !studentId || !quizId) {
    throw new Error('attemptId, studentId, and quizId are strictly required to generate an exam session token');
  }

  const expDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const expSeconds = Math.floor(expDate.getTime() / 1000);

  // Unpredictable 128-bit nonce
  const nonce = crypto.randomBytes(16).toString('hex');

  const payload = {
    attemptId: attemptId.toString(),
    studentId: studentId.toString(),
    quizId: quizId.toString(),
    type: 'exam_session',
    jti: nonce,
    exp: expSeconds,
  };

  const token = jwt.sign(payload, getExamSessionSecret());
  const tokenHash = hashSessionToken(token);

  return {
    token,
    tokenHash,
    expiresAt: expDate,
  };
};

/**
 * Verifies and decodes an exam session token.
 *
 * Returns null if signature is invalid, token is expired, or type is not 'exam_session'.
 *
 * @param {string} token
 * @returns {object|null} Decoded token payload or null
 */
const verifyExamSessionToken = (token) => {
  if (!token || typeof token !== 'string') return null;

  try {
    const decoded = jwt.verify(token, getExamSessionSecret());

    // Strict type check to prevent cross-purpose token usage
    if (!decoded || decoded.type !== 'exam_session') {
      return null;
    }

    if (!decoded.attemptId || !decoded.studentId || !decoded.quizId) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
};

module.exports = {
  getExamSessionSecret,
  hashSessionToken,
  calculateExamExpiry,
  generateExamSessionToken,
  verifyExamSessionToken,
};

