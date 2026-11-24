/**
 * Lightweight, robust CSV Parser for Student Bulk Registration
 * Refinement 3: Parses CSV text formatted as:
 * USN, Name, Email, Password
 */
function parseStudentCSV(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') {
    throw new Error('CSV content must be a non-empty string');
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one student record');
  }

  // 1. Validate Header Row
  const headerParts = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const expectedFields = ['usn', 'name', 'email', 'password'];

  const fieldIndices = {};
  for (const field of expectedFields) {
    const idx = headerParts.indexOf(field);
    if (idx === -1) {
      throw new Error(`CSV header missing required column: "${field}". Expected columns: USN, Name, Email, Password`);
    }
    fieldIndices[field] = idx;
  }

  const parsedStudents = [];
  const parseErrors = [];

  // 2. Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const row = lines[i];

    // Split considering simple commas
    const cols = row.split(',').map((c) => c.trim());

    const usn = cols[fieldIndices['usn']] || '';
    const name = cols[fieldIndices['name']] || '';
    const email = cols[fieldIndices['email']] || '';
    const password = cols[fieldIndices['password']] || '';

    const rowErrors = [];
    if (!usn) rowErrors.push('Missing USN');
    if (!name) rowErrors.push('Missing Name');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push('Invalid or missing Email');
    if (!password || password.length < 6) rowErrors.push('Password must be at least 6 characters');

    if (rowErrors.length > 0) {
      parseErrors.push({
        row: rowNumber,
        usn: usn || 'N/A',
        errors: rowErrors,
      });
    } else {
      parsedStudents.push({
        usn: usn.toUpperCase(),
        name,
        email: email.toLowerCase(),
        password,
      });
    }
  }

  return {
    students: parsedStudents,
    errors: parseErrors,
  };
}

module.exports = {
  parseStudentCSV,
};

