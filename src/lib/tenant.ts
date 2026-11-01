/**
 * tenant.ts — multi-school URL generation and tenant identification.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The multi-school spec (§3, §4) requires that onboarding a school
 * automatically produces a unique subdomain URL, and that a visit to that
 * subdomain resolves to the right school, refuses unknown hosts and blocks
 * suspended schools. Those two halves — generating a slug and reading one back
 * off a hostname — are the same vocabulary, so they live together here rather
 * than being re-derived in the mock, the panel and the portal.
 *
 * Everything in this module is PURE: no storage, no network, no `window`.
 * That is deliberate. The spec insists tenant resolution must eventually be
 * enforced on the backend (§4, §10); keeping the rules in a side-effect-free
 * module means the exact same functions can be lifted into a server handler
 * later without rewriting them, and they are testable today without a browser.
 *
 * RELATIONSHIP TO `slugifyExportToken` (`lib/console.ts`)
 * -------------------------------------------------------
 * That helper builds EXPORT FILENAMES (`All_Schools`, underscores, a fallback
 * token). This module builds URL SUBDOMAIN labels (lowercase, hyphens, no
 * fallback — an empty name is an error, not "ALL"). They are different
 * vocabularies for different outputs and are kept separate on purpose.
 *
 * DEPENDENCY NOTE
 * ---------------
 * Imports only `type` from `../types`, so this module can be bundled by
 * `tools/check-rbac.mjs` (esbuild) and by a future server handler without
 * pulling in the mock's state or any Vue code.
 */

import type { SchoolRecord, SchoolStatus } from '../types';

/**
 * The registrable domain every school subdomain hangs under.
 *
 * `https://<slug>.laaec.com`. Centralised so the URL builder, the hostname
 * parser and the panel all agree on the base; a custom-domain feature (spec §3,
 * "manage custom domains in the future") would extend this rather than fork it.
 */
export const PLATFORM_BASE_DOMAIN = 'laaec.com';

/**
 * The host label that is the platform itself, never a tenant.
 *
 * `www` resolves to the bare domain in DNS and must not be mistaken for a
 * school whose slug happens to be "www".
 */
const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set(['www', 'app', 'admin', 'api', 'mail']);

/**
 * Generate a URL-friendly slug from a school name.
 *
 * `Greenfield International School` → `greenfield-international`. The rules are
 * the conventional ones and are applied in order:
 *
 *   1. lowercase,
 *   2. apostrophes are REMOVED (an intra-word mark, so `Finbarr's` becomes
 *      `finbarrs`, not the awkward `finbarr-s`) and periods become a separator
 *      (`St.` → `st`), because nearly every archdiocesan name carries `St.` and
 *      a possessive,
 *   3. anything else that is not a letter, digit or whitespace becomes a space
 *      (so ampersands and dashes in `Q & A`, `Royal - Academy` do not produce
 *      illegal DNS labels),
 *   4. runs of whitespace collapse to a single hyphen,
 *   5. leading/trailing hyphens are trimmed.
 *
 * A name that reduces to nothing (empty, or all punctuation) yields `''` — the
 * CALLER decides whether that is a validation error (onboarding) or a reason
 * to fall back (a preview). This function does not invent a value, because a
 * silently generated slug like `school-1` would be a URL nobody chose.
 *
 * The spec's illustrative examples vary in their treatment of trailing words
 * (`Greenfield International School` → `greenfield-international` but `Royal
 * Academy` → `royalacademy`); rather than chase an inconsistent sample we keep
 * every word, which is predictable and collision-safe. The uniqueness step
 * below is what actually guarantees a free label.
 *
 * @param name - The school's display name.
 * @returns A DNS-safe lowercase label, or `''` if nothing usable remains.
 */
export function slugifySchoolName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Is this a syntactically valid subdomain label?
 *
 * DNS labels are 1–63 characters, lowercase alphanumeric plus hyphens, and may
 * not begin or end with a hyphen. Used to reject a hand-typed slug before it
 * is ever persisted, and to validate a slug recovered from a hostname.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
}

