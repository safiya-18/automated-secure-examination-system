const mongoose = require('mongoose');
const { Quiz, Question } = require('../models');
const {
  validateSubsetMarksConsistency,
  recalculateQuizTotalMarks,
} = require('./quizService');

async function runQuizServiceTests() {
  console.log('🧪 Starting Phase 4 Task 1: Quiz Service & Marks Calculation Tests...\n');
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
  const originalQuizFindByIdAndUpdate = Quiz.findByIdAndUpdate;
  const originalQuestionFind = Question.find;

  // --- SUITE 1: Empty Question Bank Handling ---
  console.log('🔹 1. Empty Question Bank Handling:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();

    Quiz.findById = async () => ({
      _id: dummyQuizId,
      title: 'Empty Test Quiz',
      questionsPerStudent: 0,
      totalMarks: 0,
    });
    Question.find = () => ({
      select: async () => [],
    });

    // 1.1 questionsPerStudent === 0 on empty quiz
    const emptyFull = await validateSubsetMarksConsistency(dummyQuizId);
    assert(emptyFull.valid === true, 'Empty question bank in full mode is valid');
    assert(emptyFull.totalMarks === 0, 'Total marks for empty quiz is 0');
    assert(emptyFull.questionCount === 0, 'Question count is 0');

    // 1.2 questionsPerStudent > 0 on empty quiz must fail
    const emptySubset = await validateSubsetMarksConsistency(dummyQuizId, 5);
    assert(emptySubset.valid === false, 'Rejects allocation when question bank is empty');
    assert(
      emptySubset.message.includes('empty'),
      'Provides clear error indicating question bank is empty'
    );
  } catch (err) {
    console.error('Suite 1 error:', err);
    failed++;
  }

  // --- SUITE 2: Invalid Allocation Values ---
  console.log('\n🔹 2. Invalid Allocation Inputs:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();

    Quiz.findById = async () => ({
      _id: dummyQuizId,
      title: 'Allocation Test Quiz',
      questionsPerStudent: 0,
    });
    Question.find = () => ({
      select: async () => [{ marks: 1 }, { marks: 1 }, { marks: 1 }],
    });

    // 2.1 Negative allocation
    const negRes = await validateSubsetMarksConsistency(dummyQuizId, -2);
    assert(negRes.valid === false, 'Rejects negative questionsPerStudent (-2)');

    // 2.2 Decimal allocation
    const decimalRes = await validateSubsetMarksConsistency(dummyQuizId, 2.5);
    assert(decimalRes.valid === false, 'Rejects non-integer questionsPerStudent (2.5)');

    // 2.3 Allocation exceeds question pool
    const excessRes = await validateSubsetMarksConsistency(dummyQuizId, 10);
    assert(excessRes.valid === false, 'Rejects allocation (10) exceeding question pool size (3)');
    assert(
      excessRes.message.includes('exceeds available questions'),
      'Returns informative message about pool bounds'
    );
  } catch (err) {
    console.error('Suite 2 error:', err);
    failed++;
  }

  // --- SUITE 3: Full-Question Mode (Sum of All Marks) ---
  console.log('\n🔹 3. Full-Question Mode Calculation:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();

    // Pool of 3 questions with disparate marks: 1, 2, 3
    Quiz.findById = async () => ({
      _id: dummyQuizId,
      title: 'Full Mode Quiz',
      questionsPerStudent: 0, // 0 = Full Mode
    });
    Question.find = () => ({
      select: async () => [{ marks: 1 }, { marks: 2 }, { marks: 3 }],
    });

    const fullResult = await validateSubsetMarksConsistency(dummyQuizId);
    assert(fullResult.valid === true, 'Full mode allows disparate question marks');
    assert(fullResult.isSubset === false, 'Identifies mode as full question mode (isSubset = false)');
    assert(fullResult.totalMarks === 6, 'Total marks equals sum of all questions (1 + 2 + 3 = 6)');
    assert(fullResult.questionCount === 3, 'Question count matches pool size');
  } catch (err) {
    console.error('Suite 3 error:', err);
    failed++;
  }

  // --- SUITE 4: Subset Allocation Mode (Equal Marks Invariant) ---
  console.log('\n🔹 4. Subset Allocation Mode & Equal Marks Invariant:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();

    // 4.1 Case A: Disparate marks in pool must be rejected in subset mode
    Quiz.findById = async () => ({
      _id: dummyQuizId,
      title: 'Subset Disparate Quiz',
      questionsPerStudent: 2, // Allocate 2 out of 4
    });
    Question.find = () => ({
      select: async () => [{ marks: 2 }, { marks: 2 }, { marks: 1 }, { marks: 2 }],
    });

    const disparateRes = await validateSubsetMarksConsistency(dummyQuizId);
    assert(
      disparateRes.valid === false,
      'Rejects subset allocation when questions have unequal marks (2, 2, 1, 2)'
    );
    assert(
      disparateRes.message.includes('identical marks'),
      'Error explains that equal marks are required to guarantee equal maximum scores'
    );

    // 4.2 Case B: Equal marks in pool (all questions worth 2 marks)
    Question.find = () => ({
      select: async () => [{ marks: 2 }, { marks: 2 }, { marks: 2 }, { marks: 2 }],
    });

    const equalRes = await validateSubsetMarksConsistency(dummyQuizId);
    assert(equalRes.valid === true, 'Accepts subset allocation when all questions have identical marks (2, 2, 2, 2)');
    assert(equalRes.isSubset === true, 'Identifies mode as subset mode (isSubset = true)');
    assert(equalRes.marksPerQuestion === 2, 'Extracts uniform mark per question (2)');
    assert(
      equalRes.totalMarks === 4,
      'Calculates totalMarks as questionsPerStudent * markPerQuestion (2 * 2 = 4)'
    );
  } catch (err) {
    console.error('Suite 4 error:', err);
    failed++;
  }

  // --- SUITE 5: recalculateQuizTotalMarks Dynamic Persistence ---
  console.log('\n🔹 5. recalculateQuizTotalMarks Persistence:');
  try {
    const dummyQuizId = new mongoose.Types.ObjectId();
    let updatedPayload = null;

    Quiz.findById = async () => ({
      _id: dummyQuizId,
      title: 'Recalculation Quiz',
      questionsPerStudent: 3,
    });
    Quiz.findByIdAndUpdate = async (id, update) => {
      updatedPayload = update;
      return { _id: id, ...update };
    };

    // 5 questions, all 2 marks, allocating 3 questions
    Question.find = () => ({
      select: async () => [
        { marks: 2 },
        { marks: 2 },
        { marks: 2 },
        { marks: 2 },
        { marks: 2 },
      ],
    });

    const recalcRes = await recalculateQuizTotalMarks(dummyQuizId);
    assert(recalcRes.totalMarks === 6, 'Recalculates subset total marks correctly (3 * 2 = 6)');
    assert(recalcRes.mode === 'subset', 'Returns correct calculation mode ("subset")');
    assert(updatedPayload.totalMarks === 6, 'Persists updated totalMarks to Quiz in MongoDB');

    // 5.2 Throws when quiz does not exist
    Quiz.findById = async () => null;
    let notFoundCaught = false;
    try {
      await recalculateQuizTotalMarks(dummyQuizId);
    } catch (e) {
      notFoundCaught = true;
    }
    assert(notFoundCaught, 'Throws error when quiz does not exist');
  } catch (err) {
    console.error('Suite 5 error:', err);
    failed++;
  } finally {
    // Restore original methods
    Quiz.findById = originalQuizFindById;
    Quiz.findByIdAndUpdate = originalQuizFindByIdAndUpdate;
    Question.find = originalQuestionFind;
  }

  console.log(`\n📊 Quiz Service Test Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runQuizServiceTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running quiz service tests:', err);
    process.exit(1);
  });

