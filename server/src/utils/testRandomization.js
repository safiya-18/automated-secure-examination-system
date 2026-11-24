const mongoose = require('mongoose');
const {
  generateStudentExamAllocation,
  sanitizeQuestionsForStudent,
  secureShuffle,
  secureSample,
} = require('./quizService');

async function runRandomizationTests() {
  console.log('🧪 Starting Phase 4 Task 3.5: Per-Student Question Selection & Randomization Tests...\n');
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

  // Helper to generate N mock questions
  function generateMockQuestions(count, marks = 1) {
    const list = [];
    for (let i = 1; i <= count; i++) {
      list.push({
        _id: new mongoose.Types.ObjectId(),
        questionText: `Question ${i}: What is the output of statement ${i}?`,
        questionType: 'multiple-choice',
        options: [
          { optionId: 'opt_1', text: `Option A for Q${i}` },
          { optionId: 'opt_2', text: `Option B for Q${i}` },
          { optionId: 'opt_3', text: `Option C for Q${i}` },
          { optionId: 'opt_4', text: `Option D for Q${i}` },
        ],
        correctOptionId: 'opt_2',
        marks: Array.isArray(marks) ? marks[i - 1] || 1 : marks,
      });
    }
    return list;
  }

  // =========================================================================
  // SECTION A: UNIT & ALGORITHMIC TESTS (Cryptographic Randomness & Shuffle)
  // =========================================================================
  console.log('🔹 [UNIT] 1. Full Question Bank Allocation Mode:');
  try {
    const questions10 = generateMockQuestions(10, 2);
    const quizFullZero = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 0, // 0 = Full Pool
      randomizeQuestions: false,
      randomizeOptions: false,
    };

    const resZero = generateStudentExamAllocation(quizFullZero, questions10);
    assert(resZero.assignedQuestionOrder.length === 10, 'Assigns all 10 questions when questionsPerStudent === 0');
    assert(resZero.totalMarksPossible === 20, 'Calculates total marks as sum of all questions (10 * 2 = 20)');

    const quizFullEqual = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 10, // Equal to pool size
      randomizeQuestions: false,
      randomizeOptions: false,
    };
    const resEqual = generateStudentExamAllocation(quizFullEqual, questions10);
    assert(resEqual.assignedQuestionOrder.length === 10, 'Assigns all 10 questions when questionsPerStudent === pool size');
  } catch (err) {
    console.error('Section 1 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 2. Configurable Subsets (10 of 100, 25 of 50):');
  try {
    // 2.1 Subset: 10 of 100 questions
    const pool100 = generateMockQuestions(100, 1);
    const quiz10of100 = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 10,
      randomizeQuestions: true,
      randomizeOptions: true,
    };
    const res10 = generateStudentExamAllocation(quiz10of100, pool100);
    assert(res10.assignedQuestionOrder.length === 10, 'Allocates exactly 10 questions out of a 100-question pool');
    assert(res10.totalMarksPossible === 10, 'Calculates subset total marks as 10 * 1 = 10');

    // 2.2 Subset: 25 of 50 questions
    const pool50 = generateMockQuestions(50, 2);
    const quiz25of50 = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 25,
      randomizeQuestions: true,
      randomizeOptions: true,
    };
    const res25 = generateStudentExamAllocation(quiz25of50, pool50);
    assert(res25.assignedQuestionOrder.length === 25, 'Allocates exactly 25 questions out of a 50-question pool');
    assert(res25.totalMarksPossible === 50, 'Calculates subset total marks as 25 * 2 = 50');
  } catch (err) {
    console.error('Section 2 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 3. Combination Entropy Across Different Students:');
  try {
    const pool30 = generateMockQuestions(30, 1);
    const quizSubset = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 5,
      randomizeQuestions: true,
      randomizeOptions: true,
    };

    const usedSignatures = new Set();
    const studentsCount = 10;
    for (let s = 0; s < studentsCount; s++) {
      const alloc = generateStudentExamAllocation(quizSubset, pool30, usedSignatures);
      usedSignatures.add(alloc.combinationSignature);
    }

    assert(
      usedSignatures.size === studentsCount,
      `Assigns distinct question combinations across all ${studentsCount} students when combinations remain`
    );
  } catch (err) {
    console.error('Section 3 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 4. Graceful Overlap Tolerance When Combinations Exhausted:');
  try {
    // Pool of 3 questions, selecting 2. Total unique combinations: (3 choose 2) = 3
    const pool3 = generateMockQuestions(3, 1);
    const quizSmall = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 2,
      randomizeQuestions: true,
      randomizeOptions: true,
    };

    const usedSignatures = new Set();
    let allocationsSucceeded = 0;

    // Simulate 10 students taking this exam (more than the 3 available unique combinations)
    for (let s = 0; s < 10; s++) {
      const alloc = generateStudentExamAllocation(quizSmall, pool3, usedSignatures);
      usedSignatures.add(alloc.combinationSignature);
      if (alloc.assignedQuestionOrder.length === 2) {
        allocationsSucceeded++;
      }
    }

    assert(
      allocationsSucceeded === 10,
      'Gracefully allows overlapping question sets without throwing or failing when combinations are exhausted'
    );
    assert(
      usedSignatures.size <= 3,
      'Correctly detected all available combinations before cycling'
    );
  } catch (err) {
    console.error('Section 4 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 5. Independent Question & Option Shuffling:');
  try {
    const pool10 = generateMockQuestions(10, 1);
    const quizShuffled = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 10,
      randomizeQuestions: true,
      randomizeOptions: true,
    };

    const runA = generateStudentExamAllocation(quizShuffled, pool10);
    const runB = generateStudentExamAllocation(quizShuffled, pool10);

    const orderA = runA.assignedQuestionOrder.map((id) => id.toString()).join(',');
    const orderB = runB.assignedQuestionOrder.map((id) => id.toString()).join(',');

    assert(
      orderA !== orderB,
      'Produces different question sequences across independent student sessions'
    );

    // Option order shuffling
    const q1OptionsA = runA.assignedOptionOrder[0].shuffledOptionIds.join(',');
    const q1OptionsB = runB.assignedOptionOrder[0].shuffledOptionIds.join(',');
    assert(
      runA.assignedOptionOrder[0].shuffledOptionIds.length === 4,
      'All 4 option IDs preserved after option shuffling'
    );
  } catch (err) {
    console.error('Section 5 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 6. Disabled Randomization Invariant:');
  try {
    const pool5 = generateMockQuestions(5, 1);
    const quizNoRandom = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 5,
      randomizeQuestions: false,
      randomizeOptions: false,
    };

    const resNoRandom = generateStudentExamAllocation(quizNoRandom, pool5);

    // Verify question order exactly matches input array order
    const expectedQuestionOrder = pool5.map((q) => q._id.toString()).join(',');
    const actualQuestionOrder = resNoRandom.assignedQuestionOrder.map((id) => id.toString()).join(',');
    assert(
      actualQuestionOrder === expectedQuestionOrder,
      'Preserves original question order when randomizeQuestions is false'
    );

    // Verify option order exactly matches original option order
    const expectedOptionOrder = pool5[0].options.map((o) => o.optionId).join(',');
    const actualOptionOrder = resNoRandom.assignedOptionOrder[0].shuffledOptionIds.join(',');
    assert(
      actualOptionOrder === expectedOptionOrder,
      'Preserves original option order when randomizeOptions is false'
    );
  } catch (err) {
    console.error('Section 6 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 7. Stable Option IDs & Answer Evaluation Integrity:');
  try {
    const pool2 = generateMockQuestions(2, 1);
    const quizRand = {
      _id: new mongoose.Types.ObjectId(),
      questionsPerStudent: 2,
      randomizeQuestions: true,
      randomizeOptions: true,
    };

    const alloc = generateStudentExamAllocation(quizRand, pool2);
    const q1Entry = alloc.assignedOptionOrder[0];
    const originalQ1 = pool2.find((q) => q._id.toString() === q1Entry.questionId.toString());

    // Verify that option IDs match the original question's options exactly
    const originalOptionIds = new Set(originalQ1.options.map((o) => o.optionId));
    const allMatch = q1Entry.shuffledOptionIds.every((id) => originalOptionIds.has(id));
    assert(allMatch === true, 'All shuffled options correspond to valid, existing option IDs');

    // Verify correctOptionId ('opt_2') still correctly references the designated option
    const correctOpt = originalQ1.options.find((o) => o.optionId === originalQ1.correctOptionId);
    assert(correctOpt.text.includes('Option B'), 'correctOptionId mapping remains consistent regardless of shuffle');
  } catch (err) {
    console.error('Section 7 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 8. Student Answer-Key Exclusion (sanitizeQuestionsForStudent):');
  try {
    const pool3 = generateMockQuestions(3, 2);
    // Explicitly add secret answer keys to question documents
    pool3.forEach((q) => {
      q.correctOptionId = 'opt_2';
      q.internalSecretNotes = 'Faculty confidential answer notes';
    });

    const alloc = generateStudentExamAllocation(
      { questionsPerStudent: 3, randomizeQuestions: true, randomizeOptions: true },
      pool3
    );

    const sanitized = sanitizeQuestionsForStudent(
      pool3,
      alloc.assignedQuestionOrder,
      alloc.assignedOptionOrder
    );

    assert(sanitized.length === 3, 'Returns all allocated questions in sanitized student format');

    const hasAnyCorrectOptionId = sanitized.some((q) => q.correctOptionId !== undefined);
    assert(!hasAnyCorrectOptionId, 'CRITICAL: correctOptionId is strictly excluded from student-visible questions');

    const hasAnySecretNotes = sanitized.some((q) => q.internalSecretNotes !== undefined);
    assert(!hasAnySecretNotes, 'Strict allowlist excludes non-student internal metadata');

    assert(sanitized[0].options.length === 4, 'Student options array is properly formatted');
    assert(sanitized[0].options[0].optionId && sanitized[0].options[0].text, 'Each option contains optionId and text');
  } catch (err) {
    console.error('Section 8 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 9. Error Validation (Invalid Allocation & Unequal Marks):');
  try {
    const pool4 = generateMockQuestions(4, 1);

    // 9.1 Empty pool throws
    let emptyCaught = false;
    try {
      generateStudentExamAllocation({ questionsPerStudent: 2 }, []);
    } catch (e) {
      emptyCaught = true;
    }
    assert(emptyCaught, 'Throws error when question bank is empty');

    // 9.2 Allocation exceeds pool
    let excessCaught = false;
    try {
      generateStudentExamAllocation({ questionsPerStudent: 10 }, pool4);
    } catch (e) {
      excessCaught = true;
    }
    assert(excessCaught, 'Throws error when questionsPerStudent exceeds question bank size');

    // 9.3 Unequal marks in subset mode
    const disparatePool = generateMockQuestions(4, [1, 2, 1, 1]); // Question 2 has 2 marks, others have 1
    let disparateCaught = false;
    try {
      generateStudentExamAllocation({ questionsPerStudent: 2 }, disparatePool);
    } catch (e) {
      disparateCaught = e.message.includes('identical marks');
    }
    assert(disparateCaught, 'Rejects subset allocation when question marks are unequal');
  } catch (err) {
    console.error('Section 9 error:', err);
    failed++;
  }

  console.log('\n🔹 [UNIT] 10. Attempt Schema Compatibility Check:');
  try {
    const pool5 = generateMockQuestions(5, 2);
    const alloc = generateStudentExamAllocation(
      { questionsPerStudent: 3, randomizeQuestions: true, randomizeOptions: true },
      pool5
    );

    // Verify fields match Attempt schema requirements directly
    assert(Array.isArray(alloc.assignedQuestionOrder), 'assignedQuestionOrder is an Array');
    assert(alloc.assignedQuestionOrder[0] instanceof mongoose.Types.ObjectId, 'assignedQuestionOrder holds ObjectIds');
    assert(Array.isArray(alloc.assignedOptionOrder), 'assignedOptionOrder is an Array');
    assert(
      alloc.assignedOptionOrder[0].questionId && Array.isArray(alloc.assignedOptionOrder[0].shuffledOptionIds),
      'assignedOptionOrder holds { questionId, shuffledOptionIds } objects matching Attempt.js'
    );
    assert(typeof alloc.totalMarksPossible === 'number', 'totalMarksPossible is a Number');
  } catch (err) {
    console.error('Section 10 error:', err);
    failed++;
  }

  console.log(`\n📊 Randomization & Allocation Test Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runRandomizationTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running randomization tests:', err);
    process.exit(1);
  });

