import type { ReactNode } from "react";
import styles from "./Badge.module.css";

/**
 * Status badge. Tone maps to the UI Direction's status colour system —
 * distinct hues, never Tomah Blue (blue stays structural).
 *   success  -> green   (Paid, Approved, Delivered)
 *   danger   -> red     (Failed, Rejected, Overdue, Cancelled)
 *   pending  -> yellow  (Pending approval, Quote sent, Draft) — the one
 *              functional use of Camouflage Yellow
 *   neutral  -> grey    (Processing, Shipped, and other in-between states)
 */
export type BadgeTone = "success" | "danger" | "pending" | "neutral";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

/** Central mapping so every table renders the same status the same way. */
export function toneForStatus(status: string): BadgeTone {
  const s = status.toUpperCase();
  if (["PAID", "APPROVED", "DELIVERED", "SYNCED", "ACTIVE", "CONVERTED"].includes(s)) return "success";
  if (["FAILED", "REJECTED", "OVERDUE", "CANCELLED", "VOID", "REFUNDED", "EXPIRED"].includes(s)) return "danger";
  if (["PENDING", "DRAFT", "SENT", "REQUESTED", "PENDING_APPROVAL"].includes(s)) return "pending";
  return "neutral";
}
