# ProteinDojo QA Plan

## Overview

This document provides a systematic approach to QA testing for ProteinDojo. Given the AI-assisted development approach ("vibe coding"), thorough QA is essential to catch edge cases and integration issues that may not be obvious during rapid development.

## Test Environments

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| Local | http://localhost:5173 | SQLite (local) | Development testing |
| Production | https://proteindojo.com | SQLite (Fly.io) | Final verification |

## Quick Smoke Test (5 min)

Run this after every deploy:

- [ ] Home page loads
- [ ] Can view challenges list
- [ ] Can view a challenge detail page
- [ ] Can sign up (use test email)
- [ ] Can sign in
- [ ] Jobs page loads for authenticated user
- [ ] Team selector appears in header

---

## Feature Checklists

### 1. Authentication

#### Sign Up
- [ ] Email/password signup works
- [ ] Validation: invalid email format rejected
- [ ] Validation: password too short rejected
- [ ] Duplicate email shows appropriate error
- [ ] Verification email sent (check console in dev, email in prod)
- [ ] New user gets $1.00 starting balance

#### Sign In
- [ ] Email/password login works
- [ ] Invalid credentials show error
- [ ] "Forgot password" flow works
- [ ] Session persists on page refresh
- [ ] Session expires appropriately

#### Sign Out
- [ ] Logout clears session
- [ ] Protected pages redirect to login after logout
- [ ] No stale data visible after logout

### 2. Challenges

#### Challenge List (`/challenges`)
- [ ] All challenges load
- [ ] Challenge cards show: name, level, task type, target info
- [ ] Level badges display correctly (1-4)
- [ ] "Design" button links to designer

#### Challenge Detail (`/challenges/:id`)
- [ ] Challenge info loads correctly
- [ ] Target structure renders in Mol* viewer
- [ ] Binding site visualization works
- [ ] Reference binders section shows (if available)
- [ ] Leaderboard shows top submissions
- [ ] "Start Designing" button works

### 3. Designer (`/design/:challengeId`)

#### Target Selection
- [ ] Challenge target loads automatically
- [ ] Target structure visible in viewer
- [ ] Binding site highlighted

#### Design Methods
- [ ] RFDiffusion tab available
- [ ] BindCraft tab available
- [ ] BoltzGen tab available
- [ ] Method parameters load with defaults

#### Job Submission
- [ ] Parameter validation works
- [ ] Cost estimate displays before submission
- [ ] Insufficient balance shows deposit prompt
- [ ] Job submits successfully
- [ ] Redirects to job detail page
- [ ] Balance deducted correctly

### 4. Jobs

#### Jobs List (`/jobs`)
- [ ] User's jobs display
- [ ] Job status indicators: pending, running, completed, failed
- [ ] Progress bar for running jobs
- [ ] Pagination works (if many jobs)
- [ ] Click job navigates to detail

#### Job Detail (`/jobs/:id`)
- [ ] Job info displays: type, status, parameters, cost
- [ ] Running job shows progress updates
- [ ] Completed job shows results
- [ ] Result structures render in Mol* viewer
- [ ] Download buttons work (PDB files)
- [ ] Failed job shows error message
- [ ] "Submit to Challenge" button works (for successful jobs)

### 5. Submissions

#### Submit Flow
- [ ] Can submit from job results
- [ ] Can submit custom PDB (`/submit`)
- [ ] Sequence validation works
- [ ] Submission creates scoring job
- [ ] Score displays when complete

#### Submissions List (`/submissions`)
- [ ] User's submissions display
- [ ] Status shows: pending, scored, failed
- [ ] Score metrics display for completed
- [ ] Challenge name links to challenge
- [ ] Structure viewer works

### 6. Billing

#### Balance Display
- [ ] Balance shows in header (via TeamSelector)
- [ ] Balance updates after job completion
- [ ] Balance updates after deposit

#### Deposit Flow (`/billing`)
- [ ] Preset amounts display
- [ ] Custom amount input works
- [ ] Stripe checkout opens
- [ ] Successful payment credits balance
- [ ] Transaction history shows deposits
- [ ] Transaction history shows job charges

