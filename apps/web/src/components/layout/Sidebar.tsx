import { NavLink } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { DELIVERED_THROUGH_PHASE, visibleNav } from "../../lib/nav";
import styles from "./Sidebar.module.css";

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { hasRole } = useAuth();
  const sections = visibleNav(hasRole);

  return (
    <aside className={`${styles.sidebar} ${open ? styles.open : ""}`}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden>
          ▲
        </span>
        <span className={styles.brandText}>
          Tomah <strong>Admin</strong>
        </span>
      </div>

      <nav className={styles.nav}>
        {sections.map((section) => (
          <div key={section.title} className={styles.group}>
            <div className={styles.groupTitle}>{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `${styles.link} ${isActive ? styles.active : ""}`
                }
              >
                <span className={styles.dot} aria-hidden />
                <span>{item.label}</span>
                {item.phase > DELIVERED_THROUGH_PHASE && (
                  <span className={styles.phase}>P{item.phase}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.foot}>Phase 3 · Wholesale Accounts</div>
    </aside>
  );
}
