# Frontend Implementation Plan

Plan date: 2026-03-31

This plan converts the current route audit into a practical frontend delivery sequence for `frontend/saas-frontend`.

Related reference:

- `docs/frontend-backend-route-audit.md`

## 1. Goal

Finish the frontend so the main admin and owner workflows are fully usable against the backend that already exists, and clearly separate work that is blocked by missing backend APIs.

## 2. Current status

### Already implemented

- Login
- Admin dashboard
- Tenant list
- Tenant create
- Tenant detail
- Owner invitation screen UI
- Server list
- Server create

### Still incomplete

- Onboarding job list and detail
- Real owner invitation submission
- Real server edit flow
- Real server detail flow
- Metrics screens
- Logs screens
- Logout / refresh token flow

## 3. Delivery phases

## Phase 1: Fix contract blockers

Objective:
Make the current frontend safe to continue building on.

Tasks:

1. Resolve onboarding access mismatch for owner/member users.
2. Decide whether owner/member can read tenant-scoped onboarding jobs.
3. If backend will not allow that access, remove onboarding-job dependency from tenant workspace summaries.
4. Confirm the final product rule for admin server browsing:
   - one tenant at a time
   - or cross-tenant server directory

Output:

- stable role-based data contract
- no frontend page depending on forbidden backend routes

Blocked by backend:

- yes, for onboarding access decision

## Phase 2: Finish authentication foundation

Objective:
Close auth gaps before more screens depend on them.

Tasks:

1. Add logout action in the frontend.
2. Add refresh-token flow using `POST /api/v1/auth/refresh`.
3. Add token-expired handling in `apiClient.ts`.
4. Remove or disable fake OAuth buttons if backend OAuth is not coming soon.
5. Remove or disable forgot-password link if backend reset flow is not available.

Output:

- stable session lifecycle
- fewer dead-end auth actions

Backend dependency:

- refresh already exists
- forgot password and OAuth are still missing

## Phase 3: Onboarding jobs module

Objective:
Replace placeholder `/tasks` routes with real onboarding job pages.

Tasks:

1. Decide route naming:
   - rename `/tasks` to `/onboarding-jobs`
   - or keep `/tasks` and document the mapping
2. Build onboarding job list page using `GET /api/v1/onboarding/jobs`.
3. Build onboarding job detail page using `GET /api/v1/onboarding/jobs/{jobId}`.
4. Add action to start onboarding using `POST /api/v1/onboarding/jobs`.
5. Link server actions like `Verify` or `Install Monitoring` to real onboarding jobs.
6. Add job status pills, timestamps, tenant context, and server context.

Output:

- real onboarding flow instead of placeholder task screens

Backend dependency:

- endpoints already exist
- role access needs Phase 1 decision

## Phase 4: Server management module

Objective:
Finish server lifecycle beyond create/list.

Tasks:

1. Add server detail page using `GET /api/v1/tenants/{tenantId}/servers/{serverId}`.
2. Add server edit page or modal using `PUT /api/v1/tenants/{tenantId}/servers/{serverId}`.
3. Wire `Open` and `Edit` buttons on the server list.
4. Persist tenant context when moving between server list, detail, edit, and onboarding pages.
5. Add proper empty states for tenants with zero servers.

Output:

- end-to-end server management flow

Backend dependency:

- none, routes already exist

## Phase 5: Metrics module

Objective:
Implement the owner/admin server metrics experience using existing backend routes.

Tasks:

1. Build server overview page using `GET /overview`.
2. Build CPU, memory, disk, and network charts using the chart endpoints.
3. Add top container CPU and memory panels.
4. Add range switching, loading states, and error states.
5. Link server list `Open` action into the metrics overview if that is the intended default landing.

Output:

- real metrics page backed by Prometheus-facing APIs

Backend dependency:

- none, routes already exist

## Phase 6: Logs module

Objective:
Implement searchable server logs page.

Tasks:

