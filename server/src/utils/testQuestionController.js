const mongoose = require('mongoose');
const { Quiz, Question, Attempt } = require('../models');
const questionController = require('../controllers/questionController');
const quizService = require('../utils/quizService');

async function runQuestionControllerTests() {
  console.log('🧪 Starting Phase 4 Task 5: Question Controller CRUD & Answer Protection Tests...\n');
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

  // Preserve original Mongoose methods
  const originalQuizFindById = Quiz.findById;
  const originalQuestionFind = Question.find;
  const originalQuestionFindOne = Question.findOne;
  const originalQuestionFindOneAndDelete = Question.findOneAndDelete;
  const originalQuestionCount = Question.countDocuments;
  const originalQuestionInsertMany = Question.insertMany;
  const originalQuestionSave = Question.prototype.save;
  const originalAttemptCount = Attempt.countDocuments;
  const originalRecalculate = quizService.recalculateQuizTotalMarks;

  try {
    const facultyId = new mongoose.Types.ObjectId();
    const otherFacultyId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const mockQuizId = new mongoose.Types.ObjectId();

    const mockQuiz = {
      _id: mockQuizId,
      title: 'Data Structures Midterm',
      createdBy: facultyId,
      status: 'draft',
      duration: 60,
      questionsPerStudent: 0,
      totalMarks: 0,
    };

    Quiz.findById = async () => mockQuiz;
    Attempt.countDocuments = async () => 0; // 0 attempts by default
    quizService.recalculateQuizTotalMarks = async () => ({
      totalMarks: 4,
      questionCount: 2,
      mode: 'full',
    });

    // =========================================================================
    // SECTION 1: CREATE QUESTION (MCQ & TRUE/FALSE)
    // =========================================================================
    console.log('🔹 1. Create Question Validation & Answer Integrity:');

    // 1.1 Valid MCQ creation
    let savedQuestionData = null;
    Question.prototype.save = async function () {
      savedQuestionData = this.toObject ? this.toObject() : this;
      return this;
    };

    const validMcqReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        questionText: 'What is the time complexity of binary search?',
        questionType: 'multiple-choice',
        options: [
          { optionId: 'opt_1', text: 'O(1)' },
          { optionId: 'opt_2', text: 'O(n)' },
          { optionId: 'opt_3', text: 'O(log n)' },
          { optionId: 'opt_4', text: 'O(n^2)' },
        ],
        correctOptionId: 'opt_3',
        marks: 2,
      },
    };
    const validMcqRes = createMockRes();
    await questionController.createQuestion(validMcqReq, validMcqRes);

    assert(validMcqRes.statusCode === 201, 'Creates valid MCQ with HTTP 201 Created');
    assert(validMcqRes.body.question.quizId.toString() === mockQuizId.toString(), 'Associates question with parent quizId');
    assert(validMcqRes.body.question.options.length === 4, 'Constructs 4 options correctly');
    assert(validMcqRes.body.question.correctOptionId === 'opt_3', 'Stores designated correctOptionId');
    assert(validMcqRes.body.totalMarks === 4, 'Returns updated totalMarks from quizService');

    // 1.2 Valid True/False creation
    const validTfReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        questionText: 'HTTP is a stateful protocol.',
        questionType: 'true-false',
        correctOptionId: 'false', // Should map to opt_2
        marks: 1,
      },
    };
    const validTfRes = createMockRes();
    await questionController.createQuestion(validTfReq, validTfRes);

    assert(validTfRes.statusCode === 201, 'Creates valid True/False question with HTTP 201');
    assert(validTfRes.body.question.options.length === 2, 'True/False question has exactly two options (True and False)');
    assert(validTfRes.body.question.correctOptionId === 'opt_2', 'Normalizes "false" to "opt_2"');

    // 1.3 Validation: Unreferenced correctOptionId
    const unrefReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        questionText: 'Invalid options question',
        questionType: 'multiple-choice',
        options: [
          { optionId: 'opt_1', text: 'Choice 1' },
          { optionId: 'opt_2', text: 'Choice 2' },
        ],
        correctOptionId: 'opt_99', // Non-existent option
        marks: 1,
      },
    };
    const unrefRes = createMockRes();
    await questionController.createQuestion(unrefReq, unrefRes);
    assert(unrefRes.statusCode === 400, 'Rejects unreferenced correctOptionId with HTTP 400');

    // 1.4 Validation: Missing question text
    const noTextReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        questionType: 'true-false',
        correctOptionId: 'opt_1',
        marks: 1,
      },
    };
    const noTextRes = createMockRes();
    await questionController.createQuestion(noTextReq, noTextRes);
    assert(noTextRes.statusCode === 400, 'Rejects empty question text with HTTP 400');

    // 1.5 Validation: Subset Mode marks consistency check
    const subsetQuiz = {
      ...mockQuiz,
      questionsPerStudent: 5,
    };
    Quiz.findById = async () => subsetQuiz;
    Question.find = () => ({
      select: async () => [{ marks: 2 }, { marks: 2 }],
    });

    const disparateReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        questionText: 'Unequal marks question',
        questionType: 'true-false',
        correctOptionId: 'opt_1',
        marks: 1, // baseline is 2, this is 1
      },
    };
    const disparateRes = createMockRes();
    await questionController.createQuestion(disparateReq, disparateRes);
    assert(disparateRes.statusCode === 400, 'Rejects question with disparate marks in subset allocation mode');

    // 1.6 Failure Rollback Invariant: When recalculation fails, roll back created question
    Quiz.findById = async () => mockQuiz;
    let rollbackQuestionDeleted = false;
    const originalFindByIdAndDelete = Question.findByIdAndDelete;
    Question.findByIdAndDelete = async () => {
      rollbackQuestionDeleted = true;
    };
    quizService.recalculateQuizTotalMarks = async () => {
      throw new Error('Database recalculation failure simulation');
    };

    const failRecalcReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        questionText: 'Rollback test question',
        questionType: 'true-false',
        correctOptionId: 'opt_1',
        marks: 1,
      },
    };
    const failRecalcRes = createMockRes();
    await questionController.createQuestion(failRecalcReq, failRecalcRes);

    assert(failRecalcRes.statusCode === 500, 'Returns HTTP 500 on recalculation failure');
    assert(rollbackQuestionDeleted === true, 'Rolls back created question document if recalculation fails');

    // Restore methods for remaining tests
    Question.findByIdAndDelete = originalFindByIdAndDelete;
    quizService.recalculateQuizTotalMarks = async () => ({
      totalMarks: 4,
      questionCount: 2,
      mode: 'full',
    });

    // =========================================================================
    // SECTION 2: ATTEMPT MODIFICATION LOCKS & OWNERSHIP
    // =========================================================================
    console.log('\n🔹 2. Attempt Modification Locks & Ownership Security:');
    Quiz.findById = async () => mockQuiz;

    // 2.1 Non-owner faculty access rejected
    const rogueReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: otherFacultyId, role: 'faculty' },
      body: { questionText: 'Rogue Question', correctOptionId: 'opt_1', marks: 1 },
    };
    const rogueRes = createMockRes();
    await questionController.createQuestion(rogueReq, rogueRes);
    assert(rogueRes.statusCode === 403, 'Non-owner Faculty blocked with HTTP 403 Forbidden');

    // 2.2 Archived quiz is strictly read-only
    const archivedQuiz = { ...mockQuiz, status: 'archived' };
    Quiz.findById = async () => archivedQuiz;
    const archivedReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { questionText: 'Archived Question', questionType: 'true-false', correctOptionId: 'opt_1' },
    };
    const archivedRes = createMockRes();
    await questionController.createQuestion(archivedReq, archivedRes);
    assert(archivedRes.statusCode === 400, 'Archived quiz rejects question creation with HTTP 400 Read-Only');

    // 2.3 Published quiz with existing student attempts locks questions
    const publishedWithAttemptsQuiz = { ...mockQuiz, status: 'published' };
    Quiz.findById = async () => publishedWithAttemptsQuiz;
    Attempt.countDocuments = async () => 4; // 4 attempts exist!

    const lockReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { questionText: 'Attempt-locked Question', questionType: 'true-false', correctOptionId: 'opt_1' },
    };
    const lockRes = createMockRes();
    await questionController.createQuestion(lockReq, lockRes);
    assert(lockRes.statusCode === 409, 'Published quiz with attempts locks question creation with HTTP 409 Conflict');

    // 2.4 Published quiz with 0 attempts permits question creation
    Attempt.countDocuments = async () => 0; // 0 attempts
    const zeroAttemptsReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { questionText: 'Zero-attempts Question', questionType: 'true-false', correctOptionId: 'opt_1' },
    };
    const zeroAttemptsRes = createMockRes();
    await questionController.createQuestion(zeroAttemptsReq, zeroAttemptsRes);
    assert(zeroAttemptsRes.statusCode === 201, 'Published quiz with 0 attempts permits question creation (HTTP 201)');

    // =========================================================================
    // SECTION 3: LIST QUESTIONS & ANSWER-KEY PROJECTION
    // =========================================================================
    console.log('\n🔹 3. List Questions & Answer-Key Management Projection:');
    Quiz.findById = async () => mockQuiz;

    const mockQuestions = [
      {
        _id: new mongoose.Types.ObjectId(),
        quizId: mockQuizId,
        questionText: 'Q1',
        options: [{ optionId: 'opt_1', text: 'A' }, { optionId: 'opt_2', text: 'B' }],
        correctOptionId: 'opt_1',
        marks: 1,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        quizId: mockQuizId,
        questionText: 'Q2',
        options: [{ optionId: 'opt_1', text: 'True' }, { optionId: 'opt_2', text: 'False' }],
        correctOptionId: 'opt_2',
        marks: 1,
      },
    ];

    Question.find = () => ({
      select: function (proj) {
        this.selectedProj = proj;
        return {
          sort: function () {
            return mockQuestions;
          },
        };
      },
    });
    Question.countDocuments = async () => 2;

    // 3.1 Owner faculty lists questions (gets correctOptionId)
    const listReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      query: {},
    };
    const listRes = createMockRes();
    await questionController.getQuestions(listReq, listRes);

    assert(listRes.statusCode === 200, 'Owner Faculty retrieves questions with HTTP 200');
    assert(listRes.body.count === 2, 'Returns full count of questions in bank');
    assert(listRes.body.questions[0].correctOptionId === 'opt_1', 'Explicitly includes correctOptionId for faculty management');

    // 3.2 Non-owner faculty blocked from viewing question bank
    const rogueListReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: otherFacultyId, role: 'faculty' },
      query: {},
    };
    const rogueListRes = createMockRes();
    await questionController.getQuestions(rogueListReq, rogueListRes);
    assert(rogueListRes.statusCode === 403, 'Non-owner Faculty blocked from reading questions with HTTP 403');

    // 3.3 Admin can view question bank
    const adminListReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: adminId, role: 'admin' },
      query: {},
    };
    const adminListRes = createMockRes();
    await questionController.getQuestions(adminListReq, adminListRes);
    assert(adminListRes.statusCode === 200, 'Admin can view question bank with HTTP 200');

    // =========================================================================
    // SECTION 4: GET SINGLE QUESTION BY ID
    // =========================================================================
    console.log('\n🔹 4. Get Question By ID:');
    const targetQId = mockQuestions[0]._id;

    Question.findOne = () => ({
      select: async () => mockQuestions[0],
    });

    const getOneReq = {
      params: { quizId: mockQuizId.toString(), questionId: targetQId.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const getOneRes = createMockRes();
    await questionController.getQuestionById(getOneReq, getOneRes);

    assert(getOneRes.statusCode === 200, 'Retrieves single question with HTTP 200');
    assert(getOneRes.body.question.questionText === 'Q1', 'Question text matches target');
    assert(getOneRes.body.question.correctOptionId === 'opt_1', 'Includes correctOptionId for faculty review');

    // =========================================================================
    // SECTION 5: UPDATE QUESTION
    // =========================================================================
    console.log('\n🔹 5. Update Question & Total Marks Recalculation:');
    const editableQuestion = {
      _id: targetQId,
      quizId: mockQuizId,
      questionText: 'Old text',
      questionType: 'multiple-choice',
      options: [
        { optionId: 'opt_1', text: 'Old A' },
        { optionId: 'opt_2', text: 'Old B' },
      ],
      correctOptionId: 'opt_1',
      marks: 1,
      save: async function () {
        return this;
      },
    };

    Question.findOne = () => ({
      select: async () => editableQuestion,
    });
    Attempt.countDocuments = async () => 0;

    const updateReq = {
      params: { quizId: mockQuizId.toString(), questionId: targetQId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: {
        questionText: 'Updated question text',
        marks: 3,
      },
    };
    const updateRes = createMockRes();
    await questionController.updateQuestion(updateReq, updateRes);

    assert(updateRes.statusCode === 200, 'Updates question with HTTP 200');
    assert(editableQuestion.questionText === 'Updated question text', 'Persists updated text');
    assert(editableQuestion.marks === 3, 'Persists updated marks');

    // 5.2 Attempt lock check on update
    Attempt.countDocuments = async () => 2; // attempts exist!
    Quiz.findById = async () => ({ ...mockQuiz, status: 'published' });
    const lockUpdateReq = {
      params: { quizId: mockQuizId.toString(), questionId: targetQId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: { questionText: 'Locked edit' },
    };
    const lockUpdateRes = createMockRes();
    await questionController.updateQuestion(lockUpdateReq, lockUpdateRes);
    assert(lockUpdateRes.statusCode === 409, 'Blocks question editing with HTTP 409 when attempts exist');

    // =========================================================================
    // SECTION 6: DELETE QUESTION
    // =========================================================================
    console.log('\n🔹 6. Delete Question & Attempt Guard:');
    Quiz.findById = async () => mockQuiz;
    Attempt.countDocuments = async () => 0;
    Question.findOneAndDelete = async () => editableQuestion;

    const deleteReq = {
      params: { quizId: mockQuizId.toString(), questionId: targetQId.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const deleteRes = createMockRes();
    await questionController.deleteQuestion(deleteReq, deleteRes);

    assert(deleteRes.statusCode === 200, 'Deletes question with HTTP 200');

    // 6.2 Attempt lock check on delete
    Attempt.countDocuments = async () => 1; // 1 attempt exists!
    Quiz.findById = async () => ({ ...mockQuiz, status: 'published' });
    const lockDeleteReq = {
      params: { quizId: mockQuizId.toString(), questionId: targetQId.toString() },
      user: { _id: facultyId, role: 'faculty' },
    };
    const lockDeleteRes = createMockRes();
    await questionController.deleteQuestion(lockDeleteReq, lockDeleteRes);
    assert(lockDeleteRes.statusCode === 409, 'Blocks question deletion with HTTP 409 when attempts exist');

    // =========================================================================
    // SECTION 7: BULK IMPORT QUESTIONS (CSV & JSON)
    // =========================================================================
    console.log('\n🔹 7. Bulk Ingestion Engine (CSV & JSON Batch Processing):');
    Quiz.findById = async () => mockQuiz;
    Attempt.countDocuments = async () => 0;

    let insertedDocs = [];
    Question.insertMany = async (docs) => {
      insertedDocs = docs;
      return docs;
    };

    // 7.1 Valid CSV Import
    const csvPayload = `QuestionText,QuestionType,OptionA,OptionB,OptionC,OptionD,CorrectOptionId,Marks
"What does SQL stand for?",multiple-choice,"Strong Question Language","Structured Query Language","Sequential Query Language","None of the above",B,2
"Is JavaScript single-threaded?",true-false,,,,,True,1`;

    const bulkCsvReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: csvPayload,
    };
    const bulkCsvRes = createMockRes();
    await questionController.bulkImportQuestions(bulkCsvReq, bulkCsvRes);

    assert(bulkCsvRes.statusCode === 201, 'Imports CSV questions with HTTP 201 Created');
    assert(bulkCsvRes.body.importedCount === 2, 'Imports exactly 2 valid parsed questions');
    assert(insertedDocs[0].quizId.toString() === mockQuizId.toString(), 'Attaches quizId to all imported documents');
    assert(insertedDocs[0].correctOptionId === 'opt_2', 'Correctly mapped option B to opt_2');
    assert(insertedDocs[1].questionType === 'true-false', 'Parsed True/False question type properly');

    // 7.2 Valid JSON Import
    const jsonPayload = [
      {
        questionText: 'JSON Q1: Which data structure operates on LIFO?',
        questionType: 'multiple-choice',
        options: [
          { optionId: 'opt_1', text: 'Queue' },
          { optionId: 'opt_2', text: 'Stack' },
          { optionId: 'opt_3', text: 'Array' },
        ],
        correctOptionId: 'opt_2',
        marks: 1.5,
      },
    ];

    const bulkJsonReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: jsonPayload,
    };
    const bulkJsonRes = createMockRes();
    await questionController.bulkImportQuestions(bulkJsonReq, bulkJsonRes);

    assert(bulkJsonRes.statusCode === 201, 'Imports JSON questions with HTTP 201 Created');
    assert(bulkJsonRes.body.importedCount === 1, 'Imports 1 valid JSON question');

    // 7.3 Malformed Batch Rejection
    const malformedCsv = `QuestionText,QuestionType,OptionA,OptionB,OptionC,OptionD,CorrectOptionId,Marks
"No options question",multiple-choice,,,,,,2`;

    const malformedReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: malformedCsv,
    };
    const malformedRes = createMockRes();
    await questionController.bulkImportQuestions(malformedReq, malformedRes);

    assert(malformedRes.statusCode === 400, 'Rejects batch with 0 valid questions with HTTP 400');
    assert(malformedRes.body.errorCount > 0, 'Returns itemized row error breakdown');

    // 7.4 Bulk Import: Archived quiz lock check
    Quiz.findById = async () => ({ ...mockQuiz, status: 'archived' });
    const bulkArchivedReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: csvPayload,
    };
    const bulkArchivedRes = createMockRes();
    await questionController.bulkImportQuestions(bulkArchivedReq, bulkArchivedRes);
    assert(bulkArchivedRes.statusCode === 400, 'Rejects bulk import on archived quiz with HTTP 400 Read-Only');

    // 7.5 Bulk Import: Published quiz with attempts lock check
    Quiz.findById = async () => ({ ...mockQuiz, status: 'published' });
    Attempt.countDocuments = async () => 3; // 3 attempts exist!
    const bulkLockedReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: csvPayload,
    };
    const bulkLockedRes = createMockRes();
    await questionController.bulkImportQuestions(bulkLockedReq, bulkLockedRes);
    assert(bulkLockedRes.statusCode === 409, 'Rejects bulk import with HTTP 409 Conflict when attempts exist');

    // 7.6 Bulk Import: Recalculation Failure Compensating Rollback
    Quiz.findById = async () => mockQuiz;
    Attempt.countDocuments = async () => 0;

    let rollbackBatchDeleted = false;
    const originalDeleteMany = Question.deleteMany;
    Question.deleteMany = async (filter) => {
      if (filter && filter._id && filter._id.$in) {
        rollbackBatchDeleted = true;
      }
    };
    quizService.recalculateQuizTotalMarks = async () => {
      throw new Error('Total marks calculation failure during bulk import');
    };

    const failBulkRecalcReq = {
      params: { quizId: mockQuizId.toString() },
      user: { _id: facultyId, role: 'faculty' },
      body: jsonPayload,
    };
    const failBulkRecalcRes = createMockRes();
    await questionController.bulkImportQuestions(failBulkRecalcReq, failBulkRecalcRes);

    assert(failBulkRecalcRes.statusCode === 500, 'Returns HTTP 500 when bulk recalculation fails');
    assert(rollbackBatchDeleted === true, 'Compensating rollback deletes inserted batch if recalculation fails');

    Question.deleteMany = originalDeleteMany;
  } finally {
    // Restore original methods
    Quiz.findById = originalQuizFindById;
    Question.find = originalQuestionFind;
    Question.findOne = originalQuestionFindOne;
    Question.findOneAndDelete = originalQuestionFindOneAndDelete;
    Question.countDocuments = originalQuestionCount;
    Question.insertMany = originalQuestionInsertMany;
    Question.prototype.save = originalQuestionSave;
    Attempt.countDocuments = originalAttemptCount;
    quizService.recalculateQuizTotalMarks = originalRecalculate;
  }

  console.log(`\n📊 Question Controller Test Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runQuestionControllerTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running question controller tests:', err);
    process.exit(1);
  });

