<script setup lang="ts">
/**
 * `/` — the LAEC CBT portal gateway.
 *
 * PRD §4.1 — `/` Portal Gateway.
 *
 * STRUCTURE
 * ---------
 * Rebuilt to the NICEGENE DAILYAPP marketing design (live reference captured
 * 2026-10-02): sticky brand bar, hero over a crossfading campus image, then the
 * module grid, a four-step "how it works" band, the portal grid, a contact
 * block and a footer bar.
 *
 * CONTENT
 * -------
 * LAEC throughout. The reference's copy describes Our Lady of Apostle Secondary
 * School's own modules, staff, parents and campus; none of that is true of the
 * Lagos Archdiocesan Education Commission, so every string below is Laaec's:
 * candidates, invigilators, markers, examination centres and schools of the
 * archdiocese. What is *kept* from the reference is the outline — twelve
 * modules, four steps, a portal per role, three contact rows — because the
 * outline is the UI.
 *
 * DESTINATIONS
 * ------------
 * Every door is a real login page for exactly one audience, and the list comes
 * from `src/lib/portals.ts` rather than being written here, so a card can never
 * point somewhere that does not exist or at a page that accepts a different
 * role. `CANDIDATE_PORTAL` is the origin's own `/login/`; the six staff doors
 * are `/login/<role>/`, each of which refuses an account from any other door
 * and names the right one. The role-agnostic `/control/` gate also still works.
 *
 * STYLES
 * ------
 * `src/styles/landing.css`, imported here rather than in `PublicLayout.vue` so
 * the tokens load only on this route, matching the per-route scoping decision.
 * `glass.css` still supplies this page's <body> reset.
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { CANDIDATE_PORTAL, PORTALS } from '../lib/portals';
import '../styles/landing.css';

const currentYear = new Date().getFullYear();

/**
 * The candidate door, where an unauthenticated visitor belongs by default, and
 * what the header's "Sign in" opens.
 */
const loginHref = CANDIDATE_PORTAL.path;

/** Where the two hero/contact calls to action go. */
const portalsHref = '#portals';

/** Header anchors, in the reference's order. */
const navLinks: { label: string; href: string }[] = [
  { label: 'Modules', href: '#modules' },
  { label: 'How it works', href: '#how' },
  { label: 'Portals', href: '#portals' },
  { label: 'Contact', href: '#contact' },
];

/** The seven doors, as cards. */
const portals = PORTALS;

/**
 * Cells that complete the last row of the portal grid.
 *
 * The design draws the grid's outer edges from the cells themselves — the
 * container carries `border-top`/`border-left` and every cell carries
 * `border-right`/`border-bottom` — which is what gives it the single-hairline
 * table look. A short row therefore has nothing to draw its bottom edge, and
 * the outline visibly stops mid-grid rather than reading as a deliberate
 * shape. These are those cells: borders and fill, no content.
 *
 * The grid has two multi-column states (2 at `sm`, 4 at `lg`) and a single
 * column below that, so the shortfall differs per state and the two groups are
 * emitted separately — one per state — and shown only at that breakpoint. With
 * 7 doors the shortfall is 1 in both, and 0 in a single column.
 */
const GRID_COLUMNS = { sm: 2, lg: 4 } as const;
const shortfall = (columns: number): number => PORTALS.length % columns;
const fillersSm = shortfall(GRID_COLUMNS.sm);
const fillersLg = shortfall(GRID_COLUMNS.lg);

/**
 * The twelve modules. The reference lists twelve school-department modules in
 * a 4×3 grid; these are the LAEC equivalents, same count, same grid.
 */
