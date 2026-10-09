/**
 * AdminMoneyPanel — the three fee and wallet pages that are summaries rather
 * than lists: `/school-fees`, `/school-fees/reports` and `/wallets/reports`.
 *
 * WHY NOT THE GENERIC PANEL
 * -------------------------
 * None of these three has a row of its own to list. `/school-fees` is three
 * summary numbers plus a category breakdown; `/school-fees/reports` is three
 * numbers plus a `Collected by Category` list; `/wallets/reports` is five
 * numbers plus a recent-transactions table. A registry entry is a description of
 * a list, so these are not list modules and declaring them as one would make the
 * registry claim something false about them.
 *
 * WHAT IS *NOT* HERE, AND WHERE IT IS
 * ------------------------------------
 * `/school-fees/categories`, `/school-fees/items` and `/school-fees/payments` ARE
 * plain lists and go through `AdminResourcePanel` — the first two have registry
 * entries and the third is declared there too. The wallet *list* (`/wallets`) is
 * also a plain list; its Top up / Deduct row actions are issued by the generic
 * panel, which is why `ADJUST_WALLET` is the one action in `issueFor` that
 * carries its own kind and amount rather than reading them off the form.
 */
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { callApi } from '../../api';
import AdminModuleShell from './AdminModuleShell.vue';
import { money } from '../../api/mockAdmin';
import { useAdminSession } from './useAdminSession';
import type { AdminModule } from '../../types/admin-registry';
import type { FeeItem, FeePayment } from '../../types/admin';

const props = defineProps<{ module: AdminModule }>();

const session = useAdminSession();

const isBreakdown = computed(() => props.module.resource === 'fee-breakdown');
const isFeeReports = computed(() => props.module.resource === 'fee-reports');

/*
 * The remaining kind is read as "not one of the two above" rather than as a third
 * comparison, because there are exactly three resources this component owns and
 * the third is the fallback branch of the template. Naming it would give it an
 * apparent independence it does not have: adding a fourth kind would need the
 * branch rewritten anyway, and the named flag would then be a lie the compiler
 * cannot catch.
 */

interface Breakdown {
  rows: FeeItem[];
  total: number;
  paid: number;
  payments: FeePayment[];
}
interface FeeReports {
  collected: number;
  payments: number;
  pending: number;
  byCategory: Array<{ name: string; amount: number }>;
}
interface WalletReports {
  liability: number;
  funded: number;
  spent: number;
  active: number;
  confirmed: number;
  transactions: Array<{ id: string; studentName: string; type: string; amount: number; note: string; createdAt: string }>;
}

const breakdown = ref<Breakdown | null>(null);
const feeReports = ref<FeeReports | null>(null);
const walletReports = ref<WalletReports | null>(null);
const loading = ref(false);
const loadError = ref('');
const banner = ref('');

const categoryCount = computed(() => new Set((breakdown.value?.rows ?? []).map((r) => r.categoryName)).size);

