const mongoose = require('mongoose');
const { Quiz, Question, Attempt } = require('../models');
const quizController = require('../controllers/quizController');
const quizService = require('../utils/quizService');

async function runQuizControllerTests() {
  console.log('🧪 Starting Phase 4 Task 4: Quiz Controller CRUD & Lifecycle Tests...\n');
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

  function createMockRes() {
    return {
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
  }

  // Preserve original Mongoose & Service methods
  const originalQuizSave = Quiz.prototype.save;
  const originalQuizFindById = Quiz.findById;
  const originalQuizFind = Quiz.find;
  const originalQuizCount = Quiz.countDocuments;
  const originalQuizFindByIdAndDelete = Quiz.findByIdAndDelete;
  const originalQuestionCount = Question.countDocuments;
  const originalQuestionAggregate = Question.aggregate;
  const originalQuestionDeleteMany = Question.deleteMany;
  const originalAttemptCount = Attempt.countDocuments;
  const originalAttemptAggregate = Attempt.aggregate;
  const originalValidateSubset = quizService.validateSubsetMarksConsistency;
  const originalRecalculate = quizService.recalculateQuizTotalMarks;

  try {
    // =========================================================================
    // SECTION 1: CREATE QUIZ
    // =========================================================================
    console.log('🔹 1. Create Quiz Validation & Status Guarantees:');
    const facultyId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();

    // 1.1 Valid Draft Creation & Body Sanitization
    let savedQuizData = null;
    Quiz.prototype.save = async function () {
      savedQuizData = this.toObject();
      return this;
    };

    const validReq = {
      user: { _id: facultyId, role: 'faculty' },
      body: {
        title: 'Midterm Examination 2026',
        description: 'Comprehensive assessment on Data Structures',
        duration: 60,
        startTime: new Date(Date.now() + 3600000).toISOString(),
        endTime: new Date(Date.now() + 7200000).toISOString(),
        maxAttempts: 1,
        questionsPerStudent: 10,
        randomizeQuestions: true,
        randomizeOptions: true,
        // Attempting to inject restricted fields:
        status: 'published',
        createdBy: adminId,
        totalMarks: 500,
      },
    };
    const validRes = createMockRes();
    await quizController.createQuiz(validReq, validRes);

    assert(validRes.statusCode === 201, 'Creates quiz with HTTP 201 Created');
    assert(validRes.body.quiz.status === 'draft', 'Status is strictly initialized to "draft" (ignores body.status)');
    assert(
      validRes.body.quiz.createdBy.toString() === facultyId.toString(),
      'Sets createdBy strictly from authenticated user (ignores body.createdBy)'
    );
    assert(validRes.body.quiz.totalMarks === 0, 'Total marks strictly initialized to 0 (ignores body.totalMarks)');
    assert(validRes.body.quiz.questionsPerStudent === 10, 'Preserves configurable questionsPerStudent');

    // 1.2 Validation Rejections
    const missingTitleReq = {
      user: { _id: facultyId, role: 'faculty' },
      body: { duration: 30, startTime: new Date().toISOString(), endTime: new Date(Date.now() + 1000).toISOString() },
    };
    const missingTitleRes = createMockRes();
    await quizController.createQuiz(missingTitleReq, missingTitleRes);
    assert(missingTitleRes.statusCode === 400, 'Rejects missing title with HTTP 400');

    const invalidDatesReq = {
      user: { _id: facultyId, role: 'faculty' },
      body: {
        title: 'Invalid Quiz Dates',
        duration: 30,
        startTime: new Date(Date.now() + 10000).toISOString(),
        endTime: new Date(Date.now() + 5000).toISOString(), // endTime earlier than startTime
      },
    };
    const invalidDatesRes = createMockRes();
    await quizController.createQuiz(invalidDatesReq, invalidDatesRes);
    assert(invalidDatesRes.statusCode === 400, 'Rejects endTime earlier than startTime with HTTP 400');

    const invalidDurationReq = {
      user: { _id: facultyId, role: 'faculty' },
      body: {
        title: 'Invalid Duration Quiz',
        duration: 0,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 10000).toISOString(),
      },
    };
    const invalidDurationRes = createMockRes();
    await quizController.createQuiz(invalidDurationReq, invalidDurationRes);
    assert(invalidDurationRes.statusCode === 400, 'Rejects duration < 1 with HTTP 400');

    // =========================================================================
    // SECTION 2: LIST QUIZZES & PAGINATION
    // =========================================================================
    console.log('\n🔹 2. List Quizzes, Role Scoping & Pagination:');
    const otherFacultyId = new mongoose.Types.ObjectId();
    const mockQuizList = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Quiz 1',
        createdBy: facultyId,
        status: 'draft',
      },
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Quiz 2',
        createdBy: otherFacultyId,
        status: 'published',
      },
    ];

    Quiz.find = function (query) {
      return {
        populate: function () {
          return {
            sort: function () {
              return {
                skip: function (skipNum) {
                  return {
                    limit: function (limitNum) {
                      return {
                        lean: function () {
                          // Filter mock list based on query
                          return mockQuizList.filter((q) => {
                            if (query.createdBy && q.createdBy.toString() !== query.createdBy.toString()) {
                              return false;
                            }
                            return true;
                          });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    };
    Quiz.countDocuments = async function (query) {
      return mockQuizList.filter((q) => {
        if (query.createdBy && q.createdBy.toString() !== query.createdBy.toString()) {
          return false;
        }
        return true;
      }).length;
    };
    Question.aggregate = async function () {
      return [{ _id: mockQuizList[0]._id, count: 5 }];
    };
    Attempt.aggregate = async function () {
      return [{ _id: mockQuizList[0]._id, count: 2 }];
    };

    // 2.1 Faculty scoping: sees only own quizzes
    const facultyListReq = {
      user: { _id: facultyId, role: 'faculty' },
      query: { page: 1, limit: 10 },
    };
    const facultyListRes = createMockRes();
    await quizController.getQuizzes(facultyListReq, facultyListRes);
    assert(facultyListRes.statusCode === 200, 'Faculty lists quizzes with HTTP 200');
    assert(facultyListRes.body.count === 1, 'Faculty query scopes results strictly to own createdBy');
    assert(facultyListRes.body.quizzes[0].questionCount === 5, 'Includes dynamically computed questionCount');
    assert(facultyListRes.body.quizzes[0].attemptsCount === 2, 'Includes dynamically computed attemptsCount');

    // 2.2 Admin scoping: sees all quizzes across faculties
    const adminListReq = {
      user: { _id: adminId, role: 'admin' },
      query: { page: 1, limit: 10 },
    };
    const adminListRes = createMockRes();
    await quizController.getQuizzes(adminListReq, adminListRes);
    assert(adminListRes.statusCode === 200, 'Admin lists quizzes with HTTP 200');
    assert(adminListRes.body.count === 2, 'Admin receives all quizzes across all faculty accounts');

    // =========================================================================
    // SECTION 3: GET QUIZ DETAILS & SECURITY
    // =========================================================================
    console.log('\n🔹 3. Get Quiz Details & Ownership Security:');
    const detailedQuiz = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Detailed Quiz',
      createdBy: { _id: facultyId, name: 'Prof. Turing', email: 'turing@univ.edu', role: 'faculty' },
      status: 'published',
      duration: 45,
    };

    Quiz.findById = function () {
      return {
        populate: async function () {
          return detailedQuiz;
        },
      };
    };
    Question.countDocuments = async () => 15;
    Attempt.countDocuments = async () => 8;
    Attempt.aggregate = async () => [
      { _id: 'completed', count: 6, avgScore: 18.5 },
      { _id: 'in-progress', count: 2, avgScore: 10.0 },
    ];

    // 3.1 Owner access
    const ownerDetailReq = {
      params: { quizId: detailedQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const ownerDetailRes = createMockRes();
    await quizController.getQuizById(ownerDetailReq, ownerDetailRes);
    assert(ownerDetailRes.statusCode === 200, 'Owning Faculty retrieves quiz details with HTTP 200');
    assert(ownerDetailRes.body.statistics.questionCount === 15, 'Returns questionCount statistics');
    assert(ownerDetailRes.body.statistics.attemptsCount === 8, 'Returns attemptsCount statistics');
    assert(ownerDetailRes.body.statistics.byStatus.completed.count === 6, 'Returns detailed attempt breakdown');

    // 3.2 Non-owner Faculty access rejected
    const rogueFacultyReq = {
      params: { quizId: detailedQuiz._id.toString() },
      user: { _id: otherFacultyId, role: 'faculty' },
    };
    const rogueFacultyRes = createMockRes();
    await quizController.getQuizById(rogogueFacultyReq = rogueFacultyReq, rogueFacultyRes);
    assert(rogueFacultyRes.statusCode === 403, 'Non-owner Faculty access rejected with HTTP 403 Forbidden');

    // 3.3 Admin access permitted
    const adminDetailReq = {
      params: { quizId: detailedQuiz._id.toString() },
      user: { _id: adminId, role: 'admin' },
    };
    const adminDetailRes = createMockRes();
    await quizController.getQuizById(adminDetailReq, adminDetailRes);
    assert(adminDetailRes.statusCode === 200, 'Admin can view any quiz details with HTTP 200');

    // =========================================================================
    // SECTION 4: UPDATE QUIZ & ATTEMPT LOCKS
    // =========================================================================
    console.log('\n🔹 4. Update Quiz & Attempt Modification Locks:');
    const updateTargetQuiz = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Operating Systems',
      description: 'Initial syllabus description',
      duration: 60,
      startTime: new Date(Date.now() + 100000),
      endTime: new Date(Date.now() + 500000),
      status: 'published',
      createdBy: facultyId,
      randomizeQuestions: true,
      randomizeOptions: true,
      questionsPerStudent: 10,
      save: async function () {
        return this;
      },
    };

    Quiz.findById = async () => updateTargetQuiz;

    // 4.1 Reject direct status mutation via PUT
    const putStatusReq = {
      params: { quizId: updateTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'draft' },
    };
    const putStatusRes = createMockRes();
    await quizController.updateQuiz(putStatusReq, putStatusRes);
    assert(putStatusRes.statusCode === 400, 'Rejects modifying status via PUT with HTTP 400');

    // 4.2 When attempts exist: reject duration reduction
    Attempt.countDocuments = async () => 3; // 3 existing student attempts!
    const reduceDurationReq = {
      params: { quizId: updateTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { duration: 40 }, // Attempt to reduce from 60 to 40 mins
    };
    const reduceDurationRes = createMockRes();
    await quizController.updateQuiz(reduceDurationReq, reduceDurationRes);
    assert(reduceDurationRes.statusCode === 409, 'Rejects duration reduction with HTTP 409 Conflict when attempts exist');

    // 4.3 When attempts exist: reject randomization alterations
    const alterRandomizationReq = {
      params: { quizId: updateTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { randomizeQuestions: false },
    };
    const alterRandomizationRes = createMockRes();
    await quizController.updateQuiz(alterRandomizationReq, alterRandomizationRes);
    assert(
      alterRandomizationRes.statusCode === 409,
      'Rejects modifying randomizeQuestions with HTTP 409 Conflict when attempts exist'
    );

    // 4.4 When attempts exist: permit benign changes (description, endTime extension)
    const benignUpdateReq = {
      params: { quizId: updateTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        description: 'Updated instructions for midterm',
        endTime: new Date(Date.now() + 1000000).toISOString(), // extended deadline
      },
    };
    const benignUpdateRes = createMockRes();
    await quizController.updateQuiz(benignUpdateReq, benignUpdateRes);
    assert(benignUpdateRes.statusCode === 200, 'Allows benign description and endTime extension with HTTP 200');
    assert(
      updateTargetQuiz.description === 'Updated instructions for midterm',
      'Persists description update on quiz'
    );

    // 4.5 Archived quiz is strictly read-only
    const archivedQuiz = { ...updateTargetQuiz, status: 'archived' };
    Quiz.findById = async () => archivedQuiz;
    const updateArchivedReq = {
      params: { quizId: archivedQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { description: 'New description' },
    };
    const updateArchivedRes = createMockRes();
    await quizController.updateQuiz(updateArchivedReq, updateArchivedRes);
    assert(updateArchivedRes.statusCode === 400, 'Archived quiz rejects all updates with HTTP 400 Read-Only');

    // =========================================================================
    // SECTION 5: QUIZ LIFECYCLE (draft -> published -> archived)
    // =========================================================================
    console.log('\n🔹 5. Quiz Lifecycle Transitions & Validation:');
    const lifecycleQuiz = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Database Systems Exam',
      duration: 60,
      status: 'draft',
      startTime: new Date(Date.now() + 100000),
      endTime: new Date(Date.now() + 500000),
      createdBy: facultyId,
      questionsPerStudent: 5,
      totalMarks: 0,
      save: async function () {
        return this;
      },
    };
    Quiz.findById = async () => lifecycleQuiz;

    // 5.1 Publish with 0 questions rejected
    Question.countDocuments = async () => 0;
    const pubEmptyReq = {
      params: { quizId: lifecycleQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'published' },
    };
    const pubEmptyRes = createMockRes();
    await quizController.updateQuizStatus(pubEmptyReq, pubEmptyRes);
    assert(pubEmptyRes.statusCode === 400, 'Rejects publishing quiz when question bank is empty (HTTP 400)');

    // 5.1b Publish with questionsPerStudent exceeding question bank size rejected
    Question.countDocuments = async () => 3;
    const excessAllocationQuiz = {
      ...lifecycleQuiz,
      questionsPerStudent: 10, // 10 requested, but bank only has 3
    };
    Quiz.findById = async () => excessAllocationQuiz;
    const pubExcessReq = {
      params: { quizId: excessAllocationQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'published' },
    };
    const pubExcessRes = createMockRes();
    await quizController.updateQuizStatus(pubExcessReq, pubExcessRes);
    assert(
      pubExcessRes.statusCode === 400,
      'Rejects publishing when questionsPerStudent exceeds available questions (HTTP 400)'
    );

    // 5.2 Publish with unequal marks rejected
    Quiz.findById = async () => lifecycleQuiz;
    Question.countDocuments = async () => 10;
    quizService.validateSubsetMarksConsistency = async () => ({
      valid: false,
      message: 'All questions in the question bank must have identical marks when subset allocation is enabled',
    });
    const pubInconsistentReq = {
      params: { quizId: lifecycleQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'published' },
    };
    const pubInconsistentRes = createMockRes();
    await quizController.updateQuizStatus(pubInconsistentReq, pubInconsistentRes);
    assert(pubInconsistentRes.statusCode === 400, 'Rejects publishing when subset question marks are unequal');

    // 5.3 Valid Publish succeeds
    quizService.validateSubsetMarksConsistency = async () => ({
      valid: true,
      totalMarks: 20,
    });
    quizService.recalculateQuizTotalMarks = async () => ({
      totalMarks: 20,
      questionCount: 10,
      mode: 'subset',
    });
    const pubValidReq = {
      params: { quizId: lifecycleQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'published' },
    };
    const pubValidRes = createMockRes();
    await quizController.updateQuizStatus(pubValidReq, pubValidRes);
    assert(pubValidRes.statusCode === 200, 'Publish succeeds with HTTP 200');
    assert(lifecycleQuiz.status === 'published', 'Transitions quiz status to "published"');
    assert(lifecycleQuiz.totalMarks === 20, 'Updates totalMarks dynamically from quizService');

    // 5.4 Publish -> Archived succeeds
    const archiveReq = {
      params: { quizId: lifecycleQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'archived' },
    };
    const archiveRes = createMockRes();
    await quizController.updateQuizStatus(archiveReq, archiveRes);
    assert(archiveRes.statusCode === 200, 'Transitions published -> archived with HTTP 200');
    assert(lifecycleQuiz.status === 'archived', 'Status is now "archived"');

    // 5.5 Archived cannot reopen to draft or published
    const reopenReq = {
      params: { quizId: lifecycleQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'draft' },
    };
    const reopenRes = createMockRes();
    await quizController.updateQuizStatus(reopenReq, reopenRes);
    assert(reopenRes.statusCode === 400, 'Rejects reopening archived quiz to draft with HTTP 400');

    // 5.6 Published quiz cannot revert to draft (Strict unidirectional lifecycle)
    const publishedQuizForRevert = {
      ...lifecycleQuiz,
      status: 'published',
    };
    Quiz.findById = async () => publishedQuizForRevert;
    const revertReq = {
      params: { quizId: publishedQuizForRevert._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { status: 'draft' },
    };
    const revertRes = createMockRes();
    await quizController.updateQuizStatus(revertReq, revertRes);
    assert(
      revertRes.statusCode === 400,
      'Rejects reverting published quiz to draft (strictly enforces draft -> published -> archived)'
    );

    // =========================================================================
    // SECTION 6: DELETE QUIZ & TRANSACTION INTEGRITY
    // =========================================================================
    console.log('\n🔹 6. Delete Quiz & Preservation Invariant:');
    const deleteTargetQuiz = {
      _id: new mongoose.Types.ObjectId(),
      title: 'Quiz to Delete',
      createdBy: facultyId,
      status: 'draft',
    };
    Quiz.findById = async () => deleteTargetQuiz;

    // 6.1 Delete blocked when attempts exist
    Attempt.countDocuments = async () => 2; // existing student attempts!
    const deleteBlockedReq = {
      params: { quizId: deleteTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const deleteBlockedRes = createMockRes();
    await quizController.deleteQuiz(deleteBlockedReq, deleteBlockedRes);
    assert(
      deleteBlockedRes.statusCode === 409,
      'Blocks quiz deletion with HTTP 409 Conflict when student attempts exist'
    );

    // 6.2 Non-owner blocked from deleting
    Attempt.countDocuments = async () => 0;
    const deleteRogueReq = {
      params: { quizId: deleteTargetQuiz._id.toString() },
      user: { _id: otherFacultyId, role: 'faculty' },
    };
    const deleteRogueRes = createMockRes();
    await quizController.deleteQuiz(deleteRogueReq, deleteRogueRes);
    assert(deleteRogueRes.statusCode === 403, 'Non-owner Faculty blocked from deleting with HTTP 403');

    // 6.3 Permitted delete when 0 questions exist (Atomic single-document delete)
    Attempt.countDocuments = async () => 0;
    Question.countDocuments = async () => 0; // 0 questions
    let quizDeleted = false;
    Quiz.findByIdAndDelete = async (id) => {
      if (id.toString() === deleteTargetQuiz._id.toString()) {
        quizDeleted = true;
      }
    };
    const deleteZeroQuestionsReq = {
      params: { quizId: deleteTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const deleteZeroQuestionsRes = createMockRes();
    await quizController.deleteQuiz(deleteZeroQuestionsReq, deleteZeroQuestionsRes);
    assert(deleteZeroQuestionsRes.statusCode === 200, 'Permitted delete when 0 questions exist succeeds with HTTP 200');
    assert(quizDeleted === true, 'Deletes quiz document atomically');

    // 6.4 When questions exist and transactions are UNSUPPORTED: Refuse with HTTP 500 without partial deletion
    Question.countDocuments = async () => 5; // 5 questions exist
    // Simulating no transaction support (readyState === 0 or startSession throws)
    const originalStartSession = mongoose.startSession;
    mongoose.startSession = async () => {
      throw new Error('Transaction numbers are only allowed on a replica set member or mongos');
    };

    let partialQuestionsDeleted = false;
    Question.deleteMany = async () => {
      partialQuestionsDeleted = true;
    };

    const deleteNoTxReq = {
      params: { quizId: deleteTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const deleteNoTxRes = createMockRes();
    await quizController.deleteQuiz(deleteNoTxReq, deleteNoTxRes);
    assert(
      deleteNoTxRes.statusCode === 500,
      'Refuses deletion with HTTP 500 when transactions are unsupported to prevent partial deletion'
    );
    assert(partialQuestionsDeleted === false, 'CRITICAL: No questions were deleted (zero partial destructive deletion)');

    // 6.5 When questions exist and transactions ARE SUPPORTED: Cascade delete atomically
    let txCommitted = false;
    let questionsCascadeDeleted = false;
    let quizCascadeDeleted = false;

    // Mock active transaction session
    const mockSession = {
      startTransaction: () => {},
      commitTransaction: async () => {
        txCommitted = true;
      },
      abortTransaction: async () => {},
      endSession: async () => {},
    };
    mongoose.startSession = async () => mockSession;
    // Mock readyState as connected
    const originalConnection = mongoose.connection;
    Object.defineProperty(mongoose, 'connection', {
      value: { readyState: 1 },
      configurable: true,
    });

    Question.deleteMany = async (filter, opts) => {
      if (opts && opts.session === mockSession) {
        questionsCascadeDeleted = true;
      }
    };
    Quiz.findByIdAndDelete = async (id, opts) => {
      if (opts && opts.session === mockSession) {
        quizCascadeDeleted = true;
      }
    };

    const deleteWithTxReq = {
      params: { quizId: deleteTargetQuiz._id.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const deleteWithTxRes = createMockRes();
    await quizController.deleteQuiz(deleteWithTxReq, deleteWithTxRes);

    assert(deleteWithTxRes.statusCode === 200, 'Transactional cascade delete returns HTTP 200');
    assert(questionsCascadeDeleted === true, 'Questions deleted within transaction session');
    assert(quizCascadeDeleted === true, 'Quiz deleted within transaction session');
    assert(txCommitted === true, 'Transaction committed successfully');

    // 6.6 Admin permitted to delete quiz
    Question.countDocuments = async () => 0;
    quizDeleted = false;
    Quiz.findByIdAndDelete = async (id) => {
      quizDeleted = true;
    };
    const deleteAdminReq = {
      params: { quizId: deleteTargetQuiz._id.toString() },
      user: { _id: adminId, role: 'admin' },
    };
    const deleteAdminRes = createMockRes();
    await quizController.deleteQuiz(deleteAdminReq, deleteAdminRes);
    assert(deleteAdminRes.statusCode === 200, 'Admin permitted to delete quiz with HTTP 200');
    assert(quizDeleted === true, 'Admin delete successfully executed');

    // Restore mongoose mocks
    mongoose.startSession = originalStartSession;
    Object.defineProperty(mongoose, 'connection', {
      value: originalConnection,
      configurable: true,
    });
  } finally {
    // Restore original methods
    Quiz.prototype.save = originalQuizSave;
    Quiz.findById = originalQuizFindById;
    Quiz.find = originalQuizFind;
    Quiz.countDocuments = originalQuizCount;
    Quiz.findByIdAndDelete = originalQuizFindByIdAndDelete;
    Question.countDocuments = originalQuestionCount;
    Question.aggregate = originalQuestionAggregate;
    Question.deleteMany = originalQuestionDeleteMany;
    Attempt.countDocuments = originalAttemptCount;
    Attempt.aggregate = originalAttemptAggregate;
    quizService.validateSubsetMarksConsistency = originalValidateSubset;
    quizService.recalculateQuizTotalMarks = originalRecalculate;
  }

  console.log(`\n📊 Quiz Controller Test Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runQuizControllerTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running quiz controller tests:', err);
    process.exit(1);
  });

