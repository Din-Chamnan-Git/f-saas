# Frontend / Backend Route Audit

Audit date: 2026-03-31

This document compares the current frontend API usage in `frontend/saas-frontend` with the backend controllers in `monitor-saas/monitoring-backend`.

## 1. Aligned and currently used

| Frontend flow | Frontend call | Backend route | Status | Notes |
| --- | --- | --- | --- | --- |
| Login | `POST /api/v1/auth/login` | `POST /api/v1/auth/login` | Aligned | Used in `app/(authentications)/login/page.tsx` |
| Current user / role | `GET /api/v1/auth/me` | `GET /api/v1/auth/me` | Aligned | Used by workspace, tenants, invitations, servers pages |
| Tenant directory | `GET /api/v1/tenants` | `GET /api/v1/tenants` | Aligned | Admin-only in both frontend intent and backend security |
| Create tenant | `POST /api/v1/tenants` | `POST /api/v1/tenants` | Aligned | Used by `app/(workspaces)/tenants/create/page.tsx` |
| Tenant detail | `GET /api/v1/tenants/{tenantId}` | `GET /api/v1/tenants/{tenantId}` | Aligned | Used by `app/(workspaces)/tenants/[id]/page.tsx` |
| Server inventory | `GET /api/v1/tenants/{tenantId}/servers` | `GET /api/v1/tenants/{tenantId}/servers` | Aligned | Used by workspace and servers list pages |
| Create server | `POST /api/v1/tenants/{tenantId}/servers` | `POST /api/v1/tenants/{tenantId}/servers` | Aligned | Used by `app/(workspaces)/servers/create/page.tsx` |
| Admin onboarding list | `GET /api/v1/onboarding/jobs` and `GET /api/v1/onboarding/jobs?tenantId=...` | `GET /api/v1/onboarding/jobs` | Aligned for admin only | Used in admin dashboard, tenant directory, tenant detail |

## 2. Backend routes exist, but frontend is not using them yet

These routes already exist in the backend, but the frontend currently has no real integration for them.

### Auth

| Backend route | Frontend status | Notes |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Not used | No registration UI wired |
| `POST /api/v1/auth/refresh` | Partially prepared | Refresh token is stored optionally, but no refresh flow is implemented |
| `POST /api/v1/auth/logout` | Not used | No logout action wired |

### Tenant and server management

| Backend route | Frontend status | Notes |
| --- | --- | --- |
| `PUT /api/v1/tenants/{tenantId}` | Not used | Tenant detail page is read-only right now |
| `GET /api/v1/tenants/{tenantId}/servers/{serverId}` | Not used | No real server detail page yet |
| `PUT /api/v1/tenants/{tenantId}/servers/{serverId}` | Not used | `Edit` buttons are UI-only right now |

### Onboarding jobs

| Backend route | Frontend status | Notes |
| --- | --- | --- |
| `POST /api/v1/onboarding/jobs` | Not used | No real "start onboarding" action wired |
| `GET /api/v1/onboarding/jobs/{jobId}` | Not used | Task detail page is placeholder-only |

### Metrics and logs

| Backend route group | Frontend status | Notes |
| --- | --- | --- |
| `GET /api/v1/tenants/{tenantId}/servers/{serverId}/overview` | Not used | No metrics page integration |
| `GET /api/v1/tenants/{tenantId}/servers/{serverId}/charts/*` | Not used | No charts page integration |
| `GET /api/v1/tenants/{tenantId}/servers/{serverId}/containers/top/*` | Not used | No top containers UI integration |
| `GET /api/v1/tenants/{tenantId}/servers/{serverId}/logs` | Not used | No logs page integration |

### Server metrics endpoints

| Backend route group | Frontend status | Notes |
| --- | --- | --- |
| `/api/v1/tenants/{tenantId}/servers/{serverId}/metrics-endpoints/*` | Not used | No frontend CRUD/check flow for scrape endpoints yet |

## 3. Frontend flows exist, but no matching backend route was found

These are the clearest missing backend contracts from the frontend point of view.

| Frontend flow | Expected backend capability | Current state |
| --- | --- | --- |
| Owner invitation / provisioning page | Something like `POST /api/v1/invitations`, `POST /api/v1/tenant-owners`, or `POST /api/v1/users` with tenant assignment | Missing. `app/(workspaces)/invitations/page.tsx` is UI-only and does not submit to backend |
| Tenant owner assignment data | Owner lookup / assignment API | Missing. Tenant list/detail derive owner state from tenant/server/job status instead of real owner records |
| Forgot password link | Forgot/reset password endpoints | Missing from current backend controllers |
| Google / GitHub sign-in buttons | OAuth callback / provider auth endpoints | Missing from current backend controllers |

## 4. Contract and access mismatches

These are not just "missing pages". These are real frontend/backend mismatches.

### 4.1 Owner and member onboarding access is mismatched

- Frontend service code calls `GET /api/v1/onboarding/jobs?tenantId=...` to build tenant server summaries.
- Backend security restricts `/api/v1/onboarding/**` to `ADMIN` only.
- Result: owner/member server dashboards can break even though those roles can list servers.

Current code involved:

- Frontend: `services/workspaceService.ts`
- Backend: `config/SecurityConfig.java`

Options to fix:

1. Allow owner/member read access to tenant-scoped onboarding job summaries.
2. Stop frontend tenant dashboards from calling onboarding jobs and provide another summary endpoint instead.

### 4.2 Frontend route naming does not match backend resource naming

- Frontend has placeholder routes under `/tasks` and `/tasks/[id]`.
- Backend resource is `/api/v1/onboarding/jobs`.
- Result: the UI route naming and backend naming are disconnected.

Recommendation:

- Rename frontend task pages to onboarding-job pages, or
- Keep `/tasks` as UI wording but wire it explicitly to onboarding job APIs and document that mapping.

### 4.3 Admin server list is tenant-scoped, but backend has no cross-tenant server list

- Frontend admin `Servers` page currently works inside one selected tenant at a time.
- Backend has tenant-scoped server listing only: `GET /api/v1/tenants/{tenantId}/servers`.
- There is no backend route like `GET /api/v1/servers` for a real cross-tenant admin server directory.

This is acceptable if product intent is "admin chooses a tenant, then sees that tenant's servers".
It is not enough if product intent is "admin sees every server across the platform".

## 5. Current frontend placeholders

These screens or actions exist visually but are not backed by real API logic yet.

| Frontend area | Placeholder status |
| --- | --- |
| `app/(workspaces)/tasks/page.tsx` | Static sample data only |
| `app/(workspaces)/tasks/[id]/page.tsx` | Route param only, no backend data |
| `Edit` buttons in server inventory | No backend fetch/update flow wired |
| `Review Alerts` admin action | UI button only |
| Owner invitation submit | Success message only, no API call |

## 6. Recommended implementation order

1. Add a real owner invitation / owner assignment backend contract.
2. Resolve the onboarding access mismatch for owner/member tenant dashboards.
3. Wire onboarding job pages to `POST /api/v1/onboarding/jobs`, `GET /api/v1/onboarding/jobs`, and `GET /api/v1/onboarding/jobs/{jobId}`.
4. Add real server detail and update flows using `GET /api/v1/tenants/{tenantId}/servers/{serverId}` and `PUT /api/v1/tenants/{tenantId}/servers/{serverId}`.
5. Add metrics and logs pages wired to the existing backend endpoints.