/** The live page's share of the bar list, as a percentage of the largest. */
const share = (amount: number): number => {
  const rows = feeReports.value?.byCategory ?? [];
  const max = rows.reduce((n, r) => Math.max(n, r.amount), 0);
  return max === 0 ? 0 : Math.round((amount / max) * 100);
};

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = '';
  try {
    if (isBreakdown.value) {
      const data = await callApi('GET_ADMIN_FEE_BREAKDOWN', {});
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
      breakdown.value = data;
    } else if (isFeeReports.value) {
      const data = await callApi('GET_ADMIN_FEE_REPORTS', {});
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
      feeReports.value = data;
    } else {
      const data = await callApi('GET_ADMIN_WALLET_REPORTS', { schoolID: session.schoolId() });
      if (data.status !== 'success') throw new Error(data.message || 'Failed to load.');
      walletReports.value = data;
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load.';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <!-- Fee breakdown: what the live `/school-fees` page shows. -->
  <AdminModuleShell
    v-if="isBreakdown"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="breakdown?.rows.length ?? 0"
    @retry="load"
    @dismiss="banner = ''"
  >
    <template #actions>
      <RouterLink class="ap-btn ap-btn--primary" :to="{ path: '/admin/', query: { panel: 'fee-payments', action: 'create' } }">
        New Payment
      </RouterLink>
    </template>

    <div class="ap-statgrid">
      <div class="ap-stat"><span class="ap-stat__label">Total</span><span class="ap-stat__value">{{ money(breakdown?.total ?? 0) }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Paid</span><span class="ap-stat__value">{{ money(breakdown?.paid ?? 0) }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Payments Made</span><span class="ap-stat__value">{{ breakdown?.payments.length ?? 0 }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Fee Categories</span><span class="ap-stat__value">{{ categoryCount }}</span></div>
    </div>

    <p v-if="!breakdown?.payments.length" class="ap-inline-note">No payments recorded yet.</p>

    <section v-if="breakdown?.rows.length" class="ap-money__block">
      <h3 class="ap-money__heading">Fee breakdown</h3>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <caption class="ap-table__caption">Fee items in scope</caption>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Category</th>
              <th scope="col">Class</th>
              <th scope="col" class="ap-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in breakdown.rows" :key="row.id">
              <td>{{ row.description }}</td>
              <td>{{ row.categoryName }}</td>
              <td>{{ row.className }}</td>
              <td class="ap-num">{{ money(row.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="breakdown?.payments.length" class="ap-money__block">
      <h3 class="ap-money__heading">Payment history</h3>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Student</th>
              <th scope="col" class="ap-num">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Paid at</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in breakdown.payments" :key="row.id">
              <td>{{ row.reference }}</td>
              <td>{{ row.studentName }}</td>
              <td class="ap-num">{{ money(row.amount) }}</td>
              <td>{{ row.status }}</td>
              <td>{{ row.paidAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminModuleShell>

  <!-- Fee reports. -->
  <AdminModuleShell
    v-else-if="isFeeReports"
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="feeReports ? 1 : 0"
    @retry="load"
    @dismiss="banner = ''"
  >
    <div class="ap-statgrid">
      <div class="ap-stat"><span class="ap-stat__label">Total Collected</span><span class="ap-stat__value">{{ money(feeReports?.collected ?? 0) }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Payments</span><span class="ap-stat__value">{{ feeReports?.payments ?? 0 }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Pending Payments</span><span class="ap-stat__value">{{ feeReports?.pending ?? 0 }}</span></div>
    </div>

    <section class="ap-money__block">
      <h3 class="ap-money__heading">Collected by Category</h3>
      <p v-if="!feeReports?.byCategory.length" class="ap-inline-note">No confirmed collections to show yet.</p>
      <div v-else class="ap-money__bars">
        <div v-for="row in feeReports.byCategory" :key="row.name" class="ap-money__bar">
          <span class="ap-money__barlabel">{{ row.name }}</span>
          <span class="ap-money__bartrack" aria-hidden="true">
            <span class="ap-money__barfill" :style="{ width: share(row.amount) + '%' }" />
          </span>
          <span class="ap-money__barvalue">{{ money(row.amount) }}</span>
        </div>
      </div>
    </section>
  </AdminModuleShell>

  <!-- Wallet reports. -->
  <AdminModuleShell
    v-else
    :title="module.title"
    :description="module.description"
    :loading="loading"
    :error="loadError"
    :banner="banner"
    :empty-count="walletReports ? 1 : 0"
    @retry="load"
    @dismiss="banner = ''"
  >
    <div class="ap-statgrid">
      <div class="ap-stat"><span class="ap-stat__label">Total Liability</span><span class="ap-stat__value">{{ money(walletReports?.liability ?? 0) }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Total Funded</span><span class="ap-stat__value">{{ money(walletReports?.funded ?? 0) }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Total Spent</span><span class="ap-stat__value">{{ money(walletReports?.spent ?? 0) }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Active Wallets</span><span class="ap-stat__value">{{ walletReports?.active ?? 0 }}</span></div>
      <div class="ap-stat"><span class="ap-stat__label">Confirmed Transactions</span><span class="ap-stat__value">{{ walletReports?.confirmed ?? 0 }}</span></div>
    </div>

    <section v-if="(walletReports?.transactions.length ?? 0) > 0" class="ap-money__block">
      <h3 class="ap-money__heading">Recent transactions</h3>
      <div class="ap-table-wrap">
        <table class="ap-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Type</th>
              <th scope="col" class="ap-num">Amount</th>
              <th scope="col">Note</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in walletReports?.transactions ?? []" :key="row.id">
              <td>{{ row.studentName }}</td>
              <td>{{ row.type }}</td>
              <td class="ap-num">{{ money(row.amount) }}</td>
              <td>{{ row.note }}</td>
              <td>{{ row.createdAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdminModuleShell>
</template>

<style scoped>
@import './admin-panel.css';

.ap-money__block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-money__heading {
  margin: 0;
  font-size: 0.9375rem;
}

.ap-money__bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ap-money__bar {
  display: grid;
  grid-template-columns: minmax(120px, 220px) 1fr auto;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
}

.ap-money__bartrack {
  height: 0.625rem;
  border-radius: 999px;
  background: #eef2f7;
  overflow: hidden;
}

.ap-money__barfill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--laec-blue, #1c4e80);
}

.ap-money__barvalue {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .ap-money__bar { grid-template-columns: 1fr; }
}
</style>
