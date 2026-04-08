import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-glow">
        <div className="absolute inset-[1px] rounded-[15px] bg-gradient-to-br from-brand via-brand-secondary to-cyan-400 opacity-90" />
        <div className="relative h-5 w-5 rounded-full border-2 border-white/80" />
      </div>
      {!compact && (
        <div>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-white/45">
            SubtleAI
          </p>
          <p className="text-sm font-medium text-white/80">Video Subtitle Studio</p>
        </div>
      )}
    </div>
  );
}
