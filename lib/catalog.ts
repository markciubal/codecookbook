/**
 * Single source of truth for all catalog entries (nav + home page).
 * Add a new algorithm here and it automatically appears everywhere.
 */

export type SortingEntry = {
  kind: "sorting";
  name: string;
  path: string;
  time: string;
  space: string;
  stable: boolean;
  online: boolean;
  blurb: string;
};

export type DSEntry = {
  kind: "ds";
  name: string;
  path: string;
  time: string;
  space: string;
  blurb: string;
};

export type BenchmarkEntry = {
  kind: "benchmark";
  name: string;
  path: string;
  description: string;
  blurb: string;
};

export type CustomSortEntry = {
  kind: "custom";
  name: string;
  path: string;
  description: string;
  blurb: string;
};

export type CompareEntry = {
  kind: "compare";
  name: string;
  path: string;
  description: string;
  blurb: string;
};

export type ToolEntry = {
  kind: "tool";
  name: string;
  path: string;
  description: string;
  blurb: string;
  icon: string; // lucide icon name
};

export type SearchEntry = {
  kind: "search";
  name: string;
  path: string;
  time: string;
  space: string;
  blurb: string;
};

export type GraphAlgoEntry = {
  kind: "graph-algo";
  name: string;
  path: string;
  time: string;
  space: string;
  blurb: string;
};

export type DPEntry = {
  kind: "dp";
  name: string;
  path: string;
  time: string;
  space: string;
  blurb: string;
};

export type StringAlgoEntry = {
  kind: "string-algo";
  name: string;
  path: string;
  time: string;
  space: string;
  blurb: string;
};

export type GeometryEntry = {
  kind: "geometry";
  name: string;
  path: string;
  time: string;
  space: string;
  blurb: string;
};

export type MathEntry = {
  kind: "math";
  name: string;
  path: string;
  time: string;
  space: string;
  blurb: string;
};

export type CatalogEntry = SortingEntry | DSEntry | BenchmarkEntry | CustomSortEntry | CompareEntry | ToolEntry | SearchEntry | GraphAlgoEntry | DPEntry | StringAlgoEntry | GeometryEntry | MathEntry;

export const SEARCHING_ALGORITHMS: SearchEntry[] = [
  { kind: "search", name: "Linear Search",      path: "/search/linear",        time: "O(n)",       space: "O(1)", blurb: "Scans every element left to right until the target is found. Works on unsorted arrays." },
  { kind: "search", name: "Binary Search",       path: "/search/binary",        time: "O(log n)",   space: "O(1)", blurb: "Halves the search space each step by comparing the target to the midpoint. Requires a sorted array." },
  { kind: "search", name: "Jump Search",         path: "/search/jump",          time: "O(√n)",      space: "O(1)", blurb: "Jumps ahead by √n steps, then does a linear scan backward. A middle ground between linear and binary." },
  { kind: "search", name: "Interpolation Search",path: "/search/interpolation", time: "O(log log n)",space: "O(1)", blurb: "Estimates the target's position using value interpolation. O(log log n) on uniform distributions, O(n) worst case." },
];

export const GRAPH_ALGORITHMS: GraphAlgoEntry[] = [
  { kind: "graph-algo", name: "BFS",             path: "/graph/bfs",          time: "O(V+E)", space: "O(V)", blurb: "Breadth-first search on a weighted graph. Explores level by level, tracking distance labels." },
  { kind: "graph-algo", name: "DFS",             path: "/graph/dfs",          time: "O(V+E)", space: "O(V)", blurb: "Depth-first search with discovery/finish timestamps and back-edge detection." },
  { kind: "graph-algo", name: "Dijkstra",        path: "/graph/dijkstra",     time: "O((V+E) log V)", space: "O(V)", blurb: "Shortest paths from a source using a min-priority queue. Shows distance relaxation step by step." },
  { kind: "graph-algo", name: "Bellman-Ford",    path: "/graph/bellman-ford", time: "O(VE)",  space: "O(V)", blurb: "Shortest paths that handle negative edge weights. Relaxes all edges V−1 times, detects negative cycles." },
  { kind: "graph-algo", name: "Prim's MST",      path: "/graph/prim",         time: "O((V+E) log V)", space: "O(V)", blurb: "Grows a minimum spanning tree one cheapest edge at a time from a seed vertex." },
  { kind: "graph-algo", name: "Kruskal's MST",   path: "/graph/kruskal",      time: "O(E log E)", space: "O(V)", blurb: "Builds an MST by sorting edges and greedily adding them if they don't create a cycle (Union-Find)." },
  { kind: "graph-algo", name: "Topological Sort",path: "/graph/topo",         time: "O(V+E)", space: "O(V)", blurb: "Linear ordering of vertices in a DAG such that every directed edge u→v places u before v." },
];

