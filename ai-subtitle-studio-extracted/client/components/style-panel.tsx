import { Sparkles, Type } from "lucide-react";

import { subtitlePresets, type SubtitlePresetId, type SubtitleStyle } from "@/lib/studio-data";
import { cn } from "@/lib/utils";

interface StylePanelProps {
  activePreset: SubtitlePresetId;
  style: SubtitleStyle;
  onPresetChange: (preset: SubtitlePresetId) => void;
  onStyleChange: (stylePatch: Partial<SubtitleStyle>) => void;
  onToggleKeyword: (keyword: string) => void;
}

const swatches = ["#F8FAFC", "#F97316", "#38BDF8", "#8B5CF6", "#34D399"];
const keywordSuggestions = ["viral", "AI", "captions", "export", "creator"];

export function StylePanel({
  activePreset,
  style,
  onPresetChange,
  onStyleChange,
  onToggleKeyword,
}: StylePanelProps) {
  return (
    <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Styles</p>
          <h2 className="mt-2 font-display text-2xl text-white">Preset and polish</h2>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-brand">
          <Type className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-white/65">
            <Sparkles className="h-4 w-4 text-brand" /> Style presets
          </div>
          <div className="grid gap-3">
            {subtitlePresets.map((preset) => {
              const active = preset.id === activePreset;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onPresetChange(preset.id)}
                  className={cn(
                    "rounded-[1.4rem] border p-4 text-left transition",
                    active
                      ? "border-brand/60 bg-brand/10 shadow-glow"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-white">{preset.label}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-white/35">
                      {active ? "Active" : "Preset"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/55">{preset.summary}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-sm text-white/65">
            <span>Font size</span>
            <span>{style.fontSize}px</span>
          </div>
          <input
            type="range"
            min={24}
            max={56}
            value={style.fontSize}
            onChange={(event) => onStyleChange({ fontSize: Number(event.target.value) })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-brand"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-white/65">
              <span>Font family</span>
              <select
                value={style.fontFamily}
                onChange={(event) =>
                  onStyleChange({ fontFamily: event.target.value as SubtitleStyle["fontFamily"] })
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-brand/50"
              >
                <option value="sans">Inter</option>
                <option value="display">Sora</option>
                <option value="creative">Space Grotesk</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-white/65">
              <span>Alignment</span>
              <select
                value={style.align}
                onChange={(event) =>
                  onStyleChange({ align: event.target.value as SubtitleStyle["align"] })
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-brand/50"
              >
                <option value="center">Centered</option>
                <option value="left">Left aligned</option>
              </select>
            </label>
          </div>

          <div className="space-y-2 text-sm text-white/65">
            <span>Text color</span>
            <div className="flex flex-wrap gap-2">
              {swatches.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => onStyleChange({ color: swatch })}
                  className={cn(
                    "h-9 w-9 rounded-full border transition",
                    style.color === swatch ? "border-white shadow-panel" : "border-white/15",
                  )}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white/65">
            <span>All caps emphasis</span>
            <input
              type="checkbox"
              checked={style.uppercase}
              onChange={(event) => onStyleChange({ uppercase: event.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-transparent text-brand accent-brand"
            />
          </label>
        </section>

        <section className="space-y-3">
          <p className="text-sm text-white/65">Highlight keywords</p>
          <div className="flex flex-wrap gap-2">
            {keywordSuggestions.map((keyword) => {
              const active = style.keywords.includes(keyword);
              return (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => onToggleKeyword(keyword)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition",
                    active
                      ? "border-brand/50 bg-brand/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20",
                  )}
                >
                  {keyword}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
