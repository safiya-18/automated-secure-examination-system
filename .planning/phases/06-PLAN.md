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
  * `server/src/utils/testExamEngine.js` — Automated integration test suite covering end-to-end exam lifecycle.

---

## 3. Schema Modifications (Safe & Backward Compatible)

### `server/src/models/Attempt.js`
Preserve existing schema and status enum. Add non-breaking fields:
```js
// Added to attemptSchema:
submissionReason: {
  type: String,
  enum: ['student-submit', 'timer-expiry', 'proctor-terminated'],
  default: 'student-submit',
},
sessionToken: {
  type: String,
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
  * Added `submissionReason` enum (`['student-submit', 'timer-expiry', 'proctor-terminated']`, default `'student-submit'`) while preserving all original `status` enum values (`'in-progress'`, `'completed'`, `'terminated-malpractice'`).
  * Added `sessionTokenHash` (`select: false`, SHA-256) and updated `Attempt.prototype.toJSON()` to exclude token hashes from API serialization.
  * Created `server/src/utils/examToken.js` containing `generateExamSessionToken`, `verifyExamSessionToken`, `hashSessionToken`, and `calculateExamExpiry` (`Math.min(attempt.startTime + quiz.duration, quiz.endTime)`).
  * Created `server/src/middleware/examSessionMiddleware.js` providing `verifyExamSession` with signature verification, attemptId/studentId/quizId matching, status checks, hash invalidation, and server timing calculation.
  * Verified with 45 unit/integration test assertions in `server/src/utils/testExamSessionMiddleware.js` (45 passed, 0 failed) and zero regression across existing suites (283+ tests passing).

#### Task 2: Student Exam Controller — Public Info & Verify-Start
* **Files:**
  * `server/src/controllers/examController.js`
  * `server/src/routes/examRoutes.js`
* **Implementation:**
  * `GET /api/exams/:quizId/public-info`:
    * Returns public quiz metadata: title, description, duration, totalMarks, questionsPerStudent, startTime, endTime.
    * Rejects if quiz is not found or `status !== 'published'`.
    * **Zero questions or answer keys exposed.**
  * `POST /api/exams/:quizId/verify-start`:
    * Input: `{ usn, studentName }`.
    * Normalized lookup: find active student in `User` collection by `usn`.
    * Verifies student name matches registered name (case-insensitive trim).
    * Verifies quiz availability window: `now >= quiz.startTime && now <= quiz.endTime`.
    * Verifies attempt quota: counts existing attempts for `(studentId, quizId)`.
    * **Resumption Check:** If an attempt with `status === 'in-progress'` exists:
      * Resumes existing attempt.
      * Loads assigned questions using `attempt.assignedQuestionOrder`.
      * Projects questions using `sanitizeQuestionsForStudent()`.
      * Generates a refreshed ephemeral session token.
      * Returns sanitized questions + saved answers (`submittedAnswers`) + remaining time.
    * **New Allocation:** If no active attempt and quota remains:
      * Fetches question pool for quiz.
      * Calls `quizService.generateStudentExamAllocation(quiz, allQuestions)`.
      * Creates `Attempt` record with `assignedQuestionOrder`, `assignedOptionOrder`, and `totalMarksPossible`.
      * Issues ephemeral session token with expiry set to `examExpiresAt + 5min`.
      * Returns sanitized questions + initial state.

#### Task 3: Real-Time Answer Saving & Strict Timer Cutoff
* **Files:**
  * `server/src/controllers/examController.js`
* **Implementation:**
  * `PATCH /api/exams/attempts/:attemptId/answers`:
    * Protected by `verifyExamSession`.
    * Server Timer Hard Cutoff:
      * Computes `examExpiresAt = attempt.startTime.getTime() + (quiz.duration * 60 * 1000)`.
      * If `Date.now() > examExpiresAt`:
        * Rejects answer save with HTTP 403: `"Examination time has expired. Answer editing is closed."`
    * Validates `{ questionId, selectedOptionId }`:
      * Ensures `questionId` is within `attempt.assignedQuestionOrder`.
      * Finds question; ensures `selectedOptionId` exists in `question.options`.
    * Updates or inserts into `attempt.submittedAnswers`:
      * `{ questionId, selectedOptionId, isCorrect: null, marksAwarded: 0 }`.
    * Saves attempt atomically; returns `{ success: true, savedAt: new Date() }`.

#### Task 4: Submission Controller, Automatic Evaluation & Focus Telemetry
* **Files:**
  * `server/src/controllers/examController.js`
* **Implementation:**
  * `POST /api/exams/attempts/:attemptId/telemetry`:
    * Protected by `verifyExamSession`.
    * Accepts `{ eventType, eventDescription }`.
    * Validates `eventType` against `MalpracticeLog` enum (`TAB_SWITCH`, `WINDOW_BLUR`, etc.).
    * Inserts record into `MalpracticeLog` collection.
    * Increments `attempt.violationCount`.
    * If `quiz.proctoringSettings.autoSubmitOnMaxViolations` enabled and `violationCount >= maxViolationsAllowed`:
      * Terminates attempt with `status: 'terminated-malpractice'`, `submissionReason: 'proctor-terminated'`.
      * Automatically evaluates answers saved so far.
    * Returns `{ logged: true, violationCount }`.
  * `POST /api/exams/attempts/:attemptId/submit`:
    * Protected by `verifyExamSession`.
    * Timer Enforcement:
      * `examExpiresAt = attempt.startTime.getTime() + (quiz.duration * 60 * 1000)`.
      * If `Date.now() > examExpiresAt + 60_000` (beyond 60s grace):
        * Marks `submissionReason = 'timer-expiry'`.
      * Else:
        * Marks `submissionReason = 'student-submit'`.
    * Automatic Objective Evaluation:
      * Fetches all assigned questions with `.select('+correctOptionId')`.
      * Evaluates each entry in `attempt.submittedAnswers` against `correctOptionId`:
        * If `selectedOptionId === question.correctOptionId`: `isCorrect = true`, `marksAwarded = question.marks`.
        * Else: `isCorrect = false`, `marksAwarded = 0`.
      * Missing/unanswered questions are evaluated as `isCorrect = false, marksAwarded = 0`.
      * Calculates `score = sum(marksAwarded)`.
      * Calculates `percentage = Math.round((score / totalMarksPossible) * 100)`.
    * Sets `attempt.status = 'completed'` and `attempt.submittedAt = new Date()`.
    * Saves attempt to database.
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

