import { BarChart3, Download, Sparkles, Wand2 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const navigation = [
  { to: "/", label: "Home", icon: Sparkles },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/editor", label: "Editor", icon: Wand2 },
  { to: "/export", label: "Export", icon: Download },
];

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-hero-glow opacity-80" />
      <div className="pointer-events-none fixed inset-0 app-grid opacity-25" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-10 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 pt-4">
          <div className="glass-panel mx-auto flex items-center justify-between rounded-3xl px-4 py-3 sm:px-6">
            <BrandMark />
            <nav className="hidden items-center gap-2 md:flex">
              {navigation.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white/65 transition hover:bg-white/8 hover:text-white",
                      isActive && "bg-white/10 text-white shadow-panel",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <NavLink
              to="/dashboard"
              className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
            >
              Launch Studio
            </NavLink>
          </div>
        </header>

        <main className="flex-1 pt-8 sm:pt-10">
          <Outlet />
        </main>

        <footer className="mt-8 border-t border-white/10 px-2 pt-6 text-sm text-white/45">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="SubZI" className="h-6 w-6 rounded-lg object-contain" />
              <p>© {new Date().getFullYear()} SubZI — AI-powered subtitle workflows for creators.</p>
            </div>
            <p className="text-white/30">Upload. Style. Export.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
