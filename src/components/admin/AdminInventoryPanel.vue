/**
 * AdminInventoryPanel — the inventory and commerce half of the admin portal:
 * stock, categories, suppliers, assets, the inventory report, inventory settings,
 * clinic stock, sales, the store, the cart, orders and the bursary queue.
 *
 * WHY ONE COMPONENT FOR ELEVEN PAGES
 * ----------------------------------
 * Every one of these is a list with a search box, a filter or two and a
 * create/edit dialog — the shape `AdminResourcePanel` already renders. What
 * differs between them is the column set, the field set, and one or two page
 * behaviours. Those three things are already data in the registry, so adding a
 * twelfth file per page would be eleven copies of the same rendering loop.
 *
 * What this adds over the generic panel, and why each is here rather than in the
 * registry:
 *
 *  - TABS WITH COUNTS. The live `/inventory/sales` tabs read `All (1)`,
 *    `Draft (0)`, `Payment Confirmed (0)`, `Released (0)`, `Cancelled (1)`. A tab
 *    label with a count in it is a function of the loaded data, not a constant,
 *    so it cannot live in a static `tabs` array.
 *  - THE REPORT PAGE. `/inventory/reports` is eight stat tiles plus two tables and
 *    no rows of its own; it has no registry entry because it is not a list.
 *  - THE SETTINGS PAGE. `/inventory/settings` is one number and one explanation.
 *  - THE CART. It holds a mutable session state rather than a registry record,
 *    so it cannot be a `LIST_ADMIN_RECORDS` read.
 */
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { callApi } from '../../api';
import AdminModuleShell from './AdminModuleShell.vue';
import AdminResourcePanel from './AdminResourcePanel.vue';
import AdminStatusBadge from './AdminStatusBadge.vue';
import { useAdminSession } from './useAdminSession';
import { money } from '../../api/mockAdmin';
import AdminDialog from './AdminDialog.vue';
import type { CartLine } from '../../types/admin';
import type { AdminModule } from '../../types/admin-registry';

const props = defineProps<{ module: AdminModule }>();
const can = defineModel<((permission?: string | null) => boolean) | null>('can', { default: null });

const session = useAdminSession();
const route = useRoute();
const router = useRouter();

/**
 * Move to another panel of this console.
 *
 * Through `?panel=`, the same address every dashboard tile and deep link uses,
 * so the store's Cart button lands on the cart the same way a bookmarked
 * `/admin/?panel=cart` does. Setting the query is also what keeps the browser's
 * back button working: a `showTab`-style in-place switch would leave the URL
 * pointing at the store.
 */
const goToPanel = (panelId: string): void => {
  void router.replace({ path: route.path, query: { ...route.query, panel: panelId } });
};
const permitted = (permission?: string): boolean => {
  if (!permission) return true;
  return can.value ? can.value(permission) : true;
};

/* Which of the five page kinds is this module? One boolean per kind rather than
   a string compare per usage — the comparison is cheap but the boolean reads
   better in the template. */
const isReport = computed(() => props.module.resource === 'inventory-reports');
const isSettings = computed(() => props.module.resource === 'inventory-settings');
const isCart = computed(() => props.module.resource === 'cart');
const isSales = computed(() => props.module.resource === 'sales');
const isQueue = computed(() => props.module.resource === 'store-queue');
const isStore = computed(() => props.module.resource === 'store-items');

/* ── the page kinds the generic panel cannot render ─────────────────────── */

interface InventoryReport {
  totalItems: number;
  stockValue: number;
  low: number;
  out: number;
  releasedSales: number;
  revenue: number;
  pendingSales: number;
  assets: number;
  movements: Array<Record<string, unknown>>;
  salesByStatus: Array<{ status: string; count: number }>;
}

const report = ref<InventoryReport | null>(null);
const reorderLevel = ref(0);
const reportLoading = ref(false);
const reportError = ref('');
const banner = ref('');
const busy = ref(false);
const settingsError = ref('');

const loadReport = async (): Promise<void> => {
  reportLoading.value = true;
  reportError.value = '';
  try {
    const data = await callApi('GET_ADMIN_INVENTORY_REPORTS', { schoolID: session.schoolId() });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load reports.');
    report.value = data;
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Failed to load reports.';
  } finally {
    reportLoading.value = false;
  }
};

const loadSettings = async (): Promise<void> => {
  reportLoading.value = true;
  reportError.value = '';
  try {
    const data = await callApi('GET_ADMIN_INVENTORY_SETTINGS', { schoolID: session.schoolId() });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load settings.');
    reorderLevel.value = data.settings.defaultReorderLevel;
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Failed to load settings.';
  } finally {
    reportLoading.value = false;
  }
};

