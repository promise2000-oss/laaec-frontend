/**
 * portals.ts — the seven doors of the LAEC CBT portal, in one place.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `/` listed four portals, but three of them pointed at the same `/control/`
 * page: "Sign in as invigilator", "Sign in as marker" and "Sign in as officer"
 * were three labels on one door. Anyone who picked one discovered, only after
 * authenticating, that the portal they had chosen did not exist.
 *
 * This module is the single source of truth for which doors there are, what
 * each is called, which role it accepts and where a successful login lands. It
 * is imported by all three places that must agree:
 *
 *   - `src/views/HomeView.vue`      — the portal cards on the landing page
 *   - `src/views/ControlView.vue`   — the heading, and the wrong-role refusal
 *   - `src/router/index.ts`         — the routes that serve them
 *
 * A door added here and nowhere else would be a card that 404s; a door added
 * to a route and not here would be a page nobody can reach.
 *
 * RELATIONSHIP TO `/control/`
 * -------------------------
 * `/control/` is a transcribed origin document (PRD §4.4) and is left exactly
 * as it was: a role-agnostic staff gate that accepts any of the six claims and
 * dispatches on the result. The six doors below are the role-specific
 * equivalents, added alongside it rather than in place of it, so the origin
 * page stays auditable. It remains reachable and continues to work.
 *
 * ROLE SCOPING
 * ------------
 * A staff door names one `AdminRole`. A session whose claim is a different role
 * is refused at that door and told which door it belongs to, rather than being
 * logged in somewhere the operator did not choose. `SUPER_ADMIN` is the one
 * claim every console already exempts from permission checks (see
 * `bypassesPermissions`), but it is still scoped to its own door here: the
 * point of these pages is that each one is unambiguous about who it is for.
 */

import type { AdminRole } from '../types';

/** A door into the portal. */
export interface Portal {
  /** URL segment, e.g. `school`. `null` for the candidate door, which is `/login/`. */
  readonly slug: string | null;
  /** Where the door lives. */
  readonly path: string;
  /** The single claim this door accepts; `null` for candidates, who are not staff. */
  readonly role: AdminRole | null;
  /** The role as a person would name it, e.g. "School Administrator". */
  readonly roleLabel: string;
  /** Card heading on the landing page, e.g. "School administration". */
  readonly title: string;
  /** Card copy on the landing page. */
  readonly text: string;
  /** The card's call to action, e.g. "Sign in as school admin". */
  readonly cta: string;
  /** The `<h2>` on this door's own login page. */
  readonly loginHeading: string;
  /** The line under the heading on this door's login page. */
  readonly loginSubheading: string;
  /** Where a successful staff login lands. `null` for candidates: they go to `/exam/`. */
  readonly consolePath: string | null;
}

/**
 * The candidate door. It is the origin's own `/login/` page, transcribed
 * verbatim (PRD §4.3) — registration number plus a subject, then `/exam/`. It
 * is listed here so the landing page can present all seven doors together, but
 * it has no role claim and no variant, because the origin page needs none.
 */
export const CANDIDATE_PORTAL: Portal = {
  slug: null,
  path: '/login/',
  role: null,
  roleLabel: 'Candidate',
  title: 'Candidate portal',
  text: 'Check your schedule, sit scheduled sessions, submit answers and view released results.',
  cta: 'Sign in as candidate',
  loginHeading: 'CANDIDATE PORTAL',
  loginSubheading: 'Lagos Archdiocesan Education Commission',
  consolePath: null,
};

/**
 * The six staff doors, in the order the landing page shows them — the person
 * who most needs the portal first, the platform owner last.
 */
export const STAFF_PORTALS: readonly Portal[] = [
  {
    slug: 'school',
    path: '/login/school/',
    role: 'SCHOOL_ADMIN',
    roleLabel: 'School Administrator',
    title: 'School administration',
    text: 'Register candidates, schedule sessions, supervise your centre and publish school results.',
    cta: 'Sign in as school admin',
    loginHeading: 'SCHOOL ADMIN PORTAL',
    loginSubheading: 'Registration, examinations and school results',
    consolePath: '/ca/',
  },
  {
    slug: 'ict',
    path: '/login/ict/',
    role: 'ICT_ADMIN',
    roleLabel: 'ICT Administrator',
    title: 'ICT administration',
    text: 'Own device readiness, portal configuration, access provisioning and system health.',
    cta: 'Sign in as ICT admin',
    loginHeading: 'ICT ADMIN PORTAL',
    loginSubheading: 'Infrastructure, configuration and access',
    consolePath: '/ict/',
  },
  {
    slug: 'committee',
    path: '/login/committee/',
    role: 'EXAM_COMMITTEE',
    roleLabel: 'Examination Committee',
    title: 'Examination committee',
    text: 'Set papers and grade boundaries, mark and moderate scripts, and archive each session.',
    cta: 'Sign in as examiner',
    loginHeading: 'EXAM COMMITTEE PORTAL',
    loginSubheading: 'Papers, marking and moderation',
    consolePath: '/comm/',
  },
  {
    slug: 'teacher',
    path: '/login/teacher/',
    role: 'TEACHER',
    roleLabel: 'Teacher',
    title: 'Teacher portal',
    text: 'Compose question papers, submit them for review, and follow the decision on each one.',
    cta: 'Sign in as teacher',
    loginHeading: 'TEACHER PORTAL',
    loginSubheading: 'Question authoring and review decisions',
    consolePath: '/teacher/',
  },
  {
    slug: 'central',
    path: '/login/central/',
    role: 'CENTRAL_ADMIN',
    roleLabel: 'Central Administrator',
    title: 'Central office',
    text: 'Onboard staff across every school, decide the review queue, and oversee the archdiocese.',
    cta: 'Sign in as central admin',
    loginHeading: 'CENTRAL ADMIN PORTAL',
    loginSubheading: 'Staff onboarding and content governance',
    consolePath: '/central/',
  },
  {
    slug: 'super',
    path: '/login/super/',
    role: 'SUPER_ADMIN',
    roleLabel: 'Super Administrator',
    title: 'Platform owner',
    text: 'Full access to every console, every school and the platform configuration itself.',
    cta: 'Sign in as super admin',
    loginHeading: 'SUPER ADMIN PORTAL',
    loginSubheading: 'Full platform access',
    consolePath: '/admin/',
  },
];

/** All seven doors, candidates first. The landing page renders these in order. */
export const PORTALS: readonly Portal[] = [CANDIDATE_PORTAL, ...STAFF_PORTALS];

/** The six staff doors that have a role-scoped login page of their own. */
export const ROLE_PORTALS: readonly Portal[] = STAFF_PORTALS;

/** The staff door that accepts `role`, or `undefined` if there is none. */
export function portalForRole(role: string | undefined | null): Portal | undefined {
  const value = String(role || '').trim().toUpperCase();
  return STAFF_PORTALS.find((p) => p.role === value);
}

/** The door served at `path`, or `undefined`. Used by the router's guard. */
export function portalForPath(path: string): Portal | undefined {
  return PORTALS.find((p) => p.path === path);
}
