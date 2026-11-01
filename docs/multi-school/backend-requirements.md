# Backend Requirements — Multi-School Platform

The follow-up phase that turns the frontend + mock multi-school work into a
real, isolated, backend-enforced SaaS (specification §4, §6, §7, §10).

The frontend in this repository **simulates** tenant isolation and authorization
honestly: the rules live in pure modules (`src/lib/tenant.ts`,
`src/lib/permissions.ts`), the transport (`src/api/mock.ts`) enforces them the
way a server would, and no permission can be bypassed from the UI. What it
**cannot** do is the part that actually protects data — because there is no
server and no database. This document specifies that part precisely so it can
be built without re-deriving the model.

## 1. Guiding constraints carried from the specification

1. **Do not trust the frontend for tenant identity.** The school is derived
   from the request's `Host` header on the server, never from a body/query
   `schoolId`. A client-supplied school id is a *hint to verify*, never a fact.
2. **Enforce RBAC on the server.** Every mutating action re-checks its
   permission code server-side. The frontend gate is UX, not security.
3. **Never allow cross-school access.** After RBAC passes, a *tenant* check
   confirms the target school is within the principal's scope.
4. **Suspended and inactive schools do not serve** protected routes (§4).
5. **Exclusive group membership** (§7): one school belongs to at most one
   group; deleting a group never deletes its schools.
6. **No per-school deployments**: one application, one database, many tenants
   resolved at request time.

The frontend already models all six; the backend must preserve them exactly so
the UI keeps working when `callApi` starts issuing real `fetch`es.

## 2. Transport contract (unchanged)

The action vocabulary in `src/api/contract.ts` is the API surface. Multi-school
actions to implement:

**Reads** (permission-checked):

| Action | Permission | Server behaviour |
|--------|-----------|------------------|
| `GET_SCHOOLS` | `schools.manage` | List all schools (registry scope). |
| `GET_SCHOOL_GROUPS` | `school_groups.read` | List groups + derived member codes. |
| `GET_SCHOOL_STATS` | `schools.manage` | Per-school counts, scoped by school code. |

**Writes** (permission-checked, audited):

| Action | Permission | Server behaviour |
|--------|-----------|------------------|
| `ADD_SCHOOL` | `schools.manage` | Mint slug (unique), insert in a transaction. |
| `UPDATE_SCHOOL` | `schools.update` | Partial profile + branding patch. |
| `SET_SCHOOL_STATUS` | `schools.status` | `ACTIVE` / `INACTIVE` / `SUSPENDED`. |
| `REGENERATE_SCHOOL_URL` | `schools.urls` | New unique slug; old one freed. |
| `CREATE_SCHOOL_GROUP` | `school_groups.manage` | Unique group name. |
| `UPDATE_SCHOOL_GROUP` | `school_groups.manage` | Rename / re-describe. |
| `DELETE_SCHOOL_GROUP` | `school_groups.manage` | Deletes group, **keeps** schools. |
| `SET_SCHOOL_GROUP` | `school_groups.manage` | Add / transfer / remove in one call. |

Add / transfer / remove are deliberately the **same** call
(`SET_SCHOOL_GROUP { code, groupId | null }`) because membership is a single
exclusive column — this is why the UI has no separate "transfer" operation to
get out of sync.

**Map the frontend `ACTION_PERMISSIONS` table to middleware verbatim.**
`node tools/check-rbac.mjs` already asserts every write action is mapped; the
server must load the same table rather than a hand-copied second copy.

## 3. Database schema (§7)

PostgreSQL recommended. Types shown for the columns the frontend already
defines (`src/types/index.ts`).

```sql
-- ── schools ───────────────────────────────────────────────────────────────
CREATE TYPE school_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TABLE schools (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL,                 -- SchoolID, e.g. 'ABC'
  name         TEXT NOT NULL,
  address      TEXT,
  slug         TEXT NOT NULL,                 -- subdomain label
  status       school_status NOT NULL DEFAULT 'ACTIVE',
  group_id     UUID REFERENCES school_groups(id) ON DELETE SET NULL,
  branding     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT schools_code_unique  UNIQUE (code),
  CONSTRAINT schools_slug_unique  UNIQUE (slug),
  CONSTRAINT schools_slug_format  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX schools_group_id_idx ON schools (group_id);
CREATE INDEX schools_status_idx   ON schools (status);

-- ── school groups ─────────────────────────────────────────────────────────
CREATE TABLE school_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT school_groups_name_unique UNIQUE (name)
);
```

