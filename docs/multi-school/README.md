# Multi-School Platform

Multi-school management, school grouping and automatic subdomain URL generation
for LAAEC (the multi-school specification, §1–§11).

This folder documents **what is built in the frontend today** and **what the
backend/infrastructure follow-up must add** to satisfy the parts of the
specification that cannot be met by a browser-side mock alone.

## Read this first: what this application is

LAAEC is a **frontend-only** Vite multi-page application:

- `callApi` — the single API entry point — never touches the network. It
  dispatches to an in-browser handler map with simulated latency
  (`src/api/mock.ts`).
- There is **no server, no database, no migrations and no serverless/edge
  layer** in this repository.
- Authentication runs through `mockAuthenticate`, which explicitly never
  contacts the real Cognito pool.

The specification asks for backend-enforced tenant isolation, a real database
with foreign keys/transactions, and server-side subdomain resolution. None of
those exist here. The chosen scope — agreed with the product owner — is:

> **Frontend + mock now, backend as follow-up.**

So this repository delivers the complete multi-school *behaviour and UI* against
the mock, plus the pure domain logic that will move to the server unchanged, and
this folder specifies exactly what the server/infrastructure phase must build.

## What is built (frontend, verified)

All of it is verified by `npm run typecheck`, `node tools/check-rbac.mjs`,
`npm run build`, and 24 assertions against the real tenant library.

| Spec | Delivered |
|------|-----------|
| §1 Multi-school management | `Schools` panel: register (auto-URL), edit profile + branding, activate/suspend/restore with confirmation, per-school statistics, search + pagination. Lifecycle via `SET_SCHOOL_STATUS`. |
| §2 School grouping | `School Groups` panel: create / edit / delete (delete **keeps** its schools and confirms the count), add / remove / transfer members. Exclusive membership by construction. |
| §3 Automatic URL generation | `src/lib/tenant.ts`: slug minting with uniqueness + `-2/-3…` alternatives, copy / open / regenerate from the registry, duplicate and empty-name handling. |
| §4 Tenant routing (frontend half) | `src/composables/useTenant.ts` + `App.vue` gate: hostname → school, then active / blocked / unknown. Unknown → not-found screen; suspended/inactive → refusal screen. |
| §5 School branding | Branding fields (logo, colours, contact, address, exam instructions) edited per school; applied to `:root` CSS variables + document title when a tenant resolves. |
| §6 RBAC | 5 new permission codes (`schools.update/status/urls`, `school_groups.read/manage`) enforced at the D-71 transport gate; super-admin-only like the registry. `GROUP_ADMIN` is deferred — see `backend-requirements.md`. |
| §9 UI | Schools Management, Add New School, School Details/Edit, School Groups, Create Group, Group Details, School URL management — with loading/empty/error/success states and confirmation dialogs. |

### Where the code lives

- `src/lib/tenant.ts` — **pure** slug + hostname + resolution rules (liftable to a server).
- `src/composables/useTenant.ts` — browser-side tenant runner + branding applier.
- `src/App.vue` — the tenant gate (unknown / blocked / pending screens).
- `src/api/contract.ts`, `src/api/mock.ts` — the actions and mock handlers.
- `src/lib/permissions.ts`, `src/lib/roles.ts` — codes and grants.
- `src/views/AdminView.vue` — the enhanced Schools panel.
- `src/components/schools/SchoolGroupsPanel.vue` — the groups surface.

### Reviewing tenant screens before wildcard DNS exists

A generated subdomain is **not** reachable until the infrastructure in
`infrastructure.md` exists. To preview tenant resolution locally, append
`?tenant=<slug>` to any URL — e.g. `http://localhost:5173/?tenant=st-finbarrs-college`
for the branded portal, or a bogus slug for the "not found" screen. This is a
review aid only; on a real deployment the hostname alone identifies the tenant.

## What the follow-up must add

- **`backend-requirements.md`** — the database schema (§7), server-side tenant
  resolution and authorization (§4, §10), and role scoping incl. `GROUP_ADMIN` (§6).
- **`infrastructure.md`** — wildcard DNS, wildcard SSL, host-based routing (§8),
  and the explicit limitations of the current static-Vercel deployment.

## Verification

```bash
npm run typecheck          # vue-tsc
node tools/check-rbac.mjs  # RBAC invariants (36 nav entries, 123 writes)
npm run build              # production build
```

Tenant-logic assertions (slug generation, uniqueness, hostname extraction, all
four resolution outcomes) are run against the real bundled `tenant.ts`; see the
project log for the script.
