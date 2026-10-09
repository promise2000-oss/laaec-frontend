# St Finbarr's Teacher Portal — Discovery, Mapping & Parity

Target system: `https://saintfinbarrscollege.com` — the "NICEGENE DAILYAPP" school
management portal (Next.js 16, React 19, backend `https://api.saintfinbarrscollege.com`).

Implementation target: **this project**, `laaec-audit` (Vue 3 + Vite multi-page CBT portal),
at the single route **`/teacher/`**, as panels in the rail.

## How ground truth was established

The live portal is **fully unauthenticated-read**: every endpoint answers `401`.

```
[INFO]  [api] using backend at https://api.saintfinbarrscollege.com
[ERROR] 401  https://api.saintfinbarrscollege.com/dashboard/stats
[ERROR] 401  https://api.saintfinbarrscollege.com/notifications
[ERROR] 401  https://api.saintfinbarrscollege.com/academic/sessions   (x2)
```

`/login` offers email + password with no demo account. No `.env` exists in any
project. Per the brief's safety rules, authentication was **not** bypassed, so no
teacher credentials were obtained and no authenticated behaviour was observed live.

Ground truth therefore comes from the **deployed application's own source**, which is
present locally at `C:\Users\USER\Documents\saintfinbarrs-frontend` (a Next.js
project whose routes, titles and API base match the live deployment exactly), plus its
in-memory mock backend (`lib/api/mock-data.ts`) for behaviour.

**Consequence, stated plainly:** every observation below is *source-derived*, not
*live-observed*. Items that could not be settled from source are marked `UNKNOWN`
in `features.md`. Nothing here is a guess about runtime behaviour.

## Documents

| File | Contents |
|---|---|
| `routes.md` | All 50 origin routes + the panel mapping chosen for this port |
| `features.md` | Per-module, per-feature inventory (fields, validation, states, copy) |
| `workflows.md` | 14 end-to-end workflows |
| `permissions.md` | Origin permission model, gaps, and the vocabulary added here |
| `api-map.md` | Every origin endpoint, and the LAEC contract action it maps to |
| `data-model.md` | Entities, fields, statuses, relationships |
| `ui-specification.md` | Layout, chrome, tables, forms, states |
| `implementation-map.md` | Feature → local implementation → status → required work |
| `testing.md` | Verification matrix and results |
| `parity-report.md` | Original vs local, per feature |

## Scope decisions (agreed before implementation)

1. **Parity means UI + behaviour over mock.** LAEC's Lambda contract has 38 actions,
   none for lesson plans, leave, counselling or disciplinary. API-level parity with
   LAEC's backend is therefore *impossible* — those endpoints do not exist there.
   The port is UI/behavioural fidelity backed by new mock contract actions.
2. **One route, 17 panels.** The origin uses 50 nested Next.js routes; this portal is
   a flat multi-page app where each role gets one document with panel tabs. Each
   origin module becomes a panel in the `/teacher/` rail.
3. **The existing LAEC author workflow is kept, not replaced.** `My Papers` /
   `Compose` / `Decisions` (exam question authoring) sit alongside the 14 new
   St Finbarr's modules. The teacher rail grows from 5 entries to 19.

## Documents on disk

- `screenshots/` — populated during PHASE 5 verification.