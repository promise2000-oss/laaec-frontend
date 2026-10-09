/*
 * useAnchoredPopup.ts — viewport-aware placement for teleported popups (D-74).
 *
 * WHY IT IS TELEPORTED
 * --------------------
 * `.app-topbar` is `position: sticky` with a z-index, so it forms a stacking
 * context, and a popup rendered inside it can never paint above page content
 * that resolves against the root — regardless of the popup's own z-index. The
 * panel is therefore teleported to `<body>` and given `position: fixed`, which
 * puts it in the root stacking context where `--z-dropdown` means what it says.
 *
 * WHY PLACEMENT IS COMPUTED
 * -------------------------
 * The origin markup anchored these panels with `position: absolute; right: 0`.
 * That runs off the left edge of a 390 px viewport (the bell panel is 400 px
 * wide) and has no answer for a panel taller than the space below its trigger.
 * Here the panel is placed below the trigger, flipped above when it does not
 * fit, and clamped into a viewport gutter; when neither side has room it takes
 * the larger side and scrolls internally.
 *
 * The panel's *width* is owned by CSS (`min(400px, calc(100vw - 24px))`) and is
 * never written inline, so the measurement below is always the natural size.
 */
import { nextTick, onBeforeUnmount, watch, ref, type CSSProperties, type Ref } from 'vue';

export interface AnchoredPopupOptions {
  /** open state, owned by the caller */
  open: Ref<boolean>;
  /** the button that toggles the popup; used for anchoring and focus return */
  trigger: Ref<HTMLElement | null>;
  /** the teleported panel */
  panel: Ref<HTMLElement | null>;
  /** px between the trigger's edge and the panel */
  gap?: number;
  /** minimum distance kept from every viewport edge */
  margin?: number;
  /** dismiss from outside (click / focus) — usually sets `open` to false */
  onDismiss?: () => void;
}

/** `visibility` starts hidden so the panel never paints at its CSS fallback
 *  origin for the frame before the first placement lands. */
const HIDDEN: CSSProperties = { position: 'fixed', visibility: 'hidden' };

export function useAnchoredPopup(options: AnchoredPopupOptions): { panelStyle: Ref<CSSProperties> } {
  const { open, trigger, panel } = options;
  const gap = options.gap ?? 8;
  const margin = options.margin ?? 12;

  const panelStyle = ref<CSSProperties>(HIDDEN);
  let restoreFocusTo: HTMLElement | null = null;

  const place = (): void => {
    const t = trigger.value;
    const p = panel.value;
    if (!t || !p || !open.value) return;

    const tr = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    /*
     * Reset the box to its CSS-owned size before measuring, so every placement
     * starts from the natural dimensions rather than last placement's clamped
     * ones. (This runs synchronously, before Vue patches the style binding, so
     * the reads below see the reset state.)
     */
    p.style.width = '';
    p.style.maxHeight = '';

    /*
     * CSS sizes the panel with `100vw`, which *includes* the classic scrollbar,
     * while `clientWidth` excludes it — so on a page with a vertical scrollbar
     * the panel can be a few pixels wider than the gutter box allows and the
     * horizontal clamp below would resolve to less than `margin`. Squeeze it
     * into the gutter box first, then clamp against a width we know fits.
     */
    const avail = vw - margin * 2;
    if (p.offsetWidth > avail) p.style.width = `${avail}px`;

    /* Read both after the width decision: narrowing reflows the content. */
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;

    /* Horizontal: align the panel's right edge with the trigger's, then clamp
       into the gutters. `pw <= avail` guarantees the upper bound is never below
       `margin`, so `left` always lands inside [margin, vw - margin - pw]. */
    const left = Math.round(Math.min(Math.max(margin, tr.right - pw), vw - margin - pw));

    /* Vertical: prefer below, flip above, otherwise take the roomier side and
       let the panel's own `overflow-y: auto` body do the scrolling. */
    const belowRoom = vh - margin - tr.bottom - gap;
    const aboveRoom = tr.top - gap - margin;
    let top: number;
    let maxHeight: number | null = null;

    if (ph <= belowRoom) {
      top = tr.bottom + gap;
    } else if (ph <= aboveRoom) {
      top = tr.top - gap - ph;
    } else if (belowRoom >= aboveRoom && belowRoom >= 140) {
      top = tr.bottom + gap;
      maxHeight = belowRoom;
    } else if (aboveRoom >= 140) {
      top = margin;
      maxHeight = aboveRoom;
    } else {
      /* Neither side can show a usable panel: take the whole column rather
         than render something the user cannot interact with. */
      top = margin;
      maxHeight = vh - margin * 2;
    }

    panelStyle.value = {
      position: 'fixed',
      visibility: 'visible',
      left: `${left}px`,
      top: `${Math.round(top)}px`,
      ...(maxHeight !== null ? { maxHeight: `${Math.round(maxHeight)}px` } : {}),
      ...(p.style.width ? { width: `${pw}px` } : {}),
    };
  };

  const schedulePlace = (): void => {
    void nextTick(place);
  };

  /* ── dismissal ────────────────────────────────────────────────────────
   * A teleported panel is no longer a DOM descendant of its trigger, so
   * containment has to be tested against both elements explicitly. */
  const onPointerDown = (e: PointerEvent): void => {
    if (!open.value) return;
    const target = e.target as Node | null;
    if (!target) return;
    if (trigger.value?.contains(target)) return;
    if (panel.value?.contains(target)) return;
    options.onDismiss?.();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !open.value) return;
    options.onDismiss?.();
    /* Escape is a dismissal: focus belongs back on the control that opened it,
       otherwise it lands on <body> and the next Tab starts from the top.
       No stopPropagation — the shell's own Escape handler also closes the
       drawer, and pressing Escape once should clear every open surface. */
    restoreFocusTo?.focus?.();
  };

  const onScroll = (): void => place();

  watch(open, (isOpen) => {
    if (isOpen) {
      restoreFocusTo =
        document.activeElement instanceof HTMLElement ? document.activeElement : trigger.value;
      schedulePlace();
      nextTick(() => {
        /* `pointerdown` rather than `click`: it fires before the toggle
           button's own handler, so the reopen-toggle does not immediately
           close. Registered in the bubble phase so a stopPropagation inside
           the panel cannot accidentally shield it. */
        document.addEventListener('pointerdown', onPointerDown, false);
      });
      document.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onScroll);
    } else {
      panelStyle.value = HIDDEN;
      document.removeEventListener('pointerdown', onPointerDown, false);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    }
  });

  /* Re-place after the panel's own content changes size (notifications
     arriving, a filter change swapping the list). */
  watch(
    () => panel.value?.scrollHeight,
    () => {
      if (open.value) schedulePlace();
    },
  );

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointerDown, false);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll);
  });

  return { panelStyle };
}
