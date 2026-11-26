# Phase 06: Examination Attempt Engine & Persistent Results Integration - Context

**Gathered:** 2026-11-09
**Status:** Ready for Planning (All Core Architectural Decisions Confirmed)

<domain>
## Phase Boundary

Phase 6 implements the core examination attempt engine, server-authoritative proctoring telemetry, automatic evaluation, and faculty results reporting for the Automated Secure Examination System:

1. **Student Join & Eligibility Verification (No Accounts / Zero Navigation):**
   - Direct exam entry via lecturer-distributed link or QR code (`/attend/:quizId`).
   - Students have no account, no password, and no general dashboard.
   - Verification against pre-registered admin records using **USN + Registered Full Name**.
   - Verification checks: Student exists in database, `role === 'student'`, `accountStatus === 'active'`, name matches registered record (case-insensitive normalized), quiz exists, `quiz.status === 'published'`, and current time is within availability window (`startTime` $\le$ now $\le$ `endTime`).
   - Verification checks maximum attempts: student has not exceeded `quiz.maxAttempts`.

2. **Deterministic Question Allocation & Reconnection Resilience:**
   - **New Attempt:** If no active attempt exists and quota remains, generates per-student randomized question and option order using `quizService.generateStudentExamAllocation`.
   - **Resume Attempt:** If an active attempt with `status === 'in-progress'` already exists, reconnects to that attempt and reloads the exact `assignedQuestionOrder`, `assignedOptionOrder`, and previously saved `submittedAnswers`. It **never** re-shuffles or re-allocates questions upon page reload or network reconnect.
   - **Zero Answer-Key Leaks:** Questions returned to the client are projected strictly through `quizService.sanitizeQuestionsForStudent()`, completely omitting `correctOptionId`.

3. **Ephemeral Attempt Session Token:**
   - Separate from standard user login JWTs.
   - Dedicated cryptographic token or exam-scoped signed token (`{ attemptId, studentId, quizId, type: 'exam_session' }`).
   - Time-limited, scoped strictly to that specific attempt, and required for all subsequent in-exam actions (`PATCH /answers`, `POST /telemetry`, `POST /submit`).

4. **Server-Authoritative Timer Enforcement & Grace Period:**
   - Client countdown timer is purely visual and informational.
   - Server computes exact expiration: `examExpiresAt = Math.min(attempt.startTime + quiz.duration, quiz.endTime)`.
   - **Hard Cutoff for Answer Edits:** Once `examExpiresAt` is reached, answer modification requests are strictly rejected with HTTP 403 / 400.
   - **Submission Grace Period:** A maximum 60-second grace window applies strictly to final submission transmission (`POST /submit`), allowing students on high-latency networks to finalize their attempt without losing credit.
   - **Grace Period Invariant:** The grace window **never** extends answer editing or permits new answer selections.
   - If an attempt expires and the student drops offline without submitting, the server automatically finalizes the attempt using previously saved answers when queried or during sweep, recording `submissionReason: 'timer-expiry'`.

5. **Real-Time Answer Saving (State Sync):**
   - As students select options, answers are persisted to `attempt.submittedAnswers` via `PATCH /api/exams/attempts/:attemptId/answers`.
   - Validates that `questionId` is part of `attempt.assignedQuestionOrder` and `selectedOptionId` exists in that question's options.
   - Answers are saved without evaluating correctness; evaluation occurs strictly upon submission.

6. **Automatic Objective Evaluation & Result Visibility Policy:**
   - Evaluates all objective questions on the backend by querying questions with `.select('+correctOptionId')`.
   - Compares student's `selectedOptionId` against `correctOptionId`:
     - Match: `isCorrect = true`, `marksAwarded = question.marks`.
     - Mismatch or blank: `isCorrect = false`, `marksAwarded = 0`.
   - Computes `score = sum(marksAwarded)` and `percentage = Math.round((score / totalMarksPossible) * 100)`.
   - **Student Visibility Restriction:** Students do **not** see marks or scores immediately upon submission.
   - Student receives a clean submission confirmation receipt containing `submittedAt`, `attemptNumber`, and digital confirmation hash.
   - Faculty reviews and releases results through academic channels or a subsequent result-release workflow.