export const CHEATSHEET: ToolEntry = {
  kind: "tool",
  name: "Cheat Sheet",
  path: "/cheatsheet",
  description: "Sortable reference table of every algorithm and data structure",
  blurb: "All algorithms and data structures at a glance — sort by time, space, stability. Filter, print, or bookmark for interview prep.",
  icon: "TableProperties",
};

export const FLASHCARDS: ToolEntry = {
  kind: "tool",
  name: "Flashcards",
  path: "/tools/flashcards",
  description: "Quiz yourself on time and space complexities",
  blurb: "See an algorithm name, guess the complexity, track your score. Covers all sorting algorithms and data structures.",
  icon: "GalleryHorizontal",
};

export const PICKER: ToolEntry = {
  kind: "tool",
  name: "Algorithm Picker",
  path: "/tools/picker",
  description: "Answer questions to find the right algorithm for your use case",
  blurb: "Stability? Memory constraints? Nearly sorted data? Answer a few questions and get a tailored recommendation with reasoning.",
  icon: "GitFork",
};

export const CALCULATOR: ToolEntry = {
  kind: "tool",
  name: "Complexity Calculator",
  path: "/tools/calculator",
  description: "Estimate real-world runtimes from Big-O and n",
  blurb: "Select a complexity class, enter n, and see estimated milliseconds. Compare all classes side by side in one reference table.",
  icon: "Calculator",
};

export const PATHFINDING: ToolEntry = {
  kind: "tool",
  name: "Path Finding",
  path: "/tools/pathfinding",
  description: "Draw walls and watch A*, Dijkstra, BFS, DFS explore a grid",
  blurb: "Click to draw walls, drag to set start/end, pick an algorithm, and watch it find a path step by step.",
  icon: "Navigation",
};

export const CONCERT: ToolEntry = {
  kind: "tool",
  name: "Sound Concert",
  path: "/sorting/concert",
  description: "Watch and listen to multiple algorithms sort simultaneously, each with a unique instrument sound",
  blurb: "Each algorithm gets its own oscillator type and pitch range. Start them all together and listen to the chaos resolve into order.",
  icon: "Music",
};

export const COMPLEXITY_QUIZ: ToolEntry = {
  kind: "tool",
  name: "Complexity Quiz",
  path: "/quiz",
  description: "Test your knowledge of algorithm time and space complexities",
  blurb: "40+ questions, streaks, timer, and a local high score. See an algorithm, guess its Big-O. Covers sorting, data structures, searching, and graph algorithms.",
  icon: "BrainCircuit",
};

export const SORTING_NETWORK: ToolEntry = {
  kind: "tool",
  name: "Sorting Network",
  path: "/tools/sorting-network",
  description: "Visualize comparator networks that sort in parallel",
  blurb: "See how bitonic sort uses a fixed network of comparators to sort in O(log² n) parallel stages with no branching.",
  icon: "GitMerge",
};

export const TOOLS: ToolEntry[] = [CHEATSHEET, FLASHCARDS, PICKER, CALCULATOR, PATHFINDING, CONCERT, COMPLEXITY_QUIZ, SORTING_NETWORK];