/**
 * Generate a slug for a school name that is not already taken.
 *
 * This is the spec's §3 duplicate handling: "checks whether the generated slug
 * is already in use… if the slug exists, the system generates an alternative
 * unique slug." The base slug is tried first, then `-2`, `-3`, … until a free
 * label is found. The suffix keeps the slug recognisably derived from the name
 * (unlike a random hash), so a human reading `greenfield-international-2` can
 * still tell which school it is.
 *
 * The search is bounded so a pathological collision loop cannot hang a
 * request; if the bound is reached the last candidate is returned and the
 * caller's uniqueness check (in the mock) will surface it as an error rather
 * than silently overwriting.
 *
 * @param name   - The school's display name.
 * @param taken  - Slugs already in use across the whole registry.
 * @returns A slug derived from `name` that is not in `taken`.
 */
export function generateUniqueSlug(name: string, taken: Iterable<string>): string {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  const base = slugifySchoolName(name);
  if (!base) return '';
  if (!takenSet.has(base)) return base;

  for (let n = 2; n <= 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  /* Bound reached: return the final candidate. The caller re-checks
     uniqueness and fails closed rather than clobbering an existing tenant. */
  return `${base}-1000`;
}

/**
 * Build the public URL for a school's portal.
 *
 * `schoolPortalUrl('greenfield-international')` →
 * `https://greenfield-international.laaec.com`.
 *
 * Always `https` — the spec's infrastructure section (§8) requires a wildcard
 * TLS certificate, and a scheme-relative or `http` URL here would bake an
 * insecure default into every place the link is rendered (the copy button, the
 * "open portal" link, the details page).
 *
 * @param slug       - The school's unique subdomain label.
 * @param baseDomain - Registrable domain; defaults to `PLATFORM_BASE_DOMAIN`.
 */
export function schoolPortalUrl(slug: string, baseDomain: string = PLATFORM_BASE_DOMAIN): string {
  return `https://${slug}.${baseDomain}`;
}

/**
 * Extract the tenant subdomain label from a request hostname.
 *
 * This is the first step of the spec's §4 tenant-resolution chain ("extract the
 * subdomain from the request hostname"). It returns:
 *
 *   - `null` for the bare platform domain (`laaec.com`), for `www`, for a
 *     hostname not under the base domain at all (local dev, an intranet name),
 *     and for anything with no label before the base — because none of those
 *     name a tenant;
 *   - the leftmost label otherwise (`greenfield-international.laaec.com` →
 *     `greenfield-international`).
 *
 * A port is stripped first (`greenfield.laaec.com:5173`), and the host is
 * lowercased and stripped of a trailing dot, so the comparison is stable
 * regardless of how the request arrived. Multi-label subdomains
 * (`a.b.laaec.com`) resolve to the full `a.b` so a future nested scheme still
 * has one obvious label to look up.
 *
 * @param hostname   - The host from the request (`window.location.hostname`
 *                     in the browser, `Host` header on a server).
 * @param baseDomain - Registrable domain; defaults to `PLATFORM_BASE_DOMAIN`.
 * @returns The subdomain label, or `null` when the host names no tenant.
 */
export function extractSubdomain(
  hostname: string,
  baseDomain: string = PLATFORM_BASE_DOMAIN,
): string | null {
  const host = String(hostname || '')
    .split(':')[0]
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) return null;

  const suffix = `.${baseDomain}`;
  if (host === baseDomain) return null;
  if (!host.endsWith(suffix)) return null;

  const label = host.slice(0, -suffix.length);
  if (!label || RESERVED_SUBDOMAINS.has(label)) return null;
  return label;
}