7. **Focus Telemetry & Academic Review Log:**
   - Records focus interruptions (`TAB_SWITCH`, `PAGE_HIDDEN`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`) in the `MalpracticeLog` collection.
   - Increments `attempt.violationCount`.
   - **Non-Punitive Telemetry Rule:** Focus events are recorded strictly as telemetry indicators for faculty review, not automated proof of cheating.

8. **Faculty Results & Audit Analytics:**
   - Faculty owners and administrators view comprehensive results at `GET /api/faculty/quizzes/:quizId/results`.
   - Displays real student names, USNs, scores, percentages, durations, and focus event summaries.
   - Provides deep attempt audit inspection: question-by-question student responses vs answer keys and chronological telemetry events.

</domain>

<decisions>
## Implementation Decisions

### 1. Student Verification Mechanism
- **D-01:** Verification via USN + Registered Full Name:
  - Student inputs USN and Name on `/attend/:quizId`.
  - Backend queries `User.findOne({ usn: normalizedUsn, role: 'student' })`.
  - Verifies student exists, `accountStatus === 'active'`, and registered name matches input name (trim, lowercase, collapsed internal whitespace `replace(/\s+/g, ' ')`, exact full match).
  - **Zero Enumeration Leakage:** Any validation failure (USN not found, inactive account, or name mismatch) returns the identical generic HTTP 401 response: `{ success: false, message: 'Invalid USN or student name' }`. Does not reveal whether the USN exists or the account state.
  - No student password, no student registration portal, and no student dashboard.
  - **Pre-Window Resumption Check Order:** Verification checks for an existing `in-progress` attempt *before* checking the quiz availability window. An existing active attempt may resume within its authoritative `examExpiresAt + 60_000`, even if `quiz.endTime` has passed. New attempts are strictly barred from starting outside the `quiz.startTime` to `quiz.endTime` window.
  — **Reversibility:** costly

### 2. Result Visibility Policy
- **D-02:** Delayed score visibility:
  - Submission response returns `{ success: true, message: 'Examination completed and submitted successfully', submittedAt, receiptHash }`.
  - Numerical `score` and `percentage` are calculated and saved in the `Attempt` document, but are strictly hidden from the student response payload.
  - Faculty controls score dissemination through the faculty results portal.
  — **Reversibility:** reversible

### 3. Server Timer & Latency Grace Window
- **D-03:** Strict two-tier timer enforcement:
  - `examExpiresAt = calculateExamExpiry(attempt.startTime, quiz.duration, quiz.endTime)`.
  - If `now > examExpiresAt`: `PATCH /answers` is rejected with HTTP 403 (`"Exam time has expired; answer modifications are closed"`).
  - If `now <= examExpiresAt + 60_000` (60s grace): `POST /submit` is accepted and evaluates saved answers.
  - If `now > examExpiresAt + 60_000`: triggers automatic finalization based on previously saved answers with `submissionReason: 'timer-expiry'`.
  - **Ephemeral Session Token Expiry:** The session token expires at `examExpiresAt + 60_000` (the 60s transmission grace window). It does not use arbitrary multi-minute windows.
  - **Reusable Evaluation & Expired Attempt Finalization:** When an attempt expires (`now > examExpiresAt + 60_000`), it is never simply marked completed without scoring. A reusable server-side evaluation module (`server/src/utils/evaluationService.js`) evaluates previously saved answers against `Question.correctOptionId`, calculates `score` and `percentage`, sets `status: 'completed'`, `submissionReason: 'timer-expiry'`, `submittedAt`, and invalidates `sessionTokenHash = null`. This finalization is idempotent and concurrency-safe across Task 2 and Task 4.
  — **Reversibility:** costly

### 4. Attempt Status Preservation, Numbering & Schema Additions
- **D-04:** Attempt schema safety & numbering:
  - Preserves existing `status` enum: `['in-progress', 'completed', 'terminated-malpractice']`.
  - Adds optional `submissionReason` field: `['student-submit', 'timer-expiry', 'proctor-terminated']`, with `default: null`.
  - **In-Progress Invariant:** An attempt created with `status: 'in-progress'` must **never** be initialized with `submissionReason: 'student-submit'`. `submissionReason` is set strictly when the attempt is finalized upon completion or termination.
  - **Attempt Numbering:** When creating a new attempt, the next attempt number is calculated using `max(existing attemptNumber) + 1` rather than array length, preserving `maxAttempts` enforcement and compound-index duplicate key recovery (error code 11000).
  - Adds `sessionTokenHash` field (`select: false`) on `Attempt` for secure session tracking and invalidation upon session refresh or submission.
  — **Reversibility:** reversible

### 5. Ephemeral Exam Session Token Architecture
- **D-05:** Dedicated Exam Session Token:
  - Issued upon successful `/api/exams/:quizId/verify-start`.
  - Stateless signed JWT with payload: `{ attemptId, studentId, quizId, exp: Math.floor((examExpiresAt + 60_000) / 1000), type: 'exam_session' }`.
  - Middleware `verifyExamSession` checks token on `PATCH /answers`, `POST /telemetry`, and `POST /submit`.
  - Prevents students from tampering with `attemptId` or accessing other students' exam sessions.
  — **Reversibility:** one-way

### 6. Focus Telemetry Invariant
- **D-06:** Telemetry vs Cheating Verdict:
  - Browser focus loss events are recorded in `MalpracticeLog` and aggregated into `attempt.violationCount`.
  - The UI and API explicitly treat these events as "Focus Telemetry for Instructor Review", ensuring accidental OS dialogs, system updates, or trackpad gestures do not cause automated academic penalties.
  — **Reversibility:** reversible

</decisions>

<canonical_refs>
## Canonical References
- `server/src/models/Attempt.js` — Core attempt schema, question and option orders, submitted answers.
- `server/src/models/Quiz.js` — Quiz scheduling window, duration, proctoring settings, questionsPerStudent.
- `server/src/models/Question.js` — Objective question schema with quarantined `correctOptionId`.
- `server/src/models/User.js` — Registered student roster with USN and role.
- `server/src/models/MalpracticeLog.js` — Telemetry event schema.
- `server/src/utils/quizService.js` — Randomization, subset sampling, and student sanitization functions.
- `server/src/utils/evaluationService.js` — Reusable objective evaluation and atomic attempt finalization.
- `client/src/pages/student/StudentAttend.jsx` — Student join, attend, and submit UI.
- `client/src/pages/faculty/QuizResults.jsx` — Faculty submissions and telemetry audit UI.
</canonical_refs>
