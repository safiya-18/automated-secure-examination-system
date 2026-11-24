/**
 * Question Parser Utility (CSV & JSON)
 *
 * Implements Task 3:
 * - RFC 4180 standard CSV tokenizer (quoted fields, commas, escaped quotes, UTF-8 BOM)
 * - Deterministic option mapping (OptionA -> opt_1, OptionB -> opt_2, OptionC -> opt_3, OptionD -> opt_4, OptionE -> opt_5)
 * - True/False support (strictly two options: opt_1 -> 'True', opt_2 -> 'False')
 * - CorrectOptionId validation: strictly ensures correctOptionId references an existing, populated option
 * - JSON array parser with identical validation
 * - Detailed row-level error reporting: { row, field, message }
 */

/**
 * Tokenize CSV string into rows and fields following RFC 4180
 */
function tokenizeCSV(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Strip UTF-8 Byte Order Mark (BOM) if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote ("")
        currentField += '"';
        i++; // skip second quote
      } else {
        // Toggle quote enclosure
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField);
      if (currentRow.some((f) => f.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Final field/row flush
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Map raw correct option input (e.g. 'A', '1', 'opt_1', 'true', etc.) to deterministic optionId
 */
function normalizeCorrectOptionId(raw, questionType) {
  if (!raw || typeof raw !== 'string') return null;
  const val = raw.trim().toLowerCase();

  if (questionType === 'true-false') {
    if (['opt_1', '1', 'a', 'true', 't'].includes(val)) return 'opt_1';
    if (['opt_2', '2', 'b', 'false', 'f'].includes(val)) return 'opt_2';
    return null;
  }

  // MCQ mapping
  if (['opt_1', '1', 'a'].includes(val)) return 'opt_1';
  if (['opt_2', '2', 'b'].includes(val)) return 'opt_2';
  if (['opt_3', '3', 'c'].includes(val)) return 'opt_3';
  if (['opt_4', '4', 'd'].includes(val)) return 'opt_4';
  if (['opt_5', '5', 'e'].includes(val)) return 'opt_5';

  return null;
}

/**
 * Parse CSV text into validated question objects
 * Expected Header: QuestionText, QuestionType, OptionA, OptionB, OptionC, OptionD, CorrectOptionId, Marks (optional OptionE)
 */
function parseQuestionsCSV(csvContent) {
  if (!csvContent || typeof csvContent !== 'string' || csvContent.trim().length === 0) {
    return {
      questions: [],
      errors: [{ row: 0, field: 'csv', message: 'CSV content must be a non-empty string' }],
      totalReceived: 0,
      validCount: 0,
      errorCount: 1,
    };
  }

  const rows = tokenizeCSV(csvContent);
  if (rows.length < 2) {
    return {
      questions: [],
      errors: [{ row: 1, field: 'csv', message: 'CSV must contain a header row and at least one data row' }],
      totalReceived: 0,
      validCount: 0,
      errorCount: 1,
    };
  }

  // 1. Header identification & normalization
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
  const findIdx = (names) => header.findIndex((h) => names.includes(h));

  const idxText = findIdx(['questiontext', 'question', 'text']);
  const idxType = findIdx(['questiontype', 'type']);
  const idxOptA = findIdx(['optiona', 'a', 'opt1', 'option1']);
  const idxOptB = findIdx(['optionb', 'b', 'opt2', 'option2']);
  const idxOptC = findIdx(['optionc', 'c', 'opt3', 'option3']);
  const idxOptD = findIdx(['optiond', 'd', 'opt4', 'option4']);
  const idxOptE = findIdx(['optione', 'e', 'opt5', 'option5']);
  const idxCorrect = findIdx(['correctoptionid', 'correctoption', 'correctanswer', 'answer', 'correct']);
  const idxMarks = findIdx(['marks', 'mark', 'points', 'score']);

  if (idxText === -1 || idxCorrect === -1) {
    return {
      questions: [],
      errors: [
        {
          row: 1,
          field: 'header',
          message: 'Missing required header columns. Expected at least "QuestionText" and "CorrectOptionId"',
        },
      ],
      totalReceived: 0,
      validCount: 0,
      errorCount: 1,
    };
  }

  const validQuestions = [];
  const errors = [];

  // 2. Data rows processing
  for (let r = 1; r < rows.length; r++) {
    const rowNum = r + 1;
    const row = rows[r];

    const rawText = idxText !== -1 && row[idxText] ? row[idxText].trim() : '';
    const rawType = idxType !== -1 && row[idxType] ? row[idxType].trim().toLowerCase() : '';
    const rawCorrect = idxCorrect !== -1 && row[idxCorrect] ? row[idxCorrect].trim() : '';
    const rawMarks = idxMarks !== -1 && row[idxMarks] ? row[idxMarks].trim() : '1';

    // Validate Question Text
    if (!rawText) {
      errors.push({ row: rowNum, field: 'questionText', message: 'Question text is required' });
      continue;
    }

    // Determine & Normalize Question Type
    let questionType = 'multiple-choice';
    if (['true-false', 'truefalse', 'tf', 'true/false'].includes(rawType)) {
      questionType = 'true-false';
    } else if (rawType && !['multiple-choice', 'multiplechoice', 'mcq'].includes(rawType)) {
      errors.push({
        row: rowNum,
        field: 'questionType',
        message: `Unsupported question type: "${rawType}". Expected "multiple-choice" or "true-false"`,
      });
      continue;
    }

    // Validate Marks
    const marksNum = parseFloat(rawMarks);
    if (isNaN(marksNum) || marksNum < 0.5) {
      errors.push({
        row: rowNum,
        field: 'marks',
        message: 'Marks must be a valid number of at least 0.5',
      });
      continue;
    }

    // Build Options
    let options = [];
    if (questionType === 'true-false') {
      options = [
        { optionId: 'opt_1', text: 'True' },
        { optionId: 'opt_2', text: 'False' },
      ];
    } else {
      // MCQ Mode: extract option columns
      const rawOptions = [
        { id: 'opt_1', text: idxOptA !== -1 && row[idxOptA] ? row[idxOptA].trim() : '' },
        { id: 'opt_2', text: idxOptB !== -1 && row[idxOptB] ? row[idxOptB].trim() : '' },
        { id: 'opt_3', text: idxOptC !== -1 && row[idxOptC] ? row[idxOptC].trim() : '' },
        { id: 'opt_4', text: idxOptD !== -1 && row[idxOptD] ? row[idxOptD].trim() : '' },
        { id: 'opt_5', text: idxOptE !== -1 && row[idxOptE] ? row[idxOptE].trim() : '' },
      ];

      options = rawOptions
        .filter((o) => o.text.length > 0)
        .map((o) => ({ optionId: o.id, text: o.text }));

      if (options.length < 2) {
        errors.push({
          row: rowNum,
          field: 'options',
          message: 'Multiple-choice question requires at least two non-empty options',
        });
        continue;
      }
    }

    // Normalize & Validate CorrectOptionId
    const resolvedCorrectId = normalizeCorrectOptionId(rawCorrect, questionType);
    if (!resolvedCorrectId) {
      errors.push({
        row: rowNum,
        field: 'correctOptionId',
        message: `Invalid correct option identifier: "${rawCorrect}"`,
      });
      continue;
    }

    // Option Integrity Check: Does correctOptionId exist in populated options?
    const optionExists = options.some((opt) => opt.optionId === resolvedCorrectId);
    if (!optionExists) {
      errors.push({
        row: rowNum,
        field: 'correctOptionId',
        message: `Correct option ID "${resolvedCorrectId}" does not match any populated option in this question`,
      });
      continue;
    }

    validQuestions.push({
      questionText: rawText,
      questionType,
      options,
      correctOptionId: resolvedCorrectId,
      marks: marksNum,
    });
  }

  const totalReceived = rows.length - 1;

  return {
    questions: validQuestions,
    errors,
    totalReceived,
    validCount: validQuestions.length,
    errorCount: errors.length,
  };
}

/**
 * Parse and validate an array of question objects (JSON import format)
 */
function parseQuestionsJSON(jsonArray) {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) {
    return {
      questions: [],
      errors: [{ row: 0, field: 'json', message: 'Expected a non-empty array of question objects' }],
      totalReceived: 0,
      validCount: 0,
      errorCount: 1,
    };
  }

  const validQuestions = [];
  const errors = [];

  for (let i = 0; i < jsonArray.length; i++) {
    const itemNum = i + 1;
    const item = jsonArray[i];

    if (!item || typeof item !== 'object') {
      errors.push({ row: itemNum, field: 'item', message: 'Question entry must be a valid object' });
      continue;
    }

    const rawText = item.questionText ? String(item.questionText).trim() : '';
    const rawType = item.questionType ? String(item.questionType).trim().toLowerCase() : 'multiple-choice';
    const rawMarks = item.marks !== undefined ? parseFloat(item.marks) : 1;

    // Validate Text
    if (!rawText) {
      errors.push({ row: itemNum, field: 'questionText', message: 'Question text is required' });
      continue;
    }

    // Determine Type
    let questionType = 'multiple-choice';
    if (['true-false', 'tf'].includes(rawType)) {
      questionType = 'true-false';
    } else if (rawType && !['multiple-choice', 'mcq'].includes(rawType)) {
      errors.push({
        row: itemNum,
        field: 'questionType',
        message: `Unsupported question type: "${rawType}". Expected "multiple-choice" or "true-false"`,
      });
      continue;
    }

    // Validate Marks
    if (isNaN(rawMarks) || rawMarks < 0.5) {
      errors.push({
        row: itemNum,
        field: 'marks',
        message: 'Marks must be a valid number of at least 0.5',
      });
      continue;
    }

    // Normalize Options
    let options = [];
    if (questionType === 'true-false') {
      options = [
        { optionId: 'opt_1', text: 'True' },
        { optionId: 'opt_2', text: 'False' },
      ];
    } else {
      // Support options array of strings or objects
      if (Array.isArray(item.options)) {
        options = item.options
          .map((opt, idx) => {
            const optId = `opt_${idx + 1}`;
            if (typeof opt === 'string') {
              return { optionId: optId, text: opt.trim() };
            }
            if (opt && typeof opt === 'object') {
              return {
                optionId: opt.optionId ? String(opt.optionId).trim() : optId,
                text: opt.text ? String(opt.text).trim() : '',
              };
            }
            return null;
          })
          .filter((opt) => opt && opt.text.length > 0);
      }

      if (options.length < 2) {
        errors.push({
          row: itemNum,
          field: 'options',
          message: 'Multiple-choice question requires at least two non-empty options',
        });
        continue;
      }
    }

    // Normalize CorrectOptionId
    let resolvedCorrectId = normalizeCorrectOptionId(String(item.correctOptionId || ''), questionType);

    // If direct match with an explicit optionId in options array
    if (!resolvedCorrectId && item.correctOptionId) {
      const match = options.find((o) => o.optionId === item.correctOptionId);
      if (match) {
        resolvedCorrectId = match.optionId;
      }
    }

    if (!resolvedCorrectId) {
      errors.push({
        row: itemNum,
        field: 'correctOptionId',
        message: `Invalid or missing correctOptionId: "${item.correctOptionId}"`,
      });
      continue;
    }

    // Option Integrity Check
    const optionExists = options.some((opt) => opt.optionId === resolvedCorrectId);
    if (!optionExists) {
      errors.push({
        row: itemNum,
        field: 'correctOptionId',
        message: `Correct option ID "${resolvedCorrectId}" does not reference an existing option in this question`,
      });
      continue;
    }

    validQuestions.push({
      questionText: rawText,
      questionType,
      options,
      correctOptionId: resolvedCorrectId,
      marks: rawMarks,
    });
  }

  return {
    questions: validQuestions,
    errors,
    totalReceived: jsonArray.length,
    validCount: validQuestions.length,
    errorCount: errors.length,
  };
}

module.exports = {
  tokenizeCSV,
  normalizeCorrectOptionId,
  parseQuestionsCSV,
  parseQuestionsJSON,
};