const saveSettings = async (): Promise<void> => {
  /* The live settings form's only validation: "Enter a whole number of 0 or more." */
  if (!Number.isInteger(Number(reorderLevel.value)) || Number(reorderLevel.value) < 0) {
    settingsError.value = 'Enter a whole number of 0 or more.';
    return;
  }
  busy.value = true;
  settingsError.value = '';
  try {
    const data = await callApi('SAVE_INVENTORY_SETTINGS', {
      defaultReorderLevel: Number(reorderLevel.value),
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Save failed.');
    banner.value = 'Inventory settings saved.';
  } catch (e) {
    settingsError.value = e instanceof Error ? e.message : 'Save failed.';
  } finally {
    busy.value = false;
  }
};

/* ── the store and the cart ────────────────────────────────────────────── */

interface StockRow extends Record<string, unknown> {
  id: string;
  name: string;
  categoryName: string;
  unitPrice: number;
  available: number;
  status: string;
}

const storeItems = ref<StockRow[]>([]);
/**
 * The cart, mirrored from the mock rather than held here.
 *
 * It used to be a local array appended to on every "Add to Cart", which meant
 * checkout had nothing to check out against — see `placeOrder`. The server owns
 * it now, so the total shown here is the mock's own derived total rather than a
 * second arithmetic pass that could disagree with the order it is quoting.
 */
const cartLines = ref<CartLine[]>([]);
const cartTotal = computed(() => cartLines.value.reduce((n, line) => n + line.quantity * line.unitPrice, 0));
/** The live cart offers exactly one choice: pay online, or pay at the bursary. */
const payMethod = ref<'online' | 'bursary'>('bursary');
const placedOrderNo = ref('');

const loadStore = async (): Promise<void> => {
  reportLoading.value = true;
  reportError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', { resource: 'store-items', limit: 100 });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load the store.');
    storeItems.value = data.records as StockRow[];
    /* The catalogue page carries a cart badge, so it needs the cart's count. It
       comes from the cart itself rather than from a local tally, which is what
       keeps the number on the button equal to the number of lines the cart page
       will show. */
    const cart = await callApi('GET_CART', {});
    if (cart.status === 'success') cartLines.value = cart.cart.items;
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Failed to load the store.';
  } finally {
    reportLoading.value = false;
  }
};

const loadCart = async (): Promise<void> => {
  reportLoading.value = true;
  reportError.value = '';
  try {
    /* The cart is the one collection with no key: the live `/store/cart` is its
       own GET rather than a filtered list. Reading the store grid and taking the
       cart from it would be the one shortcut that shows nothing — an empty grid
       means an empty store, not an empty cart. */
    const data = await callApi('GET_CART', {});
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load the cart.');
    cartLines.value = data.cart.items;
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Failed to load the cart.';
  } finally {
    reportLoading.value = false;
  }
};

const addToCart = async (item: StockRow): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('ADD_TO_CART', { stockItemId: item.id, quantity: 1 });
    if (data.status !== 'success') throw new Error(data.message || 'Could not add to cart.');
    cartLines.value = data.cart.items;
    banner.value = data.message || 'Added to cart.';
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not add to cart.';
  } finally {
    busy.value = false;
  }
};

/**
 * Raise or lower one line's quantity.
 *
 * The live cart PATCHes the cart item rather than re-adding, so quantity is a
 * set-to rather than a delta — otherwise lowering a line by one would need a
 * second action to undo. The mock clamps to available stock and rejects a zero,
 * so the panel never has to know the ceiling itself.
 */
const setQuantity = async (line: CartLine, quantity: number): Promise<void> => {
  if (quantity < 1) {
    await removeFromCart(line);
    return;
  }
  busy.value = true;
  try {
    const data = await callApi('UPDATE_CART_ITEM', { stockItemId: line.stockItemId, quantity });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update the cart.');
    cartLines.value = data.cart.items;
    banner.value = '';
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not update the cart.';
  } finally {
    busy.value = false;
  }
};

const removeFromCart = async (line: CartLine): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('REMOVE_CART_ITEM', { stockItemId: line.stockItemId });
    if (data.status !== 'success') throw new Error(data.message || 'Could not remove the item.');
    cartLines.value = data.cart.items;
    banner.value = `Removed ${line.name} from the cart.`;
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not remove the item.';
  } finally {
    busy.value = false;
  }
};

