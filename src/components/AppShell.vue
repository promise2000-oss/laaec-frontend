<!--
  AppShell — the one chrome every role renders inside (D-60).

  The six consoles previously each authored their own <header>: a gradient bar
  with a horizontal tab strip. That is what made the portal read as a set of
  unrelated 2020 admin panels. This component replaces all six with a single
  frame: a left rail grouped by domain, and a top bar carrying the breadcrumb,
  the role, the tenant scope and the account menu.

  Two things it deliberately does NOT do:

  - It is not a permission layer. Each role is handed its own nav list, so a
    role only *sees* the sections it owns, but nothing here blocks a route, a
    panel or an action. Authorisation stays the backend's, exactly as D-11
    records for the origin (D-61).
  - It does not own the panels. Each view keeps its own tab state and panel
    markup; the shell emits a selection and the view calls its own showTab().
    That is what lets the 37 existing panels survive a chrome rewrite with
    their verified DOM intact.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { callApi } from '../api';
import { STORAGE_KEYS } from '../types';
import type { NoticeCategory, PortalNotification } from '../types';
import { useAnchoredPopup } from '../lib/useAnchoredPopup';

const ICONS: Record<string, string> = {
  dot: '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><circle cx="8" cy="8" r="3"/></svg>',
  /*
   * `file` and `pen` were added with the St Finbarr's teacher portal (D-72),
   * whose rail needs a document glyph (Lesson Planning, Weekly Report, Class
   * Teacher Report) and an authoring glyph distinct from `book`, which already
   * means "Compose" and "My Papers" here. Same 24-box, 1.7 stroke and 18px
   * scale as every other icon in this map, per the note above.
   */
  file: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3.5V8h4.5"/><path d="M8.5 12.5h7M8.5 16h5"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.9 20 7.4 8.6 18.8l-4.4 1 1-4.4Z"/><path d="m14.2 6.2 3.6 3.6"/></svg>',
  gauge: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m13.4 10.6 4.1-4.1"/><path d="M3.5 18a9 9 0 1 1 17 0"/></svg>',
  users: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.3a3.2 3.2 0 0 1 0 5.4"/><path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.6 1.6 0 0 0-1.6-1.4H4Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.6 1.6 0 0 1 1.6-1.4H20Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 20v-6M12.5 20V9M17 20v-9"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6Z"/><path d="m9 12 2 2 4-4"/></svg>',
  cog: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.5l2 1.2M17.5 15.3l2 1.2M4.5 16.5l2-1.2M17.5 8.7l2-1.2"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 13 6 5.5h12L20.5 13v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z"/><path d="M3.5 13H9a3 3 0 0 0 6 0h5.5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-3.6-3.6"/></svg>',
  /* 18, not 20: the icon scale in this file is 18 for primary/nav icons (every
     rail glyph, the bell), 16 for utility glyphs (collapse, search) and 14 for
     the caret. The menu button sits beside the bell in an identically sized
     32 px square and above a rail drawn at 18, so 20 made it the only icon in
     the chrome that did not belong to the scale. */
  menu: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  caret: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 10 5 5 5-5"/></svg>',
  logout: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5.5V4H5.5v16H14v-1.5"/><path d="M10 12h10M17 9l3 3-3 3"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg>',
};

/** One nav entry. `badge` is a count the view supplies; it is never computed here. */
interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  /**
   * Set when the entry is its own document rather than a panel of this console
   * (D-71). `/calendar/` and `/notices/` exist as routes, so clicking them
   * navigates; without this the shell would set a tab id no panel matches and
   * blank the content area.
   */
  route?: string;
  permission?: string;
}

/** A named group of entries. Groups render in order, with a heading when set. */
interface NavGroup {
  title: string;
  items: NavItem[];
}

const props = withDefaults(
  defineProps<{
    role: string;
    roleLabel: string;
    scope: string;
    scopeKind: 'global' | 'school';
    breadcrumb: string;
    groups: NavGroup[];
    activeId: string;
    identity?: string;
    searchPlaceholder?: string;
  }>(),
  { identity: '', searchPlaceholder: 'Search' },
);

const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'logout'): void }>();

/* Route-backed rail entries navigate rather than switch panels (D-71). */
const router = useRouter();


/* ── notification centre (D-64) ────────────────────────────────────────────
 * Lives in the shell, not on a page, so the unread count is visible from every
 * console. Filters mirror the categories the contract exposes rather than the
 * reference application's departmental tabs, which have no counterpart in an
 * examination portal.
 */
const CATEGORIES: Array<{ key: NoticeCategory | 'ALL' | 'UNREAD'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'REVIEW', label: 'Review' },
  { key: 'EXAM', label: 'Exams' },
  { key: 'RESULTS', label: 'Results' },
  { key: 'ANNOUNCEMENT', label: 'Notices' },
  { key: 'SECURITY', label: 'Security' },
  { key: 'SYSTEM', label: 'System' },
];

const bellOpen = ref(false);
/* Declared alongside bellOpen rather than down with the other chrome state,
   so both toggles can close each other without a use-before-declaration. */
const accountOpen = ref(false);
const notifications = ref<PortalNotification[]>([]);
const unreadCount = ref(0);
const categoryCounts = ref<Record<string, number>>({});
const activeCategory = ref<NoticeCategory | 'ALL' | 'UNREAD'>('ALL');
const notifLoading = ref(false);

const OPERATOR_USERNAME = localStorage.getItem(STORAGE_KEYS.AdminUsername) || '';
const OPERATOR_ROLE = localStorage.getItem(STORAGE_KEYS.AdminRole) || '';
const OPERATOR_SCHOOL = localStorage.getItem(STORAGE_KEYS.SchoolID) || '';

const visibleNotifications = computed(() => {
  if (activeCategory.value === 'UNREAD') return notifications.value.filter((n) => !n.Read);
  if (activeCategory.value === 'ALL') return notifications.value;
  return notifications.value.filter((n) => n.Category === activeCategory.value);
});

const categoryCount = (key: NoticeCategory | 'ALL' | 'UNREAD'): number => {
  if (key === 'ALL') return notifications.value.length;
  if (key === 'UNREAD') return unreadCount.value;
  return categoryCounts.value[key] || 0;
};

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.round(hours / 24);
  return days < 7 ? days + 'd ago' : new Date(iso).toISOString().slice(0, 10);
};

const loadNotifications = async (): Promise<void> => {
  notifLoading.value = true;
  try {
    const data = await callApi('GET_NOTIFICATIONS', {
      schoolID: OPERATOR_SCHOOL,
      username: OPERATOR_USERNAME,
      role: OPERATOR_ROLE,
    });
    if (data.status !== 'success') throw new Error(data.message || 'read failed');
    notifications.value = data.notifications;
    unreadCount.value = data.unread;
    categoryCounts.value = data.counts || {};
  } catch {
    notifications.value = [];
    unreadCount.value = 0;
  }
  notifLoading.value = false;
};

