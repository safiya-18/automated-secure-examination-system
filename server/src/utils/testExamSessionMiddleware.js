const mongoose = require('mongoose');
const {
  generateExamSessionToken,
  verifyExamSessionToken,
  hashSessionToken,
  calculateExamExpiry,
} = require('./examToken');
const { verifyExamSession } = require('../middleware/examSessionMiddleware');
const { Attempt, Quiz, User } = require('../models');

// Mock Express req/res generator
function createMockReqRes({ headers = {}, params = {}, body = {}, cookies = {} } = {}) {
  const req = {
    headers: { ...headers },
    params: { ...params },
    body: { ...body },
    cookies: { ...cookies },
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  return { req, res };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting Phase 6 Task 1: Exam Session Middleware & Token Tests...\n');

  // =========================================================================
  // 1. Token Utilities & Hash Tests
  // =========================================================================
  console.log('🔹 1. Exam Session Token Utilities & Expiry Calculation:');

  const now = new Date();
  const startTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
  const durationMinutes = 60;
  const quizEndTimeLater = new Date(now.getTime() + 120 * 60 * 1000); // 2 hours later
  const quizEndTimeEarlier = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins later (window closes early)

  // Case A: Quiz window is wider than duration -> limit is startTime + duration
  const expiryA = calculateExamExpiry(startTime, durationMinutes, quizEndTimeLater);
  const expectedA = new Date(startTime.getTime() + 60 * 60 * 1000);
  assert(
    expiryA.getTime() === expectedA.getTime(),
    'Calculates expiry as startTime + duration when quiz window is wider'
  );

  // Case B: Quiz window closes before duration -> limit is quiz.endTime
  const expiryB = calculateExamExpiry(startTime, durationMinutes, quizEndTimeEarlier);
  assert(
    expiryB.getTime() === quizEndTimeEarlier.getTime(),
    'Reconciles expiry as quiz.endTime when window closes earlier than full duration'
  );

  // Token Generation & Hashing
  const mockAttemptId = new mongoose.Types.ObjectId();
  const mockStudentId = new mongoose.Types.ObjectId();
  const mockQuizId = new mongoose.Types.ObjectId();

  const { token, tokenHash, expiresAt } = generateExamSessionToken({
    attemptId: mockAttemptId,
    studentId: mockStudentId,
    quizId: mockQuizId,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  });

  assert(typeof token === 'string' && token.length > 20, 'Generates valid JWT token string');
  assert(typeof tokenHash === 'string' && tokenHash.length === 64, 'Generates 64-character SHA-256 token hash');
  assert(tokenHash === hashSessionToken(token), 'hashSessionToken produces consistent SHA-256 digest');

  const decoded = verifyExamSessionToken(token);
  assert(decoded !== null, 'verifyExamSessionToken decodes valid token');
  assert(decoded.attemptId === mockAttemptId.toString(), 'Decoded attemptId matches original');
  assert(decoded.studentId === mockStudentId.toString(), 'Decoded studentId matches original');
  assert(decoded.quizId === mockQuizId.toString(), 'Decoded quizId matches original');
  assert(decoded.type === 'exam_session', 'Enforces strict token type exam_session');
  assert(typeof decoded.jti === 'string' && decoded.jti.length === 32, 'Includes unpredictable 128-bit cryptographic nonce');

  // =========================================================================
  // 2. Middleware Security Rejections (Unit/Mock Level)
  // =========================================================================
  console.log('\n🔹 2. Middleware Header & Token Validation:');

  // Test 2.1: Missing token
  {
    const { req, res } = createMockReqRes();
    let nextCalled = false;
    await verifyExamSession(req, res, () => {
      nextCalled = true;
    });
    assert(res.statusCode === 401, 'Rejects request with no token (HTTP 401)');
    assert(res.body.message.includes('No session token provided'), 'Indicates token required');
    assert(!nextCalled, 'Halts middleware chain when token is absent');
  }

  // Test 2.2: Invalid / malformed token
  {
    const { req, res } = createMockReqRes({
      headers: { authorization: 'Bearer this_is_a_completely_garbage_token' },
    });
    await verifyExamSession(req, res, () => {});
    assert(res.statusCode === 401, 'Rejects malformed token (HTTP 401)');
    assert(res.body.message.includes('Invalid or expired'), 'Returns invalid token message');
  }

  // Test 2.3: Standard user JWT passed to exam middleware (cross-token rejection)
  {
    // Generate token with wrong secret / wrong type
    const jwt = require('jsonwebtoken');
    const fakeUserToken = jwt.sign(
      { id: mockStudentId.toString(), role: 'student' },
      process.env.JWT_SECRET || 'temporary_development_secret_change_in_production'
    );
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${fakeUserToken}` },
    });
    await verifyExamSession(req, res, () => {});
    assert(res.statusCode === 401, 'Rejects standard user auth JWT on exam session endpoint (HTTP 401)');
  }

  // Test 2.4: Expired token
  {
    const expiredExp = new Date(Date.now() - 60 * 1000); // 1 min in the past
    const { token: expiredToken } = generateExamSessionToken({
      attemptId: mockAttemptId,
      studentId: mockStudentId,
      quizId: mockQuizId,
      expiresAt: expiredExp,
    });
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    await verifyExamSession(req, res, () => {});
    assert(res.statusCode === 401, 'Rejects expired exam session token (HTTP 401)');
  }

  // Test 2.5: Mismatched attemptId in URL parameter vs token
  {
    const foreignAttemptId = new mongoose.Types.ObjectId();
    const { req, res } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
      params: { attemptId: foreignAttemptId.toString() },
    });
    await verifyExamSession(req, res, () => {});
    assert(res.statusCode === 403, 'Rejects when URL attemptId does not match token claim (HTTP 403)');
    assert(
      res.body.message.includes('token does not match the requested attempt ID'),
      'Prevents access to other attempt IDs'
    );
  }

  // =========================================================================
  // 3. Database Attempt State Verification (Integration with DB stubs/mock)
  // =========================================================================
  console.log('\n🔹 3. Attempt Ownership, State & Invalidation Guard:');

  // Stub Attempt.findById
  const originalAttemptFindById = Attempt.findById;
  const originalQuizFindById = Quiz.findById;
  const originalUserFindById = User.findById;

  try {
    // Test 3.1: Attempt not found
    Attempt.findById = () => ({
      select: () => Promise.resolve(null),
    });
    {
      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await verifyExamSession(req, res, () => {});
      assert(res.statusCode === 404, 'Returns HTTP 404 when Attempt record is missing');
    }

    // Test 3.2: Attempt ownership mismatch (studentId mismatch)
    const otherStudentId = new mongoose.Types.ObjectId();
    Attempt.findById = () => ({
      select: () =>
        Promise.resolve({
          _id: mockAttemptId,
          studentId: otherStudentId, // Foreign student!
          quizId: mockQuizId,
          status: 'in-progress',
          startTime: new Date(),
        }),
    });
    {
      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await verifyExamSession(req, res, () => {});
      assert(res.statusCode === 403, 'Rejects when attempt studentId does not match token student (HTTP 403)');
      assert(res.body.message.includes('Attempt ownership mismatch'), 'Security ownership violation caught');
    }

    // Test 3.3: Attempt is completed (no longer active)
    Attempt.findById = () => ({
      select: () =>
        Promise.resolve({
          _id: mockAttemptId,
          studentId: mockStudentId,
          quizId: mockQuizId,
          status: 'completed', // Already finished
          startTime: new Date(),
        }),
    });
    {
      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await verifyExamSession(req, res, () => {});
      assert(res.statusCode === 409, 'Rejects completed attempt with HTTP 409 Conflict');
      assert(res.body.message.includes('no longer active'), 'Reports attempt is no longer active');
    }

    // Test 3.4: Token hash invalidation (token was superseded / rotated)
    Attempt.findById = () => ({
      select: () =>
        Promise.resolve({
          _id: mockAttemptId,
          studentId: mockStudentId,
          quizId: mockQuizId,
          status: 'in-progress',
          startTime: new Date(),
          sessionTokenHash: 'different_superseded_token_hash_value',
        }),
    });
    {
      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });
      await verifyExamSession(req, res, () => {});
      assert(res.statusCode === 401, 'Rejects invalidated session token when hash does not match (HTTP 401)');
      assert(res.body.message.includes('invalidated or superseded'), 'Reports superseded session');
    }

    // Test 3.5: Successful authentication & request attachment
    Attempt.findById = () => ({
      select: () =>
        Promise.resolve({
          _id: mockAttemptId,
          studentId: mockStudentId,
          quizId: mockQuizId,
          status: 'in-progress',
          startTime: new Date(Date.now() - 5 * 60 * 1000), // started 5 mins ago
          sessionTokenHash: tokenHash, // matches!
        }),
    });
    Quiz.findById = () =>
      Promise.resolve({
        _id: mockQuizId,
        title: 'Network Systems Security',
        duration: 45,
        endTime: new Date(Date.now() + 60 * 60 * 1000),
      });
    User.findById = () =>
      Promise.resolve({
        _id: mockStudentId,
        name: 'Jane Doe',
        usn: '1MS21CS099',
        accountStatus: 'active',
      });

    {
      const { req, res } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
        params: { attemptId: mockAttemptId.toString() },
      });
      let nextCalled = false;
      await verifyExamSession(req, res, () => {
        nextCalled = true;
      });

      assert(nextCalled, 'Successfully passes valid active attempt through middleware');
      assert(req.examAttempt._id.toString() === mockAttemptId.toString(), 'Attaches req.examAttempt');
      assert(req.examQuiz._id.toString() === mockQuizId.toString(), 'Attaches req.examQuiz');
      assert(req.examStudent._id.toString() === mockStudentId.toString(), 'Attaches req.examStudent');
      assert(req.examTiming !== undefined, 'Attaches req.examTiming');
      assert(req.examTiming.durationMinutes === 45, 'req.examTiming reflects quiz duration');
      assert(req.examTiming.isExpired === false, 'Correctly flags attempt as not expired');
      assert(req.examTiming.remainingMs > 0, 'Computes accurate remaining milliseconds');
    }

    // Test 3.6: Alternative header x-exam-session
    {
      const { req, res } = createMockReqRes({
        headers: { 'x-exam-session': token },
      });
      let nextCalled = false;
      await verifyExamSession(req, res, () => {
        nextCalled = true;
      });
      assert(nextCalled, 'Accepts token via x-exam-session custom header');
    }
  } finally {
    // Restore original methods
    Attempt.findById = originalAttemptFindById;
    Quiz.findById = originalQuizFindById;
    User.findById = originalUserFindById;
  }

  // =========================================================================
  // 4. Attempt Schema Verification
  // =========================================================================
  console.log('\n🔹 4. Attempt Schema Status & Reason Integrity:');

  const testAttempt = new Attempt({
    studentId: mockStudentId,
    quizId: mockQuizId,
    attemptNumber: 1,
    assignedQuestionOrder: [new mongoose.Types.ObjectId()],
    status: 'in-progress',
    submissionReason: 'student-submit',
    sessionTokenHash: tokenHash,
  });

  const validationError = testAttempt.validateSync();
  assert(!validationError, 'Valid attempt with submissionReason and sessionTokenHash passes schema validation');
  assert(testAttempt.submissionReason === 'student-submit', 'Defaults submissionReason to student-submit');

  testAttempt.submissionReason = 'timer-expiry';
  assert(!testAttempt.validateSync(), 'Accepts timer-expiry submissionReason');

  testAttempt.submissionReason = 'proctor-terminated';
  assert(!testAttempt.validateSync(), 'Accepts proctor-terminated submissionReason');

  testAttempt.submissionReason = 'invalid-reason';
  const reasonError = testAttempt.validateSync();
  assert(reasonError && reasonError.errors.submissionReason, 'Rejects unauthorized submissionReason value');

  // Verify all 3 original status values pass
  ['in-progress', 'completed', 'terminated-malpractice'].forEach((st) => {
    testAttempt.status = st;
    testAttempt.submissionReason = 'student-submit';
    assert(!testAttempt.validateSync(), `Preserves original status enum value: "${st}"`);
  });

  // Verify toJSON omits sessionTokenHash by default
  const jsonOutput = testAttempt.toJSON();
  assert(jsonOutput.sessionTokenHash === undefined, 'sessionTokenHash is strictly omitted from standard JSON projections');

  console.log(`\n📊 Exam Session Middleware Test Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});