const modules: { title: string; text: string }[] = [
  {
    title: 'Dashboards & analytics',
    text: 'Every role lands on a tailored dashboard with live overviews of the day and session.',
  },
  {
    title: 'Users, roles & permissions',
    text: 'Manage officers and fine-grained permissions so access always matches responsibility.',
  },
  {
    title: 'Candidates & guardians',
    text: 'Registration records, biometric capture and guardian contacts for every candidate.',
  },
  {
    title: 'Schools & centres',
    text: 'Every Catholic secondary school and examination centre in the archdiocese, in one register.',
  },
  {
    title: 'Exams & scheduling',
    text: 'Sessions, subjects, seats and time bounds scheduled from a single timetable.',
  },
  {
    title: 'Candidate portal',
    text: 'Sit a scheduled CBT session, autosave every answer and submit from any device.',
  },
  {
    title: 'Results management',
    text: 'Upload windows, entry, moderation, grade boundaries and printable transcripts.',
  },
  {
    title: 'Communications',
    text: 'Notice boards, events, messaging and notifications keep every stakeholder informed.',
  },
  {
    title: 'Invigilation & reporting',
    text: 'Live attendance, incident and status reporting for supervisors on the day.',
  },
  {
    title: 'Question banks',
    text: 'Versioned, tagged and mapped banks, ready for paper assembly and moderation.',
  },
  {
    title: 'Marking & moderation',
    text: 'Objective scoring, free-text marking and moderation with a full audit trail.',
  },
  {
    title: 'Security & audit',
    text: 'Role-based permissions, session lockdown and tamper-evident activity logs.',
  },
];

/** The four steps of the setup-to-examination-day path. */
const steps: { number: string; title: string; text: string }[] = [
  {
    number: '1',
    title: 'Set up',
    text: 'Configure the archdiocese, its schools, examination centres, subjects, officers and staff profiles.',
  },
  {
    number: '2',
    title: 'Create users & roles',
    text: 'Invite candidates, invigilators, markers and staff into role-based portals with the right permissions.',
  },
  {
    number: '3',
    title: 'Run daily operations',
    text: 'Officers register candidates, invigilators run sessions, markers grade scripts and admins publish results.',
  },
  {
    number: '4',
    title: 'Report & optimise',
    text: 'Run reports every term, review results and keep every stakeholder aligned through the dashboards.',
  },
];

/**
 * Hero background frames.
 *
 * The reference crossfades two photographs of its own campus. This portal has
 * no campus photography and none was commissioned, so the hero reuses a
 * photograph the project already ships — the one behind /login/ — and pairs it
 * with itself at a different `object-position`. Two frames on the reference's
 * 4.2s cadence keep the crossfade; what reads as motion is a slow drift across
 * the frame rather than a change of scene.
 *
 * The photograph this page used to inherit from `glass.css` (the classroom
 * image, `photo-1523240798132-875721a3afc3`) now 404s upstream — it had been
 * removed from Unsplash, so the old body background was painting nothing. The
 * login photograph is the nearest surviving image the project already loads.
 *
 * `frames[i].position` is bound to `object-position` below.
 */
const heroImage =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80';

const heroFrames: { src: string; position: string }[] = [
  { src: heroImage, position: '50% 50%' },
  { src: heroImage, position: '68% 50%' },
];

/** Crossfade cadence, in ms — the reference's 4200. */
const HERO_INTERVAL = 4200;

const heroIndex = ref(0);
let heroTimer: ReturnType<typeof setInterval> | undefined;

/**
 * True once the photograph is known to be reachable. The frames stay unpainted
 * until then, so a dead or blocked remote URL falls back to the hero's own ink
 * field instead of parking a broken-image glyph across it.
 *
 * Readiness is measured with a detached `Image` probe rather than the rendered
 * elements' `load` events. Both frames are cached by the time the component
 * mounts, so their events can fire before Vue has attached a listener, and a
 * completeness check in `onMounted` is then too early to see them. The probe
 * starts the fetch at mount and settles on the same cached resource, so its
 * event always arrives. `markHeroLoaded` is also wired to each frame's `load`
 * and `error`, and either outcome is enough to stop waiting.
 */
const heroLoaded = ref(false);

const markHeroLoaded = () => {
  heroLoaded.value = true;
};

