import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-glow">
        <img
          src="/logo.png"
          alt="SubZI Logo"
          className="h-full w-full object-contain"
        />
      </div>
      {!compact && (
        <div>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-white/45">
            SubZI
          </p>
          <p className="text-sm font-medium text-white/80">AI Subtitle Studio</p>
        </div>
      )}
    </div>
  );
}

