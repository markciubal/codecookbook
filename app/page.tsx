import Link from "next/link";
import { BarChart2, Layers, ChevronRight, Sparkles, FlaskConical } from "lucide-react";
import InfoBadge from "@/components/InfoBadge";

const SECTIONS = [
  {
    title: "Sorting Algorithms",
    description: "See how different strategies sort data step by step",
    accentColor: "var(--color-accent)",
    accentBg: "var(--color-accent-muted)",
    icon: "sorting",
    items: [
      { name: "Bubble Sort",    path: "/sorting/bubble",    time: "O(n²)",      space: "O(1)",      stable: true,  online: false, blurb: "Adjacent elements bubble toward their correct positions, pass by pass." },
      { name: "Selection Sort", path: "/sorting/selection", time: "O(n²)",      space: "O(1)",      stable: false, online: false, blurb: "Repeatedly finds the minimum in the unsorted region and places it next." },
      { name: "Insertion Sort", path: "/sorting/insertion", time: "O(n²)",      space: "O(1)",      stable: true,  online: true,  blurb: "Inserts each element into its correct spot among already-sorted elements." },
      { name: "Merge Sort",     path: "/sorting/merge",     time: "O(n log n)", space: "O(n)",      stable: true,  online: false, blurb: "Divides in half, sorts each half, then merges. Guaranteed O(n log n)." },
      { name: "Quick Sort",     path: "/sorting/quick",     time: "O(n log n)", space: "O(log n)",  stable: false, online: false, blurb: "Picks a pivot, partitions around it, and recurses on both sides." },
      { name: "Heap Sort",      path: "/sorting/heap",      time: "O(n log n)", space: "O(1)",      stable: false, online: false, blurb: "Builds a max-heap, then extracts the maximum element repeatedly." },
      { name: "Shell Sort",     path: "/sorting/shell",     time: "O(n log² n)",space: "O(1)",      stable: false, online: false, blurb: "Generalized insertion sort with a decreasing gap sequence." },
      { name: "Counting Sort",  path: "/sorting/counting",  time: "O(n+k)",     space: "O(k)",      stable: true,  online: false, blurb: "Counts occurrences of each value, then reconstructs the sorted array." },
      { name: "Radix Sort",     path: "/sorting/radix",     time: "O(nk)",      space: "O(n+k)",    stable: true,  online: false, blurb: "Sorts digit by digit from least to most significant using counting sort." },
      { name: "Bucket Sort",    path: "/sorting/bucket",    time: "O(n+k)",     space: "O(n)",      stable: true,  online: false, blurb: "Distributes elements into buckets, sorts each, then concatenates." },
      { name: "Tim Sort",       path: "/sorting/timsort",   time: "O(n log n)", space: "O(n)",      stable: true,  online: false, blurb: "Hybrid of insertion sort and merge sort. Used in Python and Java standard libraries." },
      { name: "Logos Sort",     path: "/sorting/logos",     time: "O(n log n)", space: "O(log n)",  stable: false, online: false, blurb: "A philosophy of sorting. Dual φ-pivots, chaos factor, counting sort shortcut, and gallop pre-scan." },
    ],
  },
  {
    title: "Data Structures",
    description: "Push, pop, enqueue, dequeue — watch every operation live",
    accentColor: "var(--color-state-current)",
    accentBg: "rgba(196,106,26,0.1)",
    icon: "ds",
    items: [
      { name: "Stack",       path: "/ds/stack",       time: "O(1)",     space: "O(n)", stable: null, online: null, blurb: "Last-In-First-Out. Push and pop from the top of the stack." },
      { name: "Queue",       path: "/ds/queue",       time: "O(1)",     space: "O(n)", stable: null, online: null, blurb: "First-In-First-Out. Enqueue at back, dequeue from the front." },
      { name: "Deque",       path: "/ds/deque",       time: "O(1)",     space: "O(n)", stable: null, online: null, blurb: "Double-ended queue. Push and pop from both front and back." },
      { name: "Linked List", path: "/ds/linked-list", time: "O(n)",     space: "O(n)", stable: null, online: null, blurb: "Nodes connected by pointers. Insert, delete, and traverse." },
      { name: "Binary Heap", path: "/ds/binary-heap", time: "O(log n)", space: "O(n)", stable: null, online: null, blurb: "Min-heap tree. Insert and extract-min with percolate operations." },
      { name: "Hash Table",  path: "/ds/hash-table",  time: "O(1) avg", space: "O(n)", stable: null, online: null, blurb: "Hash function maps keys to buckets. Separate chaining for collisions." },
      { name: "BST",         path: "/ds/bst",         time: "O(log n)", space: "O(n)", stable: null, online: null, blurb: "Binary Search Tree. Insert, search, delete, and traversal animations." },
      { name: "Graph",       path: "/ds/graph",       time: "O(V+E)",   space: "O(V)", stable: null, online: null, blurb: "Undirected graph with BFS and DFS traversal step-by-step." },
    ],
  },
] as const;

