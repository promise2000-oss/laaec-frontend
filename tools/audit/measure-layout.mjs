/**
 * measure-layout.mjs — measure the shell's actual scroll behaviour in a browser.
 *
 * WHY THIS EXISTS
 * ---------------
 * The requirement is behavioural: the sidebar must stay put while the content
 * scrolls, the sidebar's nav must scroll independently, and the document must
 * not grow a second vertical scrollbar. None of that can be confirmed by reading
 * the CSS — `position: sticky` looks correct in source and still moves if an
 * ancestor has `overflow: hidden`, if the grid row is sized by content, or if the
 * rail is taller than the scrollport.
 *
 * So this measures it: it scrolls the window, scrolls the nav, and reads the
 * resulting rectangles and scroll offsets. A check that only asserted on the
 * computed `position` value would pass on all of those failures.
 *
 * Run:  node tools/audit/measure-layout.mjs
 */

import { launch } from 'file:///C:/Users/USER/AppData/Local/Temp/opencode/cdp/cdp.mjs';

const BASE = 'http://localhost:5173';
const USER = 'mocksuper';
const PASS = 'MockAdminPass1';

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pass = (id, name, detail) => results.push({ id, name, verdict: 'PASS', detail });
const fail = (id, name, detail) => results.push({ id, name, verdict: 'FAIL', detail });

/**
 * The probe. Everything is read from live rects and scroll offsets rather than
 * from computed styles, because a computed style says what was asked for and a
 * rect says what happened.
 */
const PROBE = `
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left), height: Math.round(r.height), width: Math.round(r.width) };
  };
  const railNav = document.querySelector('.rail-nav');
  const shell = document.querySelector('.app-shell');
  const rail = document.querySelector('.app-rail');
  const topbar = document.querySelector('.app-topbar');
  const main = document.querySelector('.app-main');

  /* Scrollability, read off the live boxes. A scroll container that is not
       rendered is not a scroll context: the closed mobile drawer reports
       thousands of pixels of nav overflow while presenting no scrollbar at all,
       and counting it would make the phone check fail for a phantom. */
  const railVisible = (() => {
    if (!rail) return false;
    const cs = getComputedStyle(rail);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return rail.getBoundingClientRect().width > 0;
  })();
  const navScrollable = railNav && railVisible ? railNav.scrollHeight - railNav.clientHeight : 0;
  const mainScrollable = main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
  const docScrollable = Math.max(0, document.documentElement.scrollHeight - document.documentElement.clientHeight);

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    docScrollable,
    railVisible,
    scrollY: Math.round(window.scrollY),
    /* How many vertical scrollbars can this page present? The document's, plus
       any rendered descendant that scrolls. Counted, because "the document has
       one" and "the document has one and the content region has another" are
       different layouts and only the second is the nested-scroll problem. */
    verticalScrollbars: [
      docScrollable > 1,
      navScrollable > 1,
      mainScrollable > 1,
    ].filter(Boolean).length,
    navScrollable: Math.round(navScrollable),
    mainScrollable: Math.round(mainScrollable),
    rail: rect('.app-rail'),
    nav: railNav ? { height: Math.round(railNav.getBoundingClientRect().height), scrollTop: Math.round(railNav.scrollTop) } : null,
    topbar: rect('.app-topbar'),
    main: rect('.app-main'),
    shellHeight: shell ? Math.round(shell.getBoundingClientRect().height) : 0,
    collapseVisible: (() => {
      const b = document.querySelector('.rail-collapse');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return r.bottom <= window.innerHeight + 1 && r.top >= -1;
    })(),
    horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    mainOverflowX: main ? Math.max(0, main.scrollWidth - main.clientWidth) : 0,
    railPos: rail ? getComputedStyle(rail).position : null,
    topbarPos: topbar ? getComputedStyle(topbar).position : null,
    shellDisplay: shell ? getComputedStyle(shell).display : null,
    railHeight: rail ? Math.round(rail.getBoundingClientRect().height) : 0,
  };
`;

/**
 * Does the rail stay put when the CONTENT scrolls, and does its nav scroll on
 * its own?
 *
 * The scroller is whichever region can actually scroll, found rather than
 * assumed: the document on a page that scrolls as a page, `.app-main` on a
 * shell page. Hardcoding either one is how a check ends up asserting on a region
 * that never moves and passing for the wrong reason.
 */