const toggleBell = (): void => {
  bellOpen.value = !bellOpen.value;
  /* Only one surface may be open at a time: two anchored panels stacked on
     each other is exactly the "popup over a popup" this restructure removes. */
  if (bellOpen.value) accountOpen.value = false;
  if (bellOpen.value) void loadNotifications();
};

const markOneRead = async (item: PortalNotification): Promise<void> => {
  if (item.Read) return;
  item.Read = true;
  unreadCount.value = Math.max(0, unreadCount.value - 1);
  try {
    await callApi('MARK_NOTIFICATION_READ', {
      schoolID: OPERATOR_SCHOOL,
      notificationIds: [item.NotificationID],
    });
  } catch {
    /* the optimistic read stands; the count re-syncs on the next open */
  }
};

const markAllRead = async (): Promise<void> => {
  const data = await callApi('MARK_ALL_NOTIFICATIONS_READ', {
    schoolID: OPERATOR_SCHOOL,
    username: OPERATOR_USERNAME,
    role: OPERATOR_ROLE,
  });
  if (data.status === 'success') await loadNotifications();
};

const followNotification = (item: PortalNotification): void => {
  void markOneRead(item);
  bellOpen.value = false;
  if (item.Link) window.location.href = item.Link;
};

const railCollapsed = ref(false);
const drawerOpen = ref(false);

/* ── anchored popups (D-74) ────────────────────────────────────────────
 * Both panels are teleported to <body> and positioned from their trigger's
 * rect. src/lib/useAnchoredPopup.ts documents why: inside `.app-topbar`
 * they inherit that element's stacking context and cannot outrank page
 * content, and `position: absolute; right: 0` has no answer for a 390 px
 * viewport. */
const bellTrigger = ref<HTMLElement | null>(null);
const bellPanel = ref<HTMLElement | null>(null);
const accountTrigger = ref<HTMLElement | null>(null);
const accountPanel = ref<HTMLElement | null>(null);

const { panelStyle: bellStyle } = useAnchoredPopup({
  open: bellOpen,
  trigger: bellTrigger,
  panel: bellPanel,
  onDismiss: () => {
    bellOpen.value = false;
  },
});

const { panelStyle: accountStyle } = useAnchoredPopup({
  open: accountOpen,
  trigger: accountTrigger,
  panel: accountPanel,
  onDismiss: () => {
    accountOpen.value = false;
  },
});

const toggleAccount = (): void => {
  accountOpen.value = !accountOpen.value;
  if (accountOpen.value) bellOpen.value = false;
};

/* ── responsive behaviour ──────────────────────────────────────────────
 * Above 1200 px the rail shows labels. Between 768 and 1199 it narrows to
 * icons with a tooltip on the title attribute, which is the same breakpoint
 * band the origin's own drawer used. Below 768 it leaves the viewport
 * entirely and is reachable from the top bar.
 */
const WIDE = 1200;
const NARROW = 768;

const mode = ref<'wide' | 'icons' | 'drawer'>('wide');

const applyMode = (): void => {
  const w = window.innerWidth;
  mode.value = w >= WIDE ? 'wide' : w >= NARROW ? 'icons' : 'drawer';
  if (mode.value !== 'drawer') drawerOpen.value = false;
};

const toggleRail = (): void => {
  if (mode.value === 'drawer') drawerOpen.value = !drawerOpen.value;
  else railCollapsed.value = !railCollapsed.value;
};

const select = (item: NavItem): void => {
  /* An entry that is its own document navigates; everything else is a panel
     of this console and is selected in place (D-71). */
  if (item.route) void router.push(item.route);
  else emit('select', item.id);
  if (mode.value === 'drawer') drawerOpen.value = false;
};

const logout = (): void => {
  accountOpen.value = false;
  emit('logout');
};

/* The console pages pad their own content by --header-offset, which they read
 * from a .page-header element this shell replaces. The shell therefore owns the
 * value, and only updates it when the header itself changes size (a zoomed or
 * large-font viewport, or a 390 px layout where the breadcrumb wraps). */
const syncHeaderOffset = (): void => {
  const bar = document.querySelector('.app-topbar');
  if (bar instanceof HTMLElement) {
    document.documentElement.style.setProperty('--header-offset', `${bar.offsetHeight}px`);
  }
};

const activeGroup = computed(() => {
  for (const group of props.groups) {
    if (group.items.some((item) => item.id === props.activeId)) return group.title;
  }
  return '';
});

const activeLabel = computed(() => {
  for (const group of props.groups) {
    for (const item of group.items) if (item.id === props.activeId) return item.label;
  }
  return props.breadcrumb;
});

watch(activeLabel, () => {
  document.title = `${activeLabel.value} · LAEC`;
});

const onKey = (e: KeyboardEvent): void => {
  /* The account menu and bell panel own their own Escape handling in
     useAnchoredPopup (which also returns focus to the trigger); this covers
     the surfaces that are not anchored popups. */
  if (e.key === 'Escape') drawerOpen.value = false;
};

onMounted(() => {
  void loadNotifications();
  applyMode();
  syncHeaderOffset();
  window.addEventListener('resize', applyMode);
  window.addEventListener('resize', syncHeaderOffset);
  window.addEventListener('keydown', onKey);
});

onUnmounted(() => {
  window.removeEventListener('resize', applyMode);
  window.removeEventListener('resize', syncHeaderOffset);
  window.removeEventListener('keydown', onKey);
});

defineExpose({ syncHeaderOffset });
</script>

