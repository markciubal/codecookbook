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

export type CatalogEntry = SortingEntry | DSEntry | BenchmarkEntry;

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
];

export const DATA_STRUCTURES: DSEntry[] = [
  { kind: "ds", name: "Stack",       path: "/ds/stack",       time: "O(1)",     space: "O(n)", blurb: "Last-In-First-Out. Push and pop from the top of the stack." },
  { kind: "ds", name: "Queue",       path: "/ds/queue",       time: "O(1)",     space: "O(n)", blurb: "First-In-First-Out. Enqueue at back, dequeue from the front." },
  { kind: "ds", name: "Deque",       path: "/ds/deque",       time: "O(1)",     space: "O(n)", blurb: "Double-ended queue. Push and pop from both front and back." },
  { kind: "ds", name: "Linked List", path: "/ds/linked-list", time: "O(n)",     space: "O(n)", blurb: "Nodes connected by pointers. Insert, delete, and traverse." },
  { kind: "ds", name: "Binary Heap", path: "/ds/binary-heap", time: "O(log n)", space: "O(n)", blurb: "Min-heap tree. Insert and extract-min with percolate operations." },
  { kind: "ds", name: "Hash Table",  path: "/ds/hash-table",  time: "O(1) avg", space: "O(n)", blurb: "Hash function maps keys to buckets. Separate chaining for collisions." },
  { kind: "ds", name: "BST",         path: "/ds/bst",         time: "O(log n)", space: "O(n)", blurb: "Binary Search Tree. Insert, search, delete, and traversal animations." },
  { kind: "ds", name: "Graph",       path: "/ds/graph",       time: "O(V+E)",   space: "O(V)", blurb: "Undirected graph with BFS and DFS traversal step-by-step." },
];
