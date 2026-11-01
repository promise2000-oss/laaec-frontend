# Infrastructure Requirements — Wildcard DNS, SSL & Host Routing (§8)

What must exist for `greenfield-international.laaec.com` to actually serve the
application, and the honest limitations of the current deployment.

**The single most important statement in this document:**

> A generated subdomain is **not** automatically internet-accessible. Writing
> `slug: 'greenfield-international'` into the UI produces a correct URL *target*
> — it does not create DNS records, certificates, or a route. Until the wildcard
> infrastructure below exists, `https://greenfield-international.laaec.com` does
> not resolve, and the **Open** button in the Schools panel will land on a
> browser error. The URL is right; the plumbing is a follow-up.

## 1. Current deployment (what exists today)

- Vite **multi-page application** — 18 physical HTML entries, built to `dist/`.
- Deployed on **Vercel as a static site**: `trailingSlash: true`, **no SPA
  catch-all rewrite**, **no `middleware.ts`**, **no `functions/`**, **no `api/`**.
- Tenant resolution runs **client-side** (`src/composables/useTenant.ts` reads
  `window.location.hostname`), because there is no server layer to do it earlier.
- No wildcard domain is attached to the project.

## 2. Target architecture (no per-school deployments)

The specification forbids per-school deployments, and the design honours it:

```
                    ┌─────────────────────────────────────────┐
 *.laaec.com  ───►  │  ONE Vercel project / ONE build / ONE DB │
                    │                                         │
  admin.laaec.com ──┤► edge middleware reads Host              │
  abc.laaec.com   ──┤►   → resolveTenant(host)  [pure fn]      │
  xyz.laaec.com   ──┤►   → attach school context               │
                    │► same static assets serve every tenant  │
                    └─────────────────────────────────────────┘
```

One build, one deploy, many tenants. Adding a school is a **database row**, never
a deployment. Scaling is adding rows, not pipelines.

## 3. Wildcard DNS

Add a wildcard record so *every* unclaimed label reaches the project:

| Type | Name | Value | Notes |
|------|------|-------|-------|
| A | `@` (laaec.com) | Vercel apex IP (`76.76.21.21`) | apex / apex redirect |
| CNAME | `www` | `cname.vercel-dns.com` | |
| **CNAME** | **`*`** | **`cname.vercel-dns.com`** | **wildcard — the key record** |

(or A-record apex depending on the account's assigned IPs; Vercel shows the
exact values per project.)

A single `*.laaec.com` record covers *every* school URL. When a school is
onboarded and a slug is minted, **no DNS change occurs** — that is precisely
what makes per-school deployments unnecessary.

**Deliberately unclaimed labels** must still route to the platform, not a
stranger's page: `www`, `app`, `admin`, `api`, `mail` are reserved and excluded
by `extractSubdomain()` in `src/lib/tenant.ts`, and the DNS zone should not
delegate them to third parties either.

## 4. Wildcard SSL/TLS

- Vercel provisions and renews a **wildcard certificate for `*.laaec.com`**
  (Let's Encrypt DNS-01 validation) automatically once the wildcard domain is
  added to the project.
- Custom domains (spec §3 "later custom domains") are added the same way, each
  getting its own certificate; the slug remains the internal tenant key either
  way.
- No certificate work per school — another consequence of one wildcard cert.

## 5. Host-based routing

Because this is an MPA with **absolute root asset URLs** (`/assets/...`), no
`base` change is required for subdomains. This is the concrete advantage of
subdomains over subpaths:

- Subdomain (`abc.laaec.com/`): path root stays `/`, so `base: '/'` is correct
  as-is.
- Subpath (`laaec.com/abc/`): the path root changes, forcing a Vite `base` +
  router change for every deployment — which is why subdomains are the chosen
  shape.

Routing steps once DNS is attached:

1. Request arrives at Vercel for `abc.laaec.com`.
2. **Edge middleware** (`middleware.ts`, new) reads `request.headers.host`.
3. Resolve tenant (same `extractSubdomain` → `resolveTenant` rules, now
   server-side — see `backend-requirements.md` §4).
4. Unknown → 404 page; suspended/inactive → 403 page; active → attach tenant and
   continue to the static application.
5. The client bundle re-reads the hostname and applies branding — identical
   rules, so frontend and middleware agree.

The static MPA needs **no per-tenant file rewriting**: every subdomain serves the
same `dist/`, and the app decides which school it is from the hostname at runtime.

## 6. Concrete Vercel wiring (follow-up checklist)

- [ ] Add `laaec.com` and `*.laaec.com` to the project Domains.
- [ ] Point DNS: apex A → Vercel IP, `*` CNAME → `cname.vercel-dns.com`.
- [ ] Confirm wildcard cert issued and renewed.
- [ ] Add `middleware.ts` for server-side tenant resolution (§4 of
      `backend-requirements.md`) — the client gate alone is a demo, not a control.
- [ ] Keep `trailingSlash: true` and the no-catch-all constraint consistent with
      how routes are served on subdomains (each HTML entry resolves by path).
- [ ] Wire `callApi` to a real API (server/DB) so `fetch` replaces the mock
      dispatcher without UI changes.
- [ ] After adding the wildcard domain, verify:
      `https://<a-real-slug>.laaec.com` → branded portal,
      `https://not-a-school.laaec.com` → not-found screen,
      `https://<suspended-slug>.laaec.com` → refusal screen.

## 7. Limitations if hosting lacks wildcard support

If the platform cannot attach `*.laaec.com` (no wildcard DNS, no wildcard cert,
or no host-based routing), the generated slug is still valid but cannot appear
as a subdomain. Alternatives, in order of preference:

1. **Subpath per school** — `laaec.com/<slug>/`. Requires changing Vite `base`
   and router history base *per deployment*, which conflicts with "one build."
   Workable only if the build becomes base-parameterised at request time.
2. **Query/header tenant** — `laaec.com/?school=<slug>`. Builds fine as one
   static bundle but is explicitly what the specification rejects: tenant
   identity in the URL query is client-controlled and must never be trusted for
   isolation (§4). Acceptable only for cosmetic preview, never for security.
3. **Separate domains per school** — abandons the wildcard model; each domain
   is a DNS + cert change, i.e. approaching per-school provisioning.

The migration path is clean regardless: `slug` remains the **internal tenant key**
in the database in every option above. Only how the label is exposed in the URL
changes, so the frontend's `resolveTenant` is the only piece that varies between
shapes.

## 8. Local development (no wildcards)

`localhost` has no subdomain, so tenant resolution is exercised with the review
parameter documented in `README.md`:

```
http://localhost:5173/?tenant=st-finbarrs-college     → branded school portal
http://localhost:5173/?tenant=does-not-exist          → "School not found"
http://localhost:5173/?tenant=<a-suspended-school>    → refusal screen
http://localhost:5173/                                → platform (unchanged)
```

`?tenant=` is read from the query only and never persisted, so it cannot stick
to a session. It must be **ignored or rejected in production**, where the `Host`
header is the sole tenant source.