<template>
  <div class="app-shell" :class="[`mode-${mode}`, { 'rail-collapsed': railCollapsed }]">
    <!-- ── left rail ─────────────────────────────────────────────────── -->
    <div v-if="mode === 'drawer'" v-show="drawerOpen" class="app-scrim" @click="drawerOpen = false"></div>
    <div class="app-rail" :class="{ open: drawerOpen }" role="navigation" aria-label="Sections">
      <!--
        Pinned footer, last child of the rail's flex column. `.rail-nav` is the
        only element that grows and scrolls; everything above and below it is
        `flex: 0 0 auto`, so the Collapse control cannot be pushed off the
        bottom of a short viewport by a long nav.
      -->
      <div class="rail-brand">
        <span class="rail-mark" aria-hidden="true">LAEC</span>
        <span v-if="mode === 'wide' && !railCollapsed" class="rail-brand-text">
          <strong>LAEC</strong>
          <small>{{ roleLabel }}</small>
        </span>
      </div>

      <div class="rail-nav">
        <div v-for="group in groups" :key="group.title" class="rail-group">
          <p v-if="mode === 'wide' && !railCollapsed" class="rail-group-title">{{ group.title }}</p>
          <hr v-else class="rail-rule" />
          <button
            v-for="item in group.items"
            :key="item.id"
            class="rail-item"
            :class="{ active: !item.route && item.id === activeId }"
            :title="mode !== 'wide' || railCollapsed ? item.label : undefined"
            :aria-current="!item.route && item.id === activeId ? 'page' : undefined"
            @click="select(item)"
          >
            <span class="rail-icon" aria-hidden="true" v-html="ICONS[item.icon] || ICONS.dot"></span>
            <span v-if="mode === 'wide' && !railCollapsed" class="rail-label">{{ item.label }}</span>
            <span v-if="item.badge" class="rail-badge">{{ item.badge }}</span>
          </button>
        </div>
      </div>

      <button class="rail-collapse" @click="toggleRail" :aria-label="railCollapsed ? 'Expand navigation' : 'Collapse navigation'">
        <span aria-hidden="true" v-html="railCollapsed ? ICONS.chevronRight : ICONS.chevronLeft"></span>
        <span v-if="mode === 'wide' && !railCollapsed">Collapse</span>
      </button>
    </div>

    <!-- ── top bar ───────────────────────────────────────────────────── -->
    <div class="app-topbar" role="banner">
      <button v-if="mode === 'drawer'" class="topbar-burger" aria-label="Open navigation" @click="toggleRail">
        <span aria-hidden="true" v-html="ICONS.menu"></span>
      </button>
      <button v-else class="topbar-burger" :aria-label="railCollapsed ? 'Expand navigation' : 'Collapse navigation'" @click="toggleRail">
        <span aria-hidden="true" v-html="ICONS.menu"></span>
      </button>

      <nav class="topbar-crumbs" aria-label="Breadcrumb">
        <span class="crumb-root">{{ breadcrumb }}</span>
        <template v-if="activeGroup && activeGroup !== activeLabel">
          <span class="crumb-sep" aria-hidden="true">/</span>
          <span class="crumb-group">{{ activeGroup }}</span>
        </template>
        <span class="crumb-sep" aria-hidden="true">/</span>
        <!-- Same reasoning as .account-name: this span is the current page and
             is the only element in the breadcrumb allowed to ellipsis, so the
             one piece of text that identifies where you are was the one that
             could vanish. -->
        <span class="crumb-leaf" :title="activeLabel">{{ activeLabel }}</span>
      </nav>

      <div class="topbar-tools">
        <label class="topbar-search">
          <span class="sr-only">{{ searchPlaceholder }}</span>
          <span class="search-icon" aria-hidden="true" v-html="ICONS.search"></span>
          <input type="search" :placeholder="searchPlaceholder" disabled />
        </label>


        <div class="topbar-bell">
          <button
            ref="bellTrigger"
            class="bell-trigger"
            :class="{ open: bellOpen }"
            :aria-expanded="bellOpen"
            aria-haspopup="dialog"
            aria-label="Notifications"
            @click="toggleBell"
          >
            <span aria-hidden="true" v-html="ICONS.bell"></span>
            <span v-if="unreadCount > 0" class="bell-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </button>

          <!--
            Teleported to <body>: as a descendant of `.app-topbar` this panel
            inherited that bar's stacking context and could not outrank page
            content no matter what z-index it declared (D-74). Placement comes
            from useAnchoredPopup, so it is positioned in viewport coordinates.
          -->
          <Teleport to="body">
            <div
              v-if="bellOpen"
              ref="bellPanel"
              :style="bellStyle"
              class="bell-panel"
              role="dialog"
              aria-label="Notification centre"
            >
            <header class="bell-head">
              <strong>Notifications</strong>
              <button
                class="bell-readall"
                :disabled="unreadCount === 0"
                @click="markAllRead()"
              >
                Mark all as read
              </button>
            </header>

            <div class="bell-filters" role="tablist">
              <button
                v-for="c in CATEGORIES"
                :key="c.key"
                class="bell-filter"
                role="tab"
                :class="{ active: activeCategory === c.key }"
                :aria-selected="activeCategory === c.key"
                @click="activeCategory = c.key"
              >
                {{ c.label }}<span class="bell-filter-count">{{ categoryCount(c.key) }}</span>
              </button>
            </div>

            <div class="bell-list">
              <p v-if="notifLoading" class="bell-empty">Loading…</p>
              <p v-else-if="visibleNotifications.length === 0" class="bell-empty">
                Nothing here.
              </p>
              <button
                v-for="n in visibleNotifications"
                v-else
                :key="n.NotificationID"
                class="bell-item"
                :class="[n.Category.toLowerCase(), { unread: !n.Read }]"
                @click="followNotification(n)"
              >
                <span class="bell-item-top">
                  <span class="bell-item-title">{{ n.Title }}</span>
                  <span v-if="n.Pinned" class="bell-pin" title="Pinned">PIN</span>
                </span>
                <span class="bell-item-body">{{ n.Body }}</span>
                <span class="bell-item-foot">
                  <span class="bell-item-cat">{{ n.Category }}</span>
                  <span class="bell-item-time">{{ relativeTime(n.CreatedAt) }}</span>
                </span>
              </button>
            </div>
          </div>
          </Teleport>
        </div>

        <!--
          The scope chip is shown only when it carries information the role badge
          does not already carry.

          It was previously unconditional, which meant the top bar said "Super
          Administrator" (breadcrumb), "Super Admin" (role badge), "GLOBAL"
          (scope) and "MASTER ADMIN: …" (account pill) — four statements of the
          same claim, and on a global role the scope is a constant that restates
          the role by definition. It is also not interactive: no handler, no
          menu, so it was not a scope switcher, just a fifth label.

          For a `global` role it is now omitted. For a `school` role it is kept
          and does real work — it is the only element in the bar that says which
          college this session is scoped to, and the account menu is closed until
          clicked.
        -->
        <span
          v-if="scopeKind !== 'global'"
          class="topbar-scope"
          :class="scopeKind"
          :title="`Session scope: ${scope}. Only records for this college are shown.`"
        >
          <span class="scope-dot" aria-hidden="true"></span>{{ scope }}
        </span>

        <!--
          The one role badge. `title` states the full claim because the pill is
          the only place the unabbreviated role appears, and the account menu
          (which also carries it) is closed by default.
        -->
        <span class="topbar-role" :title="`Role: ${role}`">{{ roleLabel }}</span>

        <div class="topbar-account">
          <button
            ref="accountTrigger"
            class="account-trigger"
            :aria-expanded="accountOpen"
            aria-haspopup="menu"
            @click="toggleAccount"
          >
            <span class="account-avatar" aria-hidden="true">{{ (identity || roleLabel).charAt(0) }}</span>
            <!--
              The operator's NAME, not "MASTER ADMIN: <name>".

              The prefix repeated the role badge immediately to its left, and it
              is what pushed the useful half off the end of the box: at the old
              130px the string cut to "MASTER ADMIN: LAE…", so the one piece of
              information this pill exists to carry — who is signed in — was the
              part that got ellipsised away. The role is already stated by
              `.topbar-role` and by the breadcrumb, and the full claim is in the
              account menu, so nothing is lost by dropping it from here.

              `title` remains, because the name is still truncated to whatever
              room the bar has left, and a real person's name is worth reading in
              full without opening the menu.
            -->
            <span
              v-if="mode === 'wide'"
              class="account-name"
              :title="identity || roleLabel"
            >{{ identity || roleLabel }}</span>
            <span class="caret" aria-hidden="true" v-html="ICONS.caret"></span>
          </button>
          <!-- Teleported for the same reason as the bell panel (D-74). -->
          <Teleport to="body">
            <div v-if="accountOpen" ref="accountPanel" :style="accountStyle" class="account-menu" role="menu">
              <div class="account-head">
                <p class="account-strong">{{ identity || roleLabel }}</p>
                <p class="account-meta">{{ role }} · {{ scope }}</p>
              </div>
              <button class="account-item" role="menuitem" @click="logout">
                <span aria-hidden="true" v-html="ICONS.logout"></span> Log out
              </button>
            </div>
          </Teleport>
        </div>
      </div>
    </div>

    <!-- ── content ───────────────────────────────────────────────────── -->
    <div class="app-main" role="main">
      <slot />
    </div>
  </div>
