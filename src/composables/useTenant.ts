/**
 * useTenant — resolves the current request's tenant and applies its branding
 * (multi-school spec §4 tenant identification, §5 school branding).
 *
 * WHY THIS LIVES IN ONE COMPOSABLE
 * --------------------------------
 * Every HTML entry shares `main.ts` → `App.vue`, so resolving here once covers
 * all eighteen pages rather than each entry re-deriving the hostname.
 *
 * THE TWO PATHS
 * -------------
 *  1. PLATFORM (no subdomain, no preview): resolves SYNCHRONOUSLY to
 *     `'platform'` before the first render. `App.vue` then paints
 *     `<router-view />` exactly as it did before this file existed — zero
 *     added latency, zero behaviour change on the deployment people use today.
 *  2. TENANT (a subdomain like `greenfield.laaec.com`, or a local `?tenant=`
 *     preview): resolves ASYNCHRONOUSLY against the registry. While it runs,
 *     `kind` is `'pending'`; then it lands on `'school'` (branding applied),
 *     `'blocked'` (inactive/suspended → the refusal screen) or `'unknown'`
 *     (no such school → the not-found screen).
 *
 * THE `?tenant=` PREVIEW
 * ----------------------
 * A generated subdomain is not reachable until wildcard DNS + server routing
 * exist (spec §8 — documented, not assumed). So for local development and for
 * reviewing the tenant screens before that infrastructure lands, appending
 * `?tenant=<slug>` to any URL simulates visiting `<slug>.laaec.com`. It is a
 * REVIEW AID, not the production mechanism: on a real deployment the hostname
 * alone identifies the tenant and the parameter is unnecessary. It is read from
 * the query string only (never persisted), so it cannot stick to a session and
 * trap a reviewer on an error screen.
 *
 * PURE RESOLUTION, IMPURE BRANDING
 * --------------------------------
 * The hostname→school rules live in `lib/tenant.ts` (pure, liftable to a
 * server). This module is the browser-side runner: it fetches the registry and
 * writes CSS custom properties. Moving enforcement server-side later means
 * replacing THIS file's fetch with a server lookup — the rules do not change.
 */
import { ref, type Ref } from 'vue';
import { callApi } from '../api';
import { PLATFORM_BASE_DOMAIN, extractSubdomain, resolveTenant, schoolPortalUrl } from '../lib/tenant';
import type { SchoolRecord } from '../types';

/** The five states a request can be in while its tenant is determined. */
export type TenantKind = 'pending' | 'platform' | 'school' | 'unknown' | 'blocked';

/** Why a resolved school cannot serve the portal. */
export type TenantBlockReason = 'INACTIVE' | 'SUSPENDED';

const kind = ref<TenantKind>('pending');
const school = ref<SchoolRecord | null>(null);
const slug = ref('');
const reason = ref<TenantBlockReason | null>(null);
const resolved = ref(false);

let started = false;

/** The query parameter that previews a tenant locally (see file header). */
const PREVIEW_PARAM = 'tenant';

const previewSlug = (): string | null => {
  try {
    return new URLSearchParams(window.location.search).get(PREVIEW_PARAM);
  } catch {
    return null;
  }
};

/**
 * Apply a school's branding as CSS custom properties and the document title.
 *
 * The variables (`--school-primary`, `--school-secondary`, `--school-logo`,
 * `--school-name`) are the hooks a branded portal view reads, so identity is
 * applied in ONE place rather than every component importing the school. Only
 * fields the school actually configured are written, so a school with no
 * branding falls back to the platform defaults already in the stylesheet —
 * exactly the spec §5 rule that missing branding must not render empty
 * controls.
 */
const applyBranding = (s: SchoolRecord): void => {
  const root = document.documentElement;
  const b = s.branding || {};
  root.style.setProperty('--school-name', s.Name);
  if (b.primaryColor) root.style.setProperty('--school-primary', b.primaryColor);
  if (b.secondaryColor) root.style.setProperty('--school-secondary', b.secondaryColor);
  if (b.logoUrl) root.style.setProperty('--school-logo', `url("${b.logoUrl}")`);
  document.title = `${s.Name} — LAAEC`;
};

const start = (): void => {
  if (started) return;
  started = true;

  const subdomain = extractSubdomain(window.location.hostname);
  const preview = previewSlug();

  /* ── path 1: the platform — resolve synchronously, no fetch ─────────── */
  if (!subdomain && !preview) {
    kind.value = 'platform';
    resolved.value = true;
    return;
  }

  /* ── path 2: a tenant is indicated — resolve against the registry ───── */
  const target = preview || subdomain || '';
  slug.value = target;
  kind.value = 'pending';

  void (async () => {
    try {
      const data = await callApi('GET_SCHOOLS', { schoolID: 'ALL' });
      const schools = data.status === 'success' ? data.schools : [];
      /*
       * Rebuild the hostname the request WOULD carry on a real deployment so
       * `resolveTenant` exercises the identical extract-subdomain → find →
       * check-status chain whether the target came from an actual subdomain or
       * from the `?tenant=` preview.
       */
      const resolution = resolveTenant(`${target}.${PLATFORM_BASE_DOMAIN}`, schools);
      if (resolution.kind === 'school') {
        kind.value = 'school';
        school.value = resolution.school;
        applyBranding(resolution.school);
      } else if (resolution.kind === 'blocked') {
        kind.value = 'blocked';
        school.value = resolution.school;
        reason.value = resolution.reason;
      } else {
        kind.value = 'unknown';
      }
    } catch {
      /* A registry that cannot load cannot vouch for a school, so fail closed
         to the not-found screen rather than serve an unverified tenant. */
      kind.value = 'unknown';
    } finally {
      resolved.value = true;
    }
  })();
};

/** The reactive tenant state shared by the whole app. */
export interface TenantState {
  kind: Ref<TenantKind>;
  school: Ref<SchoolRecord | null>;
  slug: Ref<string>;
  reason: Ref<TenantBlockReason | null>;
  resolved: Ref<boolean>;
  /** The full portal URL for a resolved school. */
  schoolUrlOf: (s: SchoolRecord) => string;
}

/** Resolve the tenant once for the app and expose it reactively. */
export function useTenant(): TenantState {
  start();
  return {
    kind,
    school,
    slug,
    reason,
    resolved,
    schoolUrlOf: (s: SchoolRecord) => schoolPortalUrl(s.slug),
  };
}
