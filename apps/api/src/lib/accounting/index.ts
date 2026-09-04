import { env } from "../../config/env.js";
import { noopAccountingAdapter } from "./noop.js";
import type { AccountingAdapter } from "./types.js";

export type {
  AccountingAdapter,
  AccountingInvoice,
  AccountingSyncResult,
} from "./types.js";

function build(): AccountingAdapter {
  switch (env.ACCOUNTING_ADAPTER) {
    // Phase 8: case "quickbooks": return new QuickBooksAdapter(...)
    case "noop":
    default:
      return noopAccountingAdapter;
  }
}

export const accounting: AccountingAdapter = build();