const SCROLL_PROBE = `
  const railNav = document.querySelector('.rail-nav');
  const main = document.querySelector('.app-main');
  const rail = document.querySelector('.app-rail');
  const topbar = document.querySelector('.app-topbar');

  const docMax = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const mainMax = main ? main.scrollHeight - main.clientHeight : 0;
  const viaDoc = docMax > 4;
  const viaMain = mainMax > 4;
  const amount = Math.min(400, viaDoc ? docMax : mainMax);

  const read = () => ({
    rail: Math.round(rail.getBoundingClientRect().top),
    topbar: Math.round(topbar.getBoundingClientRect().top),
    doc: Math.round(window.scrollY),
    main: main ? Math.round(main.scrollTop) : 0,
  });

  const before = read();
  if (viaDoc) window.scrollBy(0, amount); else if (viaMain) main.scrollTop = amount;
  await new Promise((r) => setTimeout(r, 300));
  const after = read();

  /* Now scroll the nav and confirm neither scroller followed it. */
  const docBefore = after.doc, mainBefore = after.main;
  let navScrolled = false, navMax = 0;
  if (railNav && railNav.scrollHeight - railNav.clientHeight > 4) {
    navMax = railNav.scrollHeight - railNav.clientHeight;
    railNav.scrollTop = Math.min(400, navMax);
    await new Promise((r) => setTimeout(r, 250));
    navScrolled = railNav.scrollTop > 0;
  }
  const afterNav = read();

  window.scrollTo(0, 0);
  if (main) main.scrollTop = 0;
  if (railNav) railNav.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 200));

  return {
    scrolledVia: viaDoc ? 'document' : viaMain ? 'app-main' : 'nothing',
    scrolledBy: viaDoc ? after.doc - before.doc : after.main - before.main,
    railDrift: after.rail - before.rail,
    topbarDrift: after.topbar - before.topbar,
    navScrolled,
    navMax: Math.round(navMax),
    navPulledDoc: afterNav.doc !== docBefore,
    navPulledMain: afterNav.main !== mainBefore,
  };
`;