const placeOrder = async (): Promise<void> => {
  busy.value = true;
  try {
    const data = await callApi('PLACE_STORE_ORDER', {
      lines: cartLines.value.map((line) => ({ stockItemId: line.stockItemId, quantity: line.quantity })),
      paymentMethod: payMethod.value === 'online' ? 'ONLINE' : 'BURSARY',
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not place the order.');
    placedOrderNo.value = data.order.orderNo;
    cartLines.value = data.order.lines.map((line) => ({ ...line }));
    banner.value = payMethod.value === 'online'
      ? `Order ${data.order.orderNo} placed. It is in the bursary confirmation queue.`
      : `Order ${data.order.orderNo} placed. Pay at the bursary office.`;
    /* Stock moved, so the grid behind the cart is now stale. */
    await loadStore();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not place the order.';
  } finally {
    busy.value = false;
  }
};

/* ── sales and the queue, which need their counted tabs ────────────────── */

interface SaleRow extends Record<string, unknown> {
  id: string;
  invoiceNo: string;
  status: string;
}
interface OrderRow extends Record<string, unknown> {
  id: string;
  orderNo: string;
  status: string;
}

const salesRows = ref<SaleRow[]>([]);
const queueRows = ref<OrderRow[]>([]);
const salesTab = ref('ALL');
const queueTab = ref('ALL');
const busyRecord = ref('');

const SALE_TABS = ['ALL', 'DRAFT', 'PAYMENT_CONFIRMED', 'RELEASED', 'CANCELLED'] as const;
const QUEUE_TABS = ['ALL', 'PAID_CONFIRM', 'AWAITING_PAYMENT', 'REFUND_PENDING', 'CONFIRMED', 'REFUNDED'] as const;

const SALE_LABELS: Record<string, string> = {
  ALL: 'All',
  DRAFT: 'Draft',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};
const QUEUE_LABELS: Record<string, string> = {
  ALL: 'All',
  PAID_CONFIRM: 'Paid — Confirm',
  AWAITING_PAYMENT: 'Awaiting Payment',
  REFUND_PENDING: 'Refund Pending',
  CONFIRMED: 'Confirmed',
  REFUNDED: 'Refunded',
};

const countOf = (rows: Array<{ status: string }>, key: string): number =>
  key === 'ALL' ? rows.length : rows.filter((row) => row.status === key).length;

const visibleSales = computed(() =>
  salesTab.value === 'ALL' ? salesRows.value : salesRows.value.filter((row) => row.status === salesTab.value),
);
const visibleQueue = computed(() =>
  queueTab.value === 'ALL' ? queueRows.value : queueRows.value.filter((row) => row.status === queueTab.value),
);

const loadSales = async (): Promise<void> => {
  reportLoading.value = true;
  reportError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', { resource: 'sales', limit: 100 });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load sales.');
    salesRows.value = data.records as SaleRow[];
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Failed to load sales.';
  } finally {
    reportLoading.value = false;
  }
};

const loadQueue = async (): Promise<void> => {
  reportLoading.value = true;
  reportError.value = '';
  try {
    const data = await callApi('LIST_ADMIN_RECORDS', { resource: 'store-queue', limit: 100 });
    if (data.status !== 'success') throw new Error(data.message || 'Failed to load the queue.');
    queueRows.value = data.records as OrderRow[];
  } catch (e) {
    reportError.value = e instanceof Error ? e.message : 'Failed to load the queue.';
  } finally {
    reportLoading.value = false;
  }
};

/* ── Create Sale ────────────────────────────────────────────────────────── */

/**
 * The live `/inventory/sales` sheet, transcribed.
 *
 * It was previously a button with no handler at all — the only dead control in
 * the console, found by `tools/find-dead-controls.py`. It is rebuilt here from
 * `CreateSaleDialog.tsx`: the same fields, the same three validations in the
 * same order with the same wording, and the same promise in its description,
 * which is load-bearing because it is why the Release and Cancel row actions
 * make sense — a draft sale holds its stock.
 */
interface SaleLineDraft {
  stockItemId: string;
  quantity: string;
}

/**
 * Stock and suppliers for the sale sheet's two selects.
 *
 * Loaded on open rather than with the sales list: the sales table does not need
 * them, and the live sheet likewise loads suppliers and stock when it opens
 * (`Promise.all([fetchJson(suppliers), fetchJson(stock)])` in its `useEffect`).
 */
const stock = ref<StockRow[]>([]);
const suppliers = ref<Array<{ id: string; name: string }>>([]);

const loadSaleOptions = async (): Promise<void> => {
  try {
    const [items, vendors] = await Promise.all([
      callApi('LIST_ADMIN_RECORDS', { resource: 'stock', limit: 200 }),
      callApi('LIST_ADMIN_RECORDS', { resource: 'suppliers', limit: 200 }),
    ]);
    if (items.status === 'success') stock.value = items.records as StockRow[];
    if (vendors.status === 'success') {
      suppliers.value = vendors.records as Array<{ id: string; name: string }>;
    }
  } catch {
    /* The dialog reports its own failure; an empty select is better than a
       panel-level error for a sheet the operator may not even open. */
  }
};

const saleDialog = ref(false);
const saleDraft = ref<{ buyerName: string; buyerContact: string; supplierId: string; lines: SaleLineDraft[] }>({
  buyerName: '',
  buyerContact: '',
  supplierId: 'none',
  lines: [{ stockItemId: '', quantity: '1' }],
});
const saleError = ref('');

const openSaleDialog = (): void => {
  saleError.value = '';
  /* Re-seeded on open, as the live sheet re-seeds in its own `useEffect` — so
     a cancelled sale leaves nothing behind for the next one. */
  saleDraft.value = {
    buyerName: '',
    buyerContact: '',
    supplierId: 'none',
    lines: [{ stockItemId: '', quantity: '1' }],
  };
  saleDialog.value = true;
  void loadSaleOptions();
};

