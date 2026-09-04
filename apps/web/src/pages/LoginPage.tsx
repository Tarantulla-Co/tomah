import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Button } from "../components/ui/Button";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "authenticated") {
    const dest = (location.state as { from?: Location })?.from?.pathname ?? "/";
    return <Navigate to={dest} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            ▲
          </span>
          Tomah <strong>Admin</strong>
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.sub}>Owner &amp; staff dashboard for Tomah International.</p>

        <form onSubmit={onSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <Button type="submit" loading={busy}>
            Sign in
          </Button>
        </form>
      </div>
      <p className={styles.footnote}>
        Seeded dev accounts use password <code>Tomah!2026</code> — e.g.{" "}
        <code>owner@tomah.test</code>, <code>orders1@tomah.test</code>,{" "}
        <code>content1@tomah.test</code>.
      </p>
    </div>
  );
}
