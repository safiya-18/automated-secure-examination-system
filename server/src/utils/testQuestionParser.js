const {
  tokenizeCSV,
  parseQuestionsCSV,
  parseQuestionsJSON,
} = require('./questionCsvParser');

async function runQuestionParserTests() {
  console.log('🧪 Starting Phase 4 Task 3: Question Parser (CSV & JSON) Tests...\n');
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

  // --- SUITE 1: CSV Tokenizer (Quotes, Commas, Escaped Quotes, BOM) ---
  console.log('🔹 1. CSV Tokenizer RFC 4180 Compliance:');
  try {
    // 1.1 Quoted text with commas and escaped quotes
    const complexCSV = `"QuestionText","OptionA","OptionB","CorrectOptionId"\n"Which protocol, when secured, uses port 443?","HTTP, unsecured","HTTPS, ""encrypted""","B"`;
    const rows = tokenizeCSV(complexCSV);
    assert(rows.length === 2, 'Tokenizes rows with embedded commas inside quotes');
    assert(
      rows[1][0] === 'Which protocol, when secured, uses port 443?',
      'Preserves commas inside quoted field'
    );
    assert(
      rows[1][2] === 'HTTPS, "encrypted"',
      'Handles escaped quotes ("") correctly'
    );

    // 1.2 UTF-8 BOM handling
    const bomCSV = `\uFEFFQuestionText,OptionA,OptionB,CorrectOptionId\nWhat is RAM?,Volatile,Non-volatile,A`;
    const bomRows = tokenizeCSV(bomCSV);
    assert(bomRows[0][0] === 'QuestionText', 'Strips UTF-8 BOM from start of CSV');
  } catch (err) {
    console.error('Suite 1 error:', err);
    failed++;
  }

  // --- SUITE 2: MCQ & True/False CSV Parsing ---
  console.log('\n🔹 2. MCQ & True/False Parsing:');
  try {
    const csvContent = `QuestionText,QuestionType,OptionA,OptionB,OptionC,OptionD,CorrectOptionId,Marks
"What is Node.js?",multiple-choice,"Runtime","Framework","Database","OS",A,2
"MongoDB is a relational SQL database.",true-false,,,,,B,1.5`;

    const res = parseQuestionsCSV(csvContent);
    assert(res.validCount === 2, 'Parses both valid MCQ and True/False questions');
    assert(res.errorCount === 0, 'Zero errors on valid input');

    // Inspect MCQ
    const q1 = res.questions[0];
    assert(q1.questionType === 'multiple-choice', 'Identifies MCQ question type');
    assert(q1.options.length === 4, 'Constructs 4 options for MCQ');
    assert(q1.options[0].optionId === 'opt_1' && q1.options[0].text === 'Runtime', 'Deterministic opt_1 mapping');
    assert(q1.correctOptionId === 'opt_1', 'Maps correctOptionId "A" to "opt_1"');
    assert(q1.marks === 2, 'Extracts marks as positive number');

    // Inspect True/False
    const q2 = res.questions[1];
    assert(q2.questionType === 'true-false', 'Identifies True/False question type');
    assert(q2.options.length === 2, 'Generates exactly 2 options for True/False');
    assert(q2.options[0].text === 'True' && q2.options[1].text === 'False', 'Options are True and False');
    assert(q2.correctOptionId === 'opt_2', 'Maps correctOptionId "B" (False) to "opt_2"');
    assert(q2.marks === 1.5, 'Extracts 1.5 marks');
  } catch (err) {
    console.error('Suite 2 error:', err);
    failed++;
  }

  // --- SUITE 3: Option Mapping Variations & Integrity Validation ---
  console.log('\n🔹 3. Option Mapping & Correct Option Integrity:');
  try {
    // 3.1 Numeric mapping (1, 2, 3, 4)
    const numCSV = `QuestionText,OptionA,OptionB,OptionC,OptionD,CorrectOptionId\nQuestion 1,Opt 1,Opt 2,Opt 3,Opt 4,3`;
    const numRes = parseQuestionsCSV(numCSV);
    assert(numRes.validCount === 1, 'Parses numeric correct answer');
    assert(numRes.questions[0].correctOptionId === 'opt_3', 'Maps numeric "3" to "opt_3"');

    // 3.2 CorrectOptionId points to unpopulated option
    // Question only has OptionA and OptionB, but CorrectOptionId is "C" (opt_3)
    const unpopulatedCSV = `QuestionText,OptionA,OptionB,OptionC,OptionD,CorrectOptionId\nQuestion 2,Alpha,Beta,,,C`;
    const unpopRes = parseQuestionsCSV(unpopulatedCSV);
    assert(unpopRes.validCount === 0, 'Rejects question when correctOptionId does not match populated options');
    assert(unpopRes.errorCount === 1, 'Records error for invalid option reference');
    assert(
      unpopRes.errors[0].message.includes('does not match any populated option'),
      'Clear error message explaining unpopulated option reference'
    );

    // 3.3 Invalid correct option identifier altogether
    const invalidIdCSV = `QuestionText,OptionA,OptionB,CorrectOptionId\nQuestion 3,Yes,No,XYZ`;
    const invRes = parseQuestionsCSV(invalidIdCSV);
    assert(invRes.validCount === 0 && invRes.errorCount === 1, 'Rejects unrecognized correctOptionId "XYZ"');
  } catch (err) {
    console.error('Suite 3 error:', err);
    failed++;
  }

  // --- SUITE 4: Row-Level Validation & Edge Cases ---
  console.log('\n🔹 4. Row-Level Errors & Edge Cases:');
  try {
    // 4.1 Missing question text
    const missingTextCSV = `QuestionText,OptionA,OptionB,CorrectOptionId\n,Red,Blue,A`;
    const resText = parseQuestionsCSV(missingTextCSV);
    assert(resText.errors.some((e) => e.field === 'questionText'), 'Catches missing question text error');

    // 4.2 Fewer than 2 options in MCQ
    const singleOptCSV = `QuestionText,OptionA,OptionB,CorrectOptionId\nWhat is single?,OnlyOne,,A`;
    const resSingle = parseQuestionsCSV(singleOptCSV);
    assert(resSingle.errors.some((e) => e.field === 'options'), 'Requires at least 2 non-empty options for MCQ');

    // 4.3 Marks < 0.5
    const lowMarksCSV = `QuestionText,OptionA,OptionB,CorrectOptionId,Marks\nTest Marks,A,B,A,0.1`;
    const resMarks = parseQuestionsCSV(lowMarksCSV);
    assert(resMarks.errors.some((e) => e.field === 'marks'), 'Rejects marks less than 0.5');

    // 4.4 Unsupported question type
    const unsuppTypeCSV = `QuestionText,QuestionType,OptionA,OptionB,CorrectOptionId\nBad Type,essay,A,B,A`;
    const resType = parseQuestionsCSV(unsuppTypeCSV);
    assert(resType.errors.some((e) => e.field === 'questionType'), 'Rejects unsupported question type ("essay")');

    // 4.5 Empty input
    const emptyRes = parseQuestionsCSV('');
    assert(emptyRes.validCount === 0 && emptyRes.errorCount === 1, 'Safely handles empty CSV string');
  } catch (err) {
    console.error('Suite 4 error:', err);
    failed++;
  }

  // --- SUITE 5: JSON Question Ingestion ---
  console.log('\n🔹 5. JSON Question Import Validation:');
  try {
    const jsonInput = [
      {
        questionText: 'Which language runs in a web browser?',
        questionType: 'multiple-choice',
        options: ['Java', 'C', 'Python', 'JavaScript'],
        correctOptionId: '4', // maps to opt_4
        marks: 1,
      },
      {
        questionText: 'HTML stands for HyperText Markup Language.',
        questionType: 'true-false',
        correctOptionId: 'true', // maps to opt_1
        marks: 1,
      },
      {
        questionText: 'Invalid Question with no options',
        questionType: 'multiple-choice',
        options: ['JustOne'],
        correctOptionId: 'opt_1',
      },
    ];

    const jsonRes = parseQuestionsJSON(jsonInput);
    assert(jsonRes.totalReceived === 3, 'Received 3 JSON question entries');
    assert(jsonRes.validCount === 2, 'Parsed 2 valid questions');
    assert(jsonRes.errorCount === 1, 'Caught 1 invalid question');
    assert(jsonRes.questions[0].correctOptionId === 'opt_4', 'Mapped JSON array index 4 to opt_4');
    assert(jsonRes.questions[1].correctOptionId === 'opt_1', 'Mapped JSON True to opt_1');
    assert(jsonRes.errors[0].row === 3, 'Accurately indicates row 3 for the failed entry');

    // Empty JSON check
    const emptyJsonRes = parseQuestionsJSON([]);
    assert(emptyJsonRes.errorCount === 1, 'Rejects empty JSON array cleanly');
  } catch (err) {
    console.error('Suite 5 error:', err);
    failed++;
  }

  console.log(`\n📊 Question Parser Test Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runQuestionParserTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running question parser tests:', err);
    process.exit(1);
  });
