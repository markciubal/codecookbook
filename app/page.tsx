import Link from "next/link";
import { BarChart2, Layers, ChevronRight, Sparkles, FlaskConical, GitCompare, Wrench } from "lucide-react";
import InfoBadge from "@/components/InfoBadge";
import { BENCHMARK, COMPARE, SORTING_ALGORITHMS, DATA_STRUCTURES, TOOLS } from "@/lib/catalog";
import { TIME_TOKEN, SPACE_TOKEN } from "@/lib/badge-tokens";
import ProgressRing from "@/components/ProgressRing";

const SORTING_ACCENT  = { color: "var(--color-accent)",        bg: "var(--color-accent-muted)" };
const DS_ACCENT       = { color: "var(--color-state-current)", bg: "rgba(196,106,26,0.1)" };
const BENCHMARK_COLOR = "#e07b39";

const STABLE_POPOVER = {
  trueTitle:  "Stable sort",
  falseTitle: "Unstable sort",
  description:
    "A stable sort preserves the relative order of equal elements. If two items compare as equal, they appear in the same order in the output as they did in the input. This matters when sorting records by a secondary key after already sorting by a primary one.",
  url: "https://en.wikipedia.org/wiki/Sorting_algorithm#Stability",
};

const ONLINE_POPOVER = {
  trueTitle:  "Online",
  falseTitle: "Offline",
  description:
    "An online algorithm processes its input one element at a time as it arrives, without needing to see the full dataset first. An online sort can immediately place each new element into the correct position. Useful for data streams and real-time pipelines.",
  url: "https://en.wikipedia.org/wiki/Online_algorithm",
};

