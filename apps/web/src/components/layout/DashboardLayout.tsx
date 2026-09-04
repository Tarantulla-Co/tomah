import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import styles from "./DashboardLayout.module.css";

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className={styles.scrim} onClick={() => setSidebarOpen(false)} />
      )}
      <div className={styles.main}>
        <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
