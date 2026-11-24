const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const { Quiz, Question, Attempt, User } = require('../models');
const { generateToken } = require('./jwt');
const { generateCsrfToken, csrfProtection } = require('../middleware/csrfMiddleware');
const quizRoutes = require('../routes/quizRoutes');

async function runQuizRoutesTests() {
  console.log('🧪 Starting Phase 4 Task 6: Faculty Routes & Validation Tests...\n');
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

  // Set up ephemeral Express test app mounting quizRoutes with CSRF & cookies
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(csrfProtection);
  app.use('/api/faculty/quizzes', quizRoutes);

  // Global Error Handler for express app
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ success: false, message: err.message });
  });

  // Preserve original Mongoose methods
  const originalUserFindById = User.findById;
  const originalQuizFind = Quiz.find;
  const originalQuizFindById = Quiz.findById;
  const originalQuizCount = Quiz.countDocuments;
  const originalQuizSave = Quiz.prototype.save;
  const originalQuestionCount = Question.countDocuments;
  const originalQuestionAggregate = Question.aggregate;
  const originalQuestionFind = Question.find;
  const originalQuestionSave = Question.prototype.save;
  const originalAttemptCount = Attempt.countDocuments;
  const originalAttemptAggregate = Attempt.aggregate;

  let server;
  let baseUrl;

  try {
    // Start ephemeral HTTP server on random free port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/faculty/quizzes`;
        resolve();
      });
    });

    const facultyId = new mongoose.Types.ObjectId();
    const otherFacultyId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const adminId = new mongoose.Types.ObjectId();
    const validQuizId = new mongoose.Types.ObjectId();

    // Mock Users
    const facultyUser = {
      _id: facultyId,
      name: 'Dr. Alan Turing',
      email: 'turing@univ.edu',
      role: 'faculty',
      accountStatus: 'active',
      isPasswordTemporary: false,
    };

    const studentUser = {
      _id: studentId,
      name: 'Bob Student',
      email: 'bob@student.univ.edu',
      role: 'student',
      accountStatus: 'active',
      isPasswordTemporary: false,
    };

    const tempPasswordFacultyUser = {
      _id: facultyId,
      name: 'Dr. New Faculty',
      email: 'newfaculty@univ.edu',
      role: 'faculty',
      accountStatus: 'active',
      isPasswordTemporary: true, // Temporary password!
    };

    const adminUser = {
      _id: adminId,
      name: 'Super Admin',
      email: 'admin@univ.edu',
      role: 'admin',
      accountStatus: 'active',
      isPasswordTemporary: false,
    };

    User.findById = (id) => ({
      select: async () => {
        if (id.toString() === studentId.toString()) return studentUser;
        if (id.toString() === adminId.toString()) return adminUser;
        return facultyUser;
      },
    });

    // JWT tokens
    const facultyToken = generateToken(facultyUser);
    const studentToken = generateToken(studentUser);
    const adminToken = generateToken(adminUser);

    // =========================================================================
    // SECTION 1: GLOBAL AUTHENTICATION & ROLE GUARDS
    // =========================================================================
    console.log('🔹 1. Global Middleware Authentication & RBAC Order:');

    // 1.1 Unauthenticated Request
    const unauthRes = await fetch(baseUrl);
    const unauthJson = await unauthRes.json();
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');
    assert(unauthJson.message.includes('No session token'), 'Message indicates session token required');

    // 1.2 Student Role Access (Access Forbidden)
    const studentRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const studentJson = await studentRes.json();
    assert(studentRes.status === 403, 'Student access rejected with HTTP 403 Forbidden');
    assert(studentJson.message.includes('Access restricted to [faculty, admin]'), 'Strict role restriction message');

    // 1.3 Temporary Password Restriction
    User.findById = (id) => ({
      select: async () => tempPasswordFacultyUser,
    });
    const tempPassRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const tempPassJson = await tempPassRes.json();
    assert(tempPassRes.status === 403, 'Temporary password user blocked with HTTP 403');
    assert(tempPassJson.mustChangePassword === true, 'Enforces mustChangePassword flag');

    // Restore active faculty user for remaining tests
    User.findById = (id) => ({
      select: async () => {
        if (id.toString() === adminId.toString()) return adminUser;
        return facultyUser;
      },
    });

    // =========================================================================
    // SECTION 2: CSRF PROTECTION VERIFICATION
    // =========================================================================
    console.log('\n🔹 2. CSRF Guard on Cookie-Authenticated State-Changing Routes:');
    const csrfToken = generateCsrfToken();

    // 2.1 Cookie session without CSRF header rejected with 403
    const cookieNoCsrfRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${facultyToken}; xsrf-token=${csrfToken}`,
      },
      body: JSON.stringify({ title: 'New Quiz' }),
    });
    assert(cookieNoCsrfRes.status === 403, 'Cookie-authenticated POST without CSRF header rejected with HTTP 403');

    // 2.2 Cookie session with valid matching CSRF header accepted
    // (Fails at input validation, proving CSRF passed to route layer)
    const cookieWithCsrfRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xsrf-token': csrfToken,
        Cookie: `token=${facultyToken}; xsrf-token=${csrfToken}`,
      },
      body: JSON.stringify({ title: '' }), // Invalid title to trigger validator
    });
    assert(cookieWithCsrfRes.status === 400, 'Cookie-authenticated request with matching CSRF passes to route validator (HTTP 400)');

    // 2.3 Bearer token request bypasses CSRF check (Postman / mobile clients)
    const bearerRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({ title: '' }),
    });
    assert(bearerRes.status === 400, 'Bearer token request bypasses CSRF guard cleanly');

    // =========================================================================
    // SECTION 3: EXPRESS-VALIDATOR ROUTE SCHEMAS
    // =========================================================================
    console.log('\n🔹 3. Express-Validator Schemas & Input Sanitization:');

    // 3.1 Invalid MongoId in quizId parameter
    const invalidIdRes = await fetch(`${baseUrl}/not-a-valid-objectid`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const invalidIdJson = await invalidIdRes.json();
    assert(invalidIdRes.status === 400, 'Rejects invalid quizId parameter format with HTTP 400');
    assert(invalidIdJson.errors[0].message.includes('Invalid Quiz ID format'), 'Returns parameter validation error');

    // 3.2 Create Quiz: Missing required fields
    const missingFieldsRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({}),
    });
    const missingFieldsJson = await missingFieldsRes.json();
    assert(missingFieldsRes.status === 400, 'Rejects empty create quiz payload with HTTP 400');
    assert(missingFieldsJson.errors.some((e) => e.field === 'title'), 'Reports missing title error');
    assert(missingFieldsJson.errors.some((e) => e.field === 'duration'), 'Reports missing duration error');

    // 3.3 Create Quiz: End time before start time
    const invalidDatesRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        title: 'Midterm Exam',
        duration: 60,
        startTime: new Date(Date.now() + 500000).toISOString(),
        endTime: new Date(Date.now() + 100000).toISOString(), // earlier!
      }),
    });
    const invalidDatesJson = await invalidDatesRes.json();
    assert(invalidDatesRes.status === 400, 'Rejects endTime <= startTime with HTTP 400');
    assert(invalidDatesJson.errors.some((e) => e.message.includes('endTime must be later than startTime')), 'Validates date chronology');

    // 3.4 Create Quiz: Prohibited fields in body (status, createdBy, totalMarks)
    const prohibitedRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        title: 'Hacked Quiz',
        duration: 60,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 100000).toISOString(),
        status: 'published', // Prohibited!
        createdBy: adminId.toString(), // Prohibited!
      }),
    });
    const prohibitedJson = await prohibitedRes.json();
    assert(prohibitedRes.status === 400, 'Rejects user-supplied status and createdBy with HTTP 400');
    assert(prohibitedJson.errors.some((e) => e.field === 'status'), 'Validator flags prohibited status field');
    assert(prohibitedJson.errors.some((e) => e.field === 'createdBy'), 'Validator flags prohibited createdBy field');

    // 3.5 Update Quiz (PUT): Rejects direct status mutation
    const putStatusRes = await fetch(`${baseUrl}/${validQuizId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({ status: 'published' }),
    });
    const putStatusJson = await putStatusRes.json();
    assert(putStatusRes.status === 400, 'PUT /:quizId rejects status modification with HTTP 400');
    assert(putStatusJson.errors.some((e) => e.message.includes('Use PATCH')), 'Directs user to PATCH /status endpoint');

    // 3.6 PATCH /:quizId/status: Validates status values
    const patchInvalidStatusRes = await fetch(`${baseUrl}/${validQuizId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({ status: 'invalid-state' }),
    });
    const patchInvalidJson = await patchInvalidStatusRes.json();
    assert(patchInvalidStatusRes.status === 400, 'PATCH /:quizId/status rejects invalid state with HTTP 400');
    assert(patchInvalidJson.errors[0].message.includes('draft", "published", "archived'), 'Permits only valid lifecycle states');

    // =========================================================================
    // SECTION 4: ROUTE ORDERING & BULK COLLISION PREVENTION
    // =========================================================================
    console.log('\n🔹 4. Route Ordering & Bulk Path Resolution Invariant:');

    // Test that POST /:quizId/questions/bulk resolves to bulkImportQuestions
    // rather than matching /:quizId/questions/:questionId with questionId="bulk"
    const mockQuizDoc = {
      _id: validQuizId,
      createdBy: facultyId,
      status: 'draft',
      save: async function () { return this; },
    };
    Quiz.findById = async () => mockQuizDoc;
    Attempt.countDocuments = async () => 0;

    // Send malformed bulk payload to POST /:quizId/questions/bulk
    // If it routes to bulkImportQuestions, it will return the bulk import error
    const bulkRouteRes = await fetch(`${baseUrl}/${validQuizId}/questions/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({ invalid: 'payload' }),
    });
    const bulkRouteJson = await bulkRouteRes.json();
    assert(bulkRouteRes.status === 400, 'POST /:quizId/questions/bulk responds from bulkImportQuestions handler (HTTP 400)');
    assert(
      bulkRouteJson.message && bulkRouteJson.message.includes('Expected CSV string or JSON array'),
      'CRITICAL: Successfully dispatches to bulkImportQuestions without parameter collision on :questionId'
    );

    // =========================================================================
    // SECTION 5: QUESTION VALIDATOR SCHEMAS
    // =========================================================================
    console.log('\n🔹 5. Question Route Validator Schemas:');

    // 5.1 Create Question: Missing text and correctOptionId
    const emptyQuestionRes = await fetch(`${baseUrl}/${validQuizId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({}),
    });
    const emptyQuestionJson = await emptyQuestionRes.json();
    assert(emptyQuestionRes.status === 400, 'Rejects empty question body with HTTP 400');
    assert(emptyQuestionJson.errors.some((e) => e.field === 'questionText'), 'Reports missing questionText error');
    assert(emptyQuestionJson.errors.some((e) => e.field === 'correctOptionId'), 'Reports missing correctOptionId error');

    // 5.2 Create Question: Invalid questionType
    const badTypeRes = await fetch(`${baseUrl}/${validQuizId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        questionText: 'Valid Text',
        questionType: 'essay', // Unsupported
        correctOptionId: 'opt_1',
      }),
    });
    const badTypeJson = await badTypeRes.json();
    assert(badTypeRes.status === 400, 'Rejects unsupported questionType with HTTP 400');
    assert(badTypeJson.errors.some((e) => e.field === 'questionType'), 'Reports invalid questionType field');

    // 5.3 Create Question: Marks < 0.5
    const badMarksRes = await fetch(`${baseUrl}/${validQuizId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        questionText: 'Valid Text',
        questionType: 'multiple-choice',
        correctOptionId: 'opt_1',
        marks: 0.1, // Less than minimum 0.5
      }),
    });
    const badMarksJson = await badMarksRes.json();
    assert(badMarksRes.status === 400, 'Rejects marks < 0.5 with HTTP 400');
    assert(badMarksJson.errors.some((e) => e.field === 'marks'), 'Reports marks validator error');

    // 5.4 Update Question: Invalid questionId parameter
    const badParamRes = await fetch(`${baseUrl}/${validQuizId}/questions/not-a-mongo-id`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({ questionText: 'Updated' }),
    });
    const badParamJson = await badParamRes.json();
    assert(badParamRes.status === 400, 'PUT /:quizId/questions/:questionId rejects invalid questionId format');
    assert(badParamJson.errors.some((e) => e.field === 'questionId'), 'Reports questionId format error');

    // =========================================================================
    // SECTION 6: SUCCESSFUL DISPATCH TO CONTROLLERS
    // =========================================================================
    console.log('\n🔹 6. Route Dispatch to Controllers:');

    // 6.1 GET / — List quizzes
    Quiz.find = () => ({
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [mockQuizDoc],
            }),
          }),
        }),
      }),
    });
    Quiz.countDocuments = async () => 1;
    Question.aggregate = async () => [{ _id: validQuizId, count: 5 }];
    Attempt.aggregate = async () => [{ _id: validQuizId, count: 2 }];

    const listRes = await fetch(`${baseUrl}?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const listJson = await listRes.json();
    assert(listRes.status === 200, 'GET / dispatches to getQuizzes with HTTP 200');
    assert(listJson.quizzes.length === 1, 'Returns list of quizzes authored by faculty');

    // 6.2 GET /:quizId — Get quiz details
    Question.countDocuments = async () => 5;
    Attempt.countDocuments = async () => 2;
    Attempt.aggregate = async () => [{ _id: 'completed', count: 2, avgScore: 85 }];

    const detailRes = await fetch(`${baseUrl}/${validQuizId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const detailJson = await detailRes.json();
    assert(detailRes.status === 200, 'GET /:quizId dispatches to getQuizById with HTTP 200');
    assert(detailJson.statistics.questionCount === 5, 'Includes question statistics in response');

    // 6.3 Admin access on faculty routes
    const adminRes = await fetch(`${baseUrl}/${validQuizId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminRes.status === 200, 'Admin successfully accesses faculty routes with HTTP 200');
  } finally {
    // Cleanly close HTTP server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    // Restore original Mongoose methods
    User.findById = originalUserFindById;
    Quiz.find = originalQuizFind;
    Quiz.findById = originalQuizFindById;
    Quiz.countDocuments = originalQuizCount;
    Quiz.prototype.save = originalQuizSave;
    Question.countDocuments = originalQuestionCount;
    Question.aggregate = originalQuestionAggregate;
    Question.find = originalQuestionFind;
    Question.prototype.save = originalQuestionSave;
    Attempt.countDocuments = originalAttemptCount;
    Attempt.aggregate = originalAttemptAggregate;
  }

  console.log(`\n📊 Quiz Routes Test Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runQuizRoutesTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running quiz routes tests:', err);
    process.exit(1);
  });
