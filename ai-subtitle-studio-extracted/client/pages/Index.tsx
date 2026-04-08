import { motion } from "framer-motion";
import {
  ArrowRight,
  Captions,
  CheckCircle2,
  Clock3,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    title: "Auto captions",
    description: "Generate ready-to-edit subtitle blocks from a single upload.",
    icon: Captions,
  },
  {
    title: "Smart styling",
    description: "Apply creator-first presets for Instagram, YouTube, and short-form reels.",
    icon: Wand2,
  },
  {
    title: "Fast processing",
    description: "Move from raw footage to export-ready subtitles in a focused workflow.",
    icon: Zap,
  },
];

const metrics = [
  { value: "3x", label: "Faster editing cycles" },
  { value: "92%", label: "Subtitle retention clarity" },
  { value: "4K", label: "Creator-ready export pipeline" },
];

const workflow = [
  "Upload your video and start the AI subtitle pass.",
  "Review the generated timeline and rewrite any line instantly.",
  "Apply platform presets, highlight hooks, and export the final asset.",
];

export default function Index() {
  return (
    <div className="space-y-16 pb-8 sm:space-y-20">
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="max-w-3xl space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/65">
              <Sparkles className="h-4 w-4 text-brand" /> Creator-focused subtitle SaaS
            </p>
            <div className="space-y-4">
              <h1 className="text-balance font-display text-5xl leading-none text-white sm:text-6xl lg:text-7xl">
                Turn videos into viral content with AI subtitles
              </h1>
              <p className="max-w-2xl text-base leading-8 text-white/60 sm:text-lg">
                Upload footage, generate polished captions, edit every line with live styling controls, and export assets that feel ready for product teams, agencies, and high-growth startups.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
              >
                Upload Video <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/editor"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Open editor preview
              </Link>
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 + index * 0.08 }}
                className="glass-panel rounded-[1.75rem] p-5"
              >
                <p className="font-display text-3xl text-white">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-white/55">{metric.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="glass-panel relative overflow-hidden rounded-[2rem] p-4 sm:p-5"
        >
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand/20 via-brand-secondary/10 to-transparent" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950 shadow-panel">
            <div className="aspect-[4/5] bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.22),_transparent_35%),linear-gradient(150deg,_rgba(17,24,39,0.95),_rgba(15,23,42,0.92),_rgba(7,15,28,1))] p-5 sm:p-6">
              <div className="flex items-center justify-between text-white/60">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.24em]">
                  <Clock3 className="h-3.5 w-3.5" /> Live demo
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                  Subtitle style: Reel
                </div>
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="aspect-video rounded-[1.25rem] bg-[linear-gradient(135deg,_rgba(139,92,246,0.32),_transparent_35%),linear-gradient(160deg,_rgba(2,6,23,0.9),_rgba(17,24,39,0.96),_rgba(8,47,73,0.75))] p-5">
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/65 backdrop-blur">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" /> AI processing
                      </div>
                      <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/55 backdrop-blur">
                        00:08
                      </div>
                    </div>
                    <div className="space-y-3">
                      <motion.div
                        initial={{ opacity: 0.7, y: 8 }}
                        animate={{ opacity: [0.7, 1, 0.7], y: [8, 0, 8] }}
                        transition={{ duration: 3.2, repeat: Number.POSITIVE_INFINITY }}
                        className="rounded-[1.4rem] border border-white/10 bg-black/35 px-4 py-3 font-creative text-2xl uppercase tracking-[0.08em] text-white shadow-2xl backdrop-blur-xl"
                      >
                        This is how you go <span className="rounded-md bg-fuchsia-400 px-2 py-1 text-slate-950">viral</span>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0.6, x: -6 }}
                        animate={{ opacity: [0.6, 1, 0.6], x: [-6, 0, -6] }}
                        transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, delay: 0.2 }}
                        className="max-w-xs rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/55 backdrop-blur"
                      >
                        AI subtitles + smart styling + export in one flow
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/35">Accuracy</p>
                  <p className="mt-2 font-display text-2xl text-white">95.2%</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/35">Styles</p>
                  <p className="mt-2 font-display text-2xl text-white">3 presets</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/35">Export</p>
                  <p className="mt-2 font-display text-2xl text-white">MP4 + SRT</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {features.map(({ title, description, icon: Icon }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, delay: index * 0.06 }}
            className="glass-panel rounded-[2rem] p-6"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-brand">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 font-display text-2xl text-white">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-white/55">{description}</p>
          </motion.div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Why it works</p>
          <h2 className="mt-3 max-w-lg font-display text-3xl text-white sm:text-4xl">
            A clean SaaS workflow inspired by Linear, Notion, and modern creator tools.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
            The experience is intentionally minimal, fast, and confident — designed to feel like a premium internal tool instead of a generic template.
          </p>
        </div>

        <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <div className="grid gap-4">
            {workflow.map((item, index) => (
              <div key={item} className="flex gap-4 rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 font-display text-lg text-white">
                  0{index + 1}
                </div>
                <div>
                  <p className="font-medium text-white">{item}</p>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {index === 0 && "Secure upload handling with visual progress feedback and instant preview generation."}
                    {index === 1 && "Interactive editor controls let you revise language and keep subtitles platform-specific."}
                    {index === 2 && "Export deliverables stay aligned with creator needs, from baked captions to clean subtitle files."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-panel flex flex-col gap-6 rounded-[2rem] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-sm text-white/55">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Production-ready starter for AI subtitle workflows
          </p>
          <h2 className="mt-3 font-display text-3xl text-white sm:text-4xl">
            Launch the dashboard and start shaping your first export.
          </h2>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
        >
          Upload Video <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