</template>
<style>
/* ── the token contract (D-60) ─────────────────────────────────────────
 * One neutral ramp, one accent, four semantic colours, a 4 px spacing scale
 * and two radii. The three surface stylesheets that preceded this
 * (glass/enterprise/nj) stay in place for /, /login/, /control/ and /exam/,
 * which are the student and gateway surfaces and keep the PRD's own colours;
 * this block governs the six role consoles only.
 */
.surface-app,
.surface-enterprise,
body:has(.app-shell) {
  --app-accent: #1d4ed8;
  --app-accent-hover: #1e40af;
  --app-accent-soft: #eff4ff;
  --app-accent-ring: rgb(29 78 216 / 0.32);

  --app-n0: #ffffff;
  --app-n25: #fbfcfe;
  --app-n50: #f6f8fb;
  --app-n100: #eef1f6;
  --app-n150: #e3e8f0;
  --app-n200: #d5dbe6;
  --app-n300: #b9c2d2;
  --app-n400: #8d97ab;
  --app-n500: #667087;
  --app-n600: #4a5468;
  --app-n700: #333c4d;
  --app-n800: #1f2633;
  --app-n900: #121722;

  --app-text: var(--app-n800);
  --app-text-soft: var(--app-n600);
  --app-text-mute: var(--app-n500);
  --app-line: var(--app-n150);
  --app-line-soft: var(--app-n100);

  --app-info: #1d4ed8;
  --app-success: #047857;
  --app-success-soft: #ecfdf5;
  --app-warning: #a16207;
  --app-warning-soft: #fffbeb;
  --app-danger: #b91c1c;
  --app-danger-soft: #fef2f2;

  --app-rail-w: 248px;
  --app-rail-w-collapsed: 68px;
  --app-topbar-h: 60px;

  --app-r-sm: 5px;
  --app-r-md: 7px;
  --app-r-lg: 10px;

  --app-shadow-pop: 0 12px 32px rgb(18 23 34 / 0.14), 0 2px 6px rgb(18 23 34 / 0.08);
  --app-shadow-card: 0 1px 2px rgb(18 23 34 / 0.05);
}

/* ── frame ─────────────────────────────────────────────────────────────── */

.surface-app,
.surface-enterprise,
body:has(.app-shell) {
  font-family: 'Inter', 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: var(--app-text);
}

/*
 * The origin's enterprise surface is a centred flex column with a
 * `padding-top: var(--header-offset)` gutter reserved for a gradient header
 * that stood above the content. The shell puts the chrome *inside* the page
 * box instead, so that scaffolding is undone for any page that hosts a shell —
 * matched on the presence of the shell rather than on the page class, so all
 * six consoles are covered without each having to opt in.
 */
/*
 * `!important` is used here and only here, on the page-box properties, and it is
 * deliberate: the four origin consoles' stylesheets are transcribed from the
 * live pages and their selectors carry the page class (e.g.
 * `html body.surface-enterprise.page-admin`), which outranks anything this
 * component can express with classes. A reset that has to win against a
 * foreign cascade whose exact selectors are not ours to change has to say so
 * explicitly. Nothing inside the shell is marked important, and the four
 * surfaces the redesign does not touch have no `.app-shell` and are unaffected.
 */
body:has(.app-shell),
body.surface-enterprise:has(.app-shell),
body.surface-app:has(.app-shell),
body.surface-enterprise #app:has(.app-shell),
body.surface-app #app:has(.app-shell) {
  /*
   * Flex, not block. The four origin consoles have their #app promoted back to
   * `display: block` by their generated stylesheet (the origin's markup was a
   * single root, unlike a Vue fragment), so the entry document's indentation
   * ahead of the mount point forms a real line box and renders the whole
   * console 20 px low. A flex container discards whitespace-only text nodes
   * outright, which removes the line box without touching a single byte of the
   * origin's own rules.
   */
  display: flex !important;
  flex-direction: column !important;
  margin: 0 !important;
  padding: 0 !important;
  min-height: 100vh !important;
  background: var(--app-n50) !important;
  overflow-x: hidden !important;
  overflow-y: visible !important;
}

/*
 * Flex, not block, and that is not cosmetic. The four origin consoles are Vue
 * fragments, so the wrapper holds the shell preceded by the origin's decorative
 * layers and by the template's own indentation. In a block container that
 * indentation collapses into a line box and pushed the shell 20 px down the
 * page; flexbox discards whitespace-only text nodes outright, so the shell
 * starts at the top on every role.
 */
/*
 * #app is the mount point, and base.css gives it `display: contents` so a view's
 * roots resolve against the body's own layout (base.css documents why). The
 * consequence for the four origin consoles is that the indentation between the
 * mount point and the surface wrapper becomes a line box, and the whole console
 * rendered 20 px low. Promoting #app to a flex column discards those
 * whitespace-only text nodes, per the flexbox text-node rule, and puts every
 * role's shell at the top of the page. `display: contents` is restored for the
 * surfaces that do not host a shell, so nothing else is affected.
 */
/*
 * Restore base.css's `display: contents` for the mount point. The four origin
 * consoles' transcribed stylesheets promote #app to `display: block` (their
 * origin markup was a single root, not a Vue fragment), and that box is what
 * carries the 20 px offset. With `contents` the mount point generates no box
 * at all: the shell becomes a direct flex child of the body, the body's
 * whitespace-only text nodes are discarded as flex items, and the console
 * starts at the top like the two addendum consoles always did.
 */
body:has(.app-shell) #app,
body.surface-enterprise:has(.app-shell) #app,
body.surface-app:has(.app-shell) #app {
  display: contents !important;
}

body .surface-enterprise:has(.app-shell),
body .surface-app:has(.app-shell),
body #app > .surface-enterprise:has(.app-shell),
body #app > .surface-app:has(.app-shell) {
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  min-height: 100vh !important;
  background: var(--app-n50) !important;
}

body #app > .surface-enterprise > .app-shell,
body #app > .surface-app > .app-shell {
  flex: 1 0 auto;
  /* the origin's generated stylesheets put a top margin on a console's first
     element, which landed on the shell once it became that element */
  margin: 0;
}

