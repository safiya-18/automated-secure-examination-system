# Phase 04: Faculty Quiz Management & Question Engine - Context

**Gathered:** 2026-11-05  
**Updated:** 2026-11-05 (Added Configurable Question Selection & Randomization Engine)  
**Status:** In Progress (Tasks 1–3 Completed, Task 4 Awaiting Review)  

<domain>
## Phase Boundary

Phase 4 delivers the complete Faculty Quiz Management, Question Engine, and Randomization Logic for the Automated Secure Examination System:
1. Faculty dashboard and quiz management (listing, creating, updating, archiving, deleting quizzes).
2. Quiz-scoped question bank management (adding, editing, deleting objective multiple-choice and true-false questions, plus batch JSON/CSV question import).
3. Secure question and option storage: `correctOptionId` remains strictly hidden (`select: false`) except when specifically requested by the verified owning Faculty or Admin for review.
4. Dynamic total marks recomputation: automatically aggregating total marks whenever questions are added, modified, or removed.
5. Quiz lifecycle management: strict state transitions (`draft` → `published` → `archived`), locking questions from modification once attempts exist.
6. **Configurable Per-Student Question Selection & Randomization Engine**:
   - Faculty sets arbitrary `questionsPerStudent` (e.g. 10 out of 100, 25 out of 50; never hardcoded).
   - Randomizes question selection across students with maximal variation.
   - If unique sets are mathematically impossible (small pool), gracefully allows overlapping subsets without failing.
   - If `questionsPerStudent === 0` or equals pool size, full question bank is assigned.
   - Independent Fisher-Yates question order shuffling and option shuffling.
   - Assigned ordering permanently stored in student's `Attempt` record to make attempts refresh-proof and tamper-proof.
   - Never exposes `correctOptionId` to student APIs.
7. Strict ownership access control: only the authoring Faculty member or an Admin can edit, manage questions, or publish/archive a quiz.

</domain>

<decisions>
## Implementation Decisions

### 1. Quiz Lifecycle & Editing Locks
- **D-01:** Strict state locking policy:
  - `draft`: Free editing of all quiz settings and questions.
  - `published`: Once published, if student attempts exist in the database, questions cannot be added, edited, or deleted to guarantee grading consistency and evaluation integrity.
  - `archived`: Read-only state for past examinations, preserving historical score and malpractice audit trails.
  — **Reversibility:** costly

### 2. Question Bank Architecture
- **D-02:** Quiz-scoped question bank:
  - Questions are associated directly with a parent `quizId`.
  - Supports individual question CRUD (`POST`, `PUT`, `DELETE` under `/api/faculty/quizzes/:quizId/questions`).
  - Supports batch question import via JSON array or CSV payload (`POST /api/faculty/quizzes/:quizId/questions/bulk`).
  — **Reversibility:** reversible

### 3. Ownership & Authorization Policy
- **D-03:** Strict ownership guard (`verifyQuizOwnership` middleware):
  - Any faculty member can create quizzes.
  - Only the faculty member who created the quiz (`createdBy === req.user._id`) or an active `admin` can view draft details, update settings, modify questions, or delete the quiz.
  - Unauthorized faculty members receive HTTP 403 Forbidden.
  — **Reversibility:** reversible

### 4. Dynamic Marks Recomputation & Equal Marks Rule
- **D-04:** Automatic marks aggregation:
  - Quiz `totalMarks` is automatically recomputed via `recalculateQuizTotalMarks(quizId)`.
  - If `questionsPerStudent === 0` or equals question pool size: `totalMarks = sum of all question marks`.
  - If `questionsPerStudent > 0` (subset mode): all questions in the bank must have identical mark values (enforced by `validateSubsetMarksConsistency`), ensuring every student has the exact same maximum possible score. `totalMarks = questionsPerStudent * markPerQuestion`.
  — **Reversibility:** reversible

### 5. Security & Student Answer Isolation
- **D-05:** Answer isolation:
  - `correctOptionId` is configured with `select: false` on the Mongoose schema.
  - Public/student endpoints never load `correctOptionId`.
  - Faculty management endpoints explicitly invoke `.select('+correctOptionId')` only after passing ownership checks.
  — **Reversibility:** one-way

### 6. Configurable Question Selection & Shuffling Engine
- **D-06:** Per-student allocation and deterministic session persistence:
  - `questionsPerStudent` is fully configurable by Faculty (arbitrary positive integer or 0 for full pool).
  - Subset selection uses reservoir/sample randomization to maximize entropy and minimize question overlap across different students.
  - If question bank size is smaller than theoretical permutations, overlapping questions are allowed; the exam never crashes.
  - Question order is randomized independently per student when `randomizeQuestions: true`.
  - Option order is randomized independently per question when `randomizeOptions: true`, preserving original `optionId`s so backend evaluation against `correctOptionId` remains 100% deterministic.
  - The generated question IDs (`assignedQuestionOrder`) and shuffled option IDs (`assignedOptionOrder`) are stored permanently in the student's `Attempt` record. Page reloads and browser reconnects strictly read from this saved order.
  — **Reversibility:** costly — touches quizService, attempt storage, and exam session initiation.

</decisions>

<canonical_refs>
## Canonical References

### Data Layer & Schemas
- `server/src/models/Quiz.js` — Quiz schema with `questionsPerStudent`, `randomizeQuestions`, and `randomizeOptions`.
- `server/src/models/Question.js` — Question schema with options array and hidden `correctOptionId`.
- `server/src/models/Attempt.js` — Attempt schema storing `assignedQuestionOrder` and `assignedOptionOrder`.
- `server/src/utils/quizService.js` — Service handling marks calculation and question allocation validation.

### Architectural Knowledge Graph
- `graphify-out/GRAPH_REPORT.md` — AST knowledge graph showing 191 nodes, 333 edges, and 10 communities.

</canonical_refs>