### 7. Teams (NEW)

#### Team Creation (`/teams`)
- [ ] "Create Team" form displays
- [ ] Team name validation (required, reasonable length)
- [ ] Team slug auto-generated or customizable
- [ ] Team created successfully
- [ ] Creator becomes owner
- [ ] Team appears in list

#### Team Selector (Header)
- [ ] Shows "Personal" when no team active
- [ ] Shows team name when team active
- [ ] Balance updates based on context
- [ ] Dropdown lists all user's teams
- [ ] Can switch to team context
- [ ] Can switch back to personal
- [ ] Page data refreshes on context switch

#### Team Members (`/teams` expanded view)
- [ ] Member list displays
- [ ] Shows role for each member (owner/admin/member)
- [ ] Owner can see all management options

#### Invitations
- [ ] Admin/owner can invite by email
- [ ] Invitation email sent (console in dev)
- [ ] Invite link works (`/accept-invite?id=...`)
- [ ] Unauthenticated user prompted to sign in/up
- [ ] Authenticated user sees accept/reject options
- [ ] Accept adds user to team
- [ ] Reject removes invitation
- [ ] Expired invitation shows error

#### Role Management (Owner only)
- [ ] Can change member role (member <-> admin)
- [ ] Cannot demote self from owner
- [ ] Role change reflected immediately

#### Member Removal
- [ ] Admin/owner can remove members
- [ ] Cannot remove the owner
- [ ] Removed member loses team access
- [ ] Member can leave team voluntarily

#### Team Billing
- [ ] Team has separate balance from personal
- [ ] Jobs in team context use team balance
- [ ] Team deposits require admin/owner permission
- [ ] Transaction history scoped to context

#### Team Data Visibility
- [ ] Team members see each other's jobs (when in team context)
- [ ] Team members see each other's submissions (when in team context)
- [ ] Personal jobs not visible to team members
- [ ] Switching context changes visible data

### 8. Leaderboards (`/leaderboards`)

- [ ] Global leaderboard loads
- [ ] Per-challenge leaderboards available
- [ ] Scores display correctly
- [ ] Username links work (if public profiles exist)
- [ ] Pagination works

### 9. Help (`/help`)

- [ ] Help index page loads
- [ ] Design method help pages load
- [ ] Metrics help page loads
- [ ] Help articles load (`/help/:slug`)
- [ ] Content renders correctly (markdown)

### 10. Admin (`/admin`)

- [ ] Only accessible to admin users
- [ ] Non-admin gets 403 or redirect
- [ ] User management works
- [ ] Can view/edit challenges (if implemented)

---

## End-to-End User Flows

### Flow 1: New User First Design

1. Visit home page
2. Click "Get Started" / "Sign Up"
3. Complete signup with email/password
4. Verify email (or skip in dev)
5. Browse challenges, select one
6. Click "Start Designing"
7. Choose design method (e.g., BoltzGen)
8. Set parameters
9. Submit job (uses $1 starting balance)
10. Wait for job completion
11. View results
12. Submit best result to challenge
13. View submission in submissions list
14. Check leaderboard position

**Verify:**
- Balance decremented correctly
- Job appears in jobs list
- Submission appears in submissions list
- Score calculated and displayed

### Flow 2: Team Collaboration

1. User A creates account, creates team "Lab Alpha"
2. User A invites User B (by email)
3. User B creates account, accepts invitation
4. User B switches to team context
5. User A deposits $10 to team balance
6. User B submits job using team balance
7. User A sees User B's job in team jobs list
8. User B submits result to challenge
9. User A sees submission in team submissions

**Verify:**
- Invitation flow works end-to-end
- Team balance shared correctly
- Jobs/submissions visible to both members
- Personal data remains private

### Flow 3: Billing and Cost Tracking

1. User checks current balance
2. User views job cost estimate
3. User submits job
4. Job completes (or fails)
5. User checks balance (should be decremented)
6. User views transaction history
7. User makes deposit via Stripe
8. Balance updated after successful payment
9. Deposit appears in transaction history