Notes on why the schema encodes the specification directly:

- **`UNIQUE (slug)`** is what makes subdomain collision detection a *database
  guarantee*, not an application race. The slug-minting logic already exists in
  `src/lib/tenant.ts` (`generateUniqueSlug` appends `-2`, `-3`, …); the server
  runs it inside a retry loop — `INSERT`, catch `unique_violation`, mint the
  next alternative, retry — so two concurrent onboarding requests can never
  claim the same label.
- **`group_id` as a single FK on `schools`** *is* the exclusive-membership rule
  (§7). A school can only hold one value, so it can never appear in two groups.
  `ON DELETE SET NULL` *is* the "delete group without deleting schools" rule.
  If multi-membership is ever wanted, replace this with a
  `school_group_members (group_id, school_id)` join table carrying
  `UNIQUE (school_id)` — that preserves exclusivity — and only drop the unique
  constraint when the product genuinely wants a school in several groups.
- **`status` as an enum** keeps the tenant gate's three outcomes total.
- **`branding` as JSONB** matches the open-ended `SchoolBranding` object; a
  GIN index is optional until branding is queryable.

### Cross-referenced entities

Fixture data in the mock is scoped to `MOCK_SCHOOL_ID='001'` (`students`,
`exams`, `questions`, `results` all carry `SchoolID`). In the real schema each
per-school table needs:

```sql
ALTER TABLE students ADD COLUMN school_id UUID NOT NULL REFERENCES schools(id);
CREATE INDEX ON students (school_id);
-- same for exams, questions, results, users, etc.
```

Every such FK makes cross-school queries structurally impossible rather than
merely discouraged, and makes `GET_SCHOOL_STATS` a set of indexed counts.

### Audit log (§10)

```sql
CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  actor        TEXT NOT NULL,          -- authenticated username / sub
  actor_role   TEXT NOT NULL,
  action       TEXT NOT NULL,          -- the contract action
  target_type  TEXT,                   -- 'school' | 'school_group' | …
  target_id    TEXT,
  school_code  TEXT,                   -- resolved tenant, for scoping
  payload      JSONB,                  -- sanitized request body
  ip           INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_log (school_code, created_at DESC);
CREATE INDEX ON audit_log (actor, created_at DESC);
```

The mock already passes `creatorUsername` / `creatorRole` on every write; the
server should **ignore any client-claimed role** in that payload and take the
identity from the authenticated session instead.

## 4. Server-side tenant resolution (§4)

Runs before the handler, in middleware (Vercel Edge / Node), and is the **only**
source of tenant truth:

```
1. host = request.headers.host            // greenfield-international.laaec.com
2. sub  = extractSubdomain(host)          // 'greenfield-international'  (pure fn, reused)
3. if sub is null            → platform tenant; proceed (admin/central console)
4. school = SELECT ... FROM schools WHERE slug = $1        -- UNIQUE index
5. school is null            → 404  'school not found'
6. school.status <> 'ACTIVE' → 403  'inactive' | 'suspended'
7. attach school.id + school to request context
```

This is the **exact** chain `resolveTenant()` in `src/lib/tenant.ts` already
implements in the frontend — that is the point of keeping the library pure: the
server imports the same function, so behaviour cannot drift between the demo and
production.

Critical rules:

- **The `Host` header is authoritative.** A `?school=`, a body field, or a
  header is never used to select the tenant. (The frontend's `?tenant=` preview
  parameter is a local review aid only and must be **rejected**, not honoured,
  in production.)
- **Fail closed.** If the registry lookup errors, respond as "not found"
  rather than serving an unverified tenant — the same choice `useTenant` makes.
- **Suspended / inactive block protected routes.** Read-only marketing-style
  pages may still render the refusal screen's content, but no data endpoint and
  no examination route may execute.

### Cross-tenant authorization (§10)

Tenancy and RBAC are two independent gates and both must pass:

```
principal   = authenticate(request)              // JWT / session — server-derived
permission  = ACTION_PERMISSIONS[action]          // from the shared table
scope       = scopeFor(principal)                 // platform | group ids | school id
if (!has(principal.permissions, permission))      403
if (targetSchool not within scope)                403   // cross-school guard
```

