# Teams Feature QA Checklist

## Pre-Test Setup

- [ ] Fresh test database (or known state)
- [ ] Two test accounts ready (User A, User B)
- [ ] Email delivery working (or console logging in dev)

---

## 1. Team Creation

### Basic Creation
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Create team | Click "Create Team", enter name "Test Lab", submit | Team created, appears in list | [ ] |
| Auto-slug | Create team with name "My Test Lab" | Slug auto-generated as "my-test-lab" | [ ] |
| Empty name | Submit with empty name | Validation error | [ ] |
| Duplicate slug | Create team with same slug as existing | Error message | [ ] |

### Post-Creation State
| Test | Expected | Pass |
|------|----------|------|
| Creator is owner | Role shows as "owner" | [ ] |
| Team balance is $0 | Balance shows $0.00 | [ ] |
| Team in selector | Appears in header TeamSelector dropdown | [ ] |

---

## 2. Team Selector

### Display
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Shows personal | No active team | Shows "Personal" with personal balance | [ ] |
| Shows team | Select team | Shows team name with team balance | [ ] |
| Dropdown opens | Click selector | Dropdown with Personal + teams | [ ] |

### Context Switching
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Switch to team | Click team in dropdown | Context changes, balance updates | [ ] |
| Switch to personal | Click "Personal Account" | Context changes, balance updates | [ ] |
| Jobs refresh | Switch context | Jobs list shows correct jobs | [ ] |
| Submissions refresh | Switch context | Submissions list shows correct submissions | [ ] |
| Persists on refresh | Switch to team, refresh page | Still on team context | [ ] |

---

## 3. Invitations

### Sending Invites (Admin/Owner)
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Invite form visible | Expand team, check for invite form | Form visible for admin/owner | [ ] |
| Invite member | Enter email, role=member, submit | Success message, invite sent | [ ] |
| Invite admin | Enter email, role=admin, submit | Success message, invite sent | [ ] |
| Invalid email | Enter "notanemail", submit | Validation error | [ ] |
| Existing member | Invite email of existing member | Error: already a member | [ ] |

### Sending Invites (Member)
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| No invite form | Log in as member, expand team | Invite form not visible | [ ] |

### Accepting Invites
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Accept (logged in) | Open invite link while logged in | Shows team name, accept/reject buttons | [ ] |
| Accept flow | Click Accept | Success, redirects to teams page | [ ] |
| Reject flow | Click Reject | Success, invitation declined | [ ] |
| Accept (logged out) | Open invite link while logged out | Prompts to sign in/sign up | [ ] |
| Sign in then accept | Sign in from invite page | Returns to invite, can accept | [ ] |
| Expired invite | Open old invite link | Shows expiration error | [ ] |
| Invalid invite | Open `/accept-invite?id=fake123` | Shows not found error | [ ] |

---

## 4. Member Management

### Viewing Members
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Member list | Expand team | Shows all members with roles | [ ] |
| Shows owner | Owner marked clearly | [ ] |
| Shows admin | Admins marked clearly | [ ] |
| Shows member | Members marked clearly | [ ] |

### Role Changes (Owner only)
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Promote to admin | Owner: change member -> admin | Role updates | [ ] |
| Demote to member | Owner: change admin -> member | Role updates | [ ] |
| Cannot demote owner | Try to change owner role | Not allowed / no option | [ ] |

### Role Changes (Admin)
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Cannot change roles | Admin: try to change roles | No option visible | [ ] |

### Removing Members
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Owner removes member | Click remove on member | Member removed | [ ] |
| Admin removes member | Click remove on member | Member removed | [ ] |
| Cannot remove owner | Try to remove owner | Not allowed / no option | [ ] |
| Member leaves | Member clicks "Leave Team" | Removed from team | [ ] |
| Owner cannot leave | Owner tries to leave | Error: transfer ownership first | [ ] |

---

## 5. Team Billing

### Balance Display
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Team balance in selector | Switch to team | Shows team balance | [ ] |
| Personal balance in selector | Switch to personal | Shows personal balance | [ ] |
| Balance on billing page | Visit /billing in team context | Shows team balance | [ ] |

### Deposits
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Admin can deposit | Admin: initiate deposit | Stripe checkout opens | [ ] |
| Owner can deposit | Owner: initiate deposit | Stripe checkout opens | [ ] |
| Member cannot deposit | Member: try to deposit | Error: insufficient permissions | [ ] |
| Deposit credits team | Complete Stripe payment | Team balance increases | [ ] |
| Transaction recorded | Check transaction history | Deposit shows with team context | [ ] |

### Job Billing
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Team job uses team balance | Submit job in team context | Team balance decremented | [ ] |
| Personal job uses personal | Submit job in personal context | Personal balance decremented | [ ] |
| Insufficient team balance | Team has $0, submit job | Error: insufficient balance | [ ] |

---

## 6. Data Visibility

### Jobs in Team Context
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| See own team jobs | User A in team context | Sees own team jobs | [ ] |
| See teammate's jobs | User A in team context | Sees User B's team jobs | [ ] |
| Don't see personal jobs | User A in team context | User B's personal jobs hidden | [ ] |

### Jobs in Personal Context
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| See own personal jobs | User A in personal context | Sees own personal jobs | [ ] |
| Don't see team jobs | User A in personal context | Team jobs hidden | [ ] |

### Submissions
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Team submissions visible | In team context | See team members' submissions | [ ] |
| Personal submissions private | In team context | Don't see others' personal submissions | [ ] |

### Job Access Control
| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Access team job | Navigate to team job URL | Can view job details | [ ] |
| Access other's personal job | Navigate to non-team job URL | 404 or forbidden | [ ] |

---

## 7. Team Deletion

| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Owner can delete | Owner clicks "Delete Team" | Confirmation prompt | [ ] |
| Confirm delete | Confirm deletion | Team deleted, redirects | [ ] |
| Admin cannot delete | Admin: no delete option | Button not visible | [ ] |
| Member cannot delete | Member: no delete option | Button not visible | [ ] |

---

## 8. Edge Cases

| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Rapid context switch | Click teams quickly | No errors, final state correct | [ ] |
| Multiple tabs | Open /jobs in two tabs, switch context in one | Other tab updates on refresh | [ ] |
| Invite self | Try to invite own email | Error message | [ ] |
| Many team members | Add 10+ members | UI handles gracefully | [ ] |
| Long team name | Create team with 100 char name | Truncated in UI, stored correctly | [ ] |
| Special chars in name | Create team "Lab & Co." | Handled correctly | [ ] |

---

## 9. API Direct Testing (Optional)

Use curl or API client to test endpoints directly:

```bash
# List teams (requires auth cookie)
curl http://localhost:3000/api/teams

# Create team
curl -X POST http://localhost:3000/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Team", "slug": "test-team"}'

# Get team members
curl http://localhost:3000/api/teams/{teamId}/members

# Invite member
curl -X POST http://localhost:3000/api/teams/{teamId}/invite \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "role": "member"}'
```

---

## Sign-Off

| Tester | Date | Environment | Result |
|--------|------|-------------|--------|
| | | Local | |
| | | Production | |

### Notes

```
(Add any issues found, workarounds, or observations here)
```