export const DP_ALGORITHMS: DPEntry[] = [
  { kind: "dp", name: "LCS",           path: "/dp/lcs",           time: "O(mn)",    space: "O(mn)",  blurb: "Finds the longest common subsequence between two strings using a 2D DP table with backtracking." },
  { kind: "dp", name: "Edit Distance", path: "/dp/edit-distance", time: "O(mn)",    space: "O(mn)",  blurb: "Minimum insertions, deletions, and replacements to transform one string into another (Levenshtein)." },
  { kind: "dp", name: "Knapsack",      path: "/dp/knapsack",      time: "O(nW)",    space: "O(nW)",  blurb: "0/1 Knapsack: pick items to maximize value without exceeding weight capacity, using a 2D DP table." },
  { kind: "dp", name: "Coin Change",   path: "/dp/coin-change",   time: "O(n·amt)", space: "O(amt)", blurb: "Minimum coins to make an amount, built bottom-up. Classic unbounded knapsack variant." },
];

export const STRING_ALGORITHMS: StringAlgoEntry[] = [
  { kind: "string-algo", name: "KMP",          path: "/strings/kmp",         time: "O(n+m)",  space: "O(m)", blurb: "Knuth-Morris-Pratt: builds a failure function to skip redundant comparisons during pattern search." },
  { kind: "string-algo", name: "Rabin-Karp",   path: "/strings/rabin-karp",  time: "O(n+m)",  space: "O(1)", blurb: "Rolling hash window: compute pattern hash once, slide it over the text in O(1) per step." },
  { kind: "string-algo", name: "Boyer-Moore",  path: "/strings/boyer-moore", time: "O(n/m)",  space: "O(σ)", blurb: "Scans right-to-left and uses a bad-character table to skip large sections of text on mismatch." },
];

export const GEOMETRY_ALGORITHMS: GeometryEntry[] = [
  { kind: "geometry", name: "Convex Hull (Graham)",  path: "/geometry/convex-hull",   time: "O(n log n)", space: "O(n)", blurb: "Graham scan: sort points by polar angle, then sweep with a stack to build the convex hull." },
  { kind: "geometry", name: "Convex Hull (Jarvis)",  path: "/geometry/jarvis-march",  time: "O(nh)",      space: "O(h)", blurb: "Jarvis march: gift-wrapping algorithm that pivots around the hull one point at a time." },
];

export const MATH_ALGORITHMS: MathEntry[] = [
  { kind: "math", name: "Sieve of Eratosthenes", path: "/math/sieve",    time: "O(n log log n)", space: "O(n)", blurb: "Cross out multiples of each prime up to √n. The classic algorithm for finding all primes ≤ n." },
  { kind: "math", name: "Euclidean GCD",          path: "/math/gcd",      time: "O(log min(a,b))", space: "O(1)", blurb: "Repeatedly replace (a, b) with (b, a mod b) until b = 0. The remainder is the GCD." },
  { kind: "math", name: "Fast Exponentiation",    path: "/math/fast-exp", time: "O(log n)",       space: "O(1)", blurb: "Square-and-multiply: compute aⁿ in O(log n) multiplications by decomposing the exponent in binary." },
];

export const CUSTOM_SORT: CustomSortEntry = {
  kind: "custom",
  name: "Sort Your Data",
  path: "/sorting/custom",
  description: "Upload a CSV or paste your own numbers, pick an algorithm, and watch it sort live",
  blurb: "Drop in any CSV or paste a list of numbers. Choose an algorithm, watch the sort animate bar-by-bar, then download the sorted result.",
};

export const COMPARE: CompareEntry = {
  kind: "compare",
  name: "Algorithm Race",
  path: "/sorting/compare",
  description: "Pick two algorithms and watch them race on the same input side-by-side",
  blurb: "Choose any two algorithms, set the array size, and watch them sort the same array simultaneously. See which finishes first and compare comparisons, swaps, and steps.",
};

export const BENCHMARK: BenchmarkEntry = {
  kind: "benchmark",
  name: "Benchmark",
  path: "/sorting/benchmark",
  description: "Run head-to-head performance tests across any combination of algorithms and input sizes",
  blurb: "Configure algorithms, input sizes, and scenarios. Watch real timing curves emerge across millions of elements.",
};

