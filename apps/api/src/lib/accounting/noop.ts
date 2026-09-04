import type { AccountingAdapter } from "./types.js";

/**
 * Default adapter — no accounting system is configured. `connected: false` tells
 * the invoice controller to skip the sync attempt, leaving a paid invoice at
 * accountingSyncStatus = NOT_SYNCED. Phase 8 replaces this with a real adapter.
 */
export const noopAccountingAdapter: AccountingAdapter = {
  name: "noop",
  connected: false,
  async syncInvoice() {
    throw new Error("No accounting adapter is configured (ACCOUNTING_ADAPTER=noop)");
  },
};
