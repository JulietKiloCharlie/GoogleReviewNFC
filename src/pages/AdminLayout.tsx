import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";

const links = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/businesses", label: "Businesses", end: true },
  { to: "/admin/businesses/new", label: "Add Business", end: false },
  { to: "/admin/settings", label: "Settings", end: false },
];

export function AdminLayout() {
  const auth = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
          <div className="mr-auto">
            <p className="text-xs tracking-wide text-accent">Syntrex Group Limited</p>
            <p className="font-semibold">Google Review NFC Dashboard</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `min-h-11 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-white text-ink" : "text-muted hover:bg-panel"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <button className="min-h-11 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel" type="button" onClick={() => auth.signOut()}>
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