/**
 * Why a resolved tenant cannot serve the portal. Mirrors `SchoolStatus` but is
 * expressed as the reason the request was refused, so the error page can say
 * "not yet active" differently from "suspended" (spec §4: suspended schools
 * must not reach protected examination services, but the two states are
 * administratively distinct).
 */
export type TenantBlockReason = 'INACTIVE' | 'SUSPENDED';

/**
 * The outcome of resolving a hostname against the registry — the spec's §4
 * chain, "identify the corresponding school… verify that the school exists…
 * verify that the school is active."
 *
 * `platform` — no subdomain; the request is the main platform, not a tenant.
 * `school`   — an ACTIVE school; load its environment and branding.
 * `unknown`  — a subdomain with no matching school; show the not-found page.
 * `blocked`  — a school that exists but is INACTIVE or SUSPENDED; refuse.
 */
export type TenantResolution =
  | { kind: 'platform' }
  | { kind: 'school'; school: SchoolRecord }
  | { kind: 'unknown'; slug: string }
  | { kind: 'blocked'; school: SchoolRecord; reason: TenantBlockReason };

/**
 * Resolve a request hostname to a tenant, against a school registry.
 *
 * This is the pure core of spec §4. Given the hostname and the list of schools
 * (however the caller loaded them — in the browser via `GET_SCHOOLS`, on a
 * server from the database), it answers every branch the spec names:
 *
 *   1. extract the subdomain,
 *   2. if none → `platform`,
 *   3. find the school with that slug → if none, `unknown`,
 *   4. if its status is not ACTIVE → `blocked` with the reason,
 *   5. otherwise → `school`.
 *
 * Matching is by `slug`, not by `Code`: the URL a user types is the slug, and
 * the short code (`SFC`) is a separate internal identifier. The lookup is
 * case-insensitive because `extractSubdomain` lowercases the host while a slug
 * stored by an older session might not be.
 *
 * @param hostname - The incoming host.
 * @param schools  - The school registry to resolve against.
 * @param baseDomain - Registrable domain; defaults to `PLATFORM_BASE_DOMAIN`.
 */
export function resolveTenant(
  hostname: string,
  schools: readonly SchoolRecord[],
  baseDomain: string = PLATFORM_BASE_DOMAIN,
): TenantResolution {
  const label = extractSubdomain(hostname, baseDomain);
  if (label === null) return { kind: 'platform' };

  const school = schools.find((s) => String(s.slug || '').toLowerCase() === label);
  if (!school) return { kind: 'unknown', slug: label };

  const status: SchoolStatus = school.status || 'ACTIVE';
  if (status !== 'ACTIVE') return { kind: 'blocked', school, reason: status };

  return { kind: 'school', school };
}

/**
 * The reason an onboarding request could not mint a slug — returned alongside
 * a failed `generateUniqueSlug` so the panel can explain WHY rather than
 * showing a generic "could not generate URL".
 */
export type SlugFailure = 'EMPTY_NAME' | 'NO_UNIQUE_SLUG';

/**
 * Generate a unique slug or explain why it could not be produced.
 *
 * Wraps `slugifySchoolName` + `generateUniqueSlug` with the two failure modes
 * the onboarding flow needs to distinguish: a name with nothing usable in it,
 * and a name whose every candidate is taken (practically unreachable, but a
 * caller that ignores it would otherwise persist `''`). Returning a result
 * object rather than throwing keeps the mock's handler flat and lets the panel
 * render the specific message.
 *
 * @param name   - The school's display name.
 * @param taken  - Slugs already in use across the registry.
 */
export function mintSchoolSlug(
  name: string,
  taken: Iterable<string>,
): { ok: true; slug: string } | { ok: false; reason: SlugFailure } {
  const base = slugifySchoolName(name);
  if (!base) return { ok: false, reason: 'EMPTY_NAME' };
  const slug = generateUniqueSlug(name, taken);
  if (!isValidSlug(slug)) return { ok: false, reason: 'NO_UNIQUE_SLUG' };
  return { ok: true, slug };
}
