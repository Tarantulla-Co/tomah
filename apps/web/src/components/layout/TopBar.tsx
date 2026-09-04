import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { ROLE_LABELS } from "../../lib/types";
import styles from "./TopBar.module.css";

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <button className={styles.hamburger} onClick={onToggleSidebar} aria-label="Toggle navigation">
          ☰
        </button>

        {/* Account switcher pill (top-left). Single entity today; the control is
            here so business units / warehouses can be added later without a
            layout change. */}
        <button className={styles.accountPill} type="button" title="Account">
          <span className={styles.accountAvatar} aria-hidden>
            T
          </span>
          <span className={styles.accountName}>Tomah International</span>
          <span className={styles.chevron} aria-hidden>
            ▾
          </span>
        </button>
      </div>

      <div className={styles.right}>
        {hasRole("ADMIN") && (
          <button
            className={styles.iconBtn}
            aria-label="Settings"
            title="Settings"
            onClick={() => navigate("/settings")}
          >
            ⚙
          </button>
        )}

        <div className={styles.userWrap}>
          <button className={styles.userBtn} onClick={() => setMenuOpen((v) => !v)}>
            <span className={styles.userAvatar} aria-hidden>
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
            <span className={styles.userMeta}>
              <span className={styles.userName}>{user?.name}</span>
              <span className={styles.userRole}>{user ? ROLE_LABELS[user.role] : ""}</span>
            </span>
            <span className={styles.chevron} aria-hidden>
              ▾
            </span>
          </button>

          {menuOpen && (
            <>
              <div className={styles.backdrop} onClick={() => setMenuOpen(false)} />
              <div className={styles.menu} role="menu">
                <div className={styles.menuEmail}>{user?.email}</div>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