1. Build logs page using `GET /logs`.
2. Support range, limit, container name, and search filters.
3. Add empty states for no logs and failure states for missing promtail/log agent coverage.
4. Link the server list and server detail flows into logs.

Output:

- usable per-server logs UI

Backend dependency:

- none, route already exists

## Phase 7: Owner assignment and invitation module

Objective:
Replace derived owner placeholders with real backend data.

Tasks:

1. Add real invitation/owner assignment service functions once backend API exists.
2. Replace fake success flow in `app/(workspaces)/invitations/page.tsx`.
3. Replace derived owner labels in tenant list/detail with real owner records.
4. Add assignment status, resend flow, and failure handling.

Output:

- trustworthy admin ownership workflow

Backend dependency:

- yes, blocked until backend exposes invitation/owner APIs

## 4. Recommended implementation order

Recommended order for engineering work:

1. Phase 1: contract blockers
2. Phase 2: auth foundation
3. Phase 3: onboarding jobs
4. Phase 4: server detail/edit
5. Phase 5: metrics
6. Phase 6: logs
7. Phase 7: owner invitation and assignment

Reason:

- Phase 1 removes data-contract risk.
- Phase 3 and Phase 4 unlock the main operational workflow.
- Metrics and logs can then plug into server detail cleanly.
- Owner invitation should wait until backend is real, otherwise frontend work will be mostly throwaway.

## 5. Screen-by-screen plan

| Screen | Current state | Next action |
| --- | --- | --- |
| Login | Real | Add refresh/logout support |
| Admin dashboard | Real | Link alerts and activity to job detail |
| Tenant list | Real | Replace derived owner data when backend exists |
| Tenant create | Real | Keep as-is, maybe add validation polish |
| Tenant detail | Partial | Add edit/update if needed |
| Owner invitation | UI only | Wait for backend invitation API |
| Server list | Real | Link `Open` and `Edit` to real pages |
| Server create | Real | Add redirect options after success |
| Tasks / onboarding jobs | Placeholder | Replace with real jobs module |
| Metrics | Missing | Build from backend routes |
| Logs | Missing | Build from backend route |

## 6. File-level execution plan

### Core services

- `services/apiClient.ts`
- `services/authService.ts`
- `services/workspaceService.ts`

Work:

- token refresh
- shared error handling
- onboarding job service helpers
- metrics service helpers
- logs service helpers
- server detail/update helpers

### App routes

- `app/(workspaces)/workspace/page.tsx`
- `app/(workspaces)/servers/page.tsx`
- `app/(workspaces)/servers/create/page.tsx`
- `app/(workspaces)/tenants/page.tsx`
- `app/(workspaces)/tenants/[id]/page.tsx`
- `app/(workspaces)/invitations/page.tsx`
- `app/(workspaces)/tasks/page.tsx`
- `app/(workspaces)/tasks/[id]/page.tsx`

Work:

- replace placeholders
- wire actions to real pages
- reduce duplicated server inventory logic where possible

### Shared components

- `components/layouts/sidebar.tsx`
- `components/ui/server-card.tsx`
- `components/ui/state-card.tsx`

Work:

- support real server actions
- support route consistency
- add reusable status pills and page-level filters

## 7. Risks

### High risk

- onboarding access mismatch for owner/member
- missing invitation backend contract

### Medium risk

- duplicated server inventory logic between workspace and server list pages
- route naming confusion between `tasks` and `onboarding jobs`

### Low risk

- visual polish tasks on already working screens

## 8. Definition of done

Frontend implementation is considered complete when:

1. Admin can create tenant, assign owner, create server, start onboarding, inspect jobs, and open metrics/logs.
2. Owner can view only one tenant, manage servers inside that tenant, inspect jobs, metrics, and logs.
3. No screen depends on a backend route that the current role cannot access.
4. Placeholder routes and fake-submit flows are removed or clearly disabled.
5. Sidebar navigation matches real pages and no item routes to the wrong screen.