.app-shell {
  display: grid;
  /* `minmax(0, 1fr)`, not bare `1fr`. A bare `1fr` resolves its minimum as
     `min-width: auto`, i.e. the widest min-content of the items in the track,
     so one element wider than the viewport pulls the track — and with it the
     topbar, the main region and the whole page — out past the right edge
     instead of the element simply overflowing its column. `0` makes the track
     purely a function of the space that is actually there: the rail's width
     plus the remainder, whatever the content wants. */
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: var(--app-topbar-h) 1fr;
  grid-template-areas:
    'rail top'
    'rail main';
  width: 100%;
  min-height: 100vh;
  background: var(--app-n50);
}

.app-rail {
  grid-area: rail;
  position: sticky;
  top: 0;
  /*
   * `100dvh`, not `100vh`. The rail is a flex column whose nav scrolls, so its
   * height is the budget the pinned footer is drawn inside — and on a mobile
   * browser with a collapsing URL bar, `100vh` is the *largest* viewport: the
   * rail came out taller than the visible area and its last ~90px, the Collapse
   * control included, sat underneath the browser chrome with no way to scroll
   * to it. `dvh` tracks the viewport actually being shown. The `100vh` first is
   * the fallback for engines without `dvh`.
   */
  height: 100vh;
  height: 100dvh;
  width: var(--app-rail-w);
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  /* The column itself never scrolls; only .rail-nav does. */
  overflow: hidden;
  background: var(--app-n900);
  color: var(--app-n300);
  border-right: 1px solid rgb(255 255 255 / 0.07);
  z-index: var(--z-rail);
}

.app-topbar {
  grid-area: top;
  position: sticky;
  top: 0;
  height: var(--app-topbar-h);
  min-height: var(--app-topbar-h);
  max-height: var(--app-topbar-h);
  z-index: var(--z-topbar);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  background: var(--app-n0);
  border-bottom: 1px solid var(--app-line);
}

.app-main {
  grid-area: main;
  min-width: 0;
  padding: 22px 24px 48px;
}

.app-main > * {
  max-width: 1400px;
}

/* ── chrome fence (D-74) ───────────────────────────────────────────────── *
 * The four origin consoles carry blanket element rules — `.page-admin button`,
 * `.page-ca input, .page-ca select`, `.page-ca label` — transcribed from pages
 * that had no application shell, so they were written for the page's *content*
 * controls. They also match every button and label the shell renders, and the
 * same chrome therefore painted two different ways: a 44 px rail item with an
 * 800-weight label on the consoles against the designed 36 px/500 on Central
 * and Teacher. The account trigger lost its pill radius and its 1 px border,
 * `bell-item` lost the 3 px left stripe that `.bell-item.exam` colours (the
 * colour rule survived but `border: none` took the stripe it was painting),
 * `rail-collapse` lost its divider, and `topbar-search` gained
 * `text-transform: uppercase`, a 7.2 px bottom margin and 15 px bold text
 * inside a 60 px bar. `.page-X button:hover` lifted chrome by 1 px — a control
 * moving under the pointer, exactly the class of defect this pass removes.
 *
 * Each rule below restates the shell's own declaration one notch higher. The
 * `body button.` form is not decoration: `body button.rail-item` is (0,1,2),
 * which outranks `.page-X button` at (0,1,1) while staying *below*
 * `.mode-icons .rail-item` / `.rail-collapsed .rail-item` at (0,2,0), so the
 * collapsed and icon-only rail keep their own padding. Widening this to
 * `body:has(.app-shell) .rail-item` would be (0,2,1) and would flatten both.
 *
 * `transform` needs its own pass because `.page-X button:hover` sits at
 * (0,2,1), above anything in the (0,1,2) family — hence (0,2,2) below.
 * Hover feedback is the background change the shell already owns; nothing in
 * the chrome needs to move to say it is hovered.
 *
 * Properties the shell never declares (most `transition`s) are deliberately
 * left to the origin: its `transform`/`box-shadow`/`opacity` transition is
 * inert once `transform` is pinned to `none`, and an undeclared transition is
 * a no-op on Central too, so both surfaces change background instantly — the
 * one exception being `.rail-item`, which does declare its own and is restored.
 */
body button.rail-item {
  padding: 8px 10px;
  border: 0;
  border-radius: var(--app-r-md);
  font-weight: 500;
  letter-spacing: normal;
  transition: background 0.14s ease, color 0.14s ease;
}

body button.rail-collapse {
  padding: 10px 18px;
  border: 0;
  border-top: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 0;
  font-weight: 400;
  letter-spacing: normal;
}

body button.account-trigger {
  padding: 3px 7px 3px 3px;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  font-weight: 400;
  letter-spacing: normal;
}

body button.topbar-burger,
body button.bell-trigger {
  padding: 1px 6px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-md);
  font-weight: 400;
  letter-spacing: normal;
}

body label.topbar-search {
  display: flex;
  align-items: center;
  font-size: inherit;
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
  color: inherit;
  margin-bottom: 0;
}

body .topbar-search input {
  width: 190px;
  padding: 6px 10px 6px 30px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-md);
  background: var(--app-n50);
  color: var(--app-text-soft);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
}

/*
 * The two responsive rules that own the search box were written at (0,1,0),
 * which the fence above — at (0,1,2) — silently outranks, and they have to be
 * restated here or they stop applying. The first attempt at this fence did
 * exactly that: `display: flex` beat `@media (max-width: 900px)`, so the 190 px
 * search stayed on screen on a phone, `.topbar-tools` needed 387 px, and
 * because the shell grid's `1fr` track carries `min-width: auto`, the track
 * expanded to 533.8 px to contain it — dragging `.app-topbar`, `.app-main` and
 * the entire page to 534 px wide inside a 390 px viewport (measured on
 * /calendar/ and /notices/, which have no content of their own that is too
 * wide). Same specificity, later in the source, so they win the tie.
 */
@media (max-width: 1199px) {
  body .topbar-search input {
    width: 150px;
  }
}

@media (max-width: 900px) {
  body label.topbar-search {
    display: none;
  }
}

body button.account-item {
  padding: 7px 10px;
  border: 0;
  border-radius: var(--app-r-md);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: normal;
}

body button.bell-readall {
  padding: 1px 6px;
  border: 0;
  border-radius: 0;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: normal;
}

body button.bell-filter {
  padding: 4px 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: normal;
}

body button.bell-item {
  padding: 10px 11px;
  border: 1px solid transparent;
  border-left: 3px solid var(--app-n200);
  border-radius: var(--app-r-md);
  font-weight: 400;
  letter-spacing: normal;
}

/*
 * The notification header is the one shell element matched by a *bare* element
 * rule other than `button` — `<header class="bell-head">` meets `.page-X
 * header`, which is the origin's full-bleed page masthead: `position: fixed;
 * top/left/right: 0`, `width: 100%`, a navy gradient, white text and
 * `z-index: var(--z-sticky)`. Inside a 400 px popup that meant the header left
 * the popup entirely and pinned itself across the viewport, so the popups
 * opened with a stray gradient band and a "Mark all read" button stretched to
 * the 1440 px window and clipped away. `position: static` also neutralises
 * `top`/`left`/`right` for free, and `z-index` still has to be reset because
 * `z-index` applies to a flex item even when it is not positioned.
 */
