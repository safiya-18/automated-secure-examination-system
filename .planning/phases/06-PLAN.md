# Phase 06: Examination Attempt Engine & Persistent Results Integration - Implementation Plan

**Phase Number:** 06
**Status:** Planned (Ready for Implementation)
**Target:** Student Exam Attempt Engine, Server-Side Timer & Grace Enforcement, Real-Time Answer Saving, Automatic Objective Evaluation, Telemetry Logging, Faculty Results Analytics, and Frontend Integration

---

## 1. Executive Summary & Architecture Overview

Phase 6 connects the student exam attend flow to persistent database records and provides faculty with comprehensive evaluation and telemetry analytics.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXAM LIFECYCLE FLOW                                  │
├─────────────────────┬──────────────────────┬────────────────────┬──────────────────────┤
│ 1. Student Join     │ 2. Exam Session      │ 3. Submission      │ 4. Faculty Audit     │
│ - Direct link / QR  │ - Ephemeral session  │ - Auto-evaluation  │ - Cohort results     │
│ - USN + Name verify │ - Auto-save answers  │ - Hard expiry lock │ - Telemetry audit    │
│ - Resume or allocate│ - Focus telemetry    │ - Delayed scores   │ - Question breakdown │
└─────────────────────┴──────────────────────┴────────────────────┴──────────────────────┘
```

### Key Invariants & Enforcements
1. **Zero Student Accounts / Passwords:** Students verify against admin-registered USN and legal name. No login credentials or dashboards required.
2. **Reconnection Resilience:** An active attempt (`status === 'in-progress'`) reloads the exact `assignedQuestionOrder`, `assignedOptionOrder`, and previously saved answers. Re-shuffling is strictly prevented.
3. **Quarantine of Answer Keys:** `correctOptionId` is omitted from all student-facing payloads via `sanitizeQuestionsForStudent()` and is selected strictly on the backend during evaluation.
4. **Server-Side Timer & Two-Tier Grace Enforcement:**
   - Answer modifications (`PATCH /answers`) strictly close at `examExpiresAt = attempt.startTime + duration`.
   - Final submission (`POST /submit`) has an extra 60-second grace window to handle network jitter.
   - The grace window never extends answer editing.
5. **Delayed Score Visibility:** Student submission returns a confirmation receipt with timestamp; marks are saved to database and released exclusively by faculty.
6. **Focus Telemetry as Review Metric:** Focus events are recorded in `MalpracticeLog` and labeled for human academic review, never automated penalties.

---

## 2. Graphify Architectural Impact Analysis

From Graphify AST analysis:

* **Directly Modified Core Files:**
  * `server/src/models/Attempt.js` — Add `submissionReason` (`'student-submit'`, `'timer-expiry'`, `'proctor-terminated'`) and optional `sessionToken` (`select: false`). Preserves existing status enum (`'in-progress'`, `'completed'`, `'terminated-malpractice'`).
  * `server/src/app.js` — Mount `/api/exams` route.
  * `server/src/routes/quizRoutes.js` — Mount faculty results endpoints (`GET /:quizId/results`, `GET /:quizId/attempts/:attemptId`).
  * `client/src/services/api.js` — Replace mock endpoints with live API calls.
  * `client/src/pages/student/StudentAttend.jsx` — Connect live exam lifecycle (join, attend, auto-save, telemetry, submit).
  * `client/src/pages/faculty/QuizResults.jsx` — Connect live results table and attempt audit modal.

* **Newly Created Modules:**
  * `server/src/routes/examRoutes.js` — Student exam endpoints (`public-info`, `verify-start`, `answers`, `telemetry`, `submit`).
  * `server/src/controllers/examController.js` — Student exam logic (verification, allocation, auto-save, evaluation, malpractice logging).
  * `server/src/controllers/resultsController.js` — Faculty quiz results and deep attempt inspection.
  * `server/src/middleware/examSessionMiddleware.js` — Validates ephemeral exam session token and server expiration window.
  * `server/src/utils/evaluationService.js` — Reusable, atomic server-side evaluation & finalization engine (shared by Task 2 expired attempt handling and Task 4 submission/telemetry finalization).
  * `server/src/utils/testExamEngine.js` — Automated integration test suite covering end-to-end exam lifecycle.

---

## 3. Schema Modifications (Safe & Backward Compatible)

### `server/src/models/Attempt.js`
Preserve existing schema and status enum. Non-breaking fields:
```js
// Added to attemptSchema:
submissionReason: {
  type: String,
  enum: {
    values: ['student-submit', 'timer-expiry', 'proctor-terminated'],
    message: '{VALUE} is not a valid submission reason',
  },
  default: null, // Critical: in-progress attempts are NEVER initialized with 'student-submit'
},
sessionTokenHash: {
  type: String,
  default: null,
  select: false,
},
```

---

## 4. Task Breakdown

### Wave 1: Core Backend Engine & Ephemeral Session Middleware

#### Task 1: Attempt Schema Update & Exam Session Middleware [COMPLETED]
* **Files:**
  * `server/src/models/Attempt.js`
  * `server/src/utils/examToken.js`
  * `server/src/middleware/examSessionMiddleware.js`
  * `server/src/utils/testExamSessionMiddleware.js`
* **Implementation:**
  * Added `submissionReason` enum (`['student-submit', 'timer-expiry', 'proctor-terminated']`) while preserving all original `status` enum values (`'in-progress'`, `'completed'`, `'terminated-malpractice'`).
  * Added `sessionTokenHash` (`select: false`, SHA-256) and updated `Attempt.prototype.toJSON()` to exclude token hashes from API serialization.
  * Created `server/src/utils/examToken.js` containing `generateExamSessionToken`, `verifyExamSessionToken`, `hashSessionToken`, and `calculateExamExpiry` (`Math.min(attempt.startTime + quiz.duration, quiz.endTime)`).
  * Created `server/src/middleware/examSessionMiddleware.js` providing `verifyExamSession` with signature verification, attemptId/studentId/quizId matching, status checks, hash invalidation, and server timing calculation.
  * Verified with 45 unit/integration test assertions in `server/src/utils/testExamSessionMiddleware.js` (45 passed, 0 failed) and zero regression across existing suites (283+ tests passing).

#### Task 2: Student Exam Controller — Public Info & Verify-Start
* **Files & Implementation Dependencies:**
  * `server/src/models/Attempt.js` (ensure `submissionReason` default is `null` so in-progress attempts never carry `'student-submit'`)
  * `server/src/utils/evaluationService.js` (**Explicit Implementation Dependency**: reusable server-side evaluation & finalization engine implemented upfront before `examController.js` so that expired attempt finalization is fully implemented and coordinated with Task 4 without temporary stubs)
  * `server/src/controllers/examController.js` (new controller module)
  * `server/src/routes/examRoutes.js` (new routes module)
  * `server/src/app.js` (mount `/api/exams`)
  * `server/src/utils/testExamEntry.js` (focused automated test suite)
  * `server/package.json` (add `test:exam:entry` test script)
* **Implementation:**
  * **1. Explicit Dependency Implementation: Reusable Finalizer (`evaluationService.js`)**:
    * Implements `evaluateAndFinalizeAttempt(attemptId, { submissionReason = 'timer-expiry', finalizedAt = new Date() })`:
      * Concurrency & Idempotency: Atomically queries and locks the attempt with `{ _id: attemptId, status: 'in-progress' }`. If the attempt is already completed/terminated, returns the existing record immediately without re-evaluation.
      * Loads assigned questions for the attempt with `.select('+correctOptionId')`.
      * Evaluates previously saved answers in `attempt.submittedAnswers` against `correctOptionId`:
        * Exact match: `isCorrect = true`, `marksAwarded = question.marks`.
        * Blank or mismatch: `isCorrect = false`, `marksAwarded = 0`.
      * Evaluates missing/unanswered questions: `isCorrect = false`, `marksAwarded = 0`.
      * Computes `score = sum(marksAwarded)` and `percentage = Math.round((score / totalMarksPossible) * 100)`.
      * Saves final evaluation: updates `score`, `percentage`, sets `status = 'completed'`, sets `submissionReason = 'timer-expiry'` (or supplied reason), sets `submittedAt = finalizedAt`, and clears `sessionTokenHash = null`.
      * Shared and reused directly by Task 4 for `POST /api/exams/attempts/:attemptId/submit` and proctoring auto-submission.
  * **2. GET `/api/exams/:quizId/public-info`**:
    * Route: `GET /api/exams/:quizId/public-info`
    * Param validation: `quizId` must be a valid MongoDB ObjectId.
    * Checks:
      * Finds Quiz by `_id`. Rejects with HTTP 404 if not found.
      * Rejects with HTTP 403 if `quiz.status !== 'published'` (`'Quiz is not published or open for examination'`).
    * Window status flags:
      * `now = new Date()`
      * `isOpen = now >= quiz.startTime && now <= quiz.endTime`
      * `isUpcoming = now < quiz.startTime`
      * `isClosed = now > quiz.endTime`
    * Response: `{ success: true, data: { _id, title, description, duration, totalMarks, questionsPerStudent, startTime, endTime, maxAttempts, isOpen, isUpcoming, isClosed } }`.
    * **Zero answer-key or question leak:** Exposes strictly public metadata; no questions, options, or faculty details.
  * **3. POST `/api/exams/:quizId/verify-start`**:
    * Route: `POST /api/exams/:quizId/verify-start`
    * Body validation: `usn` (non-empty string), `studentName` (non-empty string).
    * Param validation: `quizId` (valid MongoDB ObjectId).
    * **Step A: Student Identity Verification & Anti-Enumeration:**
      * Normalizes input: `normalizedUsn = usn.trim().toUpperCase()`.
      * Queries `User.findOne({ usn: normalizedUsn, role: 'student' })`.
      * Verifies `student.accountStatus === 'active'` (verified against actual `accountStatus` enum in `User.js`).
      * Normalizes names: `norm(name) = name.trim().toLowerCase().replace(/\s+/g, ' ')`.
      * Enforces full complete name match: `norm(student.name) === norm(studentName)`.
      * **Generic Failure Response:** If student not found, `accountStatus !== 'active'`, or name does not match, returns the exact same HTTP 401 response: `{ success: false, message: 'Invalid USN or student name' }`. Strictly prevents USN probing or account status discovery.
    * **Step B: Quiz Existence & Publication Check:**
      * Queries `Quiz.findById(quizId)`. Rejects with HTTP 404 if missing.
      * Rejects with HTTP 403 if `quiz.status !== 'published'`.
    * **Step C: Existing In-Progress Attempt Check (BEFORE Availability Window):**
      * Queries existing attempts: `existingAttempts = await Attempt.find({ studentId: student._id, quizId: quiz._id })`.
      * Finds active attempt: `activeAttempt = existingAttempts.find(a => a.status === 'in-progress')`.
      * **Branch 1: In-Progress Attempt Exists (Resumption Path):**
        * Authoritative expiry: `examExpiresAt = calculateExamExpiry(activeAttempt.startTime, quiz.duration, quiz.endTime)`.
        * **Resumption Beyond Quiz Window Rule:** Resumption is permitted within authoritative `examExpiresAt + 60_000` (submission grace period), even if `quiz.endTime` has already passed.
        * **Expired Attempt Finalization & Evaluation (Coordinated with Task 4):**
          * If `Date.now() > examExpiresAt.getTime() + 60_000`:
            * An expired attempt must **never** be marked completed without evaluation.
            * Calls reusable `evaluateAndFinalizeAttempt(activeAttempt._id, { submissionReason: 'timer-expiry', finalizedAt: new Date(examExpiresAt.getTime() + 60_000) })` from `server/src/utils/evaluationService.js`.
            * Computes score and percentage from saved answers, updates attempt atomically, clears session token hash, and returns HTTP 403: `{ success: false, message: 'Examination time has expired. This attempt has been evaluated and closed.' }`.
            * Guarantees expired attempts never remain indefinitely stuck as `in-progress`.
        * **Active In-Time Resumption:**
          * If `Date.now() <= examExpiresAt.getTime() + 60_000`:
            * Computes remaining editing seconds: `remainingEditSeconds = Math.max(0, Math.floor((examExpiresAt.getTime() - Date.now()) / 1000))`.
            * Note: If `Date.now() > examExpiresAt.getTime()`, `remainingEditSeconds = 0` (answers cannot be edited after `examExpiresAt`, strictly within the 60s transmission grace window).
            * Loads all questions for quiz.
            * Strictly preserves original question order (`activeAttempt.assignedQuestionOrder`), option order (`activeAttempt.assignedOptionOrder`), and saved answers (`activeAttempt.submittedAnswers`).
            * Sanitizes questions via `quizService.sanitizeQuestionsForStudent(questions, activeAttempt.assignedQuestionOrder, activeAttempt.assignedOptionOrder)`.
            * Issues refreshed ephemeral session token expiring at `new Date(examExpiresAt.getTime() + 60_000)` (authoritative 60-second grace window).
            * Updates `activeAttempt.sessionTokenHash = tokenHash` (invalidates older tab sessions) and saves.
            * Returns `{ success: true, resumed: true, attemptId: activeAttempt._id, sessionToken: token, expiresAt: examExpiresAt, remainingSeconds: remainingEditSeconds, questions: sanitizedQuestions, submittedAnswers: activeAttempt.submittedAnswers }`.
      * **Branch 2: No Active Attempt Exists (New Attempt Path):**
        * **Strict Availability Window Enforcement:**
          * ONLY checked when starting a new attempt.
          * `const now = new Date();`
          * If `now < quiz.startTime || now > quiz.endTime`:
            * Returns HTTP 403: `{ success: false, message: 'Examination window is not active. New attempts cannot be started outside the scheduled window.' }`.
            * **Invariant:** Never allows a new attempt to start outside the quiz availability window.
        * **Attempt Numbering & Quota Enforcement:**
          * Calculates maximum existing attempt number:
            `maxAttemptNumber = existingAttempts.reduce((max, a) => Math.max(max, a.attemptNumber || 0), 0)`.
          * Calculates next attempt number: `nextAttemptNumber = maxAttemptNumber + 1`.
          * Enforces `maxAttempts`: If `existingAttempts.length >= quiz.maxAttempts` or `maxAttemptNumber >= quiz.maxAttempts`:
            * Returns HTTP 403: `{ success: false, message: 'Maximum attempt limit reached. You cannot start a new attempt.' }`.
        * **Question Allocation & Invariants:**
          * Fetches quiz question bank. Validates question bank is non-empty and has enough questions for `quiz.questionsPerStudent`.
          * Calls `quizService.generateStudentExamAllocation(quiz, allQuestions)`.
          * Computes authoritative expiry: `startTime = new Date()`, `examExpiresAt = calculateExamExpiry(startTime, quiz.duration, quiz.endTime)`.
          * Creates `Attempt`:
            * `studentId: student._id`
            * `quizId: quiz._id`
            * `attemptNumber: nextAttemptNumber`
            * `assignedQuestionOrder: allocation.assignedQuestionOrder`
            * `assignedOptionOrder: allocation.assignedOptionOrder`
            * `totalMarksPossible: allocation.totalMarksPossible`
            * `startTime`
            * `status: 'in-progress'`
            * `submissionReason: null` (CRITICAL: never initialized to `'student-submit'`)
            * `submittedAnswers: []`
          * Issues ephemeral session token expiring at `new Date(examExpiresAt.getTime() + 60_000)` (authoritative 60-second grace window).
          * Sets `newAttempt.sessionTokenHash = tokenHash`.
          * **Concurrency & Duplicate-Key Recovery:**
            * Saves with try-catch. If duplicate key collision occurs on compound index `{ studentId: 1, quizId: 1, attemptNumber: 1 }` (Mongo error `11000` from rapid double-clicks):
              * Catches collision, queries the newly created active attempt, and resumes it cleanly instead of throwing an unhandled error.
          * Sanitizes questions via `quizService.sanitizeQuestionsForStudent(allQuestions, newAttempt.assignedQuestionOrder, newAttempt.assignedOptionOrder)`.
          * **Zero Answer-Key Exposure:** Guarantees `correctOptionId` is completely quarantined from the returned response.
          * Returns `{ success: true, resumed: false, attemptId: newAttempt._id, sessionToken: token, expiresAt: examExpiresAt, remainingSeconds: Math.floor((examExpiresAt.getTime() - startTime.getTime()) / 1000), questions: sanitizedQuestions, submittedAnswers: [] }`.
  * **4. Routes & App Wiring**:
    * `server/src/routes/examRoutes.js`: Exposes `/public-info` and `/verify-start`.
    * `server/src/app.js`: Mounts `app.use('/api/exams', examRoutes);`.
  * **5. Comprehensive Integration Tests (`server/src/utils/testExamEntry.js`)**:
    * Public Info endpoint:
      * Valid quiz returns sanitized metadata.
      * Draft / Archived quiz returns HTTP 403.
      * Invalid/missing quizId returns HTTP 404 / 400.
      * Asserts zero questions or correct answers in public-info payload.
    * Identity verification:
      * Unknown USN returns generic HTTP 401 (`"Invalid USN or student name"`).
      * Name mismatch returns generic HTTP 401 (`"Invalid USN or student name"`).
      * Inactive student account returns generic HTTP 401 (`"Invalid USN or student name"`).
      * Whitespace-tolerant, case-insensitive normalized matching name succeeds.
    * Resumption before Availability Check:
      * In-progress attempt resumes successfully even after `quiz.endTime` has passed, provided `now <= examExpiresAt + 60s`.
      * Resumption after `examExpiresAt` reflects `remainingSeconds: 0` (no answer edits permitted).
    * Timing & Quota validation for New Attempts:
      * New attempt before `startTime` returns HTTP 403.
      * New attempt after `endTime` returns HTTP 403.
      * Student exceeding `maxAttempts` returns HTTP 403.
    * New Attempt Creation & Numbering:
      * `attemptNumber` uses `max(attemptNumber) + 1`.
      * `status` is `'in-progress'`, `submissionReason` is `null` (not `'student-submit'`).
      * Session token expires at `examExpiresAt + 60_000`.
      * `sessionTokenHash` is stored on Attempt (and omitted from JSON serialization).
    * Resumption & Reconnection:
      * Re-calling `verify-start` while in-progress returns `resumed: true`.
      * Preserves exact `assignedQuestionOrder`, `assignedOptionOrder`, and `submittedAnswers`.
      * Replaces `sessionTokenHash` with fresh token.
    * Expired Attempt Evaluation & Finalization:
      * Resuming an attempt past `examExpiresAt + 60s` triggers `evaluateAndFinalizeAttempt`, computing score/percentage from saved answers, setting `status = 'completed'`, `submissionReason = 'timer-expiry'`, invalidating session token, and rejecting with HTTP 403.
      * Finalization is idempotent against repeated or concurrent requests.
    * Concurrency & Collision Resilience:
      * Simulates concurrent creation, catches code 11000, returns resumed attempt.
    * Answer Key Quarantine:
      * Deep scan of JSON responses asserts `correctOptionId` is 100% absent.

#### Task 3: Real-Time Answer Saving & Strict Timer Cutoff
* **Files:**
  * `server/src/controllers/examController.js`
* **Implementation:**
  * `PATCH /api/exams/attempts/:attemptId/answers`:
    * Protected by `verifyExamSession`.
    * Server Timer Hard Cutoff:
      * Computes `examExpiresAt = calculateExamExpiry(attempt.startTime, quiz.duration, quiz.endTime)`.
      * If `Date.now() > examExpiresAt.getTime()`:
        * Rejects answer save with HTTP 403: `"Examination time has expired. Answer editing is closed."`
        * Notice: The 60-second grace window applies strictly to final submission transmission (`POST /submit`), **never** to answer editing.
    * Validates `{ questionId, selectedOptionId }`:
      * Ensures `questionId` is within `attempt.assignedQuestionOrder`.
      * Finds question; ensures `selectedOptionId` exists in `question.options`.
    * Updates or inserts into `attempt.submittedAnswers`:
      * `{ questionId, selectedOptionId, isCorrect: null, marksAwarded: 0 }`.
    * Saves attempt atomically; returns `{ success: true, savedAt: new Date() }`.

#### Task 4: Submission Controller, Automatic Evaluation & Focus Telemetry
* **Files:**
  * `server/src/utils/evaluationService.js` (shared with Task 2)
  * `server/src/controllers/examController.js`
* **Implementation:**
  * `POST /api/exams/attempts/:attemptId/telemetry`:
    * Protected by `verifyExamSession`.
    * Accepts `{ eventType, eventDescription }`.
    * Validates `eventType` against `MalpracticeLog` enum (`TAB_SWITCH`, `WINDOW_BLUR`, etc.).
    * Inserts record into `MalpracticeLog` collection.
    * Increments `attempt.violationCount`.
    * If `quiz.proctoringSettings.autoSubmitOnMaxViolations` enabled and `violationCount >= maxViolationsAllowed`:
      * Terminates attempt via `evaluateAndFinalizeAttempt(attemptId, { submissionReason: 'proctor-terminated' })`.
      * Automatically evaluates answers saved so far.
    * Returns `{ logged: true, violationCount }`.
  * `POST /api/exams/attempts/:attemptId/submit`:
    * Protected by `verifyExamSession`.
    * Timer Enforcement:
      * `examExpiresAt = calculateExamExpiry(attempt.startTime, quiz.duration, quiz.endTime)`.
      * If `Date.now() > examExpiresAt.getTime() + 60_000` (beyond 60s grace):
        * Calls `evaluateAndFinalizeAttempt(attemptId, { submissionReason: 'timer-expiry', finalizedAt: new Date(examExpiresAt.getTime() + 60_000) })`.
      * Else:
        * Calls `evaluateAndFinalizeAttempt(attemptId, { submissionReason: 'student-submit', finalizedAt: new Date() })`.
    * Reusable Evaluation Engine (`evaluateAndFinalizeAttempt`):
      * Fetches assigned questions with `.select('+correctOptionId')`.
      * Evaluates each entry in `attempt.submittedAnswers` against `correctOptionId`:
        * If `selectedOptionId === question.correctOptionId`: `isCorrect = true`, `marksAwarded = question.marks`.
        * Else: `isCorrect = false`, `marksAwarded = 0`.
      * Missing/unanswered questions: `isCorrect = false, marksAwarded = 0`.
      * Calculates `score = sum(marksAwarded)`.
      * Calculates `percentage = Math.round((score / totalMarksPossible) * 100)`.
      * Sets `attempt.status = 'completed'`, `attempt.submittedAt`, `attempt.sessionTokenHash = null`.
      * Saves attempt atomically with concurrency guard.
    * Generates digital receipt hash: `sha256(attemptId + studentId + submittedAt)`.
    * **Student Visibility Quarantine:**
      * Returns `{ success: true, message: 'Examination completed and submitted successfully', submittedAt: attempt.submittedAt, receiptHash }`.
      * **Does not return `score`, `percentage`, or question answer keys to the student.**

---

### Wave 2: Faculty Results API & Integration Test Suite

#### Task 5: Faculty Results Controller & Quiz Routes Wiring
* **Files:**
  * `server/src/controllers/resultsController.js`
  * `server/src/routes/quizRoutes.js`
  * `server/src/app.js`
* **Implementation:**
  * Mount `/api/exams` in `server/src/app.js`.
  * In `resultsController.js`:
    * `GET /api/faculty/quizzes/:quizId/results`:
      * Protected by `verifyToken`, `authorizeRoles('faculty', 'admin')`, and `verifyQuizOwnership`.
      * Retrieves all attempts for `quizId`, populated with `studentId` (`name`, `usn`, `email`).
      * Populates focus event counts from `MalpracticeLog`.
      * Aggregates cohort metrics: total participants, average score, pass percentage, zero-violation percentage.
      * Returns array of student attempts: `{ _id, studentName, usn, score, totalMarksPossible, percentage, status, submissionReason, startTime, submittedAt, durationTakenMinutes, violationCount }`.
    * `GET /api/faculty/quizzes/:quizId/attempts/:attemptId`:
      * Returns granular student attempt details:
        * Full question breakdown with question text, options, student selected answer, correct answer (`correctOptionId`), and marks awarded.
        * Complete chronological timeline of telemetry events from `MalpracticeLog`.
  * Mount endpoints under `server/src/routes/quizRoutes.js`.

#### Task 6: Automated Integration Test Suite
* **Files:**
  * `server/src/utils/testExamEngine.js`
* **Coverage:**
  1. *Student Eligibility:* Verify valid USN+Name succeeds; mismatched name or invalid USN returns HTTP 401; inactive student rejected.
  2. *Availability Window:* Rejects start before `startTime` or after `endTime`.
  3. *Max Attempts:* Blocks exam start when student has exhausted `maxAttempts`.
  4. *Attempt Resumption:* Verify reload loads identical question/option orders and restores previous answers without re-shuffling.
  5. *Answer Key Quarantine:* Verify student responses across all endpoints strictly contain zero `correctOptionId` references.
  6. *Server-Side Timer Enforcement:*
     * Verify answer save succeeds before `examExpiresAt`.
     * Verify answer save fails after `examExpiresAt` with HTTP 403.
     * Verify submission succeeds within 60-second grace window.
     * Verify submission beyond grace window auto-finalizes with `submissionReason: 'timer-expiry'`.
  7. *Automatic Evaluation Accuracy:* Full credit for matching `selectedOptionId`, zero credit for incorrect or missing answers; accurate percentage and score calculation.
  8. *Delayed Student Score Visibility:* Confirms student submission response omits score and percentage.
  9. *Malpractice Telemetry Logging:* Verifies events recorded in `MalpracticeLog` and associated with attempt.
  10. *Faculty Results Access:* Verifies faculty owner can access cohort results with student USNs, and non-owner receives HTTP 403.

---

### Wave 3: Frontend Integration & End-to-End Verification

#### Task 7: Student Attend Integration (`StudentAttend.jsx`)
* **Files:**
  * `client/src/services/api.js`
  * `client/src/pages/student/StudentAttend.jsx`
* **Implementation:**
  * In `api.js`: Add `examService` methods:
    * `getPublicExamInfo(quizId)`
    * `verifyAndStartExam(quizId, { usn, studentName })`
    * `saveAnswer(attemptId, { questionId, selectedOptionId })`
    * `logTelemetry(attemptId, { eventType, eventDescription })`
    * `submitExam(attemptId)`
  * In `StudentAttend.jsx`:
    * Step 1 (Join):
      * Load public quiz info on mount (`title`, `duration`, `totalMarks`).
      * Submit form: calls `verifyAndStartExam(quizId, { usn, studentName })`.
      * Stores ephemeral session token in memory/sessionStorage.
      * Populates sanitized questions and restored answers.
      * Enters Step 2 (Exam).
    * Step 2 (Exam):
      * Renders actual randomized questions and options.
      * Selecting an option triggers auto-save via `saveAnswer()`.
      * Focus loss / visibility change sends telemetry event via `logTelemetry()`.
      * Displays synchronized countdown timer based on server remaining time.
      * When timer expires: triggers final submission.
    * Step 3 (Submitted):
      * Calls `submitExam()`.
      * Displays confirmation receipt with submission timestamp and digital hash.
      * Does not display score, in compliance with delayed release policy.

#### Task 8: Faculty Results Integration (`QuizResults.jsx`)
* **Files:**
  * `client/src/services/api.js`
  * `client/src/pages/faculty/QuizResults.jsx`
* **Implementation:**
  * Replace `[TEMPORARY_MOCK_DATA]` in `resultsService.getQuizSubmissions(quizId)` with live call to `/api/faculty/quizzes/:quizId/results`.
  * Connect quiz selection dropdown to load real attempts.
  * Populate live candidate names, USNs, scores, percentages, and focus interruption counts.
  * Wire "Audit Details" modal to load full telemetry log and question evaluation breakdown.
  * Verify frontend production build (`npm run build`).

---

## 5. Risk Assessment & Mitigation

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Concurrent attempt creation race condition | Medium | Unique compound index `{ studentId: 1, quizId: 1, attemptNumber: 1 }` and atomic find-and-modify check. |
| Student manipulates client clock to gain extra time | High | Server-side expiration check on every `PATCH /answers` and `POST /submit`. Client clock is display-only. |
| Network disconnect during final submission | High | 60-second grace window allows delayed transmission. Unsubmitted attempts are evaluated based on previously auto-saved answers. |
| Option ID mismatch during evaluation | High | `quizService` generates immutable `optionId`s (`opt_1`, `opt_2`), and option shuffling preserves IDs. Answer keys evaluate against ID, not index or text. |
| Answer key leak in network inspect tab | Critical | `sanitizeQuestionsForStudent` explicitly strips `correctOptionId`. Schema specifies `select: false`. Tested in test suite. |

---

## 6. Verification Checklist

- [ ] Schema update applied to `Attempt.js` (`submissionReason`, `sessionToken`).
- [ ] `examRoutes.js` and `examController.js` implemented and mounted on `/api/exams`.
- [ ] Ephemeral exam session token middleware operational.
- [ ] Real-time answer saving (`PATCH /answers`) strictly closes at `examExpiresAt`.
- [ ] 60-second grace window applies strictly to final submission (`POST /submit`).
- [ ] Backend automatic evaluation tested with 100% accuracy on objective questions.
- [ ] Students receive confirmation receipt without numerical scores.
- [ ] Telemetry events recorded in `MalpracticeLog` without automated academic penalties.
- [ ] Faculty results endpoint returns real student records and cohort statistics.
- [ ] All 10 integration test cases pass in `server/src/utils/testExamEngine.js`.
- [ ] Frontend `StudentAttend.jsx` and `QuizResults.jsx` fully wired to live endpoints.
- [ ] `npm run build` in `client` passes with zero errors.
- [ ] Graphify refreshed.