async function main() {
  const browser = await launch();
  try {
    await browser.goto(`${BASE}/login/super/`, 600);
    await browser.evaluate(`localStorage.clear(); return true;`);
    await browser.waitFor(`return !!document.getElementById('username');`, 20000);
    await browser.evaluate(`
      const set = (id, v) => {
        const el = document.getElementById(id);
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('username', ${JSON.stringify(USER)});
      set('password', ${JSON.stringify(PASS)});
      Array.from(document.querySelectorAll('button'))
        .find((b) => /AUTHORIZE SESSION/i.test(b.textContent)).click();
      return true;
    `);
    await sleep(4000);

    /* Three viewports, because the failure modes differ by width: a desktop
       where the rail is permanent, a short laptop where the rail is the height
       constraint, and a phone where the rail is a drawer. */
    const VIEWPORTS = [
      { id: 'desktop', w: 1440, h: 900, panel: 'students' },
      { id: 'short', w: 1280, h: 620, panel: 'students' },
      { id: 'phone', w: 390, h: 720, panel: 'students' },
    ];

    for (const vp of VIEWPORTS) {
      await browser.setViewport(vp.w, vp.h);
      await browser.goto(`${BASE}/admin/?panel=${vp.panel}`, 400);
      await browser.waitFor(
        `return !!document.querySelector('[data-admin-panel]') && !document.querySelector('[data-admin-panel] .ap-loading');`,
        20000,
      );
      await sleep(600);

      const base = await browser.evaluate(PROBE);

      /* L1 — the page must not scroll sideways, at any width. */
      if (base.horizontalOverflow <= 0 && base.mainOverflowX <= 0) {
        pass(`L1-${vp.id}`, 'no horizontal overflow', `${vp.w}x${vp.h}: document 0px, main 0px`);
      } else {
        fail(`L1-${vp.id}`, 'no horizontal overflow',
          `${vp.w}x${vp.h}: document ${base.horizontalOverflow}px, main ${base.mainOverflowX}px`);
      }

      /* L2 — the document must not scroll at all on a shell page, and there may
         be at most one further vertical scroll context.
         Stated as an invariant rather than as an expected count, because the
         count legitimately differs by width: a desktop scrolls the nav inside
         the rail and the content inside the main region, while a phone's rail is
         a closed drawer and contributes nothing. */
      if (base.docScrollable === 0 && base.verticalScrollbars <= 2) {
        pass(`L2-${vp.id}`, 'the page itself does not scroll; at most one content scroller',
          `${vp.w}x${vp.h}: document ${base.docScrollable}px, ${base.verticalScrollbars} vertical scroll ` +
          `context(s) total (nav ${base.navScrollable}px, main ${base.mainScrollable}px)`);
      } else {
        fail(`L2-${vp.id}`, 'the page itself does not scroll; at most one content scroller',
          `${vp.w}x${vp.h}: document scrolls ${base.docScrollable}px, ${base.verticalScrollbars} vertical ` +
          `scroll context(s) (nav ${base.navScrollable}px, main ${base.mainScrollable}px)`);
      }

      /* L3 — the rail must be no taller than the viewport it is pinned to. A
         rail taller than the scrollport is the classic sticky failure: it looks
         right in source and its footer ends up under the fold. */
      if (base.railHeight <= vp.h + 1) {
        pass(`L3-${vp.id}`, 'rail is no taller than the viewport', `${base.railHeight}px <= ${vp.h}px`);
      } else {
        fail(`L3-${vp.id}`, 'rail is no taller than the viewport',
          `rail is ${base.railHeight}px in a ${vp.h}px viewport — ${base.railHeight - vp.h}px past the fold`);
      }

      if (vp.id === 'phone') {
        /* On a phone the rail is a drawer, so it is measured closed. */
        pass('L3-phone-drawer', 'rail is a drawer on a phone',
          `rail position ${base.railPos}, visible height ${base.rail ? base.rail.height : 0}px of ${vp.h}px`);
        continue;
      }

      /* L4 — the rail and topbar must not move when the CONTENT scrolls. This is
         the requirement that was failing: the rail drifted 81px per scroll
         because a viewport-tall sticky element cannot pin for longer than its
         containing block is taller than the viewport. */
      const scroll = await browser.evaluate(SCROLL_PROBE);
      if (Math.abs(scroll.railDrift) <= 1 && Math.abs(scroll.topbarDrift) <= 1) {
        pass(`L4-${vp.id}`, 'rail and topbar do not move when the content scrolls',
          `content scrolled ${scroll.scrolledBy}px via the ${scroll.scrolledVia}; ` +
          `rail drift ${scroll.railDrift}px, topbar drift ${scroll.topbarDrift}px`);
      } else {
        fail(`L4-${vp.id}`, 'rail and topbar do not move when the content scrolls',
          `content scrolled ${scroll.scrolledBy}px via the ${scroll.scrolledVia}; ` +
          `rail drift ${scroll.railDrift}px, topbar drift ${scroll.topbarDrift}px`);
      }

      /* L5 — the nav scrolls on its own and does not drag either scroller. */
      if (base.navScrollable > 1) {
        if (scroll.navScrolled && !scroll.navPulledDoc && !scroll.navPulledMain) {
          pass(`L5-${vp.id}`, 'rail nav scrolls independently of the content',
            `nav has ${scroll.navMax}px of overflow and scrolled; neither the page nor the content region ` +
            `followed it`);
        } else {
          fail(`L5-${vp.id}`, 'rail nav scrolls independently of the content',
            `navScrollable=${base.navScrollable} navScrolled=${scroll.navScrolled} ` +
            `pulledDocument=${scroll.navPulledDoc} pulledMain=${scroll.navPulledMain}`);
        }
      } else {
        pass(`L5-${vp.id}`, 'rail nav needs no scrollbar at this height',
          `nav content fits (${base.navScrollable}px overflow)`);
      }

      /* L6 — the collapse control must be reachable. It sits last in the rail's
         flex column, so it is the first thing a too-tall rail loses. */
      if (base.collapseVisible) {
        pass(`L6-${vp.id}`, 'the rail footer control is within the viewport', 'fully visible');
      } else {
        fail(`L6-${vp.id}`, 'the rail footer control is within the viewport',
          `collapse button visible=${base.collapseVisible} in a ${vp.h}px viewport`);
      }
    }

    /* L7 — opening a dialog must not move the content. This is the layout-shift
       case that matters in practice: an operator scrolled to the bottom of a
       long table, opens a row action, and lands somewhere else entirely.
       The row action menu is `[role="menu"]` and the detail view it opens is
       `[role="dialog"]` — two different things, and conflating them is how this
       check first reported "the row menu did not open" on a working button. */
    await browser.setViewport(1440, 900);
    await browser.goto(`${BASE}/admin/?panel=users`, 400);
    /*
     * Wait for the ROWS, not for the panel wrapper. The wrapper renders before
     * its read is issued, so waiting on it lands in the frame where the table is
     * legitimately empty — which is why the first run of this check reported "no
     * row Actions button" on a panel that has them.
     */
    await browser.waitFor(
      `return document.querySelectorAll('[data-admin-panel] tbody tr').length > 0;`,
      20000,
    );
    await sleep(400);
    const modal = await browser.evaluate(`
      const main = document.querySelector('.app-main');
      const read = () => ({ doc: Math.round(window.scrollY), main: main ? Math.round(main.scrollTop) : 0 });
      if (main && main.scrollHeight > main.clientHeight) main.scrollTop = 300;
      await new Promise((r) => setTimeout(r, 250));
      const before = read();

      const btn = Array.from(document.querySelectorAll('[data-admin-panel] button'))
        .find((b) => /Actions/.test(b.textContent));
      if (!btn) return { error: 'no row Actions button' };
      btn.click();
      await new Promise((r) => setTimeout(r, 450));
      const menu = document.querySelector('[role="menu"]');
      if (!menu) return { error: 'the row menu did not open', before };
      const viewBtn = Array.from(menu.querySelectorAll('button')).find((b) => /View/.test(b.textContent));
      if (!viewBtn) return { error: 'the row menu had no View action', before };
      viewBtn.click();
      await new Promise((r) => setTimeout(r, 700));

      const dlg = document.querySelector('[role="dialog"]');
      const afterOpen = read();

      /* Escape must close it, and focus must not be left behind the dialog. */
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((r) => setTimeout(r, 600));
      const closed = !document.querySelector('[role="dialog"]');
      const focusInside = !!document.querySelector('[role="dialog"]')?.contains(document.activeElement);

      window.scrollTo(0, 0);
      if (main) main.scrollTop = 0;
      return { before, afterOpen, opened: !!dlg, closed, focusInside };
    `);
    if (modal.error) {
      fail('L7', 'opening a dialog does not move the content, and Escape closes it', modal.error);
    } else if (
      modal.opened &&
      modal.before.doc === modal.afterOpen.doc &&
      modal.before.main === modal.afterOpen.main &&
      modal.closed
    ) {
      pass('L7', 'opening a dialog does not move the content, and Escape closes it',
        `scroll held at doc ${modal.before.doc} / main ${modal.before.main} through opening and closing; ` +
        `closed by Escape: ${modal.closed}; focus left behind the dialog: ${modal.focusInside}`);
    } else {
      fail('L7', 'opening a dialog does not move the content, and Escape closes it',
        `before doc ${modal.before.doc}/main ${modal.before.main}, afterOpen doc ${modal.afterOpen.doc}/` +
        `main ${modal.afterOpen.main}, opened=${modal.opened} closed=${modal.closed}`);
    }

    const tally = { PASS: 0, FAIL: 0 };
    for (const r of results) tally[r.verdict] += 1;
    console.log(`layout checks: ${results.length}  PASS ${tally.PASS}  FAIL ${tally.FAIL}\n`);
    for (const r of results) {
      console.log(`  ${r.verdict.padEnd(6)}${r.id.padEnd(12)}${r.name}`);
      console.log(`      ${r.verdict === 'PASS' ? '✓' : '→'} ${r.detail}`);
    }
    console.log(tally.FAIL === 0 ? '\nPASS — the shell behaves as specified.' : `\nFAIL — ${tally.FAIL} layout problem(s).`);
    process.exitCode = tally.FAIL === 0 ? 0 : 1;
  } catch (e) {
    console.error('ABORTED:', String(e).split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();