body header.bell-head {
  width: auto;
  position: static;
  z-index: auto;
  margin: 0;
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: row;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  color: inherit;
  background: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  border: 0;
  border-bottom: 1px solid var(--app-line-soft);
}

body button.rail-item:hover,
body button.rail-collapse:hover,
body button.account-trigger:hover,
body button.topbar-burger:hover,
body button.bell-trigger:hover,
body button.account-item:hover,
body button.bell-readall:hover,
body button.bell-filter:hover,
body button.bell-item:hover {
  transform: none;
}

/*
 * Box sizing for the chrome and the two popups, and only for them.
 *
 * The four origin consoles each ship `.page-X * { box-sizing: border-box }`
 * with their transcription, while base.css and the two addendum surfaces
 * declare nothing — so Central and Teacher laid the same shell out in
 * content-box. Every width the shell states is a finished dimension: `.app-rail`
 * says `width: var(--app-rail-w)` *and* draws a 1 px right border, and the
 * notification panel says `width: min(400px, calc(100vw - 24px))` precisely so
 * it lands on a 390 px phone with 12 px of margin. Under content-box those
 * widths excluded the border and padding, so the rail came out a pixel wide,
 * the panel 402 px, the account menu 230 px instead of 216 px, and every
 * `width: 100%` row inside them 14 px narrower than its own box.
 *
 * It is scoped to `.app-rail`, `.app-topbar` and the two teleported panels
 * rather than to `*` on purpose: a blanket reset would also re-box `.app-main`
 * and every view inside it, changing pages that never disagreed with anything.
 * These four containers are the whole of the measured divergence.
 */
body:has(.app-shell) .app-rail,
body:has(.app-shell) .app-rail *,
body:has(.app-shell) .app-topbar,
body:has(.app-shell) .app-topbar *,
body:has(.app-shell) .account-menu,
body:has(.app-shell) .account-menu *,
body:has(.app-shell) .bell-panel,
body:has(.app-shell) .bell-panel * {
  box-sizing: border-box;
}

/* ── rail ──────────────────────────────────────────────────────────────── */

.rail-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--app-topbar-h);
  padding: 0 16px;
  border-bottom: 1px solid rgb(255 255 255 / 0.08);
  flex: 0 0 auto;
}

.rail-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--app-r-md);
  background: var(--app-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.4px;
  flex: 0 0 auto;
}

.rail-brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}
.rail-brand-text strong {
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
}
.rail-brand-text small {
  color: var(--app-n400);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-nav {
  /*
   * `min-height: 0` is the load-bearing part, and it was the whole bug.
   *
   * A flex item's default `min-height` is `auto`, which resolves to its
   * min-content height — so `.rail-nav` refused to shrink below the full height
   * of its nav groups no matter how little room the rail had. The rail's other
   * two children (brand, Collapse) are `flex: 0 0 auto`, so the overflow went to
   * them: the Collapse button was pushed past the bottom of the `100vh` rail
   * and clipped, unreachable and unclickable. The browser's scrollbar never
   * appeared either, because the rail is `overflow: hidden` and nothing was
   * scrollable — the control was simply gone.
   *
   * `min-height: 0` lets the item shrink to the space actually available, which
   * is what makes the `overflow-y: auto` below able to do its job.
   */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 10px 16px;
  scrollbar-width: thin;
  /* Room for the scrollbar, so a scrollable nav's labels do not sit under it. */
  scrollbar-gutter: stable;
}

.rail-group + .rail-group {
  margin-top: 12px;
}

.rail-group-title {
  margin: 0 0 4px;
  padding: 4px 8px;
  /* Rail labels sit on the dark rail (#121722). --app-n500 gave 3.61:1 there;
     this lighter grey clears WCAG AA (4.5) at 5.24:1. */
  color: #828b9e;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.7px;
  text-transform: uppercase;
}

.rail-rule {
  border: 0;
  border-top: 1px solid rgb(255 255 255 / 0.08);
  margin: 6px 8px;
}

.rail-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--app-r-md);
  background: transparent;
  color: var(--app-n300);
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.rail-item:hover {
  background: rgb(255 255 255 / 0.07);
  color: #fff;
}

.rail-item.active {
  background: var(--app-accent);
  color: #fff;
  font-weight: 600;
}

.rail-icon {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  opacity: 0.92;
}

.rail-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-badge {
  margin-left: auto;
  min-width: 19px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.16);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  text-align: center;
}
.rail-item.active .rail-badge {
  background: rgb(255 255 255 / 0.26);
}

.rail-collapse {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 18px;
  border: 0;
  border-top: 1px solid rgb(255 255 255 / 0.08);
  background: transparent;
  color: var(--app-n400);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  /*
   * `margin-top: auto` pins this to the bottom of the rail's flex column when
   * the nav is short enough to leave a gap, and `flex: 0 0 auto` keeps it at its
   * natural height when the nav has filled the space. Together with
   * `.rail-nav { min-height: 0 }` the button is always fully visible: it can
   * neither be pushed out by a long nav nor float up from the bottom.
   */
  flex: 0 0 auto;
  margin-top: auto;
}
.rail-collapse:hover {
  color: #fff;
}

/* icon-only rail */
.mode-icons .app-rail,
.rail-collapsed .app-rail {
  width: var(--app-rail-w-collapsed);
}
.mode-icons .rail-collapse,
.rail-collapsed .rail-collapse {
  justify-content: center;
  padding: 10px 0;
}
.mode-icons .rail-item,
.rail-collapsed .rail-item {
  justify-content: center;
  padding: 9px 0;
}
.mode-icons .rail-brand,
.rail-collapsed .rail-brand {
  justify-content: center;
  padding: 0;
}

/* ── top bar ───────────────────────────────────────────────────────────── */

.topbar-burger {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-md);
  background: var(--app-n0);
  color: var(--app-n600);
  cursor: pointer;
  flex: 0 0 auto;
}
.topbar-burger:hover {
  background: var(--app-n50);
  color: var(--app-text);
}

.topbar-crumbs {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  font-size: 12.5px;
}
.crumb-root {
  color: var(--app-text-mute);
  font-weight: 500;
  white-space: nowrap;
}
.crumb-group {
  color: var(--app-text-mute);
  white-space: nowrap;
}
.crumb-sep {
  color: var(--app-n300);
}
.crumb-leaf {
  color: var(--app-text);
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.topbar-search {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 9px;
  display: grid;
  place-items: center;
  color: var(--app-n400);
  pointer-events: none;
}
.topbar-search input {
  width: 190px;
  padding: 6px 10px 6px 30px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-md);
  background: var(--app-n50);
  color: var(--app-text-soft);
  font: inherit;
  font-size: 12px;
}
.topbar-search input::placeholder {
  color: var(--app-n400);
}
.topbar-search input:disabled {
  cursor: not-allowed;
  opacity: 0.75;
}

