# Phase 03: Authentication & Role-Based Access Control - User Acceptance Testing (UAT)

**Status:** Completed & Verified
**Date:** 2026-11-05

## Test Scenarios & Results

### 1. Browser Login & JWT Enclosure
- **Scenario:** User authenticates via `POST /api/auth/login`.
- **Expected:** JWT is set exclusively in an `HttpOnly` cookie and NEVER returned in the response body.
- **Result:** PASS. `res.body.token` is undefined; `token` cookie set with `httpOnly: true`.

### 2. Double-Submit CSRF Protection
- **Scenario:** State-changing `POST /api/admin/users/student` using cookie authentication without `x-xsrf-token` header.
- **Expected:** Blocked with HTTP 403 Forbidden.
- **Result:** PASS. Returns HTTP 403. When matching `x-xsrf-token` is supplied, request passes.

### 3. Programmatic & Postman Compatibility
- **Scenario:** State-changing `POST /api/admin/users/student` using `Authorization: Bearer <token>`.
- **Expected:** Bypasses CSRF checks since Bearer tokens are immune to browser ambient cookie CSRF.
- **Result:** PASS. Request passes without CSRF header.

### 4. Temporary Password Enforcement
- **Scenario:** Student or Faculty user with `isPasswordTemporary: true` attempts operational actions.
- **Expected:** Blocked by `enforcePasswordChange` with HTTP 403 `{ mustChangePassword: true }`.
- **Result:** PASS. Once `POST /api/auth/change-password` is executed, temporary flag is removed.

### 5. Idempotent Admin Seeder
- **Scenario:** Running `npm run seed:admin` when an Admin already exists.
- **Expected:** Detects existing admin, logs notice, exits with code 0 without modifying credentials.
- **Result:** PASS.

### 6. Duplicate Key Collision Protection
- **Scenario:** Attempting to register an already-registered email or USN (including runtime MongoDB code 11000).
- **Expected:** Handled gracefully and mapped to HTTP 409 Conflict.
- **Result:** PASS.

### 7. Bulk Registration Partial Failure Isolation
- **Scenario:** Submitting a CSV batch containing valid students and duplicate entries.
- **Expected:** Valid students are registered; duplicate entries are captured in `skippedDetails` without aborting the batch.
- **Result:** PASS.
