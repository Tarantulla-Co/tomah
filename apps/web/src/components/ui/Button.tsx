import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({ variant = "primary", loading, children, disabled, ...rest }: Props) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "Working…" : children}
    </button>
  );
}