.topbar-scope {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.scope-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.topbar-scope.global {
  background: var(--app-accent-soft);
  color: var(--app-accent);
}
.topbar-scope.school {
  background: var(--app-n100);
  color: var(--app-n700);
}

.topbar-role {
  padding: 4px 10px;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  color: var(--app-text-soft);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
}

.topbar-account {
  position: relative;
}

.account-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 7px 3px 3px;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  background: var(--app-n0);
  font: inherit;
  color: var(--app-text);
  cursor: pointer;
}
.account-trigger:hover {
  background: var(--app-n50);
}

.account-avatar {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--app-n900);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
}

.account-name {
  font-size: 12px;
  font-weight: 600;
  /*
   * Enough for a full personal name at this size ("MOCK SUPER ADMIN" is ~118px)
   * while still truncating on a narrow bar rather than pushing the topbar
   * tools off-screen. 130px was sized around the old "MASTER ADMIN: <name>"
   * string, which it truncated to "MASTER ADMIN: LAE…"; with the prefix gone the
   * same width is no longer a constraint, and the name is readable in full.
   */
  max-width: 190px;
  min-width: 0;
  overflow: hidden;
  /* Real ellipsis: `text-overflow` only applies to a nowrap, non-wrapping box. */
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  display: grid;
  place-items: center;
  color: var(--app-n400);
}

.account-menu {
  /*
   * Fixed, not absolute, and placed by useAnchoredPopup. `right: 0` anchored
   * this to `.topbar-account` inside the topbar's stacking context, where its
   * z-index could never beat page content; it also had no answer for a
   * viewport narrower than the panel. Width is CSS-owned on purpose: the
   * placement code reads offsetWidth and never writes it back, so the clamp is
   * always computed against the real size.
   */
  position: fixed;
  width: min(216px, calc(100vw - 24px));
  padding: 6px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-lg);
  background: var(--app-n0);
  box-shadow: var(--app-shadow-pop);
  z-index: var(--z-dropdown);
}
.account-head {
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--app-line-soft);
  margin-bottom: 5px;
}
.account-strong {
  margin: 0;
  font-size: 12.5px;
  font-weight: 650;
}
.account-meta {
  margin: 2px 0 0;
  color: var(--app-text-mute);
  font-size: 11px;
}
.account-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: var(--app-r-md);
  background: transparent;
  color: var(--app-danger);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.account-item:hover {
  background: var(--app-danger-soft);
}

/* ── drawer ────────────────────────────────────────────────────────────── */

.app-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-scrim);
  background: rgb(18 23 34 / 0.42);
}

.mode-drawer .app-rail {
  position: fixed;
  left: 0;
  top: 0;
  transform: translateX(-100%);
  width: 272px;
  transition: transform 0.2s ease;
}
.mode-drawer .app-rail.open {
  transform: translateX(0);
}

/*
 * The origin's decorative bubble layer sits in flow at the top of each console's
 * fragment, which pushed the shell 20 px down, and it is one of the dated
 * signals the redesign removes. The shell's flat surface replaces it, so the
 * layer is suppressed on the six role consoles only — `/`, `/login/`,
 * `/control/` and `/exam/` keep theirs, because those surfaces are unchanged.
 */
body:has(.app-shell) .bubble-field {
  display: none;
}

/* ── notification centre (D-64) ───────────────────────────────────────── */

.topbar-bell {
  /* The badge is positioned against .bell-trigger inside this box and hangs
     outside it by design, so the overflow must stay visible. */
  position: relative;
  overflow: visible;
  flex: 0 0 auto;
}

.bell-trigger {
  position: relative;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-md);
  background: var(--app-n0);
  color: var(--app-n600);
  cursor: pointer;
}
.bell-trigger:hover,
.bell-trigger.open {
  background: var(--app-n50);
  color: var(--app-text);
}

.bell-badge {
  /*
   * Anchored to the trigger's top-right with one consistent offset.
   *
   * It was `top: -5px; right: -5px` on a 32px square trigger inside a 60px
   * `overflow: visible` top bar, so the badge sat half over the trigger's
   * corner and half outside the button's own 1px border — the digit read as
   * clipping the bell rather than as a count attached to it. `top/right: -6px`
   * clears the border cleanly at this size.
   *
   * The glyph itself was also vertically clipped: `height: 17px` with
   * `line-height: 17px` on a 10px font leaves a 17px line box inside a box
   * whose *content* is 13px once the 2px borders are taken off it
   * (`clientHeight` 13 vs `scrollHeight` 17, measured). Centring the text with
   * `display: grid; place-items: center` and dropping the fixed line-height
   * removes the box entirely — the badge now sizes to its content, so a
   * two-digit "10" is not squeezed either.
   *
   * `overflow: visible` is stated on the parent so the badge can overhang the
   * trigger; without it a future `overflow: hidden` on `.topbar-bell` (a
   * reasonable-looking change) would silently amputate the count.
   */
  position: absolute;
  top: -6px;
  right: -6px;
  display: grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--app-danger);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  border: 2px solid var(--app-n0);
  /* Never let a long count widen the badge into the icon. */
  max-width: 24px;
  overflow: hidden;
}

.bell-panel {
  /* Fixed + externally placed; see the note on .account-menu (D-74).
     `min(..., 100vw - 24px)` is what stops the 400 px panel running off the
     left edge of a 390 px phone. `max-height` is the resting ceiling —
     useAnchoredPopup lowers it further only when the space beside the trigger
     is tighter than that. */
  position: fixed;
  width: min(400px, calc(100vw - 24px));
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-lg);
  background: var(--app-n0);
  box-shadow: var(--app-shadow-pop);
  z-index: var(--z-dropdown);
  overflow: hidden;
}

.bell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--app-line-soft);
}
.bell-head strong {
  font-size: 13px;
  font-weight: 650;
}
.bell-readall {
  border: 0;
  background: transparent;
  color: var(--app-accent);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.bell-readall:disabled {
  color: var(--app-n400);
  cursor: not-allowed;
}

.bell-filters {
  display: flex;
  gap: 4px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--app-line-soft);
  overflow-x: auto;
  scrollbar-width: none;
}
.bell-filters::-webkit-scrollbar {
  display: none;
}
.bell-filter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--app-n50);
  color: var(--app-text-soft);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.bell-filter:hover {
  background: var(--app-n100);
}
.bell-filter.active {
  background: var(--app-accent-soft);
  border-color: var(--app-accent);
  color: var(--app-accent);
}
.bell-filter-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

.bell-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 6px;
}

.bell-empty {
  margin: 0;
  padding: 26px 12px;
  text-align: center;
  color: var(--app-text-mute);
  font-size: 12.5px;
}