**Verify:**
- Cost estimate matches actual charge
- Failed jobs don't charge (or charge correctly based on policy)
- Stripe webhook processes correctly
- Transaction history accurate

---

## Edge Cases & Error Handling

### Authentication Edge Cases
- [ ] Expired session handled gracefully
- [ ] Concurrent sessions (multiple tabs)
- [ ] Password reset with expired token
- [ ] Sign up with already-verified email

### Job Edge Cases
- [ ] Very long-running job (timeout handling)
- [ ] Job fails mid-execution
- [ ] Submit job with exactly $0 balance
- [ ] Submit job with 1 cent less than cost
- [ ] Rapid job submissions (rate limiting?)
- [ ] Cancel running job (if supported)

### Team Edge Cases
- [ ] Invite user who's already a member
- [ ] Invite user to team they're already invited to
- [ ] Accept invitation twice (double-click)
- [ ] Owner tries to leave team (should fail)
- [ ] Delete team with active jobs
- [ ] Delete team with pending invitations
- [ ] Switch team context while job is running

### Data Edge Cases
- [ ] Very long protein sequences
- [ ] Special characters in team names
- [ ] Unicode in usernames
- [ ] Empty results from design job
- [ ] Malformed PDB file upload

---

## Security Testing

### Authentication & Authorization
- [ ] Cannot access /jobs without auth
- [ ] Cannot access /submissions without auth
- [ ] Cannot access other user's job details
- [ ] Cannot access other user's submission details
- [ ] Cannot modify other user's data
- [ ] Cannot access team data without membership
- [ ] Cannot perform admin actions without admin role

### Input Validation
- [ ] SQL injection in search/filter fields
- [ ] XSS in username, team name, job name fields
- [ ] Path traversal in file downloads
- [ ] CSRF protection on state-changing actions

### API Security
- [ ] Rate limiting on expensive endpoints
- [ ] Webhook signature validation (Stripe)
- [ ] Proper CORS configuration

---

## Performance Testing

### Page Load Times
- [ ] Home page < 2s
- [ ] Challenges list < 2s
- [ ] Challenge detail < 3s (includes Mol* viewer)
- [ ] Jobs list < 2s
- [ ] Designer page < 3s

### API Response Times
- [ ] GET /api/challenges < 500ms
- [ ] GET /api/jobs < 500ms
- [ ] POST /api/jobs < 1s (excluding actual job time)
- [ ] GET /api/users/me < 200ms

### Stress Testing
- [ ] 10 concurrent users submitting jobs
- [ ] Large jobs list (100+ jobs)
- [ ] Large submissions list
- [ ] Team with many members (20+)

---

## Cross-Browser Testing

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Android Chrome

### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### Critical UI Elements
- [ ] Header navigation responsive
- [ ] Team selector works on mobile
- [ ] Mol* viewer responsive
- [ ] Forms usable on mobile
- [ ] Tables scroll horizontally on small screens

---

## Regression Testing

After any significant change, run:

1. **Smoke test** (see above)
2. **Authentication flow** - sign up, sign in, sign out
3. **Core happy path** - create job, view results, submit
4. **Billing** - balance display, transaction history
5. **Teams** - context switching, data visibility

---

## Bug Reporting Template

When logging bugs, include:

```markdown
## Bug Title

**Environment:** Local / Production
**Browser:** Chrome 120 / Safari 17 / etc.
**User Type:** New user / Existing user / Team member

### Steps to Reproduce
1.
2.
3.

### Expected Behavior


### Actual Behavior


### Screenshots/Logs


### Severity
- [ ] Critical (blocking, data loss)
- [ ] High (major feature broken)
- [ ] Medium (feature degraded)
- [ ] Low (cosmetic, minor)
```

---

## QA Schedule

| Frequency | Activity |
|-----------|----------|
| Every deploy | Smoke test |
| Weekly | Full feature checklist |
| Before release | End-to-end flows + edge cases |
| Monthly | Security review |
| Quarterly | Performance testing |
