import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="stack" style={{ padding: "var(--space-7)", textAlign: "center" }}>
      <h1 className="page-title">Page not found</h1>
      <p className="muted">That route doesn’t exist in the admin dashboard.</p>
      <p>
        <Link to="/">Back to dashboard</Link>
      </p>
    </div>
  );
}
