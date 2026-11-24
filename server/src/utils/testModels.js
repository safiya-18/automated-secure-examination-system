const mongoose = require('mongoose');
const { User, Quiz, Question, Attempt, MalpracticeLog } = require('../models');

async function runModelValidationTests() {
  console.log('🧪 Starting Mongoose Model Validation & Security Tests...\n');
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

  // Helper to validate and return error or null
  async function getValidationError(doc) {
    try {
      await doc.validate();
      return null;
    } catch (err) {
      return err;
    }
  }

  // --- TEST 1: User Model Validation & Security ---
  console.log('🔹 Testing User Model:');
  try {
    // 1.1 Invalid email validation test
    const invalidEmailUser = new User({
      name: 'John Doe',
      email: 'not-an-email',
      password: 'secretPassword123',
      role: 'faculty',
    });
    const emailErr = await getValidationError(invalidEmailUser);
    assert(
      emailErr && emailErr.errors['email'],
      'Rejects invalid email format'
    );

    // 1.2 Student without USN should fail validation
    const studentWithoutUsn = new User({
      name: 'Alice Student',
      email: 'alice@college.edu',
      password: 'studentPassword123',
      role: 'student',
    });
    const usnErr = await getValidationError(studentWithoutUsn);
    assert(
      usnErr && usnErr.errors['usn'],
      'Enforces USN for student accounts'
    );

    // 1.3 Faculty without USN should pass validation (USN only for students)
    const facultyWithoutUsn = new User({
      name: 'Dr. Alan Smith',
      email: 'alan@college.edu',
      password: 'facultyPassword123',
      role: 'faculty',
    });
    const facultyErr = await getValidationError(facultyWithoutUsn);
    assert(!facultyErr, 'Faculty accounts do not require USN');

    // 1.4 Valid student with USN passes validation
    const validStudent = new User({
      name: 'Bob Student',
      email: 'bob@college.edu',
      password: 'securePassword123',
      role: 'student',
      usn: '1MS21CS001',
    });
    const validStudentErr = await getValidationError(validStudent);
    assert(!validStudentErr, 'Valid student with USN passes schema validation');
    assert(validStudent.usn === '1MS21CS001', 'USN is formatted uppercase');

    // 1.5 Password hashing pre-save hook check
    const mockSaveUser = new User({
      name: 'Admin User',
      email: 'admin@college.edu',
      password: 'adminPlainPassword',
      role: 'admin',
    });
    // Trigger pre-save middleware directly
    await mockSaveUser.schema.s.hooks.execPre('save', mockSaveUser, []);
    assert(
      mockSaveUser.password !== 'adminPlainPassword' && mockSaveUser.password.startsWith('$2'),
      'Hashes password using bcrypt in pre-save hook'
    );

    // 1.6 Password comparison method
    const isMatch = await mockSaveUser.comparePassword('adminPlainPassword');
    const isWrong = await mockSaveUser.comparePassword('wrongPassword');
    assert(isMatch === true && isWrong === false, 'comparePassword correctly verifies plaintext vs hash');

    // 1.7 toJSON sanitization (omits password)
    const jsonUser = mockSaveUser.toJSON();
    assert(
      jsonUser.password === undefined,
      'toJSON automatically strips password from API outputs'
    );
  } catch (err) {
    console.error('User test error:', err);
    failed++;
  }

  // --- TEST 2: Quiz Model Validation ---
  console.log('\n🔹 Testing Quiz Model:');
  try {
    const dummyFacultyId = new mongoose.Types.ObjectId();

    // 2.1 Rejects endTime earlier than startTime
    const invalidDatesQuiz = new Quiz({
      title: 'Operating Systems Midterm',
      createdBy: dummyFacultyId,
      duration: 60,
      startTime: new Date('2026-11-10T10:00:00Z'),
      endTime: new Date('2026-11-10T09:00:00Z'), // Earlier than start time
    });
    const dateErr = await getValidationError(invalidDatesQuiz);
    assert(
      dateErr && dateErr.errors['endTime'],
      'Validates that endTime must be later than startTime'
    );

    // 2.2 Valid quiz defaults
    const validQuiz = new Quiz({
      title: 'Database Systems Final Exam',
      createdBy: dummyFacultyId,
      duration: 90,
      startTime: new Date('2026-11-10T10:00:00Z'),
      endTime: new Date('2026-11-10T12:00:00Z'),
    });
    const quizErr = await getValidationError(validQuiz);
    assert(!quizErr, 'Valid quiz passes schema validation');
    assert(validQuiz.randomizeQuestions === true, 'Defaults randomizeQuestions to true');
    assert(validQuiz.randomizeOptions === true, 'Defaults randomizeOptions to true');
    assert(validQuiz.proctoringSettings.maxViolationsAllowed === 3, 'Defaults maxViolationsAllowed to 3');
  } catch (err) {
    console.error('Quiz test error:', err);
    failed++;
  }

  // --- TEST 3: Question Model & Security ---
  console.log('\n🔹 Testing Question Model:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();

    // 3.1 Requires at least 2 options
    const singleOptionQuestion = new Question({
      quizId: dummyQuizId,
      questionText: 'What is ACID in DBMS?',
      options: [{ optionId: 'A', text: 'Atomicity' }],
      correctOptionId: 'A',
    });
    const optErr = await getValidationError(singleOptionQuestion);
    assert(
      optErr && optErr.errors['options'],
      'Enforces at least two options per question'
    );

    // 3.2 Valid question
    const validQuestion = new Question({
      quizId: dummyQuizId,
      questionText: 'Which protocol is used for secure HTTP?',
      options: [
        { optionId: 'opt_1', text: 'HTTP' },
        { optionId: 'opt_2', text: 'HTTPS' },
        { optionId: 'opt_3', text: 'FTP' },
        { optionId: 'opt_4', text: 'SSH' },
      ],
      correctOptionId: 'opt_2',
      marks: 2,
    });
    const questionErr = await getValidationError(validQuestion);
    assert(!questionErr, 'Valid question passes validation');

    // 3.3 Verify correctOptionId has select: false for student security
    const correctOptConfig = Question.schema.paths['correctOptionId'].options;
    assert(
      correctOptConfig.select === false,
      'correctOptionId is configured with select: false for student security'
    );
  } catch (err) {
    console.error('Question test error:', err);
    failed++;
  }

  // --- TEST 4: Attempt Model ---
  console.log('\n🔹 Testing Attempt Model:');
  try {
    const dummyStudentId = new mongoose.Types.ObjectId();
    const dummyQuizId = new mongoose.Types.ObjectId();
    const q1 = new mongoose.Types.ObjectId();
    const q2 = new mongoose.Types.ObjectId();

    const validAttempt = new Attempt({
      studentId: dummyStudentId,
      quizId: dummyQuizId,
      assignedQuestionOrder: [q2, q1],
      assignedOptionOrder: [
        { questionId: q2, shuffledOptionIds: ['opt_3', 'opt_1', 'opt_2'] },
        { questionId: q1, shuffledOptionIds: ['opt_2', 'opt_1'] },
      ],
      startTime: new Date(),
    });
    const attemptErr = await getValidationError(validAttempt);
    assert(!attemptErr, 'Valid attempt stores question order and shuffled option mapping');
    assert(validAttempt.status === 'in-progress', 'Default status is in-progress');
  } catch (err) {
    console.error('Attempt test error:', err);
    failed++;
  }

  // --- TEST 5: MalpracticeLog Model ---
  console.log('\n🔹 Testing MalpracticeLog Model:');
  try {
    const dummyStudentId = new mongoose.Types.ObjectId();
    const dummyQuizId = new mongoose.Types.ObjectId();
    const dummyAttemptId = new mongoose.Types.ObjectId();

    // 5.1 Rejects unlisted event types
    const invalidLog = new MalpracticeLog({
      studentId: dummyStudentId,
      quizId: dummyQuizId,
      attemptId: dummyAttemptId,
      eventType: 'INVALID_EVENT',
      eventDescription: 'Something happened',
    });
    const logErr = await getValidationError(invalidLog);
    assert(
      logErr && logErr.errors['eventType'],
      'Rejects invalid eventType'
    );

    // 5.2 Valid malpractice log
    const validLog = new MalpracticeLog({
      studentId: dummyStudentId,
      quizId: dummyQuizId,
      attemptId: dummyAttemptId,
      eventType: 'TAB_SWITCH',
      eventDescription: 'User switched away from active exam tab (visibilitychange: hidden)',
      severity: 'HIGH',
    });
    const validLogErr = await getValidationError(validLog);
    assert(!validLogErr, 'Valid malpractice log passes schema validation');
    assert(validLog.severity === 'HIGH', 'Severity level recorded correctly');
  } catch (err) {
    console.error('MalpracticeLog test error:', err);
    failed++;
  }

  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runModelValidationTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running tests:', err);
    process.exit(1);
  });
