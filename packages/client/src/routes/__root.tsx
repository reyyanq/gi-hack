import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useGraphHealth } from "../lib/graph";

function NotFound() {
  return (
    <div style={{ padding: "80px 32px", textAlign: "center", color: "#8a8f9e" }}>
      <h1 style={{ fontSize: 64, fontWeight: 700, color: "#6366f1", margin: "0 0 8px" }}>404</h1>
      <p style={{ fontSize: 16, margin: "0 0 24px" }}>This page doesn&apos;t exist in LeadGraph.</p>
      <a href="/" style={{ color: "#6366f1", textDecoration: "underline", fontSize: 14 }}>Back to Dashboard</a>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14,2 14,8 20,8" />
      </svg>
    ),
  },
  {
    to: "/leads",
    label: "Leads",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    to: "/pipeline",
    label: "Pipeline",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="5" height="18" rx="1" />
        <rect x="10" y="7" width="5" height="14" rx="1" />
        <rect x="17" y="11" width="5" height="10" rx="1" />
      </svg>
    ),
  },
  {
    to: "/graph",
    label: "Graph Explorer",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
  },
  {
    to: "/admin",
    label: "Admin",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
];

function StatusDot() {
  const { data, isLoading } = useGraphHealth();
  const ok = !isLoading && data?.status === "ok";
  return (
    <span
      title={ok ? "Graph DB connected" : "Graph DB disconnected"}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: isLoading ? "#888" : ok ? "#22c55e" : "#ef4444",
        boxShadow: ok ? "0 0 0 2px rgba(34,197,94,0.25)" : undefined,
        flexShrink: 0,
      }}
    />
  );
}

export function RootLayout() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", backgroundColor: "#0f1117" }}>

      <header style={{
        height: 64,
        backgroundColor: "#161b27",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        flexShrink: 0,
        gap: "48px",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>L</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.2px" }}>LeadGraph</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>Siemens Healthineers</div>
          </div>
        </div>

         {/* Nav Links */}
        <nav style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{ textDecoration: "none" }}
              activeProps={{ style: { textDecoration: "none" } }}
            >
              {({ isActive }) => (
                 <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#fff" : "#8a8f9e",
                  backgroundColor: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                  border: isActive ? "1px solid rgba(99,102,241,0.25)" : "1px solid transparent",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}>
                  <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
                  {item.label}
                </div>
              )}
            </Link>
          ))}
        </nav>

         {/* Status */}
        <div style={{
          padding: "10px 16px",
          borderRadius: 8,
          backgroundColor: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}>
          <StatusDot />
          <span style={{ fontSize: 11, color: "#888" }}>Graph DB</span>
        </div>
      </header>

      <main style={{ flex: 1, overflow: "auto", backgroundColor: "#0f1117" }}>
        <Outlet />
      </main>
    </div>
  );
}