export default function HomePage() {
  return (
    <div
      className="min-h-dvh px-5 py-10 lg:px-12"
      style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
    >
      {/* Hero */}
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-muted)", fontFamily: "var(--font-sans)" }}>
          <Sparkles size={11} strokeWidth={1.75} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />The Complete Guide<Sparkles size={11} strokeWidth={1.75} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-1">
          Code<span style={{ color: "var(--color-accent)" }}>Cookbook</span>
        </h1>
        <div className="flex items-center gap-3 mb-4" style={{ maxWidth: "28rem" }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          <span className="text-xs" style={{ color: "var(--color-border)", whiteSpace: "nowrap" }}>Algorithms & Data Structures</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        </div>
        <p className="text-lg max-w-lg" style={{ color: "var(--color-muted)" }}>
          Interactive, step-by-step visualizations of algorithms and data
          structures. Learn by watching, not just reading.
        </p>
      </div>

      {/* Benchmark + Compare banner */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-1">
          <FlaskConical size={20} style={{ color: BENCHMARK_COLOR }} strokeWidth={1.75} />
          <h2 className="text-xl font-semibold">Tools</h2>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>Measure performance and watch algorithms race head-to-head</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href={BENCHMARK.path}
            className="group block rounded-xl p-5 border transition-all hover:-translate-y-0.5"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical size={16} style={{ color: BENCHMARK_COLOR }} strokeWidth={1.75} />
              <span className="font-semibold text-sm">{BENCHMARK.name}</span>
            </div>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--color-muted)" }}>{BENCHMARK.blurb}</p>
            <div className="flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2" style={{ color: BENCHMARK_COLOR }}>
              Open <ChevronRight size={14} strokeWidth={2} />
            </div>
          </Link>
          <Link
            href={COMPARE.path}
            className="group block rounded-xl p-5 border transition-all hover:-translate-y-0.5"
            style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <GitCompare size={16} style={{ color: BENCHMARK_COLOR }} strokeWidth={1.75} />
              <span className="font-semibold text-sm">{COMPARE.name}</span>
            </div>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--color-muted)" }}>{COMPARE.blurb}</p>
            <div className="flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2" style={{ color: BENCHMARK_COLOR }}>
              Open <ChevronRight size={14} strokeWidth={2} />
            </div>
          </Link>
        </div>
      </section>

      {/* Sorting Algorithms */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <BarChart2 size={20} style={{ color: SORTING_ACCENT.color }} strokeWidth={1.75} />
          <h2 className="text-xl font-semibold">Sorting Algorithms</h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: SORTING_ACCENT.bg, color: SORTING_ACCENT.color }}
          >
            {SORTING_ALGORITHMS.length}
          </span>
          <div className="ml-auto">
            <ProgressRing paths={SORTING_ALGORITHMS.map(a => a.path)} label="sorting" color={SORTING_ACCENT.color} />
          </div>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
          See how different strategies sort data step by step
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {SORTING_ALGORITHMS.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="group block rounded-xl p-5 border transition-all hover:-translate-y-0.5"
              style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3
                  className="font-semibold text-base group-hover:text-[color:var(--color-accent)] transition-colors"
                  style={{ color: "var(--color-text)" }}
                >
                  {item.name}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <InfoBadge
                    kind="stable"
                    value={item.stable}
                    trueLabel="stable"
                    falseLabel="unstable"
                    title={item.stable ? STABLE_POPOVER.trueTitle : STABLE_POPOVER.falseTitle}
                    description={STABLE_POPOVER.description}
                    learnMoreUrl={STABLE_POPOVER.url}
                  />
                  <InfoBadge
                    kind="online"
                    value={item.online}
                    trueLabel="online"
                    falseLabel="offline"
                    title={item.online ? ONLINE_POPOVER.trueTitle : ONLINE_POPOVER.falseTitle}
                    description={ONLINE_POPOVER.description}
                    learnMoreUrl={ONLINE_POPOVER.url}
                  />
                </div>
              </div>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {item.blurb}
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs mb-0.5 flex items-center gap-1" style={{ color: "var(--color-muted)" }}>
                    <TIME_TOKEN.icon size={10} strokeWidth={1.75} style={{ color: TIME_TOKEN.color }} />
                    Time
                  </div>
                  <div className="text-sm font-mono font-semibold" style={{ color: TIME_TOKEN.color }}>
                    {item.time}
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: "var(--color-border)" }} />
                <div>
                  <div className="text-xs mb-0.5 flex items-center gap-1" style={{ color: "var(--color-muted)" }}>
                    <SPACE_TOKEN.icon size={10} strokeWidth={1.75} style={{ color: SPACE_TOKEN.color }} />
                    Space
                  </div>
                  <div className="text-sm font-mono font-semibold" style={{ color: SPACE_TOKEN.color }}>
                    {item.space}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2" style={{ color: SORTING_ACCENT.color }}>
                  View Recipe <ChevronRight size={14} strokeWidth={2} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Data Structures */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <Layers size={20} style={{ color: DS_ACCENT.color }} strokeWidth={1.75} />
          <h2 className="text-xl font-semibold">Data Structures</h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: DS_ACCENT.bg, color: DS_ACCENT.color }}
          >
            {DATA_STRUCTURES.length}
          </span>
          <div className="ml-auto">
            <ProgressRing paths={DATA_STRUCTURES.map(d => d.path)} label="structures" color={DS_ACCENT.color} />
          </div>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
          Push, pop, enqueue, dequeue — watch every operation live
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {DATA_STRUCTURES.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="group block rounded-xl p-5 border transition-all hover:-translate-y-0.5"
              style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3
                  className="font-semibold text-base group-hover:text-[color:var(--color-accent)] transition-colors"
                  style={{ color: "var(--color-text)" }}
                >
                  {item.name}
                </h3>
              </div>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {item.blurb}
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs mb-0.5 flex items-center gap-1" style={{ color: "var(--color-muted)" }}>
                    <TIME_TOKEN.icon size={10} strokeWidth={1.75} style={{ color: TIME_TOKEN.color }} />
                    Time
                  </div>
                  <div className="text-sm font-mono font-semibold" style={{ color: TIME_TOKEN.color }}>
                    {item.time}
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: "var(--color-border)" }} />
                <div>
                  <div className="text-xs mb-0.5 flex items-center gap-1" style={{ color: "var(--color-muted)" }}>
                    <SPACE_TOKEN.icon size={10} strokeWidth={1.75} style={{ color: SPACE_TOKEN.color }} />
                    Space
                  </div>
                  <div className="text-sm font-mono font-semibold" style={{ color: SPACE_TOKEN.color }}>
                    {item.space}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2" style={{ color: DS_ACCENT.color }}>
                  View Recipe <ChevronRight size={14} strokeWidth={2} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-1">
          <Wrench size={20} style={{ color: BENCHMARK_COLOR }} strokeWidth={1.75} />
          <h2 className="text-xl font-semibold">Tools</h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(224,123,57,0.12)", color: BENCHMARK_COLOR }}>
            {TOOLS.length}
          </span>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
          Practice, calculate, and explore algorithms interactively
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {TOOLS.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="group block rounded-xl p-5 border transition-all hover:-translate-y-0.5"
              style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3
                  className="font-semibold text-base group-hover:text-[color:var(--color-accent)] transition-colors"
                  style={{ color: "var(--color-text)" }}
                >
                  {item.name}
                </h3>
              </div>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {item.blurb}
              </p>
              <div className="flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2" style={{ color: BENCHMARK_COLOR }}>
                Open <ChevronRight size={14} strokeWidth={2} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