/**
 * Sorting algorithms in display order.
 * Logos Sort is pinned first; add new entries anywhere below it.
 */
export const SORTING_ALGORITHMS: SortingEntry[] = [
  { kind: "sorting", name: "Logos Sort",     path: "/sorting/logos",     time: "O(n log n)", space: "O(log n)",  stable: false, online: false, blurb: "Nine strategies applied in order: tally, gallop, cut at the golden ratio, consult three voices, roll the die, divide into three, recurse the small." },
  { kind: "sorting", name: "Introsort",      path: "/sorting/introsort", time: "O(n log n)", space: "O(log n)",  stable: false, online: false, blurb: "Quicksort with a safety net: if recursion depth exceeds 2·log₂n, it falls back to heapsort. Small subarrays finish with insertion sort. The basis of std::sort." },
  { kind: "sorting", name: "Bubble Sort",    path: "/sorting/bubble",    time: "O(n²)",      space: "O(1)",      stable: true,  online: false, blurb: "Compares adjacent pairs and swaps them if out of order. Each pass settles the largest remaining element." },
  { kind: "sorting", name: "Selection Sort", path: "/sorting/selection", time: "O(n²)",      space: "O(1)",      stable: false, online: false, blurb: "Finds the minimum of the unsorted region and swaps it to the sorted boundary. O(n) swaps total." },
  { kind: "sorting", name: "Insertion Sort", path: "/sorting/insertion", time: "O(n²)",      space: "O(1)",      stable: true,  online: true,  blurb: "Inserts each element into its correct spot in the already-sorted prefix. Fast on nearly-sorted data." },
  { kind: "sorting", name: "Merge Sort",     path: "/sorting/merge",     time: "O(n log n)", space: "O(n)",      stable: true,  online: false, blurb: "Recursively divides in half, sorts each half, then merges. Guaranteed O(n log n) in all cases." },
  { kind: "sorting", name: "Quick Sort",     path: "/sorting/quick",     time: "O(n log n)", space: "O(log n)",  stable: false, online: false, blurb: "Picks a pivot, partitions around it, and recurses on both sides. O(n log n) average; O(n²) worst case." },
  { kind: "sorting", name: "Heap Sort",      path: "/sorting/heap",      time: "O(n log n)", space: "O(1)",      stable: false, online: false, blurb: "Builds a max-heap, then repeatedly extracts the max to produce sorted output in-place." },
  { kind: "sorting", name: "Shell Sort",     path: "/sorting/shell",     time: "O(n log² n)",space: "O(1)",      stable: false, online: false, blurb: "Insertion sort over a shrinking gap — long-range swaps first, fine-tuning last." },
  { kind: "sorting", name: "Counting Sort",  path: "/sorting/counting",  time: "O(n+k)",     space: "O(k)",      stable: true,  online: false, blurb: "Tallies occurrences of each integer and reconstructs the array. Requires a bounded key range." },
  { kind: "sorting", name: "Radix Sort",     path: "/sorting/radix",     time: "O(nk)",      space: "O(n+k)",    stable: true,  online: false, blurb: "Sorts digit by digit, least to most significant, using counting sort at each position." },
  { kind: "sorting", name: "Bucket Sort",    path: "/sorting/bucket",    time: "O(n+k)",     space: "O(n)",      stable: true,  online: false, blurb: "Scatters elements into buckets, sorts each bucket with insertion sort, then concatenates." },
  { kind: "sorting", name: "Tim Sort",       path: "/sorting/timsort",   time: "O(n log n)", space: "O(n)",      stable: true,  online: false, blurb: "Detects natural runs, extends short ones with insertion sort, then merges via galloping mode. Python's and Java's built-in sort." },
  { kind: "sorting", name: "Cocktail Sort",  path: "/sorting/cocktail",  time: "O(n²)",      space: "O(1)",      stable: true,  online: false, blurb: "Bidirectional bubble sort — forward pass pushes the max right, backward pass pushes the min left. Faster on partially-sorted data." },
  { kind: "sorting", name: "Comb Sort",      path: "/sorting/comb",      time: "O(n²)",      space: "O(1)",      stable: false, online: false, blurb: "Eliminates turtles (small values near the end) by comparing elements far apart. Shrinks the gap by factor 1.3 each pass." },
  { kind: "sorting", name: "Gnome Sort",     path: "/sorting/gnome",     time: "O(n²)",      space: "O(1)",      stable: true,  online: true,  blurb: "A single pointer advances if neighbors are in order, or swaps and retreats. The simplest possible sorting algorithm." },
  { kind: "sorting", name: "Pancake Sort",   path: "/sorting/pancake",   time: "O(n²)",      space: "O(1)",      stable: false, online: false, blurb: "Sorts by prefix reversals only — like flipping stacks of pancakes. Each round places the next-largest element using at most 2 flips." },
  { kind: "sorting", name: "Cycle Sort",     path: "/sorting/cycle",     time: "O(n²)",      space: "O(1)",      stable: false, online: false, blurb: "Writes each element exactly once by tracing permutation cycles. Optimal when array writes are expensive." },
  { kind: "sorting", name: "Odd-Even Sort",  path: "/sorting/oddeven",   time: "O(n²)",      space: "O(1)",      stable: true,  online: false, blurb: "Alternates between odd-indexed and even-indexed adjacent swaps. Parallelizes naturally — each phase can run simultaneously." },
];

