// Question types for the interactive learning module.
// Each question has a discriminated union shape so the UI can render and grade
// each variant correctly. All variants share `id`, `prompt`, `topic`, and an
// optional `explanation` shown after the user answers.

export type Topic =
  | "sorting"
  | "lists"
  | "stacks"
  | "trees"
  | "bst"
  | "balance"
  | "heaps"
  | "hashing"
  | "sets"
  | "graphs"
  | "shortest"
  | "span"
  | "merge"
  | "radix"
  | "recursion"
  | "algorithms";

export interface QuestionBase {
  id: string;
  topic: Topic;
  prompt: string;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
}

// Single correct answer from a list of choices
export interface MultipleChoiceQuestion extends QuestionBase {
  kind: "multiple-choice";
  choices: string[];
  correctIndex: number;
}

// Multiple correct answers (selectAll). Grades as correct only if the set matches exactly.
export interface MultiSelectQuestion extends QuestionBase {
  kind: "multi-select";
  choices: string[];
  correctIndices: number[];
}

// True or false
export interface TrueFalseQuestion extends QuestionBase {
  kind: "true-false";
  correct: boolean;
}

// Fill in a blank — accepts any of `accepted` (case-insensitive, trimmed)
export interface FillBlankQuestion extends QuestionBase {
  kind: "fill-blank";
  // Show the prompt; the input replaces the literal "____" in the prompt.
  accepted: string[];
  caseSensitive?: boolean;
}

// Numeric answer with optional tolerance
export interface NumericQuestion extends QuestionBase {
  kind: "numeric";
  correct: number;
  tolerance?: number;
}

// Match left items to right items
export interface MatchingQuestion extends QuestionBase {
  kind: "matching";
  pairs: { left: string; right: string }[];
}

// Order items into the correct sequence
export interface OrderingQuestion extends QuestionBase {
  kind: "ordering";
  items: string[];
  correctOrder: number[];
}

export type Question =
  | MultipleChoiceQuestion
  | MultiSelectQuestion
  | TrueFalseQuestion
  | FillBlankQuestion
  | NumericQuestion
  | MatchingQuestion
  | OrderingQuestion;

export interface TopicMeta {
  id: Topic;
  name: string;
  blurb: string;
  pdf?: string;
}

export const TOPICS: TopicMeta[] = [
  { id: "algorithms", name: "Algorithm Analysis",  blurb: "Big-O, Big-Θ, Big-Ω, time/space complexity, asymptotic growth." },
  { id: "recursion",  name: "Recursion",           blurb: "Base cases, recursive cases, recurrence relations, tail calls." },
  { id: "lists",      name: "Linked Lists",        blurb: "Singly, doubly, circular lists. Insertion, deletion, traversal." },
  { id: "stacks",     name: "Stacks & Queues",     blurb: "LIFO, FIFO, deques, applications, array vs. linked-list backing." },
  { id: "trees",      name: "Trees",               blurb: "Binary trees, traversals (pre/in/post-order), tree properties." },
  { id: "bst",        name: "Binary Search Trees", blurb: "BST property, insertion, deletion, in-order traversal yields sorted." },
  { id: "balance",    name: "Balanced Trees",      blurb: "AVL trees, red-black trees, rotations, balance factors." },
  { id: "heaps",      name: "Heaps",               blurb: "Min-heap, max-heap, heapify, priority queues, heapsort." },
  { id: "hashing",    name: "Hashing",             blurb: "Hash functions, collisions, chaining, open addressing, load factor." },
  { id: "sets",       name: "Sets & Maps",         blurb: "Set ADT, union-find, disjoint sets, hash sets vs. tree sets." },
  { id: "sorting",    name: "Sorting",             blurb: "Quicksort, mergesort, heapsort, comparison vs. non-comparison." },
  { id: "merge",      name: "Merge Sort",          blurb: "Divide and conquer, merge step, recurrence T(n)=2T(n/2)+n." },
  { id: "radix",      name: "Radix Sort",          blurb: "Bucket-based, digit-by-digit, LSD vs. MSD, O(nk) time." },
  { id: "graphs",     name: "Graphs",              blurb: "Adjacency list/matrix, BFS, DFS, directed/undirected, weighted." },
  { id: "shortest",   name: "Shortest Paths",      blurb: "Dijkstra, Bellman-Ford, Floyd-Warshall, A*." },
  { id: "span",       name: "Spanning Trees",      blurb: "Minimum spanning tree, Prim's, Kruskal's, cut property." },
];
