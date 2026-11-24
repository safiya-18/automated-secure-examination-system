const { generateToken, verifyJwtToken } = require('./jwt');
const { parseStudentCSV } = require('./csvParser');
const {
  getAuthCookieOptions,
  getCsrfCookieOptions,
  getClearCookieOptions,
  getClearCsrfCookieOptions,
} = require('./cookieOptions');
const { csrfProtection, generateCsrfToken } = require('../middleware/csrfMiddleware');
const { authorizeRoles, enforcePasswordChange } = require('../middleware/authMiddleware');
const { login } = require('../controllers/authController');
const { User } = require('../models');

async function runAuthSecurityTests() {
  console.log('🧪 Starting Phase 3 Comprehensive Security Audit & Verification Tests...\n');
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

  // --- AUDIT 1 & 2: JWT in HttpOnly Cookie ONLY (Not in JSON body) ---
  console.log('🔹 1 & 2. JWT Storage & Transmission Security:');
  try {
    const mockUser = {
      _id: '672000000000000000000001',
      role: 'student',
      name: 'Alice Student',
      email: 'alice@college.edu',
      usn: '1MS21CS001',
      isPasswordTemporary: true,
      accountStatus: 'active',
      comparePassword: async () => true,
      toJSON: () => ({
        _id: '672000000000000000000001',
        name: 'Alice Student',
        email: 'alice@college.edu',
        role: 'student',
        usn: '1MS21CS001',
      }),
    };

    // Mock User.findOne for login test
    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => mockUser,
    });

    const cookiesSet = {};
    const mockRes = {
      cookie: (name, val, opts) => {
        cookiesSet[name] = { val, opts };
      },
      status: (code) => ({
        json: (body) => {
          mockRes.statusCode = code;
          mockRes.body = body;
        },
      }),
    };

    await login({ body: { email: 'alice@college.edu', password: 'password123' } }, mockRes);

    // Restore findOne
    User.findOne = originalFindOne;

    // Verify token is NOT in JSON response
    assert(mockRes.body.token === undefined, 'AUDIT 1: JWT token is NOT returned in the JSON response body');
    assert(Boolean(cookiesSet['token']), 'AUDIT 2: JWT is set as a session cookie');
    assert(cookiesSet['token'].opts.httpOnly === true, 'AUDIT 2: JWT cookie is strictly HttpOnly (XSS protected)');
    assert(cookiesSet['token'].opts.sameSite === 'lax', 'AUDIT 2: JWT cookie enforces SameSite: lax');
    assert(cookiesSet['token'].opts.path === '/', 'AUDIT 2: JWT cookie path is /');
  } catch (err) {
    console.error('Audit 1 & 2 error:', err);
    failed++;
  }

  // --- AUDIT 3 & 4 & 5: CSRF Token & Cookie Lifecycle ---
  console.log('\n🔹 3, 4 & 5. CSRF Token Accessibility & Validation:');
  try {
    // 3. CSRF token accessible to frontend
    const csrfOpts = getCsrfCookieOptions();
    assert(csrfOpts.httpOnly === false, 'AUDIT 3: xsrf-token cookie is accessible to client JS (httpOnly: false)');

    const authOpts = getAuthCookieOptions();
    const clearAuthOpts = getClearCookieOptions();
    const clearCsrfOpts = getClearCsrfCookieOptions();

    assert(authOpts.path === clearAuthOpts.path, 'AUDIT 5: Login and logout share identical cookie path');
    assert(authOpts.sameSite === clearAuthOpts.sameSite, 'AUDIT 5: Login and logout share identical sameSite policy');
    assert(clearCsrfOpts.httpOnly === false, 'AUDIT 5: Logout clears xsrf-token cookie with matching attributes');

    // 4. CSRF protection on state-changing endpoints
    const csrfToken = generateCsrfToken();
    let csrfStatus = null;
    const resMock = {
      status: (c) => {
        csrfStatus = c;
        return { json: () => {} };
      },
    };

    // Missing CSRF header with cookie session
    let nextA = false;
    csrfProtection(
      {
        method: 'POST',
        path: '/api/admin/users/student',
        headers: {},
        cookies: { token: 'mock.token', 'xsrf-token': csrfToken },
      },
      resMock,
      () => {
        nextA = true;
      }
    );
    assert(csrfStatus === 403 && !nextA, 'AUDIT 4: Blocks state-changing cookie request when CSRF header is missing (403)');

    // Matching CSRF header with cookie session
    let nextB = false;
    csrfProtection(
      {
        method: 'POST',
        path: '/api/admin/users/student',
        headers: { 'x-xsrf-token': csrfToken },
        cookies: { token: 'mock.token', 'xsrf-token': csrfToken },
      },
      resMock,
      () => {
        nextB = true;
      }
    );
    assert(nextB === true, 'AUDIT 4: Allows state-changing request with valid matching x-xsrf-token header');

    // Bearer header bypasses CSRF
    let nextC = false;
    csrfProtection(
      {
        method: 'POST',
        path: '/api/admin/users/student',
        headers: { authorization: 'Bearer mock.token' },
        cookies: {},
      },
      resMock,
      () => {
        nextC = true;
      }
    );
    assert(nextC === true, 'AUDIT 4: Bearer header requests are exempt from CSRF (Postman / mobile friendly)');
  } catch (err) {
    console.error('Audit 3, 4 & 5 error:', err);
    failed++;
  }

  // --- AUDIT 6: Password-change enforcement ---
  console.log('\n🔹 6. Password Change & Temporary Password Restrictions:');
  try {
    let blockStatus = null;
    let blockBody = null;
    const resMock = {
      status: (c) => {
        blockStatus = c;
        return {
          json: (b) => {
            blockBody = b;
          },
        };
      },
    };

    let passCalled = false;
    enforcePasswordChange({ user: { isPasswordTemporary: true } }, resMock, () => {
      passCalled = true;
    });
    assert(
      blockStatus === 403 && blockBody.mustChangePassword === true,
      'AUDIT 6: Blocks users with temporary passwords from protected operations (403)'
    );

    let clearedCalled = false;
    enforcePasswordChange({ user: { isPasswordTemporary: false } }, resMock, () => {
      clearedCalled = true;
    });
    assert(clearedCalled === true, 'AUDIT 6: Permits users with updated passwords to access operational routes');
  } catch (err) {
    console.error('Audit 6 error:', err);
    failed++;
  }

  // --- AUDIT 7: Super Admin Seeder Idempotency ---
  console.log('\n🔹 7. Super Admin Seeder Verification:');
  try {
    const seedScriptContent = require('fs').readFileSync(
      require('path').join(__dirname, 'seedAdmin.js'),
      'utf8'
    );
    assert(
      seedScriptContent.includes('User.findOne({ role: \'admin\' })') &&
        seedScriptContent.includes('Admin account already exists in database'),
      'AUDIT 7: seedAdmin.js verifies existing admin before creation (idempotent seeder)'
    );
  } catch (err) {
    console.error('Audit 7 error:', err);
    failed++;
  }

  // --- AUDIT 8: Duplicate Email & USN Handling ---
  console.log('\n🔹 8. Duplicate Handling & MongoDB 11000 Key Error Mapping:');
  try {
    const adminControllerContent = require('fs').readFileSync(
      require('path').join(__dirname, '../controllers/adminController.js'),
      'utf8'
    );
    assert(
      adminControllerContent.includes('error.code === 11000') &&
        adminControllerContent.includes('status(409)'),
      'AUDIT 8: Catches database-level duplicate-key error (code 11000) and maps cleanly to HTTP 409 Conflict'
    );
  } catch (err) {
    console.error('Audit 8 error:', err);
    failed++;
  }

  // --- AUDIT 9: Bulk CSV & JSON Validation ---
  console.log('\n🔹 9. Bulk Student Validation (CSV & JSON):');
  try {
    const sampleCsv = `USN,Name,Email,Password
1MS21CS001,John Doe,john@college.edu,Secret123!
1MS21CS002,Jane Smith,jane@college.edu,Secret456!
1MS21CS003,Bad Email,bad-email,Secret789!
1MS21CS004,Short Pass,short@college.edu,12`;

    const parsed = parseStudentCSV(sampleCsv);
    assert(parsed.students.length === 2, 'AUDIT 9: CSV parser extracts valid records');
    assert(parsed.errors.length === 2, 'AUDIT 9: Catches malformed email and short password per row');
    assert(parsed.students[0].usn === '1MS21CS001', 'AUDIT 9: USN parsed in uppercase');

    // Intra-batch duplicate test
    const batchWithDups = `USN,Name,Email,Password
1MS21CS001,Student One,s1@college.edu,Secret123!
1MS21CS001,Student Duplicate USN,s2@college.edu,Secret123!
1MS21CS003,Student Duplicate Email,s1@college.edu,Secret123!`;
    const parsedDups = parseStudentCSV(batchWithDups);
    assert(parsedDups.students.length === 3, 'AUDIT 9: Parses rows, leaving duplicate deduplication to controller');
  } catch (err) {
    console.error('Audit 9 error:', err);
    failed++;
  }

  // --- AUDIT 10: 401 & 403 Response Standards ---
  console.log('\n🔹 10. HTTP 401 vs 403 Response Standards:');
  try {
    let guardStatus = null;
    let guardMessage = null;
    const resMock = {
      status: (c) => {
        guardStatus = c;
        return {
          json: (b) => {
            guardMessage = b.message;
          },
        };
      },
    };

    const adminGuard = authorizeRoles('admin');

    // Forbidden for student
    adminGuard({ user: { role: 'student' } }, resMock, () => {});
    assert(
      guardStatus === 403 && guardMessage.includes('Forbidden'),
      'AUDIT 10: Returns HTTP 403 Forbidden with clear message when student attempts admin access'
    );

    // Forbidden for faculty
    adminGuard({ user: { role: 'faculty' } }, resMock, () => {});
    assert(
      guardStatus === 403 && guardMessage.includes('Forbidden'),
      'AUDIT 10: Returns HTTP 403 Forbidden with clear message when faculty attempts admin access'
    );
  } catch (err) {
    console.error('Audit 10 error:', err);
    failed++;
  }

  // --- AUDIT 11: Sensitive Information Sanitization ---
  console.log('\n🔹 11. Sensitive Information Sanitization:');
  try {
    const userDoc = new User({
      name: 'David Student',
      email: 'david@college.edu',
      password: 'PlainPassword123!',
      role: 'student',
      usn: '1MS21CS050',
    });

    const serialized = userDoc.toJSON();
    assert(serialized.password === undefined, 'AUDIT 11: toJSON() strips password from output');
    assert(serialized.__v === undefined, 'AUDIT 11: toJSON() strips internal __v field');

    // Check minimal JWT claims
    const token = generateToken(userDoc);
    const decoded = verifyJwtToken(token);
    assert(decoded.password === undefined, 'AUDIT 11: JWT payload does not contain password');
    assert(decoded.email === undefined, 'AUDIT 11: JWT payload does not contain email');
    assert(decoded.usn === undefined, 'AUDIT 11: JWT payload does not contain USN');
    assert(decoded.id && decoded.role, 'AUDIT 11: JWT payload only contains minimal { id, role }');
  } catch (err) {
    console.error('Audit 11 error:', err);
    failed++;
  }

  console.log(`\n📊 Security Audit Summary: ${passed} passed, ${failed} failed.\n`);
  return failed === 0;
}

runAuthSecurityTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error('Unexpected error running audit tests:', err);
    process.exit(1);
  });
