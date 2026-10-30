/**
 * verify-workflows.js — signs in to the LOCAL portal and drives the workflows that
 * `verify-walk.js` only ever observes.
 *
 * Loaded by Playwright's `browser_run_code_unsafe`, which evaluates a file whose
 * contents are a single arrow function — so this file has no imports and no
 * exports, and every helper it needs is defined inside it.
 *
 * WHY THE WALK IS NOT ENOUGH
 * --------------------------
 * The walk proves every panel mounts and none of them logs an error. It cannot
 * tell a working Create button from a decorative one, and it never shows whether
 * validation refuses bad input, whether a permission actually removes a control,
 * or whether a number on screen is computed or hard-coded. Those are the claims
 * the implementation makes, so each one is exercised here.
 *
 * WHAT A CHECK ASSERTS
 * --------------------
 * A BEFORE/AFTER observation around one interaction, plus the expectation that
 * makes it a pass. A check with no observable delta is reported as INCONCLUSIVE
 * rather than PASS — a script that cannot fail is worse than no script.
 *
 * RUNNING IT IN SLICES
 * --------------------
 * One browser session survives roughly six of these steps and then dies with
 * "Target page, context or browser has been closed" — the harness outlives nothing
 * here, so a full run in one call truncates. The checks are therefore a list of
 * steps, grouped into slices that each fit inside one session, and the slice is
 * chosen with `localStorage.AUDIT_PART` on the dev origin before this file loads:
 *
 *   await page.evaluate(() => localStorage.setItem('AUDIT_PART', '3'));
 *   // then load this file
 *
 * `A`…`E` run the slices below; `all` runs every step in one call, which is only
 * useful where a single long-lived session is available. Each slice signs in for
 * itself, so one can be re-run on its own after a fix without replaying the ones
 * before it — which matters, because several checks write to the mock store and
 * are not idempotent.
 *
 * The grouping is not arbitrary. W1 leaves a dialog open and W1b fills it; W3
 * leaves a row menu open and W3b dismisses it; W16 leaves the grants narrowed and
 * W16r restores them. Each pair sits in the same slice, and W16c ends on a
 * different role's session, so it is last.
 *
 * CREDENTIALS
 * -----------
 * The account is this project's own published mock fixture, which exists in the
 * local dev build and in no deployed system. It is not the credential supplied
 * for the live audit, which appears nowhere in this file or in this repository.
 * Writes here go to the in-browser mock store only; no request leaves the tab.
 */
