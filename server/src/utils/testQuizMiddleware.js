const mongoose = require('mongoose');
const { Quiz, Attempt } = require('../models');
const {
  verifyQuizOwnership,
  checkQuestionModificationLock,
  checkQuizDeletionLock,
} = require('../middleware/quizMiddleware');

async function runQuizMiddlewareTests() {
  console.log('🧪 Starting Phase 4 Task 2: Quiz Middleware & Attempt Lock Tests...\n');
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

  // Preserve original Mongoose methods
  const originalQuizFindById = Quiz.findById;
  const originalAttemptCountDocuments = Attempt.countDocuments;

  // Helper to create mock response object
  function createMockRes() {
    const res = {
      statusCode: null,
      body: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.body = payload;
        return this;
      },
    };
    return res;
  }

  // --- SUITE 1: verifyQuizOwnership ---
  console.log('🔹 1. verifyQuizOwnership Guard:');
  try {
    const facultyOwnerId = new mongoose.Types.ObjectId();
    const otherFacultyId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const validQuizId = new mongoose.Types.ObjectId();

    const mockQuiz = {
      _id: validQuizId,
      title: 'Distributed Systems Exam',
      createdBy: facultyOwnerId,
      status: 'draft',
    };

    // 1.1 Missing quizId
    const res1 = createMockRes();
    let next1 = false;
    await verifyQuizOwnership({ params: {} }, res1, () => {
      next1 = true;
    });
    assert(res1.statusCode === 400 && !next1, 'Rejects missing quizId parameter (400)');

    // 1.2 Invalid quizId format
    const res2 = createMockRes();
    let next2 = false;
    await verifyQuizOwnership({ params: { quizId: 'invalid-id-format' } }, res2, () => {
      next2 = true;
    });
    assert(res2.statusCode === 400 && !next2, 'Rejects invalid ObjectId format (400)');

    // 1.3 Quiz not found in database
    Quiz.findById = async () => null;
    const res3 = createMockRes();
    let next3 = false;
    await verifyQuizOwnership(
      { params: { quizId: validQuizId.toString() }, user: { _id: facultyOwnerId, role: 'faculty' } },
      res3,
      () => {
        next3 = true;
      }
    );
    assert(res3.statusCode === 404 && !next3, 'Returns 404 when quiz does not exist');

    // 1.4 Owner Faculty access
    Quiz.findById = async () => mockQuiz;
    const reqOwner = {
      params: { quizId: validQuizId.toString() },
      user: { _id: facultyOwnerId, role: 'faculty' },
    };
    const resOwner = createMockRes();
    let nextOwner = false;
    await verifyQuizOwnership(reqOwner, resOwner, () => {
      nextOwner = true;
    });
    assert(nextOwner === true, 'Grants access to authoring Faculty owner');
    assert(reqOwner.quiz && reqOwner.quiz._id === validQuizId, 'Attaches verified quiz to req.quiz');

    // 1.5 Admin access (can manage any quiz)
    const reqAdmin = {
      params: { quizId: validQuizId.toString() },
      user: { _id: adminId, role: 'admin' },
    };
    const resAdmin = createMockRes();
    let nextAdmin = false;
    await verifyQuizOwnership(reqAdmin, resAdmin, () => {
      nextAdmin = true;
    });
    assert(nextAdmin === true, 'Grants access to Admin user for any quiz');

    // 1.6 Non-owner Faculty access blocked
    const reqOther = {
      params: { quizId: validQuizId.toString() },
      user: { _id: otherFacultyId, role: 'faculty' },
    };
    const resOther = createMockRes();
    let nextOther = false;
    await verifyQuizOwnership(reqOther, resOther, () => {
      nextOther = true;
    });
    assert(resOther.statusCode === 403 && !nextOther, 'Rejects non-owner Faculty with HTTP 403 Forbidden');
    assert(
      resOther.body && resOther.body.message.includes('do not own'),
      'Returns descriptive ownership forbidden message'
    );
  } catch (err) {
    console.error('Suite 1 error:', err);
    failed++;
  }

  // --- SUITE 2: checkQuestionModificationLock ---
  console.log('\n🔹 2. checkQuestionModificationLock:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();

    // 2.1 Archived quiz: must reject question mutations (400)
    const reqArchived = {
      quiz: { _id: dummyQuizId, status: 'archived' },
    };
    const resArchived = createMockRes();
    let nextArchived = false;
    await checkQuestionModificationLock(reqArchived, resArchived, () => {
      nextArchived = true;
    });
    assert(
      resArchived.statusCode === 400 && !nextArchived,
      'Rejects question mutations on archived quizzes with HTTP 400'
    );
    assert(
      resArchived.body.message.includes('read-only'),
      'Message indicates archived quizzes are read-only'
    );

    // 2.2 Published quiz WITH existing student attempts: must block with 409 Conflict
    Attempt.countDocuments = async () => 3; // 3 active/completed attempts
    const reqPubWithAttempts = {
      quiz: { _id: dummyQuizId, status: 'published' },
    };
    const resPubWithAttempts = createMockRes();
    let nextPubWithAttempts = false;
    await checkQuestionModificationLock(reqPubWithAttempts, resPubWithAttempts, () => {
      nextPubWithAttempts = true;
    });
    assert(
      resPubWithAttempts.statusCode === 409 && !nextPubWithAttempts,
      'Blocks question mutations on published quiz with attempts with HTTP 409 Conflict'
    );
    assert(
      resPubWithAttempts.body.attemptsCount === 3,
      'Returns attemptsCount in conflict response body'
    );

    // 2.3 Published quiz WITHOUT attempts: allowed
    Attempt.countDocuments = async () => 0; // 0 attempts
    const reqPubNoAttempts = {
      quiz: { _id: dummyQuizId, status: 'published' },
    };
    const resPubNoAttempts = createMockRes();
    let nextPubNoAttempts = false;
    await checkQuestionModificationLock(reqPubNoAttempts, resPubNoAttempts, () => {
      nextPubNoAttempts = true;
    });
    assert(nextPubNoAttempts === true, 'Allows question mutations on published quiz when 0 attempts exist');

    // 2.4 Draft quiz: allowed
    const reqDraft = {
      quiz: { _id: dummyQuizId, status: 'draft' },
    };
    const resDraft = createMockRes();
    let nextDraft = false;
    await checkQuestionModificationLock(reqDraft, resDraft, () => {
      nextDraft = true;
    });
    assert(nextDraft === true, 'Allows question mutations on draft quiz');
  } catch (err) {
    console.error('Suite 2 error:', err);
    failed++;
  }

  // --- SUITE 3: checkQuizDeletionLock ---
  console.log('\n🔹 3. checkQuizDeletionLock:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();

    // 3.1 Quiz WITH attempts: deletion strictly blocked (409)
    Attempt.countDocuments = async () => 5;
    const reqDelBlocked = {
      quiz: { _id: dummyQuizId, status: 'published' },
    };
    const resDelBlocked = createMockRes();
    let nextDelBlocked = false;
    await checkQuizDeletionLock(reqDelBlocked, resDelBlocked, () => {
      nextDelBlocked = true;
    });
    assert(
      resDelBlocked.statusCode === 409 && !nextDelBlocked,
      'Blocks quiz deletion with HTTP 409 Conflict when student attempts exist'
    );
    assert(
      resDelBlocked.body.message.includes('preserved'),
      'Message states attempts and audit logs must be preserved'
    );

    // 3.2 Quiz WITHOUT attempts: deletion allowed
    Attempt.countDocuments = async () => 0;
    const reqDelAllowed = {
      quiz: { _id: dummyQuizId, status: 'draft' },
    };
    const resDelAllowed = createMockRes();
    let nextDelAllowed = false;
    await checkQuizDeletionLock(reqDelAllowed, resDelAllowed, () => {
      nextDelAllowed = true;
    });
    assert(nextDelAllowed === true, 'Permits quiz deletion when 0 attempts exist');
  } catch (err) {
    console.error('Suite 3 error:', err);
    failed++;
  } finally {
    // Restore original Mongoose methods
    Quiz.findById = originalQuizFindById;
    Attempt.countDocuments = originalAttemptCountDocuments;
  }

  console.log(`\n📊 Quiz Middleware Test Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runQuizMiddlewareTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running quiz middleware tests:', err);
    process.exit(1);
  });