- **SUPER_ADMIN / central console** → platform scope (all schools).
- **GROUP_ADMIN** → every school whose `group_id ∈ their groups`.
- **SCHOOL_ADMIN / TEACHER / STUDENT** → exactly their own `school_id`.

The rule the specification states plainly: *never trust a frontend-supplied
school id*. So even after the tenant gate resolves the school from `Host`, any
action naming a different school (e.g. stats for code `XYZ` on a request
arriving for `abc.laaec.com`) must be rejected unless the principal's scope
covers `XYZ` — and the platform console is the only place cross-school
operations are allowed at all.

## 5. Transactions (§7)

Every multi-statement operation runs in a transaction:

- **`ADD_SCHOOL`** — mint slug → `INSERT schools` → (optionally) `INSERT audit_log`.
  Uniqueness retry is safe because a failed insert aborts cleanly.
- **`SET_SCHOOL_GROUP`** — single `UPDATE schools SET group_id = … WHERE code = …`
  returning the row. One statement, so exclusivity and atomicity are inherent;
  a transfer is this one update, never a delete+insert pair.
- **`DELETE_SCHOOL_GROUP`** — `BEGIN; UPDATE schools SET group_id = NULL WHERE
  group_id = $1; DELETE FROM school_groups WHERE id = $1; COMMIT;` (or rely on
  `ON DELETE SET NULL`). Guarantees no school is left pointing at a dead group
  and no school is deleted.
- **`REGENERATE_SCHOOL_URL`** — `UPDATE schools SET slug = $new WHERE code = $c`
  inside the same uniqueness-retry loop.

## 6. Roles (§6)

The frontend vocabulary has six `AdminRole` values (`src/lib/roles.ts`):
`SUPER_ADMIN`, `CENTRAL_ADMIN`, `SCHOOL_ADMIN`, `ICT_ADMIN`,
`EXAM_COMMITTEE`, `TEACHER`. **`GROUP_ADMIN` does not exist yet.** Adding it is
an identity-model change, so it is scoped here rather than faked in the UI:

| Role | Scope | Permissions |
|------|-------|-------------|
| SUPER_ADMIN | platform | everything (current superset, 121 codes) |
| GROUP_ADMIN | their groups' schools | `school_groups.read/manage` + read of member schools' data |
| SCHOOL_ADMIN | own school | `schools.read/update/urls` for own school only |
| TEACHER / SUPERVISOR | own school | per-subject read/write of own classes and results |
| STUDENT | own school | read-only own profile/results |

To add `GROUP_ADMIN`:

1. Add the role to the roles vocabulary and grant it `school_groups.*` +
   scoped `schools.read`.
2. Add a **principal↔group mapping** (`group_admins(group_id, user_id)`), since
   a group admin's scope is a *set* of groups, not one school id.
3. Implement `scopeFor()` (section 4) to expand that mapping into school ids.
4. Re-run `node tools/check-rbac.mjs` — the SUPER_ADMIN-superset invariant and
   the write-action-mapping invariant must still hold.

Until then, group management is super-admin-only (as shipped), which is a
correct, non-broken intermediate state rather than a disabled button.

## 7. Authentication & sessions

`mockAuthenticate` currently never contacts Cognito, and
`public/config.js` holds only public identifiers. The backend phase must wire a
real identity provider, then:

- issue a session whose claims include role + permission set + school scope,
- resolve those **server-side on every request** (never read a role from
  local/session storage as the source of truth),
- keep the D-71 re-check idea: permission changes take effect without a
  re-login, by reading grants from the session store / DB rather than a
  cached cookie blob.

## 8. Acceptance checklist for the backend phase

- [ ] `Host` header → school; body/query school ids never select the tenant.
- [ ] Unknown subdomain → 404; suspended/inactive → 403; enforced server-side.
- [ ] Every action maps to a permission code checked on the server (same table).
- [ ] Cross-school requests rejected for non-platform principals.
- [ ] Slug collisions impossible under concurrency (DB unique + retry).
- [ ] Deleting a group keeps all its schools (test asserts row counts).
- [ ] Every write emits an audit row with server-derived identity.
- [ ] `GROUP_ADMIN` scoped to its groups; invariant suite still green.
- [ ] Frontend `callApi` switched to real `fetch` with **no UI changes needed**.