const BENCHMARK = {
  title: "Benchmark",
  description: "Run head-to-head performance tests across any combination of algorithms and input sizes",
  accentColor: "#e07b39",
  accentBg: "rgba(224,123,57,0.1)",
  path: "/sorting/benchmark",
  blurb: "Configure algorithms, input sizes, and scenarios. Watch real timing curves emerge across millions of elements.",
};

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

      {/* Benchmark banner */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-1">
          <FlaskConical size={20} style={{ color: BENCHMARK.accentColor }} strokeWidth={1.75} />
          <h2 className="text-xl font-semibold">{BENCHMARK.title}</h2>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>{BENCHMARK.description}</p>
        <Link
          href={BENCHMARK.path}
          className="group block rounded-xl p-5 border transition-all hover:-translate-y-0.5"
          style={{ background: "var(--color-surface-1)", borderColor: "var(--color-border)" }}
        >
          <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--color-muted)" }}>{BENCHMARK.blurb}</p>
          <div className="flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2" style={{ color: BENCHMARK.accentColor }}>
            Open Benchmark <ChevronRight size={14} strokeWidth={2} />
          </div>
        </Link>
      </section>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <section key={section.title} className="mb-14">
          <div className="flex items-center gap-3 mb-1">
            {section.icon === "sorting"
              ? <BarChart2 size={20} style={{ color: section.accentColor }} strokeWidth={1.75} />
              : <Layers size={20} style={{ color: section.accentColor }} strokeWidth={1.75} />
            }
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: section.accentBg, color: section.accentColor }}
            >
              {section.items.length}
            </span>
          </div>
          <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
            {section.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {section.items.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className="group block rounded-xl p-5 border transition-all hover:-translate-y-0.5"
                style={{
                  background: "var(--color-surface-1)",
                  borderColor: "var(--color-border)",
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3
                    className="font-semibold text-base group-hover:text-[color:var(--color-accent)] transition-colors"
                    style={{ color: "var(--color-text)" }}
                  >
                    {item.name}
                  </h3>

                  {/* Stable + Online badges */}
                  {item.stable !== null && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <InfoBadge
                        value={item.stable}
                        trueLabel="stable"
                        falseLabel="unstable"
                        title={item.stable ? STABLE_POPOVER.trueTitle : STABLE_POPOVER.falseTitle}
                        description={STABLE_POPOVER.description}
                        learnMoreUrl={STABLE_POPOVER.url}
                      />
                      <InfoBadge
                        value={item.online as boolean}
                        trueLabel="online"
                        falseLabel="offline"
                        title={item.online ? ONLINE_POPOVER.trueTitle : ONLINE_POPOVER.falseTitle}
                        description={ONLINE_POPOVER.description}
                        learnMoreUrl={ONLINE_POPOVER.url}
                      />
                    </div>
                  )}
                </div>

                <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  {item.blurb}
                </p>

                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>Time</div>
                    <div className="text-sm font-mono font-semibold" style={{ color: section.accentColor }}>
                      {item.time}
                    </div>
                  </div>
                  <div style={{ width: 1, height: 28, background: "var(--color-border)" }} />
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "var(--color-muted)" }}>Space</div>
                    <div className="text-sm font-mono font-semibold" style={{ color: "var(--color-muted)" }}>
                      {item.space}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2" style={{ color: section.accentColor }}>
                    View Recipe <ChevronRight size={14} strokeWidth={2} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