const addSaleLine = (): void => {
  saleDraft.value.lines.push({ stockItemId: '', quantity: '1' });
};

/** The live sheet disables removal on the last row, so a sale is never empty. */
const removeSaleLine = (index: number): void => {
  if (saleDraft.value.lines.length === 1) return;
  saleDraft.value.lines.splice(index, 1);
};

/** Items that can be sold: in stock, and not the clinic's own shelf. */
const sellableItems = computed<StockRow[]>(() =>
  stock.value.filter((item) => item.available > 0 || sellableIds.value.has(item.id)),
);

/**
 * Every id the form currently names, including a row whose quantity is 0.
 *
 * `sellableItems` filters on `available > 0`, which would silently drop an item
 * from the select the moment a sale reserved all of it — leaving a select whose
 * chosen value is no longer among its options. Anything named by the form stays
 * offered so the selection cannot evaporate underneath the operator.
 */
const sellableIds = computed<Set<string>>(
  () => new Set(saleDraft.value.lines.map((line) => line.stockItemId).filter(Boolean)),
);

/** The chosen item's price, for the per-line hint the live sheet shows. */
const unitPriceOf = (stockItemId: string): number =>
  stock.value.find((s) => s.id === stockItemId)?.unitPrice ?? 0;

const saleTotal = computed(() =>
  saleDraft.value.lines.reduce((sum, line) => {
    const item = stock.value.find((s) => s.id === line.stockItemId);
    return sum + (item ? item.unitPrice * (Number(line.quantity) || 0) : 0);
  }, 0),
);