export const DATA_STRUCTURES: DSEntry[] = [
  { kind: "ds", name: "Stack",        path: "/ds/stack",        time: "O(1)",     space: "O(n)",   blurb: "Last-In-First-Out. Push and pop from the top of the stack." },
  { kind: "ds", name: "Queue",        path: "/ds/queue",        time: "O(1)",     space: "O(n)",   blurb: "First-In-First-Out. Enqueue at back, dequeue from the front." },
  { kind: "ds", name: "Deque",        path: "/ds/deque",        time: "O(1)",     space: "O(n)",   blurb: "Double-ended queue. Push and pop from both front and back." },
  { kind: "ds", name: "Linked List",  path: "/ds/linked-list",  time: "O(n)",     space: "O(n)",   blurb: "Nodes connected by pointers. Insert, delete, and traverse." },
  { kind: "ds", name: "Binary Heap",  path: "/ds/binary-heap",  time: "O(log n)", space: "O(n)",   blurb: "Min-heap tree. Insert and extract-min with percolate operations." },
  { kind: "ds", name: "Hash Table",   path: "/ds/hash-table",   time: "O(1) avg", space: "O(n)",   blurb: "Hash function maps keys to buckets. Separate chaining for collisions." },
  { kind: "ds", name: "BST",          path: "/ds/bst",          time: "O(log n)", space: "O(n)",   blurb: "Binary Search Tree. Insert, search, delete, and traversal animations." },
  { kind: "ds", name: "Graph",        path: "/ds/graph",        time: "O(V+E)",   space: "O(V)",   blurb: "Undirected graph with BFS and DFS traversal step-by-step." },
  { kind: "ds", name: "AVL Tree",     path: "/ds/avl",          time: "O(log n)", space: "O(n)",   blurb: "Self-balancing BST. Every insert/delete triggers LL, RR, LR, or RL rotations to keep balance factors in {−1, 0, 1}." },
  { kind: "ds", name: "Red-Black Tree", path: "/ds/red-black",  time: "O(log n)", space: "O(n)",   blurb: "Self-balancing BST with color bits. Uses recoloring and rotations to maintain 5 invariants, guaranteeing O(log n) height." },
  { kind: "ds", name: "Trie",         path: "/ds/trie",         time: "O(m)",     space: "O(n·m)", blurb: "Prefix tree that stores strings character by character. O(m) insert and search where m is the word length." },
  { kind: "ds", name: "Segment Tree", path: "/ds/segment-tree", time: "O(log n)", space: "O(n)",   blurb: "Range-query tree. O(log n) range-sum queries and point updates with step-by-step traversal animations." },
];