.bell-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 11px;
  border: 1px solid transparent;
  border-left: 3px solid var(--app-n200);
  border-radius: var(--app-r-md);
  background: transparent;
  font: inherit;
  color: var(--app-text);
  cursor: pointer;
  margin-bottom: 3px;
}
.bell-item:hover {
  background: var(--app-n50);
}
.bell-item.unread {
  background: var(--app-accent-soft);
}
.bell-item.unread:hover {
  background: #e4ecff;
}
.bell-item.review { border-left-color: var(--app-info); }
.bell-item.exam { border-left-color: #7c3aed; }
.bell-item.results { border-left-color: var(--app-success); }
.bell-item.announcement { border-left-color: var(--app-accent); }
.bell-item.security { border-left-color: var(--app-danger); }
.bell-item.system { border-left-color: var(--app-text-mute); }

.bell-item-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.bell-item-title {
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.35;
}
.bell-pin {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--app-n900);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.4px;
}
.bell-item-body {
  display: block;
  margin-top: 3px;
  color: var(--app-text-soft);
  font-size: 12px;
  line-height: 1.45;
}
.bell-item-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--app-text-mute);
}
.bell-item-cat {
  font-weight: 700;
  letter-spacing: 0.4px;
}
.bell-item-time {
  margin-left: auto;
}

@media (max-width: 767px) {
  .bell-panel {
    position: fixed;
    left: 10px;
    right: 10px;
    top: calc(var(--app-topbar-h) + 8px);
    width: auto;
    max-height: 76vh;
  }
}

/* ── panel primitives ────────────────────────────────────────────
 * The 37 panels keep their own markup and class names; these rules restyle the
 * handful of primitives they all share, so a card or a button looks the same
 * whether it was authored for the origin or for the addendum.
 */

/*
 * .control-box is a row: the dark hero on the four consoles and the white
 * toolbar on /central/ and /teacher/ put their heading against their actions.
 * .card is not — it holds a heading, paragraphs, grids and tables as content,
 * so as a row (space-between + wrap) short children ended up side by side,
 * which is what tore the notice cards apart: meta, title and body all sharing
 * one line on short notices and wrapping differently on long ones. Stacked,
 * with the same 14px rhythm, every card reads top to bottom.
 */
.app-main .control-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.app-main .card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
}
.app-main .control-box,
.app-main .card {
  background: var(--app-n0);
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-lg);
  box-shadow: var(--app-shadow-card);
  padding: 14px 18px;
  margin: 0 0 16px;
  color: var(--app-text);
}

.app-main .control-box h2 {
  font-size: 15px;
  font-weight: 650;
  margin: 0;
}

.app-main .control-box p {
  margin: 3px 0 0;
  color: var(--app-text-soft);
  font-size: 12.5px;
}

.app-main .table-responsive {
  background: var(--app-n0);
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-lg);
  box-shadow: var(--app-shadow-card);
  overflow-x: auto;
}

.app-main .btn-primary,
.app-main .btn-secondary,
.app-main .btn-success,
.app-main .btn-warning,
.app-main .btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: var(--app-r-md);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.1px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.app-main .btn-primary { background: var(--app-accent); color: #fff; }
.app-main .btn-primary:hover { background: var(--app-accent-hover); }

.app-main .btn-secondary {
  background: var(--app-n0);
  border-color: var(--app-line);
  color: var(--app-n700);
}
.app-main .btn-secondary:hover { background: var(--app-n50); border-color: var(--app-n300); }

.app-main .btn-success { background: var(--app-success-soft); color: var(--app-success); }
.app-main .btn-success:hover { background: #d5f5e6; }

.app-main .btn-warning { background: var(--app-warning-soft); color: var(--app-warning); }
.app-main .btn-warning:hover { background: #fef3c7; }

.app-main .btn-danger { background: var(--app-danger-soft); color: var(--app-danger); }
.app-main .btn-danger:hover { background: #fee2e2; }

.app-main .btn-danger:disabled,
.app-main .btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.app-main input[type='text'],
.app-main input[type='email'],
.app-main input[type='password'],
.app-main input[type='search'],
.app-main input[type='number'],
.app-main select,
.app-main textarea {
  min-height: 32px;
  padding: 5px 10px;
  border: 1px solid var(--app-line);
  border-radius: var(--app-r-md);
  background: var(--app-n0);
  color: var(--app-text);
  font: inherit;
  font-size: 12.5px;
}
.app-main input:focus-visible,
.app-main select:focus-visible,
.app-main textarea:focus-visible,
.app-main button:focus-visible,
.rail-item:focus-visible {
  outline: 2px solid var(--app-accent-ring);
  outline-offset: 1px;
}

.app-main .page-footer,
.app-main .system-footer {
  margin-top: 20px;
  padding: 14px 18px;
  border-top: 1px solid var(--app-line);
  background: transparent;
  color: var(--app-text-mute);
  font-size: 11.5px;
  text-align: center;
}

/* ── shared modern primitives the panels pick up ───────────────────────── */

.surface-app .app-main h1,
.surface-enterprise .app-main h1 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--app-text);
  margin: 0 0 4px;
}
.surface-app .app-main h2,
.surface-enterprise .app-main h2 {
  font-size: 15px;
  font-weight: 650;
  color: var(--app-text);
  margin: 0;
}
.surface-app .app-main h3,
.surface-enterprise .app-main h3 {
  font-size: 13.5px;
  font-weight: 650;
  color: var(--app-text);
}

/*
 * .control-box declares its own colour — `white` on the four dark hero
 * gradients (ca/admin/ict/comm) and the inherited body colour on the light
 * toolbar variant (central/teacher). The generic heading rules above would
 * repaint it --app-n800 (#1f2633), which rendered the hero h2 dark-on-dark.
 * Let the component's own colour win.
 */
.surface-enterprise .app-main .control-box h2,
.surface-enterprise .app-main .control-box h3 {
  color: inherit;
}

.surface-app .app-main table,
.surface-enterprise .app-main table {
  font-size: 12.5px;
}
.surface-app .app-main th,
.surface-enterprise .app-main th {
  position: sticky;
  top: 0;
  z-index: var(--z-content-lift);
  background: var(--app-n50);
  color: var(--app-text-soft);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--app-line);
}
.surface-app .app-main td,
.surface-enterprise .app-main td {
  border-top: 1px solid var(--app-line-soft);
}
.surface-app .app-main tbody tr:hover,
.surface-enterprise .app-main tbody tr:hover {
  background: var(--app-n50);
}
.surface-app .app-main td,
.surface-enterprise .app-main td,
.surface-app .app-main th,
.surface-enterprise .app-main th {
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ── responsive ────────────────────────────────────────────────────────── */

@media (max-width: 1199px) {
  .topbar-search input {
    width: 150px;
  }
}

@media (max-width: 900px) {
  .topbar-role,
  .topbar-search {
    display: none;
  }
}

@media (max-width: 767px) {
  .app-main {
    padding: 16px 14px 40px;
  }
  .topbar-crumbs .crumb-root,
  .topbar-crumbs .crumb-group,
  .topbar-crumbs .crumb-sep {
    display: none;
  }
}
</style>