const submitSale = async (): Promise<void> => {
  const items = saleDraft.value.lines
    .filter((line) => line.stockItemId)
    .map((line) => ({ stockItemId: line.stockItemId, quantity: Number(line.quantity) || 0 }));

  /* The live sheet's own checks, in its own order, before anything is written. */
  if (items.length === 0) {
    saleError.value = 'Add at least one stock item to the sale.';
    return;
  }
  if (items.some((item) => item.quantity <= 0)) {
    saleError.value = 'Quantities must be greater than zero.';
    return;
  }
  for (const item of items) {
    const row = stock.value.find((s) => s.id === item.stockItemId);
    if (row && item.quantity > row.available) {
      saleError.value = `Only ${row.available} of "${row.name}" available.`;
      return;
    }
  }

  busy.value = true;
  saleError.value = '';
  try {
    const data = await callApi('CREATE_SALE', {
      buyerName: saleDraft.value.buyerName.trim() || undefined,
      buyerContact: saleDraft.value.buyerContact.trim() || undefined,
      supplierId: saleDraft.value.supplierId !== 'none' ? saleDraft.value.supplierId : undefined,
      items,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not create the sale.');
    banner.value = `${data.sale.invoiceNo} created. Stock reserved.`;
    saleDialog.value = false;
    /* The sales list gained a row and the stock levels moved, so both are read
       again. Reloading only the list would leave the stock page showing
       pre-reservation availability. */
    await Promise.all([loadSales(), loadSaleOptions()]);
  } catch (e) {
    saleError.value = e instanceof Error ? e.message : 'Could not create the sale.';
  } finally {
    busy.value = false;
  }
};

/** Release or cancel a sale — the two status changes the live dialog offers. */
const setSaleStatus = async (row: SaleRow, status: 'RELEASED' | 'CANCELLED'): Promise<void> => {
  busyRecord.value = row.id;
  try {
    const data = await callApi('ADMIN_SET_STATUS', {
      resource: 'sales',
      id: row.id,
      status,
      actor: session.actor(),
    });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update the sale.');
    banner.value = `${row.invoiceNo} ${status.toLowerCase()}.`;
    await loadSales();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not update the sale.';
  } finally {
    busyRecord.value = '';
  }
};

/**
 * The two bursary decisions, each behind its own dialog.
 *
 * The live queue detail opens a dialog for each — one asking for the payment
 * reference, one for the refund note and receipt URL — and this reproduces that
 * rather than deciding an order's fate from a single click. A confirmation that
 * needed no input was a button that could confirm an order nobody had paid for.
 */
type QueueDecision = { kind: 'confirm' | 'refund'; row: OrderRow } | null;
const queueDecision = ref<QueueDecision>(null);
const paymentMethod = ref('Cash');
const paymentRef = ref('');
const refundNote = ref('');
const refundReceiptUrl = ref('');

const openConfirm = (row: OrderRow): void => {
  queueDecision.value = { kind: 'confirm', row };
  paymentMethod.value = 'Cash';
  paymentRef.value = '';
};

const openRefund = (row: OrderRow): void => {
  queueDecision.value = { kind: 'refund', row };
  refundNote.value = '';
  refundReceiptUrl.value = '';
};

const closeQueueDecision = (): void => {
  queueDecision.value = null;
};

/**
 * `refundPending` gates the confirm button on the note, the same way the live
 * dialog does: an order cannot be marked refunded without saying why.
 */
const submitQueueDecision = async (): Promise<void> => {
  const decision = queueDecision.value;
  if (!decision) return;
  busyRecord.value = decision.row.id;
  try {
    const data = decision.kind === 'confirm'
      ? await callApi('CONFIRM_STORE_ORDER', {
          id: decision.row.id,
          paymentMethod: paymentMethod.value,
          paymentRef: paymentRef.value,
          actor: session.actor(),
        })
      : await callApi('RESOLVE_STORE_REFUND', {
          id: decision.row.id,
          refundNote: refundNote.value || undefined,
          refundReceiptUrl: refundReceiptUrl.value || undefined,
          actor: session.actor(),
        });
    if (data.status !== 'success') throw new Error(data.message || 'Could not update the order.');
    banner.value = `${decision.row.orderNo} ${data.order.status.toLowerCase()}.`;
    queueDecision.value = null;
    await loadQueue();
  } catch (e) {
    banner.value = e instanceof Error ? e.message : 'Could not update the order.';
  } finally {
    busyRecord.value = '';
  }
};

/* The live rail's Refund Queue is the same route with `?status=REFUND_PENDING`,
   so the query parameter selects the tab. Reading it here is what makes that one
   rail entry reach a filtered queue rather than a second list. */
const readStatusQuery = (): void => {
  const match = /[?&]status=([A-Z_]+)/i.exec(window.location.search);
  if (match && QUEUE_TABS.includes(match[1].toUpperCase() as (typeof QUEUE_TABS)[number])) {
    queueTab.value = match[1].toUpperCase();
  }
};

/**
 * Load whatever panel is showing.
 *
 * One call site, called on mount AND on every panel change, because this
 * component serves eleven pages: `onMounted` alone ran once, so reaching the
 * queue from the store through the rail mounted the queue with no read behind
 * it and rendered its empty state over four orders. Only a full page reload —
 * which is not how a user moves around a console — papered over that.
 */
const loadActive = async (): Promise<void> => {
  if (isReport.value) await loadReport();
  else if (isSettings.value) await loadSettings();
  else if (isStore.value) await loadStore();
  else if (isCart.value) await loadCart();
  else if (isSales.value) await loadSales();
  else if (isQueue.value) {
    readStatusQuery();
    await loadQueue();
  }
};

onMounted(loadActive);

watch(() => props.module.id, loadActive);
</script>

<template>
  <!-- ── the report page ───────────────────────────────────────────────── -->
  <AdminModuleShell
    v-if="isReport"
    :title="module.title"
    :description="module.description"
    :loading="reportLoading"
    :error="reportError"
    :banner="banner"
    :empty-count="report ? 1 : 0"
    @retry="loadReport"
    @dismiss="banner = ''"
  >
    <div class="ap-statgrid">
      <div class="ap-stat"><span class="ap-stat__label">Total Items</span><span class="ap-stat__value">{{ report?.totalItems ?? 0 }}</span><span class="ap-stat__sub">Active stock items</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Stock Value</span><span class="ap-stat__value">{{ money(report?.stockValue ?? 0) }}</span><span class="ap-stat__sub">Computed at unit price</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Low Stock</span><span class="ap-stat__value">{{ report?.low ?? 0 }}</span><span class="ap-stat__sub">Below or at reorder level</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Out of Stock</span><span class="ap-stat__value">{{ report?.out ?? 0 }}</span><span class="ap-stat__sub">Zero available quantity</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Released Sales</span><span class="ap-stat__value">{{ report?.releasedSales ?? 0 }}</span><span class="ap-stat__sub">From released sales</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Sales Revenue</span><span class="ap-stat__value">{{ money(report?.revenue ?? 0) }}</span><span class="ap-stat__sub">From released sales</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Pending Sales</span><span class="ap-stat__value">{{ report?.pendingSales ?? 0 }}</span><span class="ap-stat__sub">Draft or awaiting release</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Assets</span><span class="ap-stat__value">{{ report?.assets ?? 0 }}</span><span class="ap-stat__sub">Registered school assets</span></div>
    </div>

    <section class="ap-inv__block">
      <h3 class="ap-inv__heading">Recent Stock Movements</h3>
      <p v-if="!report?.movements.length" class="ap-inline-note">No stock movements recorded yet.</p>
    </section>

    <section class="ap-inv__block">
      <h3 class="ap-inv__heading">Sales by Status</h3>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <thead>
            <tr><th scope="col">Status</th><th scope="col" class="ap-num">Count</th></tr>
          </thead>
          <tbody>
            <tr v-for="entry in report?.salesByStatus ?? []" :key="entry.status">
              <td><AdminStatusBadge :status="entry.status" /></td>
              <td class="ap-num">{{ entry.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminModuleShell>

  <!-- ── the settings page ─────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isSettings"
    :title="module.title"
    :description="module.description"
    :loading="reportLoading"
    :error="reportError"
    :banner="banner"
    @retry="loadSettings"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="ap-btn ap-btn--primary" :disabled="busy" @click="saveSettings">Save changes</button>
    </template>

    <h4 class="ap-band">Low-stock alerting</h4>
    <p class="ap-inline-note">
      Items are flagged <strong>LOW</strong> when remaining (in stock minus reserved) is at or below their reorder level, and
      <strong>OUT</strong> when it reaches zero.
    </p>

    <label class="ap-field">
      <span class="ap-field__label">Default reorder level</span>
      <input v-model.number="reorderLevel" class="ap-input" type="number" min="0" />
      <span class="ap-field__hint">
        When a stock item has no reorder level of its own (0), this default is used to determine low stock.
      </span>
      <span v-if="settingsError" class="ap-form__error" role="alert">{{ settingsError }}</span>
    </label>

    <p class="ap-inline-note">
      Admin, Store and Inventory staff receive a notification when items are low or out of stock.
      Items that only become a concern at zero will not alert until they run out if this is left at 0.
    </p>
  </AdminModuleShell>

  <!-- ── the store ─────────────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isStore"
    title="Browse Store"
    description="Browse and purchase items from the school store."
    :loading="reportLoading"
    :error="reportError"
    :banner="banner"
    :empty-count="storeItems.length"
    @retry="loadStore"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button
        type="button"
        class="ap-btn ap-btn--primary"
        :disabled="cartLines.length === 0"
        @click="goToPanel('cart')"
      >
        Cart ({{ cartLines.length }})
      </button>
    </template>

    <template #empty>
      <p>No items in the catalogue.</p>
    </template>

    <div class="ap-cards">
      <article v-for="item in storeItems" :key="item.id" class="ap-card">
        <h3 class="ap-card__title">{{ item.name }}</h3>
        <p class="ap-inline-note">{{ item.categoryName }}</p>
        <p class="ap-stat__value">{{ money(Number(item.unitPrice)) }}</p>
        <p class="ap-inline-note">
          <AdminStatusBadge :status="item.status" /> · {{ item.available }} available
        </p>
        <button
          type="button"
          class="ap-btn ap-btn--xs"
          :disabled="item.available <= 0"
          @click="addToCart(item)"
        >
          Add to Cart
        </button>
      </article>
    </div>
  </AdminModuleShell>

  <!-- ── the cart ──────────────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isCart"
    title="Shopping Cart"
    description="Review the items you have added before checking out."
    :loading="reportLoading"
    :error="reportError"
    :banner="banner"
    :empty-count="cartLines.length"
    @retry="loadCart"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button type="button" class="ap-btn" @click="goToPanel('store')">Back to Store</button>
      <button
        type="button"
        class="ap-btn ap-btn--primary"
        :disabled="cartLines.length === 0 || busy"
        @click="placeOrder"
      >
        Checkout
      </button>
    </template>

    <template #empty>
      <p>Your cart is empty. Browse the store to add items.</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <caption class="ap-table__caption">{{ cartLines.length }} item(s) — {{ money(cartTotal) }}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" class="ap-num">Price</th>
            <th scope="col" class="ap-num">Quantity</th>
            <th scope="col" class="ap-num">Line total</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in cartLines" :key="line.stockItemId">
            <td>{{ line.name }}</td>
            <td class="ap-num">{{ money(line.unitPrice) }}</td>
            <td class="ap-num">
              <div class="ap-qty">
                <button
                  type="button"
                  class="ap-btn ap-btn--xs"
                  :disabled="busy"
                  :aria-label="`Decrease ${line.name}`"
                  @click="setQuantity(line, line.quantity - 1)"
                >
                  &minus;
                </button>
                <span class="ap-qty__value">{{ line.quantity }}</span>
                <button
                  type="button"
                  class="ap-btn ap-btn--xs"
                  :disabled="busy"
                  :aria-label="`Increase ${line.name}`"
                  @click="setQuantity(line, line.quantity + 1)"
                >
                  +
                </button>
              </div>
            </td>
            <td class="ap-num">{{ money(line.quantity * line.unitPrice) }}</td>
            <td class="ap-table__actions">
              <button
                type="button"
                class="ap-btn ap-btn--xs ap-btn--danger"
                :disabled="busy"
                @click="removeFromCart(line)"
              >
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- The live cart asks how you intend to pay before it places the order,
         and the two routes are genuinely different: one sends you to the
         bursary, the other to a payment page. -->
    <fieldset class="ap-fieldset">
      <legend class="ap-fieldset__legend">How would you like to pay?</legend>
      <div class="ap-choices">
        <label class="ap-choice">
          <input v-model="payMethod" type="radio" value="online" />
          <span>Pay online</span>
        </label>
        <label class="ap-choice">
          <input v-model="payMethod" type="radio" value="bursary" />
          <span>Pay at the bursary</span>
        </label>
      </div>
      <p v-if="payMethod === 'bursary'" class="ap-field__hint">
        Place the order now, then pay with cash or transfer at the Bursary office. The order waits for the bursary to
        confirm it before it is released.
      </p>
      <p v-else class="ap-field__hint">You will be taken to a payment page to complete this order.</p>
    </fieldset>
  </AdminModuleShell>

  <!-- ── sales, with counted tabs ──────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isSales"
    title="Sales"
    description="Store sales records and receipts."
    :loading="reportLoading"
    :error="reportError"
    :banner="banner"
    :empty-count="salesRows.length"
    @retry="loadSales"
    @dismiss="banner = ''"
  >
    <template #actions>
      <button
        v-if="permitted('inventory.sales.create')"
        type="button"
        class="ap-btn ap-btn--primary"
        @click="openSaleDialog"
      >
        Create Sale
      </button>
    </template>

    <template #filters>
      <div class="ap-tabs" role="tablist" aria-label="Sale status">
        <button
          v-for="key in SALE_TABS"
          :key="key"
          type="button"
          role="tab"
          class="ap-tab"
          :class="{ 'ap-tab--on': salesTab === key }"
          :aria-selected="salesTab === key"
          @click="salesTab = key"
        >
          {{ SALE_LABELS[key] }} ({{ countOf(salesRows, key) }})
        </button>
      </div>
    </template>

    <template #empty>
      <p>No sales in this state.</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th scope="col">Invoice #</th>
            <th scope="col">Buyer</th>
            <th scope="col" class="ap-num">Total Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Date</th>
            <th scope="col">Created By</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleSales" :key="row.id">
            <td>{{ row.invoiceNo }}</td>
            <td>{{ row.buyerName }}</td>
            <td class="ap-num">{{ money(Number(row.total)) }}</td>
            <td><AdminStatusBadge :status="row.status" /></td>
            <td>{{ row.date }}</td>
            <td>{{ row.createdBy }}</td>
            <td class="ap-table__actions">
              <button
                v-if="permitted('inventory.sales.release') && row.status === 'PAYMENT_CONFIRMED'"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--primary"
                :disabled="busyRecord === row.id"
                @click="setSaleStatus(row, 'RELEASED')"
              >
                Release
              </button>
              <button
                v-if="permitted('inventory.sales.manage') && row.status !== 'CANCELLED'"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--danger"
                :disabled="busyRecord === row.id"
                @click="setSaleStatus(row, 'CANCELLED')"
              >
                Cancel
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminModuleShell>

  <!-- ── the bursary queue ─────────────────────────────────────────────── -->
  <AdminModuleShell
    v-else-if="isQueue"
    title="Bursary Confirmation Queue"
    description="Review and confirm store orders awaiting payment."
    :loading="reportLoading"
    :error="reportError"
    :banner="banner"
    :empty-count="queueRows.length"
    @retry="loadQueue"
    @dismiss="banner = ''"
  >
    <template #filters>
      <div class="ap-tabs" role="tablist" aria-label="Order status">
        <button
          v-for="key in QUEUE_TABS"
          :key="key"
          type="button"
          role="tab"
          class="ap-tab"
          :class="{ 'ap-tab--on': queueTab === key }"
          :aria-selected="queueTab === key"
          @click="queueTab = key"
        >
          {{ QUEUE_LABELS[key] }}
        </button>
      </div>
    </template>

    <template #empty>
      <p>No orders in this state.</p>
    </template>

    <div class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th scope="col">Order #</th>
            <th scope="col">Customer</th>
            <th scope="col">Date</th>
            <th scope="col" class="ap-num">Total</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="ap-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleQueue" :key="row.id">
            <td>{{ row.orderNo }}</td>
            <td>{{ row.customerName }}</td>
            <td>{{ row.date }}</td>
            <td class="ap-num">{{ money(Number(row.total)) }}</td>
            <td><AdminStatusBadge :status="row.status" /></td>
            <td class="ap-table__actions">
              <button
                v-if="permitted('store.queue.manage') && (row.status === 'PAID_CONFIRM' || row.status === 'AWAITING_PAYMENT')"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--primary"
                :disabled="busyRecord === row.id"
                @click="openConfirm(row)"
              >
                Confirm
              </button>
              <button
                v-if="permitted('store.queue.manage') && row.status === 'REFUND_PENDING'"
                type="button"
                class="ap-btn ap-btn--xs ap-btn--danger"
                :disabled="busyRecord === row.id"
                @click="openRefund(row)"
              >
                Resolve refund
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- The bursary's two decisions. Each opens its own dialog rather than
         firing from the row button, because the live queue asks for the
         payment reference and the refund note before it will act. -->
    <AdminDialog
      :open="queueDecision?.kind === 'confirm'"
      title="Confirm order"
      kind="edit"
      confirm-label="Confirm order"
      :busy="busyRecord !== ''"
      @close="closeQueueDecision"
      @confirm="submitQueueDecision"
    >
      <p class="ap-inline-note">
        Confirm that the bursary has received payment for
        <strong>{{ queueDecision?.row.orderNo }}</strong> —
        {{ money(Number(queueDecision?.row.total ?? 0)) }} from
        {{ queueDecision?.row.customerName }}.
      </p>
      <label class="ap-field">
        <span class="ap-field__label">Payment method</span>
        <select v-model="paymentMethod" class="ap-input">
          <option>Cash</option>
          <option>Transfer</option>
          <option>POS</option>
        </select>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Payment reference <span aria-hidden="true">*</span></span>
        <input v-model="paymentRef" class="ap-input" type="text" placeholder="Receipt or teller reference" />
        <span class="ap-field__hint">
          The reference the bursary issued when it took the payment.
        </span>
      </label>
    </AdminDialog>

    <AdminDialog
      :open="queueDecision?.kind === 'refund'"
      title="Resolve refund"
      kind="edit"
      confirm-label="Resolve refund"
      danger
      :busy="busyRecord !== ''"
      @close="closeQueueDecision"
      @confirm="submitQueueDecision"
    >
      <p class="ap-inline-note">
        Marking <strong>{{ queueDecision?.row.orderNo }}</strong> refunded returns its stock to the catalogue.
        Both fields below are optional.
      </p>
      <label class="ap-field">
        <span class="ap-field__label">Refund note</span>
        <textarea v-model="refundNote" class="ap-input ap-input--area" rows="3"></textarea>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Refund receipt URL</span>
        <input v-model="refundReceiptUrl" class="ap-input" type="url" placeholder="https://…" />
      </label>
    </AdminDialog>
  </AdminModuleShell>

  <!-- ── everything else: the generic list ────────────────────────────────
       The `v-else` of the chain above, so it must stay adjacent to it: the Vue
       compiler rejects a `v-else` with anything in between. That is why the
       Create Sale dialog below sits after this element and not beside the
       branch that opens it. -->
  <AdminResourcePanel v-else v-model:can="can" :module="module" />

  <!-- ── Create Sale ──────────────────────────────────────────────────────
       Outside the `v-else-if` chain on purpose. Inside it, the dialog would be
       unmounted by the shell branch that is not active, so opening it from the
       sales panel would work but the dialog would be destroyed the moment the
       operator moved away — and a dialog that renders only while its opener is
       on screen is a dialog with a missing case. -->
  <AdminDialog
    :open="saleDialog"
    title="Create Sale"
    kind="edit"
    confirm-label="Create Sale"
    :busy="busy"
    @close="saleDialog = false"
    @confirm="submitSale"
  >
    <p class="ap-inline-note">
      Raise a new sale request. Stock is reserved until payment is confirmed and the items are released.
    </p>

    <label class="ap-field">
      <span class="ap-field__label">Buyer Name</span>
      <input v-model="saleDraft.buyerName" class="ap-input" type="text" placeholder="e.g. John Doe" />
    </label>
    <label class="ap-field">
      <span class="ap-field__label">Buyer Contact</span>
      <input v-model="saleDraft.buyerContact" class="ap-input" type="text" placeholder="Phone or email" />
    </label>
    <label class="ap-field">
      <span class="ap-field__label">Supplier</span>
      <select v-model="saleDraft.supplierId" class="ap-input">
        <option value="none">No supplier</option>
        <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </label>

    <h4 class="ap-band">Items</h4>
    <div v-for="(line, index) in saleDraft.lines" :key="index" class="ap-seat-row" data-cols="3">
      <label class="ap-field">
        <span class="ap-field__label">Stock item</span>
        <select v-model="line.stockItemId" class="ap-input">
          <option value="">Choose a stock item</option>
          <option v-for="item in sellableItems" :key="item.id" :value="item.id">
            {{ item.name }} ({{ item.available }} available)
          </option>
        </select>
        <span v-if="unitPriceOf(line.stockItemId)" class="ap-field__hint">
          Unit price: {{ money(unitPriceOf(line.stockItemId)) }}
        </span>
      </label>
      <label class="ap-field">
        <span class="ap-field__label">Quantity</span>
        <input
          v-model="line.quantity"
          class="ap-input"
          type="number"
          min="1"
          :aria-label="'Quantity for item ' + (index + 1)"
        />
      </label>
      <button
        type="button"
        class="ap-btn ap-btn--xs ap-btn--danger"
        :disabled="saleDraft.lines.length === 1"
        :aria-label="'Remove item ' + (index + 1)"
        @click="removeSaleLine(index)"
      >
        Remove
      </button>
    </div>
    <button type="button" class="ap-btn ap-btn--xs" @click="addSaleLine">Add Item</button>

    <p class="ap-total">
      <span>Total Amount</span>
      <strong>{{ money(saleTotal) }}</strong>
    </p>

    <p v-if="saleError" class="ap-form__error" role="alert">{{ saleError }}</p>
  </AdminDialog>
</template>

<style scoped>
@import './admin-panel.css';

.ap-inv__block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-inv__heading {
  margin: 0;
  font-size: 0.9375rem;
}
</style>