onMounted(() => {
  const probe = new Image();
  probe.addEventListener('load', markHeroLoaded, { once: true });
  probe.addEventListener('error', markHeroLoaded, { once: true });
  probe.src = heroImage;

  heroTimer = setInterval(() => {
    heroIndex.value = (heroIndex.value + 1) % heroFrames.length;
  }, HERO_INTERVAL);
});

onUnmounted(() => {
  if (heroTimer) clearInterval(heroTimer);
});

/** `aria-expanded` on the menu button, and what closes it on navigation. */
const menuOpen = ref(false);
</script>

<template>
  <header class="landing-header">
    <nav class="landing-header-bar">
      <a class="landing-brand" href="#">
        <img
          class="landing-brand-mark"
          src="/laec-crest.png"
          width="80"
          height="80"
          alt="Lagos Archdiocesan Education Commission crest"
          decoding="async"
        />
        <span class="landing-brand-text">
          <span class="landing-brand-title">LAGOS ARCHDIOCESAN EDUCATION COMMISSION</span>
          <span class="landing-brand-sub">LAEC CBT PORTAL</span>
        </span>
      </a>

      <div class="landing-header-end">
        <div class="landing-header-links">
          <a
            v-for="link in navLinks"
            :key="link.href"
            class="landing-header-link"
            :href="link.href"
          >
            {{ link.label }}
          </a>
        </div>
        <a class="landing-header-signin" :href="loginHref">Sign in</a>
      </div>

      <button
        type="button"
        class="landing-menu-toggle"
        aria-label="Toggle navigation menu"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <svg
          v-if="!menuOpen"
          class="landing-menu-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5h16" />
          <path d="M4 12h16" />
          <path d="M4 19h16" />
        </svg>
        <svg
          v-else
          class="landing-menu-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </nav>

    <div v-if="menuOpen" class="landing-mobile-menu">
      <div class="landing-mobile-links">
        <a
          v-for="link in navLinks"
          :key="link.href"
          class="landing-mobile-link"
          :href="link.href"
          @click="menuOpen = false"
        >
          {{ link.label }}
        </a>
        <a class="landing-header-signin" :href="loginHref" @click="menuOpen = false">
          Sign in
        </a>
      </div>
    </div>
  </header>

  <main>
    <section class="landing-hero">
      <div
        class="landing-hero-media"
        aria-hidden="true"
        :data-loaded="heroLoaded ? '' : undefined"
      >
        <img
          v-for="(frame, i) in heroFrames"
          :key="frame.src + i"
          class="landing-hero-frame"
          :class="{ 'landing-hero-frame--visible': i === heroIndex }"
          :src="frame.src"
          :style="{ objectPosition: frame.position }"
          :loading="i === 0 ? 'eager' : 'lazy'"
          :on-load="markHeroLoaded"
          :on-error="markHeroLoaded"
          alt=""
          decoding="async"
        />
        <div class="landing-hero-scrim-x"></div>
        <div class="landing-hero-scrim-y"></div>
      </div>

      <div class="landing-hero-content">
        <div class="landing-hero-fade">
          <h1 class="landing-hero-title">
            Every exam<br />
            <span class="landing-hero-title-sub">in one secure place.</span>
          </h1>
          <p class="landing-hero-lead">
            LAEC CBT PORTAL unifies candidate registration, exam scheduling, live
            invigilation, script marking and result processing into one cohesive
            cloud workspace&mdash;replacing fragmented spreadsheets and
            disconnected tools with a single, real-time examination dashboard.
          </p>
          <div class="landing-hero-actions">
            <a class="landing-btn landing-btn-primary" :href="portalsHref">
              Sign in to your portal
            </a>
            <a class="landing-btn landing-btn-secondary" href="#modules">
              Explore the modules
            </a>
          </div>
          <p class="landing-hero-note">
            Serving the Catholic Archdiocese of Lagos &mdash; candidates,
            invigilators, markers and officers each get a portal scoped to
            exactly what they need to see.
          </p>
        </div>
      </div>
    </section>

    <section id="modules" class="landing-section landing-section--paper">
      <div class="landing-section-inner">
        <div class="landing-section-head">
          <h2 class="landing-section-title">A module for every role</h2>
        </div>
        <div class="landing-card-grid">
          <div v-for="mod in modules" :key="mod.title" class="landing-card">
            <h3 class="landing-card-title">{{ mod.title }}</h3>
            <p class="landing-card-text">{{ mod.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <section
      id="how"
      class="landing-section landing-section--ink landing-grid-texture"
    >
      <div class="landing-section-inner">
        <div class="landing-section-head landing-how-head landing-section-head--ink">
          <p class="landing-section-lead">A guided path from setup to examination day.</p>
        </div>
        <div class="landing-step-grid">
          <div v-for="step in steps" :key="step.number" class="landing-step">
            <span class="landing-step-number">{{ step.number }}</span>
            <h3 class="landing-step-title">{{ step.title }}</h3>
            <p class="landing-step-text">{{ step.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <section id="portals" class="landing-section landing-section--paper">
      <div class="landing-section-inner">
        <div class="landing-section-head">
          <h2 class="landing-section-title">One system, every role</h2>
          <p class="landing-section-lead landing-section-lead--paper landing-section-lead--right">
            Seven doors, one portal each. Every account signs in at the page built
            for its role and lands in the console it actually owns.
          </p>
        </div>
        <div class="landing-card-grid">
          <div v-for="portal in portals" :key="portal.path" class="landing-card landing-card--portal">
            <h3 class="landing-card-title">{{ portal.title }}</h3>
            <p class="landing-card-text">{{ portal.text }}</p>
            <a class="landing-card-link" :href="portal.path">{{ portal.cta }}</a>
          </div>
          <div
            v-for="n in fillersSm"
            :key="'filler-sm-' + n"
            class="landing-card-filler landing-card-filler--sm"
            aria-hidden="true"
          ></div>
          <div
            v-for="n in fillersLg"
            :key="'filler-lg-' + n"
            class="landing-card-filler landing-card-filler--lg"
            aria-hidden="true"
          ></div>
        </div>
      </div>
    </section>

    <section id="contact" class="landing-section landing-section--ink">
      <div class="landing-section-inner">
        <div class="landing-contact-grid">
          <div>
            <h2 class="landing-contact-name">LAEC</h2>
            <p class="landing-contact-text">
              The education commission of the Catholic Archdiocese of Lagos,
              committed to secure, standardised and technology-enabled academic
              assessment for every candidate in every school.
            </p>
          </div>
          <div class="landing-contact-list">
            <div class="landing-contact-item">
              <span class="landing-contact-label">Based in</span>
              <span class="landing-contact-value">Catholic Archdiocese of Lagos, Nigeria</span>
            </div>
            <div class="landing-contact-item">
              <span class="landing-contact-label">Call us</span>
              <span class="landing-contact-value">Through your examination centre</span>
            </div>
            <div class="landing-contact-item">
              <span class="landing-contact-label">Email us</span>
              <span class="landing-contact-value">info@nicegeneco.com.ng</span>
            </div>
          </div>
        </div>
        <div class="landing-contact-cta">
          <a class="landing-btn landing-btn-primary" :href="portalsHref">
            Sign in to your portal
          </a>
        </div>
      </div>
    </section>

    <footer class="landing-footer">
      <div class="landing-footer-inner">
        <div class="landing-footer-row">
          <p>
            &copy; {{ currentYear }} NICEGENE TECHNOLOGIES. All rights reserved.
            Optimized for secure, large-scale educational assessments.
          </p>
          <a class="landing-footer-link" href="mailto:info@nicegeneco.com.ng">
            info@nicegeneco.com.ng
          </a>
        </div>
      </div>
    </footer>
  </main>

  <!-- PRD §4.1 item 3 — the 1×1 beacon iframe, no src, no identifier. Its
       Cloudflare injector script is omitted (DEV-1); the frame itself is a
       listed block and is rendered statically. -->
  <iframe
    height="1"
    width="1"
    style="position: absolute; top: 0; left: 0; border: none; visibility: hidden"
  ></iframe>
</template>