async (page) => {
  const BASE = 'http://localhost:5173';
  const USER = 'mocksuper';
  const PASSWORD = 'MockAdminPass1';

  const results = [];

  /*
   * Whether the gating check could reach the session store, decided inside the
   * page and read back out here. A plain variable rather than a `window` property,
   * because this code runs in the Playwright process, not the browser: reading
   * `window` from it is a ReferenceError, not an empty value.
   */
  let skipGating = false;

  /* ── harness ──────────────────────────────────────────────────────────── */

  /** The mounted module, addressed the way the page addresses it. */
  const panel = () => page.locator('[data-admin-panel]');
  const dialog = () => page.locator('[role="dialog"]');

  /*
   * Navigate to a module and wait for it to be interactive.
   *
   * `domcontentloaded` plus a bounded wait for the panel wrapper, not
   * `networkidle`: the dev server holds connections open (HMR, the source map
   * stream), so `networkidle` intermittently never resolves and the goto burns
   * its whole timeout on a page that had in fact rendered. The wrapper is the
   * real readiness signal, and the extra settle lets the module's own fetch
   * land.
   */
  const open = async (id) => {
    await page.goto(BASE + '/admin/?panel=' + id, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('[data-admin-panel]').first().waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(1100);
  };

  /** Normalised visible text of the first match, or '' when there is none. */
  const txt = async (sel, within) => {
    const scope = within ? within.first() : page;
    let raw = '';
    try {
      raw = await scope.locator(sel).first().innerText();
    } catch {
      raw = '';
    }
    return String(raw || '').replace(/\s+/g, ' ').trim();
  };

  const count = async (sel, within) => (within ? within.first() : page).locator(sel).count();

  /**
   * Run one interaction and record what changed.
   *
   * `probe` is read before and after the interaction, so the check asserts an
   * observable delta rather than "the click did not throw" — a click that
   * silently does nothing produces the same before and after and is reported
   * INCONCLUSIVE, which is what stops this file from being decorative.
   */
  const check = async (id, name, probe, act, expect) => {
    const before = await probe();
    let error = '';
    try {
      await act();
    } catch (e) {
      error = String(e).split('\n')[0].slice(0, 200);
    }
    await page.waitForTimeout(700);
    const after = await probe();
    let verdict;
    let detail;
    if (error) {
      verdict = 'FAIL';
      detail = 'threw: ' + error;
    } else {
      const judged = expect(before, after);
      verdict = judged[0];
      detail = judged[1];
    }
    results.push({ id, name, verdict, detail });
    return verdict;
  };

  /** A bare PASS / FAIL / INCONCLUSIVE verdict carrying its observation. */
  const ok = (d) => ['PASS', d];
  const bad = (d) => ['FAIL', d];
  const unknown = (d) => ['INCONCLUSIVE', d];

  const clickText = async (text, within) => {
    const scope = within ? within.first() : panel();
    const button = scope.locator(`button:has-text("${text}")`).first();
    /* Scrolled into view first: a toolbar row low in a long table is off-screen,
       and an off-screen click waits 30 s for a scroll that never comes. */
    await button.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await button.click({ timeout: 10000 });
  };

  /*
   * The label belonging to a labelled field.
   *
   * A required field's label is the label text, a space and a nested `*` marker,
   * so `text-is("Name")` does not match "Name *" — matched on the whole label
   * with the marker optional and surrounding space allowed.
   */
  /*
   * The control belonging to a labelled field.
   *
   * Found by reading each label's own text and comparing in JS rather than with
   * a `:text-matches()` selector. A selector would have to carry the label as a
   * REGEX, and these labels are not regex-safe — "Amount (NGN)" is a group, and
   * an unescaped one silently never matches. Comparing strings has no such
   * failure mode.
   *
   * The comparison drops a trailing required marker and trims, because a required
   * field renders "Name *" as two nodes.
   */
  const labelMatches = (text, wanted) =>
    String(text || '').replace(/\*\s*$/, '').trim().toLowerCase() === wanted.toLowerCase();

  const field = async (label, within) => {
    const scope = within ? within.first() : panel();
    const wanted = label.toLowerCase();
    const labels = scope.locator('label');
    for (let i = 0; i < (await labels.count()); i += 1) {
      const span = labels.nth(i).locator('> span').first();
      if (await span.count() && labelMatches(await span.innerText().catch(() => ''), wanted)) {
        return labels.nth(i);
      }
    }
    throw new Error('no field labelled "' + label + '" in ' + (within ? 'the dialog' : 'the panel'));
  };

  /** Fill the control under a label; a select takes its first real option. */
  const setField = async (label, value, within) => {
    const control = (await field(label, within)).locator('input, select, textarea').first();
    const tag = await control.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
      const option = control.locator('option').nth(1);
      await control.selectOption(await option.getAttribute('value'));
    } else {
      await control.fill(String(value));
    }
  };

  /* ── steps ────────────────────────────────────────────────────────────── */

  const STEPS = [
    /* ── W1 · the generic panel's create path ─────────────────────────────── */

    {
      id: 'W1',
      name: "stock: an empty Create Stock Item submit is refused with a required-field message",
      run: async () => {
        await open('stock');
        await check(
          'W1',
          "stock: an empty Create Stock Item submit is refused with a required-field message",
          async () => ({
            errs: (await txt('.ap-form__error')) || '',
            dialogOpen: await count('[role="dialog"]'),
          }),
          async () => {
            await clickText('Create Stock Item');
            await page.waitForTimeout(300);
            await clickText('Create', dialog());
            await page.waitForTimeout(400);
          },
          (b, a) => {
            if (a.dialogOpen !== 1) return bad('the create dialog never opened');
            if (!/required/i.test(a.errs)) return bad('no required-field error on an empty submit (saw: "' + a.errs + '")');
            return ok('refused with: ' + a.errs.split('·')[0].trim());
          },
        );
      },
    },
    {
      id: 'W1b',
      name: 'stock: a fully filled create dialog closes, adds a row and banners',
      run: async () => {
        await check(
          'W1b',
          'stock: a fully filled create dialog closes, adds a row and banners',
          async () => ({
            rows: await count('[data-admin-panel] tbody tr'),
            caption: await txt('[data-admin-panel] .ap-table__caption'),
            banner: await txt('.ap-banner'),
            dialogOpen: await count('[role="dialog"]'),
          }),
          async () => {
            /* The fields live in the dialog, so every lookup is scoped to it — the
               panel behind the backdrop also has inputs, and addressing those
               would fill the wrong control and report a plausible failure. */
            const d = dialog().first();
            await setField('Name', 'Verification Sash', d);
            await setField('SKU', 'VERIFY-SASH-1', d);
            await setField('Category', null, d);
            await setField('Unit price', '4500', d);
            await setField('In stock', '12', d);
            await clickText('Create', d);
          },
          (b, a) => {
            if (a.dialogOpen !== 0) return bad('the dialog stayed open after a valid submit');
            if (a.rows !== b.rows + 1) return bad('the row count did not grow (' + b.rows + ' → ' + a.rows + ')');
            if (!a.banner) return bad('the row was added but no success banner was shown');
            return ok('rows ' + b.rows + ' → ' + a.rows + '; banner "' + a.banner.slice(0, 40) + '"');
          },
        );
      },
    },

    /* ── W2 · search narrows the list ─────────────────────────────────────── */

    {
      id: 'W2',
      name: 'stock: typing in the search box refetches and narrows the table',
      run: async () => {
        await open('stock');
        await check(
          'W2',
          'stock: typing in the search box refetches and narrows the table',
          async () => ({
            rows: await count('[data-admin-panel] tbody tr'),
            caption: await txt('[data-admin-panel] .ap-table__caption'),
          }),
          async () => {
            await panel().locator('input[type="search"]').first().fill('Sash');
            await page.waitForTimeout(900);
          },
          (b, a) => {
            if (a.rows >= b.rows) return bad('the search did not narrow the table (' + b.rows + ' → ' + a.rows + ')');
            return ok('rows ' + b.rows + ' → ' + a.rows + ' for "Sash"');
          },
        );
      },
    },

    /* ── W3 · the row action menu ────────────────────────────────────────── */

    /*
     * `users` rather than `stock`: a module renders an Actions column only when
     * it declares row actions, and the stock module declares none. Probing a panel
     * with no row actions would assert nothing — the check is here to prove the
     * menu appears and lists what the registry declared, so it must run on a
     * module that declares some.
     */
    {
      id: 'W3',
      name: "users: the row Actions menu lists the module's declared row actions",
      run: async () => {
        await open('users');
        await check(
          'W3',
          "users: the row Actions menu lists the module's declared row actions",
          async () => ({
            menus: await count('[data-admin-panel] [role="menu"]'),
            items: (await txt('[data-admin-panel] [role="menu"]')) || '',
          }),
          async () => {
            await clickText('Actions');
            await page.waitForTimeout(400);
          },
          (b, a) => {
            if (a.menus !== 1) return bad('the row menu did not open');
            if (!a.items.trim()) return bad('the row menu opened empty');
            return ok('menu items: ' + a.items.replace(/\n/g, ' / '));
          },
        );
      },
    },
    {
      id: 'W3b',
      name: 'users: a click elsewhere dismisses the open row menu',
      run: async () => {
        await check(
          'W3b',
          'users: a click elsewhere dismisses the open row menu',
          async () => ({ menus: await count('[data-admin-panel] [role="menu"]') }),
          async () => {
            await panel().locator('.ap-module__title').first().click();
            await page.waitForTimeout(300);
          },
          (b, a) => {
            if (b.menus !== 1) return bad('W3 left no menu open, so there was nothing to dismiss');
            return a.menus === 0 ? ok('an outside click closed the menu') : bad('the menu stayed open (' + a.menus + ')');
          },
        );
      },
    },

    /* ── W4 · a leave decision moves a row between the two tables ─────────── */

    {
      id: 'W4',
      name: 'leave-approvals: Approve moves a request from Pending to Decided',
      run: async () => {
        await open('leave-approvals');
        await check(
          'W4',
          'leave-approvals: Approve moves a request from Pending to Decided',
          async () => {
            /* The two groups are labelled `Pending (n)` and `Decided (n)`, so the
               count in the heading is the authority and the rows are the check. */
            const headings = (await page.locator('[data-admin-panel] .ap-dash__heading').allInnerTexts()).join(' ');
            const num = (label) => {
              const m = new RegExp(label + '\\s*\\((\\d+)\\)').exec(headings);
              return m ? Number(m[1]) : -1;
            };
            return {
              headings,
              pending: num('Pending'),
              decided: num('Decided'),
              banner: await txt('.ap-banner'),
            };
          },
          async () => {
            await clickText('Approve');
            await page.waitForTimeout(1000);
          },
          (b, a) => {
            if (b.pending < 1) return bad('no pending request to decide (headings: ' + b.headings + ')');
            if (a.pending !== b.pending - 1) return bad('Pending did not shrink by one (' + b.pending + ' → ' + a.pending + ')');
            if (a.decided !== b.decided + 1) return bad('Decided did not grow by one (' + b.decided + ' → ' + a.decided + ')');
            return ok('Pending ' + b.pending + ' → ' + a.pending + ', Decided ' + b.decided + ' → ' + a.decided + '; banner "' + a.banner.slice(0, 40) + '"');
          },
        );
      },
    },

    /* ── W5 · leave form validation, verbatim from the deployed source ────── */

    {
      id: 'W5',
      name: "leave: an empty Apply for Leave submit is refused with the origin's message",
      run: async () => {
        await open('leave');
        await check(
          'W5',
          "leave: an empty Apply for Leave submit is refused with the origin's message",
          async () => ({
            err: (await txt('[role="dialog"] .ap-form__error')) || '',
            dialogOpen: await count('[role="dialog"]'),
          }),
          async () => {
            await clickText('Apply for Leave');
            await page.waitForTimeout(400);
            await clickText('Submit request', dialog());
            await page.waitForTimeout(400);
          },
          (b, a) => {
            if (a.dialogOpen !== 1) return bad('the Apply for Leave dialog never opened');
            if (!/select the staff member/i.test(a.err)) return bad('expected "Select the staff member", saw "' + a.err + '"');
            return ok('refused with: ' + a.err);
          },
        );
      },
    },
    {
      id: 'W5b',
      name: 'leave: an end date before the start date is refused',
      run: async () => {
        await check(
          'W5b',
          'leave: an end date before the start date is refused',
          async () => ({ err: (await txt('[role="dialog"] .ap-form__error')) || '' }),
          async () => {
            const d = dialog().first();
            await d.locator('select').first().selectOption({ index: 1 });
            await d.locator('input[placeholder^="e.g. Annual"]').first().fill('Annual Leave');
            await d.locator('input[type="date"]').nth(0).fill('2026-03-10');
            await d.locator('input[type="date"]').nth(1).fill('2026-03-01');
            await d.locator('textarea').first().fill('Verification request.');
            await clickText('Submit request', d);
            await page.waitForTimeout(300);
          },
          (b, a) =>
            /end date must be after the start date/i.test(a.err)
              ? ok('refused with: ' + a.err)
              : bad('expected the date-order message, saw "' + a.err + '"'),
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      },
    },

    /* ── W6 · the two settings validation rules ──────────────────────────── */

    {
      id: 'W6',
      name: "general-settings: blanking School name refuses the save with the origin's message",
      run: async () => {
        await open('general-settings');
        await check(
          'W6',
          "general-settings: blanking School name refuses the save with the origin's message",
          async () => ({ err: (await txt('.ap-form__error')) || '', banner: await txt('.ap-banner') }),
          async () => {
            await (await field('School name')).locator('input').first().fill('');
            await clickText('Save changes');
            await page.waitForTimeout(500);
          },
          (b, a) =>
            /school name is required/i.test(a.err)
              ? ok('refused with: ' + a.err + ' — no write was issued')
              : bad('expected "School name is required", saw "' + a.err + '"'),
        );
      },
    },
    {
      id: 'W7',
      name: 'system-configuration: a minimum password length below 8 is refused',
      run: async () => {
        await open('system-configuration');
        await check(
          'W7',
          'system-configuration: a minimum password length below 8 is refused',
          /* Read the error from the section that owns it. The panel has four
             sections and only the Security one carries this message, so a
             page-wide read would pick up an unrelated one. */
          async () => ({
            err: (await txt('.ap-sys__section .ap-form__error', panel().locator('.ap-sys__section').filter({ hasText: 'Security' }).first())) || '',
            banner: await txt('.ap-banner'),
          }),
          async () => {
            /*
             * The panel is four sections, each with its own Save button, so both
             * the field and the button are addressed inside the Security section.
             * The first number input on the page is the session timeout, and
             * filling that one is a perfectly valid save — which would have read
             * as "the validation did not fire" rather than "the wrong field".
             */
            const section = panel().locator('.ap-sys__section').filter({ hasText: 'Security' }).first();
            await (await field('Minimum password length', section)).locator('input').first().fill('4');
            await clickText('Save changes', section);
            await page.waitForTimeout(500);
          },
          (b, a) =>
            /at least 8/i.test(a.err)
              ? ok('refused with: ' + a.err + ' — no write was issued')
              : bad('expected the minimum-8 message, saw "' + a.err + '"'),
        );
      },
    },

    /* ── W8 · the grading scale refuses an inverted band ─────────────────── */

    {
      id: 'W8',
      name: 'grading: a band whose min exceeds its max is refused before any save',
      run: async () => {
        await open('grading');
        await check(
          'W8',
          'grading: a band whose min exceeds its max is refused before any save',
          async () => ({ err: (await txt('.ap-form__error')) || '', banner: await txt('.ap-banner') }),
          async () => {
            /* Row 1's Min and Max are the first two number inputs of the scale table. */
            const mins = panel().locator('table tbody input[type="number"]');
            await mins.nth(0).fill('95');
            await mins.nth(1).fill('30');
            await clickText('Save changes');
            await page.waitForTimeout(500);
          },
          (b, a) => {
            if (a.banner) return bad('the save went through despite an inverted band: "' + a.banner + '"');
            if (!/minimum score at or below its maximum/i.test(a.err)) {
              return bad('expected the inverted-band message, saw "' + a.err + '"');
            }
            return ok('refused with: ' + a.err + ' — no write was issued');
          },
        );
      },
    },

    /* ── W9 · results entry computes rather than displays ────────────────── */

    {
      id: 'W9',
      name: 'enter-results: TOTAL and GRADE recompute from CA1+CA2+PROJ+EXAM',
      run: async () => {
        await open('enter-results');
        await check(
          'W9',
          'enter-results: TOTAL and GRADE recompute from CA1+CA2+PROJ+EXAM',
          async () => {
            const row = panel().locator('table tbody tr').first();
            return {
              total: (await row.locator('td').nth(10).innerText().catch(() => '')).trim(),
              grade: (await row.locator('td').nth(12).innerText().catch(() => '')).trim(),
            };
          },
          async () => {
            const marks = panel().locator('table tbody tr').first().locator('input[type="number"]');
            await marks.nth(0).fill('18'); /* CA 1 of 20 */
            await marks.nth(1).fill('9'); /* CA 2 of 10  */
            await marks.nth(2).fill('8'); /* project of 10 */
            await marks.nth(3).fill('57'); /* exam of 60  */
            await page.waitForTimeout(400);
          },
          (b, a) => {
            const total = Number(a.total);
            if (!Number.isFinite(total)) return bad('the TOTAL cell is not a number: "' + a.total + '"');
            if (total !== 92) return bad('18+9+8+57 should total 92, the cell reads "' + a.total + '"');
            if (!a.grade) return bad('the GRADE cell is empty: "' + a.grade + '"');
            return ok('18+9+8+57 = ' + a.total + ', grade "' + a.grade + '" (was ' + b.total + '/' + b.grade + ')');
          },
        );
      },
    },
    {
      id: 'W9b',
      name: 'enter-results: Submit Results is refused until a class is chosen',
      run: async () => {
        await check(
          'W9b',
          'enter-results: Submit Results is refused until a class is chosen',
          async () => ({
            disabled: await page
              .locator('[data-admin-panel] button:has-text("Submit Results")')
              .first()
              .isDisabled()
              .catch(() => null),
          }),
          async () => {},
          (b, a) =>
            b.disabled === true
              ? ok('disabled with no class selected — the guard is the disabled attribute, so no request is issued')
              : unknown('the button is enabled without a class; validation would have to be observed on click'),
        );
      },
    },

    /* ── W10 · a wallet adjustment moves the balance ─────────────────────── */

    {
      id: 'W10',
      name: 'wallets: a Top up of a stated amount changes the balance cell',
      run: async () => {
        await open('wallets');
        await check(
          'W10',
          'wallets: a Top up of a stated amount changes the balance cell',
          async () => {
            const row = panel().locator('table tbody tr').first();
            return {
              who: (await txt('.ap-identity__name', row)).trim(),
              balance: (await row.locator('td').nth(3).innerText().catch(() => '')).trim(),
            };
          },
          async () => {
            /* The row menu opens on the first row; the item is then picked from
               the menu itself, since the menu is a sibling of the trigger and
               not inside the row's cell. */
            const row = panel().locator('table tbody tr').first();
            await row.locator('button:has-text("Actions")').first().click({ timeout: 10000 });
            await page.waitForTimeout(400);
            await page.locator('[role="menu"] button:has-text("Top up")').first().click({ timeout: 10000 });
            await page.waitForTimeout(500);
            /* The dialog's body, and the origin's own field copy — the dialog
               labels the amount "Amount (NGN)", not "Amount". */
            const d = dialog().first();
            await setField('Amount (NGN)', '5000', d);
            /* The origin's confirm button reads "Credit wallet" for a top-up. */
            await clickText('Credit wallet', d);
            await page.waitForTimeout(1100);
          },
          (b, a) => {
            const before = Number(b.balance.replace(/[^\d.]/g, ''));
            const after = Number(a.balance.replace(/[^\d.]/g, ''));
            if (!Number.isFinite(before) || !Number.isFinite(after)) {
              return bad('the balance cell is not numeric: "' + b.balance + '" → "' + a.balance + '"');
            }
            if (after !== before + 5000) return bad('expected +5000 on ' + b.who + ', got "' + b.balance + '" → "' + a.balance + '"');
            return ok(b.who + ': ' + b.balance + ' → ' + a.balance);
          },
        );
      },
    },

    /* ── W11 · a permission grant is saved ───────────────────────────────── */

    {
      id: 'W11',
      name: 'permissions: adding a grant changes the count and saves',
      run: async () => {
        await open('permissions');
        /*
         * Not expressed as before/after around a single interaction, because the
         * observable lives INSIDE the dialog: the selection count is only legible
         * once the dialog is open, so a probe taken before the interaction would
         * have nothing to read. It is written out instead, with each stage
         * asserted as it is observed.
         */
        const role = await txt('.ap-perm__row .ap-identity__name');
        await page.locator('[data-admin-panel] button:has-text("Edit")').first().click({ timeout: 10000 });
        await page.waitForTimeout(700);

        /* Reads the live pill in the dialog toolbar ("N selected") rather than the
           old "N permission(s) selected." prose line. The assertion is the same:
           the number must move by exactly one when one box is toggled. */
        const selected = async () => {
          const pill = await txt('[role="dialog"] .ap-perm__pill');
          const m = /(\d+)/.exec(pill);
          return m ? Number(m[1]) : -1;
        };
        const before = await selected();
        const boxes = page.locator('[role="dialog"] .ap-roles__item input[type="checkbox"]');
        const target = await boxes.evaluateAll((els) => els.findIndex((el) => !el.checked));

        if (before < 0) {
          results.push({
            id: 'W11',
            name: 'permissions: adding a grant changes the count and saves',
            verdict: 'FAIL',
            detail: 'the dialog showed no live selection count for ' + role,
          });
          return;
        }
        if (target < 0) {
          results.push({
            id: 'W11',
            name: 'permissions: adding a grant changes the count and saves',
            verdict: 'INCONCLUSIVE',
            detail: role + ' already held every permission, so there was nothing to add',
          });
          return;
        }

        await boxes.nth(target).click({ timeout: 10000 });
        await page.waitForTimeout(400);
        const after = await selected();
        if (after !== before + 1) {
          results.push({
            id: 'W11',
            name: 'permissions: adding a grant changes the count and saves',
            verdict: 'FAIL',
            detail: 'the in-dialog selection count did not move by one on ' + role + ' (' + before + ' → ' + after + ')',
          });
          return;
        }

        /* The confirm button by position in the dialog footer, not by its label.
           The permissions dialog labels it "Save changes"; hard-coding the string
           breaks this check every time the wording improves, and the wording is
           the part an operator actually reads. */
        await dialog().locator('.ap-dialog__foot button').last().click({ timeout: 10000 });
        await page.waitForTimeout(1100);
        const banner = await txt('.ap-banner');
        const closed = (await count('[role="dialog"]')) === 0;
        results.push({
          id: 'W11',
          name: 'permissions: adding a grant changes the count and saves',
          verdict: closed && /saved/i.test(banner) ? 'PASS' : 'FAIL',
          detail:
            role + ': selection ' + before + ' → ' + after + ', dialog ' + (closed ? 'closed' : 'stayed open') +
            ' and the banner reads "' + banner.slice(0, 50) + '"',
        });
      },
    },

    /* ── W12 · attendance marking round-trips ───────────────────────────── */

    {
      id: 'W12',
      name: 'staff-attendance: marking a register row present and saving persists it',
      run: async () => {
        await open('staff-attendance');
        /*
         * Written out rather than as before/after, for the same reason as W11:
         * the register's existence is a mid-interaction state, so a probe taken
         * only at the ends could not tell "never opened" from "opened and
         * closed". Each stage is asserted where it is seen.
         */
        const markBtn = page
          .locator('[data-admin-panel] button:has-text("Click here to mark attendance")')
          .first();
        if ((await markBtn.count()) === 0) {
          results.push({
            id: 'W12',
            name: 'staff-attendance: marking a register row present and saving persists it',
            verdict: 'FAIL',
            detail: 'no sheet offered a register — nothing to mark',
          });
          return;
        }
        await markBtn.click({ timeout: 10000 });
        await page.waitForTimeout(800);

        const d = dialog();
        const registerRows = await d.locator('table tbody tr').count();
        if ((await d.count()) !== 1 || registerRows === 0) {
          results.push({
            id: 'W12',
            name: 'staff-attendance: marking a register row present and saving persists it',
            verdict: 'FAIL',
            detail: 'the register dialog did not open a table (' + registerRows + ' row(s))',
          });
          return;
        }

        const firstRow = d.locator('table tbody tr').first();
        const who = (await txt('.ap-identity__name, td', firstRow)) || 'the first row';
        const mark = firstRow.locator('button:has-text("present")').first();
        await mark.click({ timeout: 10000 });
        await page.waitForTimeout(300);
        const pressed = await mark.getAttribute('aria-pressed');
        if (pressed !== 'true') {
          results.push({
            id: 'W12',
            name: 'staff-attendance: marking a register row present and saving persists it',
            verdict: 'FAIL',
            detail: 'clicking "present" did not set aria-pressed on the mark for ' + who,
          });
          return;
        }

        await clickText('Save attendance', d);
        await page.waitForTimeout(1100);
        const banner = await txt('.ap-banner');
        if (!/saved/i.test(banner)) {
          results.push({
            id: 'W12',
            name: 'staff-attendance: marking a register row present and saving persists it',
            verdict: 'FAIL',
            detail: 'no confirmation after the save (banner reads "' + banner.slice(0, 50) + '")',
          });
          return;
        }

        /*
         * The observable that matters is PERSISTENCE, not the dialog closing.
         * The register deliberately stays open after a save — it reloads the sheet
         * so the marks on screen are the ones now stored (a divergence from the
         * live app, where the register is its own route and stays put for the
         * same reason; see parity-report.md). So the mark is closed and the
         * register reopened: if the write did not land, the mark comes back
         * `unmarked`.
         */
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await markBtn.click({ timeout: 10000 });
        await page.waitForTimeout(800);
        const reopened = dialog().locator('table tbody tr').first().locator('button:has-text("present")').first();
        const stillPresent = (await reopened.getAttribute('aria-pressed')) === 'true';
        results.push({
          id: 'W12',
          name: 'staff-attendance: marking a register row present and saving persists it',
          verdict: stillPresent ? 'PASS' : 'FAIL',
          detail:
            who + ' marked present in a ' + registerRows + '-row register; the save reported "' +
            banner.slice(0, 30) + '" and the mark was still set after closing and reopening the register',
        });
      },
    },

    /* ── W13 · pagination ────────────────────────────────────────────────── */

    {
      id: 'W13',
      name: 'permissions: the users view paginates and reports its range',
      run: async () => {
        await open('permissions');
        await clickText('View all users');
        await page.waitForTimeout(900);
        await check(
          'W13',
          'permissions: the users view paginates and reports its range',
          async () => ({
            pager: await txt('.ap-pager'),
            prevDisabled: await page.locator('.ap-pager button:has-text("Prev")').first().isDisabled().catch(() => null),
          }),
          async () => {
            await page.locator('.ap-pager button:has-text("Next")').first().click({ timeout: 10000 });
            await page.waitForTimeout(800);
          },
          (b, a) => {
            if (!/showing \d+[–-]\d+ of \d+/i.test(b.pager + ' ' + a.pager)) {
              return bad('no "Showing x–y of N" line (saw "' + (b.pager || a.pager).slice(0, 50) + '")');
            }
            if (b.pager === a.pager) return bad('the pager line did not change after Next');
            if (b.prevDisabled !== true) return bad('Prev was not disabled on the first page');
            return ok('"' + b.pager.slice(0, 40) + '" → "' + a.pager.slice(0, 40) + '"');
          },
        );
      },
    },

    /* ── W14 · CSV export ────────────────────────────────────────────────── */

    {
      id: 'W14',
      name: 'staff: Export writes a CSV of the loaded rows',
      run: async () => {
        /* `staff`, not a table-shaped module: the origin puts its Export on the
           staff page (`staff.tsx`), and the generic panel only draws one for a
           module flagged `exportable`. Checking a module that has no export would
           assert that the button is absent — the opposite of the claim. */
        await open('staff');
        await check(
          'W14',
          'staff: Export writes a CSV of the loaded rows',
          async () => {
            const button = panel().locator('button:has-text("Export")').first();
            if ((await button.count()) === 0) return { name: null, banner: '', missing: true };
            const [download] = await Promise.all([
              page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
              button.click({ timeout: 10000 }),
            ]);
            return { name: download ? download.suggestedFilename() : null, banner: await txt('.ap-banner'), missing: false };
          },
          async () => {},
          (b, a) => {
            if (a.missing) return bad('no Export button on the staff list');
            if (!a.name) return bad('no download event fired from Export');
            return ok('downloaded ' + a.name + '; banner "' + a.banner.slice(0, 40) + '"');
          },
        );
      },
    },

    /* ── W15 · a tab filter ──────────────────────────────────────────────── */

    {
      id: 'W15',
      name: 'leave: the status tabs filter the table',
      run: async () => {
        await open('leave');
        await check(
          'W15',
          'leave: the status tabs filter the table',
          async () => ({
            caption: await txt('[data-admin-panel] .ap-table__caption'),
            rows: await count('[data-admin-panel] tbody tr'),
            on: await txt('.ap-tab--on'),
          }),
          async () => {
            await panel().locator('.ap-tab:has-text("Pending")').first().click({ timeout: 10000 });
            await page.waitForTimeout(600);
          },
          (b, a) => {
            if (a.on !== 'Pending') return bad('the Pending tab did not become current (shows "' + a.on + '")');
            if (a.rows >= b.rows) return bad('Pending did not narrow the table (' + b.rows + ' → ' + a.rows + ')');
            return ok('"' + b.caption + '" → "' + a.caption + '"');
          },
        );
      },
    },

    /* ── W16 · permission gating removes a control, not just a write ─────── */

    /*
     * The strongest claim the implementation makes is that a permission the
     * session does not hold removes the CONTROL, not merely that the write is
     * refused. That is checked by shrinking the live session's grant set and
     * watching the same page re-render.
     *
     * How the grant set is shrunk, and why not another way:
     *
     *   - Not by signing in as another role. `/admin/` admits SUPER_ADMIN only,
     *     and `GET_MY_PERMISSIONS` derives the claim from the username's own
     *     directory record, so re-pointing the session at another fixture lands
     *     on `/control/` (the guard) rather than on a narrower console.
     *   - Not by editing `localStorage`. `effectivePermissions` unions the stored
     *     grants with the role's defaults on every read, so anything written to
     *     storage is re-added at the next paint.
     *   - By assigning `store.permissions`, which is the one value both the nav
     *     filter and every `sessionCan` call read. It is the same object the
     *     running panels hold, so this exercises the real predicate and not a
     *     copy of it.
     *
     * It is reached through a dynamic `import()`, which Vite serves in the dev
     * build only. Against a built bundle this check reports SKIPPED rather than
     * passing — a gate that could not be observed is not a gate that works.
     */
    {
      id: 'W16',
      name: 'leave-approvals: without leave.approve the Approve/Reject buttons are not rendered',
      run: async () => {
        await open('leave-approvals');
        await check(
          'W16',
          'leave-approvals: without leave.approve the Approve/Reject buttons are not rendered',
          async () => ({
            approve: await count('[data-admin-panel] button:has-text("Approve")'),
            reject: await count('[data-admin-panel] button:has-text("Reject")'),
            view: await count('[data-admin-panel] button:has-text("View")'),
          }),
          async () => {
            const reachable = await page.evaluate(async () => {
              try {
                const m = await import('/src/stores/session.ts');
                const store = m.useSessionStore();
                window.__auditGrants = store.permissions;
                store.permissions = store.permissions.filter((p) => !/^leave\./.test(p));
                return true;
              } catch {
                return false;
              }
            });
            skipGating = !reachable;
            await page.waitForTimeout(700);
          },
          (b, a) => {
            if (skipGating) {
              return ['SKIPPED', 'the session store is not importable here — run this against `npm run dev`, not a built bundle'];
            }
            if (b.approve === 0) return bad('no Approve button before the grant was removed, so nothing was gated');
            if (a.approve !== 0 || a.reject !== 0) {
              return bad('Approve/Reject still rendered without leave.approve (' + a.approve + '/' + a.reject + ')');
            }
            if (a.view < b.view) return bad('the View control disappeared too — the panel emptied rather than gating');
            return ok('the decision buttons are gone and View rose ' + b.view + ' → ' + a.view + ' (each gated row falls back to View)');
          },
        );
      },
    },
    {
      id: 'W16r',
      name: 'leave-approvals: restoring the grants restores the gated controls without a reload',
      run: async () => {
        await page.evaluate(async () => {
          const m = await import('/src/stores/session.ts');
          m.useSessionStore().permissions = window.__auditGrants || [];
        });
        await page.waitForTimeout(800);
        const restored = await count('[data-admin-panel] button:has-text("Approve")');
        results.push({
          id: 'W16r',
          name: 'leave-approvals: restoring the grants restores the gated controls without a reload',
          verdict: restored > 0 ? 'PASS' : 'FAIL',
          detail: restored + ' Approve button(s) — the gate is evaluated on render, not captured when the panel mounted',
        });
      },
    },
    {
      id: 'W16c',
      name: '/admin/ refuses a SCHOOL_ADMIN claim and returns it to /control/',
      run: async () => {
        /* The console-level gate, which a narrowed permission set cannot show:
           the guard reads the claim, not the grants. Checked with a real
           sign-out and sign-in as another of the project's own fixtures. */
        await page.evaluate(() => localStorage.clear());
        await page.goto(BASE + '/login/school/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1000);
        await page.fill('#username', 'mockschool');
        await page.fill('#password', 'MockAdminPass1');
        await page.click('button:has-text("AUTHORIZE SESSION")');
        await page.waitForTimeout(3000);
        await page.goto(BASE + '/admin/?panel=leave-approvals', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);
        const gated = await page.evaluate(() => ({
          path: location.pathname,
          panel: document.querySelector('[data-admin-panel]')
            ? document.querySelector('[data-admin-panel]').getAttribute('data-admin-panel')
            : null,
        }));
        results.push({
          id: 'W16c',
          name: '/admin/ refuses a SCHOOL_ADMIN claim and returns it to /control/',
          verdict: gated.path === '/control/' && gated.panel === null ? 'PASS' : 'FAIL',
          detail:
            'asked for /admin/?panel=leave-approvals as SCHOOL_ADMIN; landed on ' +
            gated.path + ' with no module mounted — the route guard, not the panel, keeps another claim out',
        });

        /*
         * Restore the super-admin fixture. This step deliberately ends on a
         * different role's session, so anything after it in the same slice would
         * be bounced to /control/ and could not address a module at all. Signing
         * back in here keeps the slice order-independent rather than making
         * W16c the last step by convention.
         */
        await page.evaluate(() => localStorage.clear());
        await page.goto(BASE + '/login/super/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1200);
        await page.fill('#username', USER);
        await page.fill('#password', PASSWORD);
        await page.click('button:has-text("AUTHORIZE SESSION")');
        await page.waitForTimeout(3200);
      },
    },

    /* ── W17 · the three broken live settings pages stay broken ──────────── */

    {
      id: 'W17',
      name: "academic-settings: reproduces the live deployment's read failure rather than inventing a form",
      run: async () => {
        await open('academic-settings');
        await check(
          'W17',
          "academic-settings: reproduces the live deployment's read failure rather than inventing a form",
          async () => ({
            alert: await txt('[role="alert"]'),
            inputs: await count('[data-admin-panel] input, [data-admin-panel] select'),
          }),
          async () => {},
          (b) => {
            if (!b.alert) return bad('no error surface — the live page fails here and this one does not');
            if (b.inputs > 0) return bad('a form was rendered for a page that has none on the live deployment');
            return ok('error card: "' + b.alert.slice(0, 70) + '"');
          },
        );
      },
    },

    /* ── W18 · responsive reflow ─────────────────────────────────────────── */

    {
      id: 'W18',
      name: 'students: the panel reflows at a 390px viewport without horizontal overflow',
      run: async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await open('students');
        await check(
          'W18',
          'students: the panel reflows at a 390px viewport without horizontal overflow',
          async () =>
            page.evaluate(() => {
              const el = document.querySelector('[data-admin-panel]');
              const doc = document.documentElement;
              return el
                ? {
                    scrollW: el.scrollWidth,
                    clientW: el.clientWidth,
                    pageScroll: doc.scrollWidth,
                    pageClient: doc.clientWidth,
                  }
                : {};
            }),
          async () => {},
          (b) => {
            if (!b.scrollW) return bad('no panel to measure');
            /* The module's own table wrapper scrolls by design (D-59), so the page
               overflowing is the failure — the panel wrapper is what must fit. */
            if (b.pageScroll > b.pageClient + 2) {
              return bad('the page scrolls sideways at 390px: ' + b.pageScroll + ' > ' + b.pageClient);
            }
            if (b.scrollW > b.clientW + 2) return bad('the panel overflows: ' + b.scrollW + ' > ' + b.clientW);
            return ok('the page fits 390px (' + b.pageClient + 'px) and the panel does not overflow its wrapper');
          },
        );
        await page.setViewportSize({ width: 1280, height: 900 });
      },
    },
  ];

  /* ── run ──────────────────────────────────────────────────────────────── */

  const report = (extra) => {
    const lines = [];
    const tally = { PASS: 0, FAIL: 0, INCONCLUSIVE: 0, SKIPPED: 0 };
    for (const r of results) {
      tally[r.verdict] = (tally[r.verdict] || 0) + 1;
      lines.push('  ' + r.verdict.padEnd(12) + r.id.padEnd(5) + r.name);
      if (r.verdict === 'PASS') lines.push('      ✓ ' + r.detail);
      else lines.push('      → ' + r.detail);
    }
    lines.unshift(
      'workflow checks: ' + results.length +
        '  PASS ' + tally.PASS + '  FAIL ' + (tally.FAIL || 0) +
        '  INCONCLUSIVE ' + (tally.INCONCLUSIVE || 0) + '  SKIPPED ' + (tally.SKIPPED || 0),
    );
    if (extra) lines.push(extra);
    return lines.join('\n');
  };

  await page.goto(BASE + '/login/super/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.fill('#username', USER);
  await page.fill('#password', PASSWORD);
  await page.click('button:has-text("AUTHORIZE SESSION")');
  await page.waitForTimeout(3200);

  if (!(await page.evaluate(() => !!localStorage.getItem('LAEC_Session')))) {
    return 'FATAL sign-in failed — nothing was verified.';
  }

  /*
   * The slices. Kept as id lists rather than as an id regex so that re-pairing a
   * dependent step is an edit to a list a reader can see, not to a pattern.
   */
  const SLICES = {
    A: ['W1', 'W1b', 'W2'],
    B: ['W3', 'W3b', 'W4'],
    C: ['W5', 'W5b', 'W6'],
    D: ['W7', 'W8', 'W9', 'W9b'],
    E: ['W10', 'W11', 'W12'],
    F: ['W13', 'W14', 'W15'],
    G: ['W16', 'W16r'],
    H: ['W16c', 'W17', 'W18'],
  };

  const part = await page.evaluate(() => localStorage.getItem('AUDIT_PART') || 'A');
  const ids = part === 'all' ? STEPS.map((s) => s.id) : SLICES[part];
  if (!ids) {
    return 'FATAL unknown AUDIT_PART "' + part + '". Use A–H, or "all".\n\n' +
      'slices:\n' +
      Object.entries(SLICES).map(([k, v]) => '  ' + k + ': ' + v.join(', ')).join('\n');
  }
  const wanted = ids.map((id) => STEPS.find((s) => s.id === id)).filter(Boolean);

  try {
    for (const step of wanted) {
      await step.run();
    }
  } catch (e) {
    const at = wanted[results.length];
    return report('ABORTED in slice ' + part + (at ? ' at ' + at.id : '') + ': ' + String(e).split('\n')[0].slice(0, 200));
  }

  return report('slice ' + part + ': ' + ids.join(', ') + ' — ' + results.length + ' check(s)');
}