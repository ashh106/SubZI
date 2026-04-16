import { Compass } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
      <div className="glass-panel w-full rounded-[2rem] p-8 text-center sm:p-10">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-white/8 text-brand">
          <Compass className="h-7 w-7" />
        </div>
        <p className="mt-6 text-sm uppercase tracking-[0.32em] text-white/40">404</p>
        <h1 className="mt-3 font-display text-4xl text-white">This route is off the timeline</h1>
        <p className="mt-4 text-base leading-7 text-white/60">
          The page <span className="text-white/85">{location.pathname}</span> does not exist in the current subtitle studio flow.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
          >
            Return home
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
