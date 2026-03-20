// Multi-language reference implementations for CodeCookbook

export type Language = "typescript" | "javascript" | "python" | "java" | "c" | "cpp" | "rust" | "go";

export const LANGUAGE_META: Record<Language, { label: string; ext: string; runCmd: string; commentChar: string }> = {
  typescript: { label: "TypeScript", ext: "ts",   runCmd: "npx ts-node solution.ts",                              commentChar: "//" },
  javascript: { label: "JavaScript", ext: "js",   runCmd: "node solution.js",                                     commentChar: "//" },
  python:     { label: "Python",     ext: "py",   runCmd: "python solution.py",                                   commentChar: "#"  },
  java:       { label: "Java",       ext: "java", runCmd: "javac Solution.java && java Solution",                 commentChar: "//" },
  c:          { label: "C",          ext: "c",    runCmd: "gcc -o solution solution.c && ./solution",             commentChar: "//" },
  cpp:        { label: "C++",        ext: "cpp",  runCmd: "g++ -std=c++17 -o solution solution.cpp && ./solution", commentChar: "//" },
  rust:       { label: "Rust",       ext: "rs",   runCmd: "rustc solution.rs && ./solution",                      commentChar: "//" },
  go:         { label: "Go",         ext: "go",   runCmd: "go run solution.go",                                   commentChar: "//" },
};

export const LANGUAGES: Language[] = ["typescript", "javascript", "python", "java", "c", "cpp", "rust", "go"];

// ─────────────────────────────────────────────────────────────────────────────

export const ANNOTATED_CODE: Record<string, Record<Language, string>> = {

  // ── BUBBLE SORT ────────────────────────────────────────────────────────────
  bubble: {

    typescript: `function bubbleSort(arr: number[]): number[] {
  const n = arr.length;

  // Outer pass: after i rounds, the last i elements
  // are in their final sorted positions.
  for (let i = 0; i < n - 1; i++) {

    // Inner pass: compare every adjacent pair in the
    // unsorted prefix [0 .. n-i-2] and swap if needed.
    for (let j = 0; j < n - i - 1; j++) {
      // Larger value "bubbles" one step to the right.
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}
// Time: O(n²)  Space: O(1)  Stable: YES

// ── demo ──
const data = [64, 34, 25, 12, 22, 11, 90];
console.log("Before:", [...data]);
bubbleSort(data);
console.log("After: ", data);
// Run: npx ts-node solution.ts`,

    javascript: `function bubbleSort(arr) {
  const n = arr.length;

  // Outer pass: each round locks the largest remaining
  // element into its final position at the end.
  for (let i = 0; i < n - 1; i++) {

    // Inner pass: walk the unsorted region and swap
    // any adjacent pair that is out of order.
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}
// Time: O(n²)  Space: O(1)  Stable: YES

// ── demo ──
const data = [64, 34, 25, 12, 22, 11, 90];
console.log("Before:", [...data]);
bubbleSort(data);
console.log("After: ", data);
// Run: node solution.js`,

    python: `def bubble_sort(arr):
    n = len(arr)

    # Outer pass: arr[n-i:] is correctly placed
    # after i passes — shrink the unsorted region.
    for i in range(n - 1):

        # Inner pass: bubble the largest unsorted
        # element one step right each comparison.
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                # Python tuple swap — no temp needed.
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

# Time: O(n²)  Space: O(1)  Stable: True

# ── demo ──
data = [64, 34, 25, 12, 22, 11, 90]
print("Before:", data[:])
bubble_sort(data)
print("After: ", data)
# Run: python solution.py`,

    java: `import java.util.Arrays;

public class Solution {

    // Sort arr[] in-place using bubble sort.
    static void bubbleSort(int[] arr) {
        int n = arr.length;

        // Outer pass: the largest unsorted element
        // rises to position n-1-i each round.
        for (int i = 0; i < n - 1; i++) {

            // Inner pass: compare adjacent elements
            // inside the unsorted region [0 .. n-i-2].
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int tmp    = arr[j];
                    arr[j]     = arr[j + 1];
                    arr[j + 1] = tmp;
                }
            }
        }
    }
    // Time: O(n²)  Space: O(1)  Stable: YES

    public static void main(String[] args) {
        int[] data = {64, 34, 25, 12, 22, 11, 90};
        System.out.println("Before: " + Arrays.toString(data));
        bubbleSort(data);
        System.out.println("After:  " + Arrays.toString(data));
    }
}
// Run: javac Solution.java && java Solution`,

    c: `#include <stdio.h>

/* Swap two integers via a temporary variable. */
static void swap(int *a, int *b) {
    int tmp = *a; *a = *b; *b = tmp;
}

/* Sort arr[0..n-1] in-place using bubble sort. */
void bubble_sort(int arr[], int n) {
    /* Outer pass: after i passes arr[n-i..n-1] sorted */
    for (int i = 0; i < n - 1; i++) {
        /* Inner pass: push the max of [0..n-i-1] right */
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1])
                swap(&arr[j], &arr[j + 1]);
        }
    }
}
/* Time: O(n^2)  Space: O(1)  Stable: YES */

int main(void) {
    int data[] = {64, 34, 25, 12, 22, 11, 90};
    int n = (int)(sizeof data / sizeof data[0]);
    printf("Before:");
    for (int i = 0; i < n; i++) printf(" %d", data[i]);
    bubble_sort(data, n);
    printf("\\nAfter: ");
    for (int i = 0; i < n; i++) printf(" %d", data[i]);
    printf("\\n");
    return 0;
}
/* Run: gcc -o solution solution.c && ./solution */`,

    cpp: `#include <iostream>
#include <vector>
#include <utility> // std::swap

// Sort v in-place using bubble sort.
void bubbleSort(std::vector<int>& v) {
    int n = static_cast<int>(v.size());

    // Outer pass: v[n-i..end] is sorted after i passes.
    for (int i = 0; i < n - 1; ++i) {

        // Inner pass: bubble the max of v[0..n-i-1]
        // one position to the right on each comparison.
        for (int j = 0; j < n - i - 1; ++j) {
            if (v[j] > v[j + 1])
                std::swap(v[j], v[j + 1]);
        }
    }
}
// Time: O(n²)  Space: O(1)  Stable: YES

int main() {
    std::vector<int> data = {64, 34, 25, 12, 22, 11, 90};
    std::cout << "Before:";
    for (int x : data) std::cout << ' ' << x;
    bubbleSort(data);
    std::cout << "\\nAfter: ";
    for (int x : data) std::cout << ' ' << x;
    std::cout << '\\n';
}
// Run: g++ -std=c++17 -o solution solution.cpp && ./solution`,

    rust: `// Sort a mutable slice in-place using bubble sort.
fn bubble_sort(arr: &mut [i32]) {
    let n = arr.len();
    if n < 2 { return; }

    // Outer pass: arr[n-i..] is sorted after i passes.
    for i in 0..n - 1 {

        // Inner pass: walk the unsorted prefix, swapping
        // any adjacent pair that is out of order.
        for j in 0..n - i - 1 {
            if arr[j] > arr[j + 1] {
                arr.swap(j, j + 1); // built-in O(1) swap
            }
        }
    }
}
// Time: O(n²)  Space: O(1)  Stable: YES

fn main() {
    let mut data = [64, 34, 25, 12, 22, 11, 90];
    println!("Before: {:?}", data);
    bubble_sort(&mut data);
    println!("After:  {:?}", data);
}
// Run: rustc solution.rs && ./solution`,

    go: `package main

import "fmt"

// bubbleSort sorts a slice of ints in-place.
func bubbleSort(arr []int) {
	n := len(arr)

	// Outer pass: arr[n-i:] is sorted after i passes.
	for i := 0; i < n-1; i++ {

		// Inner pass: push the largest unsorted element
		// one step right on each adjacent comparison.
		for j := 0; j < n-i-1; j++ {
			if arr[j] > arr[j+1] {
				// Go multi-assign handles the swap cleanly.
				arr[j], arr[j+1] = arr[j+1], arr[j]
			}
		}
	}
}
// Time: O(n²)  Space: O(1)  Stable: YES

func main() {
	data := []int{64, 34, 25, 12, 22, 11, 90}
	fmt.Println("Before:", data)
	bubbleSort(data)
	fmt.Println("After: ", data)
}
// Run: go run solution.go`,
  },

  // ── SELECTION SORT ─────────────────────────────────────────────────────────
  selection: {

    typescript: `function selectionSort(arr: number[]): number[] {
  const n = arr.length;

  // Grow the sorted prefix one element at a time.
  for (let i = 0; i < n - 1; i++) {

    // Assume the boundary element is the minimum.
    let minIdx = i;

    // Scan the unsorted suffix for a smaller value.
    for (let j = i + 1; j < n; j++) {
      if (arr[j] < arr[minIdx]) minIdx = j;
    }

    // Swap the minimum into the sorted boundary.
    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
    }
  }
  return arr;
}
// Time: O(n²)  Space: O(1)  Stable: NO

// ── demo ──
const data = [64, 25, 12, 22, 11];
console.log("Before:", [...data]);
selectionSort(data);
console.log("After: ", data);
// Run: npx ts-node solution.ts`,

    javascript: `function selectionSort(arr) {
  const n = arr.length;

  // Each pass selects the minimum of the unsorted
  // suffix and moves it to the sorted boundary.
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;

    // Find the index of the smallest element
    // in arr[i+1 .. n-1].
    for (let j = i + 1; j < n; j++) {
      if (arr[j] < arr[minIdx]) minIdx = j;
    }

    // Only swap if we found a smaller element.
    if (minIdx !== i) {
      [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
    }
  }
  return arr;
}
// Time: O(n²)  Space: O(1)  Stable: NO

// ── demo ──
const data = [64, 25, 12, 22, 11];
console.log("Before:", [...data]);
selectionSort(data);
console.log("After: ", data);
// Run: node solution.js`,

    python: `def selection_sort(arr):
    n = len(arr)

    # Each pass extends the sorted prefix by one —
    # we place the minimum of arr[i:] at index i.
    for i in range(n - 1):
        min_idx = i

        # Search the unsorted suffix for the minimum.
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j

        # Swap minimum to the sorted boundary.
        if min_idx != i:
            arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr

# Time: O(n²)  Space: O(1)  Stable: No

# ── demo ──
data = [64, 25, 12, 22, 11]
print("Before:", data[:])
selection_sort(data)
print("After: ", data)
# Run: python solution.py`,

    java: `import java.util.Arrays;

public class Solution {

    // Sort arr[] in-place using selection sort.
    static void selectionSort(int[] arr) {
        int n = arr.length;

        // Move the sorted/unsorted boundary i right
        // by selecting the minimum each round.
        for (int i = 0; i < n - 1; i++) {
            int minIdx = i;

            // Scan unsorted region for smallest value.
            for (int j = i + 1; j < n; j++) {
                if (arr[j] < arr[minIdx]) minIdx = j;
            }

            // Swap minimum to position i.
            if (minIdx != i) {
                int tmp    = arr[i];
                arr[i]     = arr[minIdx];
                arr[minIdx] = tmp;
            }
        }
    }
    // Time: O(n²)  Space: O(1)  Stable: NO

    public static void main(String[] args) {
        int[] data = {64, 25, 12, 22, 11};
        System.out.println("Before: " + Arrays.toString(data));
        selectionSort(data);
        System.out.println("After:  " + Arrays.toString(data));
    }
}
// Run: javac Solution.java && java Solution`,

    c: `#include <stdio.h>

static void swap(int *a, int *b) {
    int tmp = *a; *a = *b; *b = tmp;
}

void selection_sort(int arr[], int n) {
    /* Each pass puts the minimum of arr[i..n-1]
       at position i, growing the sorted prefix. */
    for (int i = 0; i < n - 1; i++) {
        int min_idx = i;

        /* Scan the unsorted suffix. */
        for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[min_idx]) min_idx = j;
        }

        if (min_idx != i)
            swap(&arr[i], &arr[min_idx]);
    }
}
/* Time: O(n^2)  Space: O(1)  Stable: NO */

int main(void) {
    int data[] = {64, 25, 12, 22, 11};
    int n = (int)(sizeof data / sizeof data[0]);
    printf("Before:");
    for (int i = 0; i < n; i++) printf(" %d", data[i]);
    selection_sort(data, n);
    printf("\\nAfter: ");
    for (int i = 0; i < n; i++) printf(" %d", data[i]);
    printf("\\n");
    return 0;
}
/* Run: gcc -o solution solution.c && ./solution */`,

    cpp: `#include <iostream>
#include <vector>
#include <utility>

void selectionSort(std::vector<int>& v) {
    int n = static_cast<int>(v.size());

    // Each pass selects the minimum of v[i..n-1]
    // and swaps it into the sorted boundary at i.
    for (int i = 0; i < n - 1; ++i) {
        int minIdx = i;

        // Search for the minimum in the unsorted part.
        for (int j = i + 1; j < n; ++j) {
            if (v[j] < v[minIdx]) minIdx = j;
        }

        if (minIdx != i)
            std::swap(v[i], v[minIdx]);
    }
}
// Time: O(n²)  Space: O(1)  Stable: NO

int main() {
    std::vector<int> data = {64, 25, 12, 22, 11};
    std::cout << "Before:";
    for (int x : data) std::cout << ' ' << x;
    selectionSort(data);
    std::cout << "\\nAfter: ";
    for (int x : data) std::cout << ' ' << x;
    std::cout << '\\n';
}
// Run: g++ -std=c++17 -o solution solution.cpp && ./solution`,

    rust: `fn selection_sort(arr: &mut [i32]) {
    let n = arr.len();

    // Grow the sorted prefix: at each step find the
    // minimum of arr[i..] and swap it to position i.
    for i in 0..n.saturating_sub(1) {
        let mut min_idx = i;

        // Find the index of the smallest element
        // in the unsorted suffix arr[i+1..].
        for j in (i + 1)..n {
            if arr[j] < arr[min_idx] { min_idx = j; }
        }

        if min_idx != i {
            arr.swap(i, min_idx);
        }
    }
}
// Time: O(n²)  Space: O(1)  Stable: NO

fn main() {
    let mut data = [64, 25, 12, 22, 11];
    println!("Before: {:?}", data);
    selection_sort(&mut data);
    println!("After:  {:?}", data);
}
// Run: rustc solution.rs && ./solution`,

    go: `package main

import "fmt"

func selectionSort(arr []int) {
	n := len(arr)

	// Outer pass: place the minimum of arr[i:]
	// at index i, extending the sorted prefix.
	for i := 0; i < n-1; i++ {
		minIdx := i

		// Scan the unsorted suffix for a smaller value.
		for j := i + 1; j < n; j++ {
			if arr[j] < arr[minIdx] {
				minIdx = j
			}
		}

		if minIdx != i {
			arr[i], arr[minIdx] = arr[minIdx], arr[i]
		}
	}
}
// Time: O(n²)  Space: O(1)  Stable: NO

func main() {
	data := []int{64, 25, 12, 22, 11}
	fmt.Println("Before:", data)
	selectionSort(data)
	fmt.Println("After: ", data)
}
// Run: go run solution.go`,
  },

  // ── INSERTION SORT ─────────────────────────────────────────────────────────
  insertion: {

    typescript: `function insertionSort(arr: number[]): number[] {
  const n = arr.length;

  // arr[0..0] is trivially sorted. Start at 1.
  for (let i = 1; i < n; i++) {

    // Pick the element to insert into the
    // already-sorted prefix arr[0..i-1].
    const key = arr[i];
    let j = i - 1;

    // Shift elements greater than key one
    // position right, making room for key.
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }

    // Insert key into the gap left by shifting.
    arr[j + 1] = key;
  }
  return arr;
}
// Time: O(n²) avg/worst · O(n) best  Space: O(1)  Stable: YES

// ── demo ──
const data = [12, 11, 13, 5, 6];
console.log("Before:", [...data]);
insertionSort(data);
console.log("After: ", data);
// Run: npx ts-node solution.ts`,

    javascript: `function insertionSort(arr) {
  const n = arr.length;

  // arr[0] is already sorted. Process from index 1.
  for (let i = 1; i < n; i++) {
    const key = arr[i]; // element to be inserted
    let j = i - 1;

    // Slide elements larger than key one step right
    // to open a slot for key in sorted prefix.
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key; // place key in its correct spot
  }
  return arr;
}
// Time: O(n²) avg/worst · O(n) best  Space: O(1)  Stable: YES

// ── demo ──
const data = [12, 11, 13, 5, 6];
console.log("Before:", [...data]);
insertionSort(data);
console.log("After: ", data);
// Run: node solution.js`,

    python: `def insertion_sort(arr):
    # arr[0:1] is trivially sorted. Extend it each pass.
    for i in range(1, len(arr)):
        key = arr[i]  # element to insert into prefix
        j = i - 1

        # Shift elements larger than key to the right
        # to make room for the key's correct position.
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1

        arr[j + 1] = key  # drop key into the gap
    return arr

# Time: O(n²) avg/worst · O(n) best  Space: O(1)  Stable: True

# ── demo ──
data = [12, 11, 13, 5, 6]
print("Before:", data[:])
insertion_sort(data)
print("After: ", data)
# Run: python solution.py`,

    java: `import java.util.Arrays;

public class Solution {

    // Sort arr[] in-place using insertion sort.
    static void insertionSort(int[] arr) {
        int n = arr.length;

        // arr[0..i-1] is already sorted. Extend by
        // inserting arr[i] into its correct position.
        for (int i = 1; i < n; i++) {
            int key = arr[i];
            int j   = i - 1;

            // Shift elements > key one position right.
            while (j >= 0 && arr[j] > key) {
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = key; // insert key
        }
    }
    // Time: O(n²) avg · O(n) best  Space: O(1)  Stable: YES

    public static void main(String[] args) {
        int[] data = {12, 11, 13, 5, 6};
        System.out.println("Before: " + Arrays.toString(data));
        insertionSort(data);
        System.out.println("After:  " + Arrays.toString(data));
    }
}
// Run: javac Solution.java && java Solution`,

    c: `#include <stdio.h>

void insertion_sort(int arr[], int n) {
    /* For each element from index 1 onward, insert it
       into its correct position in the sorted prefix. */
    for (int i = 1; i < n; i++) {
        int key = arr[i];
        int j   = i - 1;

        /* Shift larger elements one position right. */
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key; /* place key in the gap */
    }
}
/* Time: O(n^2) avg · O(n) best  Space: O(1)  Stable: YES */

int main(void) {
    int data[] = {12, 11, 13, 5, 6};
    int n = (int)(sizeof data / sizeof data[0]);
    printf("Before:");
    for (int i = 0; i < n; i++) printf(" %d", data[i]);
    insertion_sort(data, n);
    printf("\\nAfter: ");
    for (int i = 0; i < n; i++) printf(" %d", data[i]);
    printf("\\n");
    return 0;
}
/* Run: gcc -o solution solution.c && ./solution */`,

    cpp: `#include <iostream>
#include <vector>

void insertionSort(std::vector<int>& v) {
    int n = static_cast<int>(v.size());

    // v[0..i-1] is sorted. Insert v[i] into
    // its correct position in the sorted prefix.
    for (int i = 1; i < n; ++i) {
        int key = v[i];
        int j   = i - 1;

        // Shift elements larger than key rightward.
        while (j >= 0 && v[j] > key) {
            v[j + 1] = v[j];
            --j;
        }
        v[j + 1] = key;
    }
}
// Time: O(n²) avg · O(n) best  Space: O(1)  Stable: YES

int main() {
    std::vector<int> data = {12, 11, 13, 5, 6};
    std::cout << "Before:";
    for (int x : data) std::cout << ' ' << x;
    insertionSort(data);
    std::cout << "\\nAfter: ";
    for (int x : data) std::cout << ' ' << x;
    std::cout << '\\n';
}
// Run: g++ -std=c++17 -o solution solution.cpp && ./solution`,

    rust: `fn insertion_sort(arr: &mut [i32]) {
    let n = arr.len();

    // arr[0..i] is sorted. Insert arr[i] into
    // the correct position in that sorted prefix.
    for i in 1..n {
        let key = arr[i];
        let mut j = i;

        // Shift elements > key one step right.
        while j > 0 && arr[j - 1] > key {
            arr[j] = arr[j - 1];
            j -= 1;
        }
        arr[j] = key; // drop key into the gap
    }
}
// Time: O(n²) avg · O(n) best  Space: O(1)  Stable: YES

fn main() {
    let mut data = [12, 11, 13, 5, 6];
    println!("Before: {:?}", data);
    insertion_sort(&mut data);
    println!("After:  {:?}", data);
}
// Run: rustc solution.rs && ./solution`,

    go: `package main

import "fmt"

func insertionSort(arr []int) {
	// arr[0] is sorted. Each iteration inserts arr[i]
	// into its correct position in arr[0..i-1].
	for i := 1; i < len(arr); i++ {
		key := arr[i]
		j := i - 1

		// Shift larger elements one step right.
		for j >= 0 && arr[j] > key {
			arr[j+1] = arr[j]
			j--
		}
		arr[j+1] = key
	}
}
// Time: O(n²) avg · O(n) best  Space: O(1)  Stable: YES

func main() {
	data := []int{12, 11, 13, 5, 6}
	fmt.Println("Before:", data)
	insertionSort(data)
	fmt.Println("After: ", data)
}
// Run: go run solution.go`,
  },

  // ── STACK ──────────────────────────────────────────────────────────────────
  stack: {

    typescript: `class Stack<T> {
  // A plain array is perfect — JS gives O(1)
  // push/pop at the END, which becomes our "top".
  private items: T[] = [];

  // push: append a new element on top. O(1).
  push(value: T): void {
    this.items.push(value);
  }

  // pop: remove and return the top element.
  // Throws on underflow (empty stack).
  pop(): T {
    if (this.isEmpty()) throw new Error("Stack underflow");
    return this.items.pop()!; // O(1)
  }

  // peek: read the top WITHOUT removing it.
  peek(): T {
    if (this.isEmpty()) throw new Error("Stack is empty");
    return this.items[this.items.length - 1]; // O(1)
  }

  isEmpty(): boolean { return this.items.length === 0; }
  size():    number  { return this.items.length; }
}
// All ops O(1) time · O(n) total space
// LIFO — Last In, First Out
// Uses: call stack, undo/redo, bracket matching

// ── demo ──
const s = new Stack<number>();
s.push(10); s.push(20); s.push(30);
console.log("peek:", s.peek());   // 30
console.log("pop: ", s.pop());    // 30
console.log("size:", s.size());   // 2
// Run: npx ts-node solution.ts`,

    javascript: `class Stack {
  // Internal array — JS push/pop at the end are O(1),
  // making the array's last element our "top".
  #items = [];

  // push: add an element to the top. O(1).
  push(value) { this.#items.push(value); }

  // pop: remove and return top, throws if empty.
  pop() {
    if (this.isEmpty()) throw new Error("Stack underflow");
    return this.#items.pop(); // O(1)
  }

  // peek: view top element without removing it.
  peek() {
    if (this.isEmpty()) throw new Error("Stack is empty");
    return this.#items.at(-1); // O(1)
  }

  isEmpty() { return this.#items.length === 0; }
  size()    { return this.#items.length; }
}
// All ops O(1) time · O(n) total space · LIFO

// ── demo ──
const s = new Stack();
s.push(10); s.push(20); s.push(30);
console.log("peek:", s.peek());  // 30
console.log("pop: ", s.pop());   // 30
console.log("size:", s.size());  // 2
// Run: node solution.js`,

    python: `class Stack:
    def __init__(self):
        # Python list gives O(1) append/pop at the end —
        # the last element is our "top".
        self._items = []

    # push: add to the top. O(1) amortised.
    def push(self, value):
        self._items.append(value)

    # pop: remove and return the top. O(1).
    def pop(self):
        if self.is_empty():
            raise IndexError("Stack underflow")
        return self._items.pop()

    # peek: view the top without removing it. O(1).
    def peek(self):
        if self.is_empty():
            raise IndexError("Stack is empty")
        return self._items[-1]

    def is_empty(self): return len(self._items) == 0
    def size(self):     return len(self._items)

# All ops O(1) time · O(n) total space · LIFO

# ── demo ──
s = Stack()
s.push(10); s.push(20); s.push(30)
print("peek:", s.peek())   # 30
print("pop: ", s.pop())    # 30
print("size:", s.size())   # 2
# Run: python solution.py`,

    java: `public class Solution {

    static class Stack<T> {
        // Array-backed stack. last element = top.
        private Object[] items = new Object[16];
        private int top = -1;

        // push: add element to top. Resizes if full.
        @SuppressWarnings("unchecked")
        public void push(T value) {
            if (top + 1 == items.length) {
                Object[] bigger = new Object[items.length * 2];
                System.arraycopy(items, 0, bigger, 0, items.length);
                items = bigger;
            }
            items[++top] = value;
        }

        // pop: remove and return the top element.
        @SuppressWarnings("unchecked")
        public T pop() {
            if (isEmpty()) throw new RuntimeException("Underflow");
            return (T) items[top--];
        }

        // peek: read top without removing. O(1).
        @SuppressWarnings("unchecked")
        public T peek() {
            if (isEmpty()) throw new RuntimeException("Empty");
            return (T) items[top];
        }

        public boolean isEmpty() { return top == -1; }
        public int     size()    { return top + 1;   }
    }
    // All ops O(1) amortised · O(n) space · LIFO

    public static void main(String[] args) {
        Stack<Integer> s = new Stack<>();
        s.push(10); s.push(20); s.push(30);
        System.out.println("peek: " + s.peek()); // 30
        System.out.println("pop:  " + s.pop());  // 30
        System.out.println("size: " + s.size()); // 2
    }
}
// Run: javac Solution.java && java Solution`,

    c: `#include <stdio.h>
#include <stdlib.h>

#define MAX 256

typedef struct {
    int data[MAX];
    int top;   /* index of the top element (-1 = empty) */
} Stack;

/* Initialise an empty stack. */
void stack_init(Stack *s) { s->top = -1; }

/* push: place value on top. O(1). */
void push(Stack *s, int value) {
    if (s->top == MAX - 1) { fprintf(stderr, "overflow\\n"); return; }
    s->data[++(s->top)] = value;
}

/* pop: remove and return the top element. O(1). */
int pop(Stack *s) {
    if (s->top < 0) { fprintf(stderr, "underflow\\n"); return -1; }
    return s->data[(s->top)--];
}

/* peek: read top without removing it. O(1). */
int peek(const Stack *s) {
    if (s->top < 0) { fprintf(stderr, "empty\\n"); return -1; }
    return s->data[s->top];
}

int  is_empty(const Stack *s) { return s->top < 0; }
int  size(const Stack *s)     { return s->top + 1; }

/* All ops O(1)  Space O(n)  LIFO */

int main(void) {
    Stack s;
    stack_init(&s);
    push(&s, 10); push(&s, 20); push(&s, 30);
    printf("peek: %d\\n", peek(&s)); /* 30 */
    printf("pop:  %d\\n", pop(&s));  /* 30 */
    printf("size: %d\\n", size(&s)); /* 2  */
    return 0;
}
/* Run: gcc -o solution solution.c && ./solution */`,

    cpp: `#include <iostream>
#include <vector>
#include <stdexcept>

template<typename T>
class Stack {
    // std::vector gives O(1) amortised push/pop
    // at the back — the back is our "top".
    std::vector<T> items;
public:
    // push: add element to top. O(1) amortised.
    void push(T value) { items.push_back(std::move(value)); }

    // pop: remove and return the top element.
    T pop() {
        if (isEmpty()) throw std::underflow_error("Stack underflow");
        T v = std::move(items.back());
        items.pop_back();
        return v;
    }

    // peek: read top without removing.
    const T& peek() const {
        if (isEmpty()) throw std::underflow_error("Stack is empty");
        return items.back();
    }

    bool isEmpty() const { return items.empty(); }
    int  size()    const { return static_cast<int>(items.size()); }
};
// All ops O(1) amortised · O(n) space · LIFO

int main() {
    Stack<int> s;
    s.push(10); s.push(20); s.push(30);
    std::cout << "peek: " << s.peek() << '\\n'; // 30
    std::cout << "pop:  " << s.pop()  << '\\n'; // 30
    std::cout << "size: " << s.size() << '\\n'; // 2
}
// Run: g++ -std=c++17 -o solution solution.cpp && ./solution`,

    rust: `struct Stack<T> {
    // Vec gives O(1) amortised push/pop at the end.
    // The last element is the "top" of the stack.
    items: Vec<T>,
}

impl<T> Stack<T> {
    fn new() -> Self { Stack { items: Vec::new() } }

    // push: add to the top. O(1) amortised.
    fn push(&mut self, value: T) {
        self.items.push(value);
    }

    // pop: remove and return the top, or None.
    fn pop(&mut self) -> Option<T> {
        self.items.pop()
    }

    // peek: borrow the top without removing it.
    fn peek(&self) -> Option<&T> {
        self.items.last()
    }

    fn is_empty(&self) -> bool { self.items.is_empty() }
    fn size(&self)     -> usize { self.items.len() }
}
// All ops O(1) amortised · O(n) space · LIFO

fn main() {
    let mut s = Stack::new();
    s.push(10); s.push(20); s.push(30);
    println!("peek: {:?}", s.peek());  // Some(30)
    println!("pop:  {:?}", s.pop());   // Some(30)
    println!("size: {}",   s.size());  // 2
}
// Run: rustc solution.rs && ./solution`,

    go: `package main

import (
	"errors"
	"fmt"
)

// Stack is a LIFO container backed by a slice.
// Slice append/pop at the end are O(1) amortised.
type Stack struct{ items []int }

// Push adds a value to the top.
func (s *Stack) Push(v int) { s.items = append(s.items, v) }

// Pop removes and returns the top value.
func (s *Stack) Pop() (int, error) {
	if s.IsEmpty() { return 0, errors.New("underflow") }
	n := len(s.items) - 1
	v := s.items[n]
	s.items = s.items[:n]
	return v, nil
}

// Peek returns the top value without removing it.
func (s *Stack) Peek() (int, error) {
	if s.IsEmpty() { return 0, errors.New("empty") }
	return s.items[len(s.items)-1], nil
}

func (s *Stack) IsEmpty() bool { return len(s.items) == 0 }
func (s *Stack) Size()    int  { return len(s.items) }

// All ops O(1) amortised · O(n) space · LIFO

func main() {
	s := &Stack{}
	s.Push(10); s.Push(20); s.Push(30)
	v, _ := s.Peek(); fmt.Println("peek:", v)  // 30
	v, _ = s.Pop();   fmt.Println("pop: ", v)  // 30
	fmt.Println("size:", s.Size())              // 2
}
// Run: go run solution.go`,
  },

  // ── QUEUE ──────────────────────────────────────────────────────────────────
  queue: {

    typescript: `class Queue<T> {
  // We keep a head pointer to avoid shifting the
  // whole array on every dequeue — dequeue stays O(1).
  private items: T[] = [];
  private head = 0;

  // enqueue: add to the back. O(1) amortised.
  enqueue(value: T): void {
    this.items.push(value);
  }

  // dequeue: remove and return the front element.
  dequeue(): T {
    if (this.isEmpty()) throw new Error("Queue underflow");
    const value = this.items[this.head++];

    // Reclaim memory when the dead prefix grows too large.
    if (this.head > this.items.length / 2) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return value;
  }

  // peek: view the front element without removing it.
  peek(): T {
    if (this.isEmpty()) throw new Error("Queue is empty");
    return this.items[this.head]; // O(1)
  }

  isEmpty(): boolean { return this.head >= this.items.length; }
  size():    number  { return this.items.length - this.head; }
}
// All ops O(1) amortised · O(n) space · FIFO

// ── demo ──
const q = new Queue<number>();
q.enqueue(1); q.enqueue(2); q.enqueue(3);
console.log("peek:", q.peek());    // 1
console.log("deq: ", q.dequeue()); // 1
console.log("size:", q.size());    // 2
// Run: npx ts-node solution.ts`,

    javascript: `class Queue {
  // Head pointer trick: advance head on dequeue
  // instead of shifting the whole array — O(1).
  #items = [];
  #head  = 0;

  // enqueue: add element to the back. O(1).
  enqueue(value) { this.#items.push(value); }

  // dequeue: remove and return the front element.
  dequeue() {
    if (this.isEmpty()) throw new Error("Queue underflow");
    const value = this.#items[this.#head++];
    // Compact the array when it gets wasteful.
    if (this.#head > this.#items.length / 2) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return value;
  }

  peek()    { return this.#items[this.#head]; }
  isEmpty() { return this.#head >= this.#items.length; }
  size()    { return this.#items.length - this.#head; }
}
// All ops O(1) amortised · O(n) space · FIFO

// ── demo ──
const q = new Queue();
q.enqueue(1); q.enqueue(2); q.enqueue(3);
console.log("peek:", q.peek());    // 1
console.log("deq: ", q.dequeue()); // 1
console.log("size:", q.size());    // 2
// Run: node solution.js`,

    python: `from collections import deque

class Queue:
    def __init__(self):
        # collections.deque gives O(1) append at the
        # right and popleft at the left — perfect for FIFO.
        self._items = deque()

    # enqueue: add to the back. O(1).
    def enqueue(self, value):
        self._items.append(value)

    # dequeue: remove from the front. O(1).
    def dequeue(self):
        if self.is_empty():
            raise IndexError("Queue underflow")
        return self._items.popleft()

    # peek: view the front without removing it.
    def peek(self):
        if self.is_empty():
            raise IndexError("Queue is empty")
        return self._items[0]

    def is_empty(self): return len(self._items) == 0
    def size(self):     return len(self._items)

# All ops O(1) · O(n) space · FIFO

# ── demo ──
q = Queue()
q.enqueue(1); q.enqueue(2); q.enqueue(3)
print("peek:", q.peek())     # 1
print("deq: ", q.dequeue())  # 1
print("size:", q.size())     # 2
# Run: python solution.py`,

    java: `import java.util.LinkedList;

public class Solution {

    static class Queue<T> {
        // LinkedList gives O(1) add-last and remove-first,
        // which maps directly to enqueue and dequeue.
        private final LinkedList<T> items = new LinkedList<>();

        // enqueue: add to the back. O(1).
        public void enqueue(T value) { items.addLast(value); }

        // dequeue: remove and return the front. O(1).
        public T dequeue() {
            if (isEmpty()) throw new RuntimeException("Underflow");
            return items.removeFirst();
        }

        // peek: view front without removing. O(1).
        public T peek() {
            if (isEmpty()) throw new RuntimeException("Empty");
            return items.getFirst();
        }

        public boolean isEmpty() { return items.isEmpty(); }
        public int     size()    { return items.size(); }
    }
    // All ops O(1) · O(n) space · FIFO

    public static void main(String[] args) {
        Queue<Integer> q = new Queue<>();
        q.enqueue(1); q.enqueue(2); q.enqueue(3);
        System.out.println("peek: " + q.peek());     // 1
        System.out.println("deq:  " + q.dequeue());  // 1
        System.out.println("size: " + q.size());     // 2
    }
}
// Run: javac Solution.java && java Solution`,

    c: `#include <stdio.h>
#include <stdlib.h>

/* Circular-buffer queue — fixed capacity, O(1) ops. */
#define CAP 256

typedef struct {
    int data[CAP];
    int head, tail, size;
} Queue;

void queue_init(Queue *q) { q->head = q->tail = q->size = 0; }

/* enqueue: add value at the back. O(1). */
void enqueue(Queue *q, int value) {
    if (q->size == CAP) { fprintf(stderr, "full\\n"); return; }
    q->data[q->tail] = value;
    q->tail = (q->tail + 1) % CAP; /* wrap around */
    q->size++;
}

/* dequeue: remove and return the front. O(1). */
int dequeue(Queue *q) {
    if (q->size == 0) { fprintf(stderr, "empty\\n"); return -1; }
    int v = q->data[q->head];
    q->head = (q->head + 1) % CAP;
    q->size--;
    return v;
}

/* peek: read front without removing. O(1). */
int peek(const Queue *q) { return q->data[q->head]; }

int  is_empty(const Queue *q) { return q->size == 0; }
int  size(const Queue *q)     { return q->size; }

/* All ops O(1)  Space O(n)  FIFO */

int main(void) {
    Queue q;
    queue_init(&q);
    enqueue(&q, 1); enqueue(&q, 2); enqueue(&q, 3);
    printf("peek: %d\\n", peek(&q));     /* 1 */
    printf("deq:  %d\\n", dequeue(&q));  /* 1 */
    printf("size: %d\\n", size(&q));     /* 2 */
    return 0;
}
/* Run: gcc -o solution solution.c && ./solution */`,

    cpp: `#include <iostream>
#include <deque>
#include <stdexcept>

template<typename T>
class Queue {
    // std::deque gives O(1) push_back and pop_front
    // — exactly what a FIFO queue needs.
    std::deque<T> items;
public:
    // enqueue: add to the back. O(1).
    void enqueue(T value) { items.push_back(std::move(value)); }

    // dequeue: remove and return the front. O(1).
    T dequeue() {
        if (isEmpty()) throw std::underflow_error("Queue underflow");
        T v = std::move(items.front());
        items.pop_front();
        return v;
    }

    // peek: read front without removing.
    const T& peek() const {
        if (isEmpty()) throw std::underflow_error("Queue is empty");
        return items.front();
    }

    bool isEmpty() const { return items.empty(); }
    int  size()    const { return static_cast<int>(items.size()); }
};
// All ops O(1) · O(n) space · FIFO

int main() {
    Queue<int> q;
    q.enqueue(1); q.enqueue(2); q.enqueue(3);
    std::cout << "peek: " << q.peek()     << '\\n'; // 1
    std::cout << "deq:  " << q.dequeue()  << '\\n'; // 1
    std::cout << "size: " << q.size()     << '\\n'; // 2
}
// Run: g++ -std=c++17 -o solution solution.cpp && ./solution`,

    rust: `use std::collections::VecDeque;

struct Queue<T> {
    // VecDeque is a ring-buffer deque that gives
    // O(1) push_back and pop_front — ideal for FIFO.
    items: VecDeque<T>,
}

impl<T> Queue<T> {
    fn new() -> Self { Queue { items: VecDeque::new() } }

    // enqueue: add to the back. O(1) amortised.
    fn enqueue(&mut self, value: T) {
        self.items.push_back(value);
    }

    // dequeue: remove from the front. O(1).
    fn dequeue(&mut self) -> Option<T> {
        self.items.pop_front()
    }

    // peek: borrow the front without removing.
    fn peek(&self) -> Option<&T> {
        self.items.front()
    }

    fn is_empty(&self) -> bool  { self.items.is_empty() }
    fn size(&self)     -> usize { self.items.len() }
}
// All ops O(1) amortised · O(n) space · FIFO

fn main() {
    let mut q = Queue::new();
    q.enqueue(1); q.enqueue(2); q.enqueue(3);
    println!("peek: {:?}", q.peek());     // Some(1)
    println!("deq:  {:?}", q.dequeue());  // Some(1)
    println!("size: {}",   q.size());     // 2
}
// Run: rustc solution.rs && ./solution`,

    go: `package main

import (
	"errors"
	"fmt"
)

// Queue is a FIFO container backed by a slice
// with a head index to keep dequeue O(1).
type Queue struct {
	items []int
	head  int
}

// Enqueue adds a value at the back. O(1).
func (q *Queue) Enqueue(v int) { q.items = append(q.items, v) }

// Dequeue removes and returns the front. O(1).
func (q *Queue) Dequeue() (int, error) {
	if q.IsEmpty() { return 0, errors.New("underflow") }
	v := q.items[q.head]
	q.head++
	// Compact when dead prefix exceeds half the slice.
	if q.head > len(q.items)/2 {
		q.items = q.items[q.head:]
		q.head = 0
	}
	return v, nil
}

// Peek returns the front without removing it.
func (q *Queue) Peek() (int, error) {
	if q.IsEmpty() { return 0, errors.New("empty") }
	return q.items[q.head], nil
}

func (q *Queue) IsEmpty() bool { return q.head >= len(q.items) }
func (q *Queue) Size()    int  { return len(q.items) - q.head }

// All ops O(1) amortised · O(n) space · FIFO

func main() {
	q := &Queue{}
	q.Enqueue(1); q.Enqueue(2); q.Enqueue(3)
	v, _ := q.Peek();    fmt.Println("peek:", v) // 1
	v, _ = q.Dequeue();  fmt.Println("deq: ", v) // 1
	fmt.Println("size:", q.Size())               // 2
}
// Run: go run solution.go`,
  },

  // ── LINKED LIST ────────────────────────────────────────────────────────────
  "linked-list": {

    typescript: `// Each node holds a value and a reference to the next node.
class ListNode<T> {
  constructor(public value: T, public next: ListNode<T> | null = null) {}
}

class LinkedList<T> {
  head: ListNode<T> | null = null;
  length = 0;

  // insertHead: create a new node, point it at the
  // current head, then make it the new head. O(1).
  insertHead(value: T): void {
    this.head = new ListNode(value, this.head);
    this.length++;
  }

  // insertTail: walk to the last node, then attach.
  // O(n) — must traverse the entire list.
  insertTail(value: T): void {
    const node = new ListNode(value);
    if (!this.head) { this.head = node; }
    else {
      let cur = this.head;
      while (cur.next) cur = cur.next; // find last node
      cur.next = node;                 // attach new tail
    }
    this.length++;
  }

  // deleteHead: advance head to head.next.
  // The old head becomes unreachable and is GC'd. O(1).
  deleteHead(): T | null {
    if (!this.head) return null;
    const val = this.head.value;
    this.head = this.head.next;
    this.length--;
    return val;
  }

  // toArray: collect values for easy inspection.
  toArray(): T[] {
    const out: T[] = [];
    for (let n = this.head; n; n = n.next) out.push(n.value);
    return out;
  }
}
// insertHead/deleteHead O(1) · insertTail/search O(n)

// ── demo ──
const list = new LinkedList<number>();
list.insertTail(10); list.insertTail(20); list.insertTail(30);
list.insertHead(5);
console.log(list.toArray());   // [5, 10, 20, 30]
list.deleteHead();
console.log(list.toArray());   // [10, 20, 30]
// Run: npx ts-node solution.ts`,

    javascript: `// Each node stores a value and a pointer to the next node.
class ListNode {
  constructor(value, next = null) {
    this.value = value;
    this.next  = next;
  }
}

class LinkedList {
  constructor() { this.head = null; this.length = 0; }

  // insertHead: wire new node → old head, update head.
  // Only one pointer change needed — O(1).
  insertHead(value) {
    this.head = new ListNode(value, this.head);
    this.length++;
  }

  // insertTail: walk to the end then attach. O(n).
  insertTail(value) {
    const node = new ListNode(value);
    if (!this.head) { this.head = node; }
    else {
      let cur = this.head;
      while (cur.next) cur = cur.next;
      cur.next = node;
    }
    this.length++;
  }

  // deleteHead: skip the first node. O(1).
  deleteHead() {
    if (!this.head) return null;
    const val = this.head.value;
    this.head = this.head.next;
    this.length--;
    return val;
  }

  toArray() {
    const out = [];
    for (let n = this.head; n; n = n.next) out.push(n.value);
    return out;
  }
}
// insertHead/deleteHead O(1) · rest O(n)

// ── demo ──
const list = new LinkedList();
list.insertTail(10); list.insertTail(20); list.insertTail(30);
list.insertHead(5);
console.log(list.toArray());  // [5, 10, 20, 30]
list.deleteHead();
console.log(list.toArray());  // [10, 20, 30]
// Run: node solution.js`,

    python: `class Node:
    def __init__(self, value, next_node=None):
        self.value = value
        self.next  = next_node


class LinkedList:
    def __init__(self):
        self.head   = None
        self.length = 0

    # insert_head: new node → old head, update head.
    # Only one re-link needed — O(1).
    def insert_head(self, value):
        self.head = Node(value, self.head)
        self.length += 1

    # insert_tail: walk to the last node then attach.
    # Must traverse the entire list — O(n).
    def insert_tail(self, value):
        node = Node(value)
        if not self.head:
            self.head = node
        else:
            cur = self.head
            while cur.next:
                cur = cur.next
            cur.next = node
        self.length += 1

    # delete_head: advance head to head.next. O(1).
    def delete_head(self):
        if not self.head:
            return None
        val = self.head.value
        self.head = self.head.next
        self.length -= 1
        return val

    def to_list(self):
        out, cur = [], self.head
        while cur:
            out.append(cur.value)
            cur = cur.next
        return out

# insert_head / delete_head: O(1)
# insert_tail / search: O(n)

# ── demo ──
ll = LinkedList()
ll.insert_tail(10); ll.insert_tail(20); ll.insert_tail(30)
ll.insert_head(5)
print(ll.to_list())   # [5, 10, 20, 30]
ll.delete_head()
print(ll.to_list())   # [10, 20, 30]
# Run: python solution.py`,

    java: `public class Solution {

    static class Node<T> {
        T value;
        Node<T> next;
        Node(T v) { value = v; }
    }

    static class LinkedList<T> {
        Node<T> head = null;
        int length   = 0;

        // insertHead: attach new node before current head.
        // A single pointer update — O(1).
        void insertHead(T value) {
            Node<T> node = new Node<>(value);
            node.next    = head;
            head         = node;
            length++;
        }

        // insertTail: traverse to the end then attach.
        // Requires a full traversal — O(n).
        void insertTail(T value) {
            Node<T> node = new Node<>(value);
            if (head == null) { head = node; }
            else {
                Node<T> cur = head;
                while (cur.next != null) cur = cur.next;
                cur.next = node;
            }
            length++;
        }

        // deleteHead: skip the first node. O(1).
        T deleteHead() {
            if (head == null) return null;
            T val = head.value;
            head  = head.next;
            length--;
            return val;
        }

        public String toString() {
            StringBuilder sb = new StringBuilder("[");
            for (Node<T> n = head; n != null; n = n.next) {
                if (sb.length() > 1) sb.append(", ");
                sb.append(n.value);
            }
            return sb.append("]").toString();
        }
    }
    // insertHead/deleteHead O(1) · rest O(n)

    public static void main(String[] args) {
        LinkedList<Integer> list = new LinkedList<>();
        list.insertTail(10); list.insertTail(20); list.insertTail(30);
        list.insertHead(5);
        System.out.println(list);        // [5, 10, 20, 30]
        list.deleteHead();
        System.out.println(list);        // [10, 20, 30]
    }
}
// Run: javac Solution.java && java Solution`,

    c: `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int          value;
    struct Node *next;
} Node;

/* Allocate a new node on the heap. */
static Node *new_node(int value) {
    Node *n = (Node *)malloc(sizeof(Node));
    n->value = value;
    n->next  = NULL;
    return n;
}

/* insert_head: new node → old head, update head.  O(1). */
void insert_head(Node **head, int value) {
    Node *n = new_node(value);
    n->next = *head;
    *head   = n;
}

/* insert_tail: walk to the end then attach. O(n). */
void insert_tail(Node **head, int value) {
    Node *n = new_node(value);
    if (!*head) { *head = n; return; }
    Node *cur = *head;
    while (cur->next) cur = cur->next;
    cur->next = n;
}

/* delete_head: skip first node, free its memory. O(1). */
int delete_head(Node **head) {
    if (!*head) return -1;
    Node *old = *head;
    int   val = old->value;
    *head = old->next;
    free(old);   /* return memory to the allocator */
    return val;
}

/* Print the list in 10 -> 20 -> null style. */
void print_list(const Node *head) {
    for (const Node *n = head; n; n = n->next)
        printf("%d -> ", n->value);
    printf("null\\n");
}

/* insertHead/deleteHead O(1)  insertTail/search O(n) */

int main(void) {
    Node *head = NULL;
    insert_tail(&head, 10);
    insert_tail(&head, 20);
    insert_tail(&head, 30);
    insert_head(&head, 5);
    print_list(head);   /* 5 -> 10 -> 20 -> 30 -> null */
    delete_head(&head);
    print_list(head);   /* 10 -> 20 -> 30 -> null */
    return 0;
}
/* Run: gcc -o solution solution.c && ./solution */`,

    cpp: `#include <iostream>
#include <memory>

template<typename T>
struct Node {
    T                        value;
    std::unique_ptr<Node<T>> next;
    explicit Node(T v) : value(std::move(v)) {}
};

template<typename T>
class LinkedList {
    std::unique_ptr<Node<T>> head;
    int len = 0;
public:
    // insertHead: prepend a node in O(1).
    void insertHead(T value) {
        auto node  = std::make_unique<Node<T>>(std::move(value));
        node->next = std::move(head);
        head       = std::move(node);
        ++len;
    }

    // insertTail: walk to end, then append. O(n).
    void insertTail(T value) {
        auto node = std::make_unique<Node<T>>(std::move(value));
        if (!head) { head = std::move(node); }
        else {
            Node<T> *cur = head.get();
            while (cur->next) cur = cur->next.get();
            cur->next = std::move(node);
        }
        ++len;
    }

    // deleteHead: release the first node. O(1).
    void deleteHead() {
        if (!head) return;
        head = std::move(head->next);
        --len;
    }

    void print() const {
        for (auto *n = head.get(); n; n = n->next.get())
            std::cout << n->value << " -> ";
        std::cout << "null\\n";
    }
};
// insertHead/deleteHead O(1) · rest O(n)

int main() {
    LinkedList<int> list;
    list.insertTail(10); list.insertTail(20); list.insertTail(30);
    list.insertHead(5);
    list.print();   // 5 -> 10 -> 20 -> 30 -> null
    list.deleteHead();
    list.print();   // 10 -> 20 -> 30 -> null
}
// Run: g++ -std=c++17 -o solution solution.cpp && ./solution`,

    rust: `// Box<Node> is Rust's safe heap-allocated pointer.
// Ownership rules ensure no dangling pointers or leaks.
type Link<T> = Option<Box<Node<T>>>;

struct Node<T> {
    value: T,
    next:  Link<T>,
}

struct LinkedList<T> {
    head: Link<T>,
    len:  usize,
}

impl<T: std::fmt::Debug> LinkedList<T> {
    fn new() -> Self { LinkedList { head: None, len: 0 } }

    // insert_head: prepend a new node. O(1).
    fn insert_head(&mut self, value: T) {
        let node = Box::new(Node { value, next: self.head.take() });
        self.head = Some(node);
        self.len += 1;
    }

    // insert_tail: walk to the end, then attach. O(n).
    fn insert_tail(&mut self, value: T) {
        let node = Box::new(Node { value, next: None });
        match self.head {
            None => self.head = Some(node),
            Some(_) => {
                let mut cur = self.head.as_mut().unwrap();
                while cur.next.is_some() {
                    cur = cur.next.as_mut().unwrap();
                }
                cur.next = Some(node);
            }
        }
        self.len += 1;
    }

    // delete_head: drop the first node. O(1).
    fn delete_head(&mut self) -> Option<T> {
        self.head.take().map(|node| {
            self.head = node.next;
            self.len -= 1;
            node.value
        })
    }

    fn print(&self) {
        let mut cur = &self.head;
        while let Some(n) = cur {
            print!("{:?} -> ", n.value);
            cur = &n.next;
        }
        println!("null");
    }
}
// insert_head / delete_head O(1)  ·  insert_tail / search O(n)

fn main() {
    let mut list = LinkedList::new();
    list.insert_tail(10); list.insert_tail(20); list.insert_tail(30);
    list.insert_head(5);
    list.print();   // 5 -> 10 -> 20 -> 30 -> null
    list.delete_head();
    list.print();   // 10 -> 20 -> 30 -> null
}
// Run: rustc solution.rs && ./solution`,

    go: `package main

import "fmt"

// Node holds a value and a pointer to the next node.
type Node struct {
	Value int
	Next  *Node
}

// LinkedList holds a pointer to the head node.
type LinkedList struct {
	Head *Node
	Len  int
}

// InsertHead prepends a new node in O(1).
func (l *LinkedList) InsertHead(value int) {
	l.Head = &Node{Value: value, Next: l.Head}
	l.Len++
}

// InsertTail walks to the last node and appends. O(n).
func (l *LinkedList) InsertTail(value int) {
	node := &Node{Value: value}
	if l.Head == nil {
		l.Head = node
	} else {
		cur := l.Head
		for cur.Next != nil {
			cur = cur.Next // walk to the last node
		}
		cur.Next = node
	}
	l.Len++
}

// DeleteHead removes the first node. O(1).
func (l *LinkedList) DeleteHead() (int, bool) {
	if l.Head == nil { return 0, false }
	val    := l.Head.Value
	l.Head  = l.Head.Next
	l.Len--
	return val, true
}

// Print displays the list as: 5 -> 10 -> null
func (l *LinkedList) Print() {
	for n := l.Head; n != nil; n = n.Next {
		fmt.Printf("%d -> ", n.Value)
	}
	fmt.Println("null")
}
// InsertHead/DeleteHead O(1)  ·  InsertTail/Search O(n)

func main() {
	list := &LinkedList{}
	list.InsertTail(10); list.InsertTail(20); list.InsertTail(30)
	list.InsertHead(5)
	list.Print()   // 5 -> 10 -> 20 -> 30 -> null
	list.DeleteHead()
	list.Print()   // 10 -> 20 -> 30 -> null
}
// Run: go run solution.go`,
  },

  // ── MERGE ───────────────────────────────────────────────────────
  "merge": {
    typescript: `
// Bottom-up iterative merge sort in TypeScript
function mergeSort(arr: number[]): number[] {
  const n = arr.length;
  const result = arr.slice(); // copy input so original is unchanged
  const temp = new Array<number>(n); // scratch buffer for merging

  // start with sub-arrays of size 1, then 2, 4, 8 ...
  for (let width = 1; width < n; width *= 2) { // double width each pass
    for (let lo = 0; lo < n; lo += 2 * width) { // step through pairs
      const mid = Math.min(lo + width, n);       // guard against overrun
      const hi  = Math.min(lo + 2 * width, n);  // guard against overrun

      // merge result[lo..mid) and result[mid..hi) into temp
      let i = lo, j = mid, k = lo;
      while (i < mid && j < hi) {
        // pick the smaller element; <= keeps sort stable
        if (result[i] <= result[j]) temp[k++] = result[i++];
        else                         temp[k++] = result[j++];
      }
      while (i < mid) temp[k++] = result[i++]; // drain left remainder
      while (j < hi)  temp[k++] = result[j++]; // drain right remainder

      // write merged segment back to result
      for (let x = lo; x < hi; x++) result[x] = temp[x];
    }
  }
  return result; // fully sorted copy
}

// --- demo ---
const input = [38, 27, 43, 3, 9, 82, 10];
console.log('Before:', input.join(', '));
console.log('After: ', mergeSort(input).join(', '));
// Time: O(n log n)  Space: O(n)  Stable: YES
`,

    javascript: `
// Bottom-up iterative merge sort in JavaScript
function mergeSort(arr) {
  const n = arr.length;
  const result = arr.slice(); // work on a copy
  const temp = new Array(n); // reusable scratch space

  // outer loop doubles the sub-array width each pass
  for (let width = 1; width < n; width *= 2) {
    // inner loop advances by two widths to cover every pair
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);      // clamp to array end
      const hi  = Math.min(lo + 2 * width, n); // clamp to array end

      // two-pointer merge into temp buffer
      let i = lo, j = mid, k = lo;
      while (i < mid && j < hi) {
        // stable: take left element when equal
        temp[k++] = result[i] <= result[j] ? result[i++] : result[j++];
      }
      while (i < mid) temp[k++] = result[i++]; // leftover left
      while (j < hi)  temp[k++] = result[j++]; // leftover right

      // copy merged window back
      for (let x = lo; x < hi; x++) result[x] = temp[x];
    }
  }
  return result;
}

// --- demo ---
const input = [38, 27, 43, 3, 9, 82, 10];
console.log('Before:', input.join(', '));
console.log('After: ', mergeSort(input).join(', '));
// Time: O(n log n)  Space: O(n)  Stable: YES
`,

    python: `
# Bottom-up iterative merge sort in Python
def merge_sort(arr):
    n = len(arr)
    result = arr[:]          # work on a copy; leave original unchanged
    temp = [0] * n           # reusable scratch buffer

    width = 1
    while width < n:         # double the merge width each pass
        lo = 0
        while lo < n:        # walk through all pairs at this width
            mid = min(lo + width, n)           # guard against overrun
            hi  = min(lo + 2 * width, n)      # guard against overrun

            # two-pointer merge of result[lo:mid] and result[mid:hi]
            i, j, k = lo, mid, lo
            while i < mid and j < hi:
                # <= preserves original order of equals (stability)
                if result[i] <= result[j]:
                    temp[k] = result[i]; i += 1
                else:
                    temp[k] = result[j]; j += 1
                k += 1
            while i < mid:   # drain remaining left elements
                temp[k] = result[i]; i += 1; k += 1
            while j < hi:    # drain remaining right elements
                temp[k] = result[j]; j += 1; k += 1

            # copy merged segment back into result
            result[lo:hi] = temp[lo:hi]
            lo += 2 * width  # advance to next pair
        width *= 2           # next pass with wider segments

    return result

# --- demo ---
data = [38, 27, 43, 3, 9, 82, 10]
print('Before:', data)
print('After: ', merge_sort(data))
# Time: O(n log n)  Space: O(n)  Stable: YES
`,

    java: `
// Bottom-up iterative merge sort in Java
public class MergeSort {

    // sorts a copy of the input array and returns it
    public static int[] mergeSort(int[] arr) {
        int n = arr.length;
        int[] result = arr.clone(); // defensive copy
        int[] temp   = new int[n]; // scratch buffer reused every pass

        // width of sub-arrays being merged; doubles each outer iteration
        for (int width = 1; width < n; width *= 2) {
            // lo is the start of the left half of each pair
            for (int lo = 0; lo < n; lo += 2 * width) {
                int mid = Math.min(lo + width, n);      // end of left half
                int hi  = Math.min(lo + 2 * width, n); // end of right half

                // two-pointer merge into temp
                int i = lo, j = mid, k = lo;
                while (i < mid && j < hi) {
                    // take left when equal to keep sort stable
                    if (result[i] <= result[j]) temp[k++] = result[i++];
                    else                         temp[k++] = result[j++];
                }
                while (i < mid) temp[k++] = result[i++]; // drain left
                while (j < hi)  temp[k++] = result[j++]; // drain right

                // copy merged segment back to result
                System.arraycopy(temp, lo, result, lo, hi - lo);
            }
        }
        return result;
    }

    // --- demo ---
    public static void main(String[] args) {
        int[] input = {38, 27, 43, 3, 9, 82, 10};
        System.out.print("Before: ");
        for (int v : input) System.out.print(v + " ");
        System.out.println();

        int[] sorted = mergeSort(input);
        System.out.print("After:  ");
        for (int v : sorted) System.out.print(v + " ");
        System.out.println();
    }
}
// Time: O(n log n)  Space: O(n)  Stable: YES
`,

    c: `
/* Bottom-up iterative merge sort in C */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/* merge two adjacent sorted runs inside arr[] using temp as scratch */
static void merge(int *arr, int *temp, int lo, int mid, int hi) {
    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi) {
        /* <= keeps equal elements in original order (stable) */
        if (arr[i] <= arr[j]) temp[k++] = arr[i++];
        else                   temp[k++] = arr[j++];
    }
    while (i < mid) temp[k++] = arr[i++]; /* drain left remainder */
    while (j < hi)  temp[k++] = arr[j++]; /* drain right remainder */
    memcpy(arr + lo, temp + lo, (hi - lo) * sizeof(int)); /* write back */
}

void mergeSort(int *arr, int n) {
    int *temp = malloc(n * sizeof(int)); /* allocate scratch buffer once */
    if (!temp) return;                   /* handle allocation failure */

    /* width starts at 1 and doubles each outer pass */
    for (int width = 1; width < n; width *= 2) {
        for (int lo = 0; lo < n; lo += 2 * width) {
            int mid = lo + width < n ? lo + width : n; /* clamp mid */
            int hi  = lo + 2*width < n ? lo+2*width : n; /* clamp hi */
            if (mid < hi) /* skip if no right half exists */
                merge(arr, temp, lo, mid, hi);
        }
    }
    free(temp); /* release scratch buffer */
}

/* --- demo --- */
int main(void) {
    int a[] = {38, 27, 43, 3, 9, 82, 10};
    int n = sizeof(a) / sizeof(a[0]); /* compute length at runtime */
    printf("Before:");
    for (int i = 0; i < n; i++) printf(" %d", a[i]);
    printf("\n");
    mergeSort(a, n);
    printf("After: ");
    for (int i = 0; i < n; i++) printf(" %d", a[i]);
    printf("\n");
    return 0;
}
/* Time: O(n log n)  Space: O(n)  Stable: YES */
`,

    cpp: `
// Bottom-up iterative merge sort in C++
#include <iostream>
#include <vector>
#include <algorithm> // std::min

// sorts arr in-place using a separate temp buffer
void mergeSort(std::vector<int>& arr) {
    int n = static_cast<int>(arr.size());
    std::vector<int> temp(n); // scratch buffer; allocated once

    // width doubles every outer pass: 1, 2, 4, 8 ...
    for (int width = 1; width < n; width *= 2) {
        // lo is the left boundary of each merge pair
        for (int lo = 0; lo < n; lo += 2 * width) {
            int mid = std::min(lo + width, n);      // guard right boundary
            int hi  = std::min(lo + 2 * width, n); // guard right boundary

            // classic two-pointer merge
            int i = lo, j = mid, k = lo;
            while (i < mid && j < hi) {
                // <= maintains stability for equal keys
                if (arr[i] <= arr[j]) temp[k++] = arr[i++];
                else                   temp[k++] = arr[j++];
            }
            while (i < mid) temp[k++] = arr[i++]; // leftover left run
            while (j < hi)  temp[k++] = arr[j++]; // leftover right run

            // write merged segment back into arr
            for (int x = lo; x < hi; x++) arr[x] = temp[x];
        }
    }
}

// --- demo ---
int main() {
    std::vector<int> v = {38, 27, 43, 3, 9, 82, 10};
    std::cout << "Before:";
    for (int x : v) std::cout << ' ' << x;
    std::cout << '\n';
    mergeSort(v);
    std::cout << "After: ";
    for (int x : v) std::cout << ' ' << x;
    std::cout << '\n';
    return 0;
}
// Time: O(n log n)  Space: O(n)  Stable: YES
`,

    rust: `
// Bottom-up iterative merge sort in Rust
fn merge_sort(arr: &[i32]) -> Vec<i32> {
    let n = arr.len();
    let mut result = arr.to_vec(); // work on an owned copy
    let mut temp   = vec![0i32; n]; // scratch buffer allocated once

    let mut width = 1usize;
    while width < n { // outer loop: width doubles each pass
        let mut lo = 0usize;
        while lo < n { // inner loop: walk all pairs at this width
            let mid = (lo + width).min(n);      // clamp to array length
            let hi  = (lo + 2 * width).min(n); // clamp to array length

            // two-pointer merge of result[lo..mid] and result[mid..hi]
            let (mut i, mut j, mut k) = (lo, mid, lo);
            while i < mid && j < hi {
                // <= keeps equal elements in left-to-right order (stable)
                if result[i] <= result[j] {
                    temp[k] = result[i]; i += 1;
                } else {
                    temp[k] = result[j]; j += 1;
                }
                k += 1;
            }
            while i < mid { temp[k] = result[i]; i += 1; k += 1; } // drain left
            while j < hi  { temp[k] = result[j]; j += 1; k += 1; } // drain right

            // copy merged window from temp back to result
            result[lo..hi].copy_from_slice(&temp[lo..hi]);
            lo += 2 * width; // advance to next pair
        }
        width *= 2; // next pass merges twice as large segments
    }
    result
}

// --- demo ---
fn main() {
    let data = vec![38, 27, 43, 3, 9, 82, 10];
    println!("Before: {:?}", data);
    let sorted = merge_sort(&data);
    println!("After:  {:?}", sorted);
}
// Time: O(n log n)  Space: O(n)  Stable: YES
`,

    go: `
// Bottom-up iterative merge sort in Go
package main

import "fmt"

// mergeSort returns a new sorted slice; input is not modified
func mergeSort(arr []int) []int {
    n := len(arr)
    result := make([]int, n)
    copy(result, arr)        // defensive copy of input
    temp := make([]int, n)   // reusable scratch buffer

    // width doubles each outer pass: 1 -> 2 -> 4 -> ...
    for width := 1; width < n; width *= 2 {
        // walk through every adjacent pair of runs
        for lo := 0; lo < n; lo += 2 * width {
            mid := lo + width
            if mid > n { mid = n }           // clamp mid to array end
            hi := lo + 2*width
            if hi > n { hi = n }             // clamp hi to array end

            // two-pointer merge of result[lo:mid] and result[mid:hi]
            i, j, k := lo, mid, lo
            for i < mid && j < hi {
                // <= ensures stability for equal elements
                if result[i] <= result[j] {
                    temp[k] = result[i]; i++
                } else {
                    temp[k] = result[j]; j++
                }
                k++
            }
            for i < mid { temp[k] = result[i]; i++; k++ } // drain left
            for j < hi  { temp[k] = result[j]; j++; k++ } // drain right

            // write merged segment back to result
            copy(result[lo:hi], temp[lo:hi])
        }
    }
    return result
}

// --- demo ---
func main() {
    input := []int{38, 27, 43, 3, 9, 82, 10}
    fmt.Println("Before:", input)
    fmt.Println("After: ", mergeSort(input))
}
// Time: O(n log n)  Space: O(n)  Stable: YES
`,

  },

  // ── QUICK ───────────────────────────────────────────────────────
  "quick": {
    typescript: `
// Iterative Lomuto-partition quicksort in TypeScript
function quickSort(arr: number[]): number[] {
  const a = arr.slice(); // sort a copy, leave original intact
  const n = a.length;

  // explicit stack replaces call-stack recursion
  const stack: number[] = [];
  stack.push(0);       // push initial low index
  stack.push(n - 1);  // push initial high index

  while (stack.length > 0) {
    const high = stack.pop()!; // pop high first (LIFO pair)
    const low  = stack.pop()!; // pop low

    if (low >= high) continue; // sub-array of size 0 or 1 is sorted

    // --- Lomuto partition ---
    const pivot = a[high]; // choose rightmost element as pivot
    let i = low - 1;       // i tracks boundary of "less-than" region

    for (let j = low; j < high; j++) {
      if (a[j] <= pivot) {    // element belongs in left partition
        i++;
        [a[i], a[j]] = [a[j], a[i]]; // swap into left partition
      }
    }
    // place pivot at its final sorted position
    [a[i + 1], a[high]] = [a[high], a[i + 1]];
    const p = i + 1; // pivot index after partition

    // push left sub-array onto stack
    stack.push(low);
    stack.push(p - 1);
    // push right sub-array onto stack
    stack.push(p + 1);
    stack.push(high);
  }
  return a;
}

// --- demo ---
const input = [38, 27, 43, 3, 9, 82, 10];
console.log('Before:', input.join(', '));
console.log('After: ', quickSort(input).join(', '));
// Time: O(n log n) avg  Space: O(log n)  Stable: NO
`,

    javascript: `
// Iterative Lomuto-partition quicksort in JavaScript
function quickSort(arr) {
  const a = arr.slice(); // copy so original is unchanged
  const n = a.length;

  const stack = []; // explicit stack; avoids recursion depth limits
  stack.push(0);       // initial low
  stack.push(n - 1);  // initial high

  while (stack.length > 0) {
    const high = stack.pop(); // retrieve high (pushed last)
    const low  = stack.pop(); // retrieve low  (pushed first)

    if (low >= high) continue; // base case: sub-array already sorted

    // --- Lomuto partition ---
    const pivot = a[high]; // pivot is always the last element
    let i = low - 1;       // i = right edge of "smaller" partition

    for (let j = low; j < high; j++) {
      if (a[j] <= pivot) {          // j-th element belongs left of pivot
        i++;
        [a[i], a[j]] = [a[j], a[i]]; // swap to extend left partition
      }
    }
    [a[i + 1], a[high]] = [a[high], a[i + 1]]; // move pivot to final spot
    const p = i + 1; // pivot's sorted position

    // push both halves; smaller half pushed last = processed first
    stack.push(low);  stack.push(p - 1); // left half
    stack.push(p + 1); stack.push(high); // right half
  }
  return a;
}

// --- demo ---
const input = [38, 27, 43, 3, 9, 82, 10];
console.log('Before:', input.join(', '));
console.log('After: ', quickSort(input).join(', '));
// Time: O(n log n) avg  Space: O(log n)  Stable: NO
`,

    python: `
# Iterative Lomuto-partition quicksort in Python
def quick_sort(arr):
    a = arr[:]       # sort a copy; do not mutate the caller's list
    n = len(a)
    if n < 2:
        return a     # trivially sorted

    stack = []       # explicit stack stores (low, high) pairs
    stack.append((0, n - 1)) # seed with the full array range

    while stack:
        low, high = stack.pop() # process top pair

        if low >= high:          # sub-array of length 0 or 1: skip
            continue

        # --- Lomuto partition ---
        pivot = a[high]  # rightmost element is the pivot
        i = low - 1      # i is the right edge of the "less-than" zone

        for j in range(low, high):
            if a[j] <= pivot:     # element should be left of pivot
                i += 1
                a[i], a[j] = a[j], a[i] # grow left partition

        # place pivot between the two partitions
        a[i + 1], a[high] = a[high], a[i + 1]
        p = i + 1  # pivot's final position

        # push sub-problems; Python list.append/pop is O(1)
        stack.append((low, p - 1))   # left half
        stack.append((p + 1, high))  # right half

    return a

# --- demo ---
data = [38, 27, 43, 3, 9, 82, 10]
print('Before:', data)
print('After: ', quick_sort(data))
# Time: O(n log n) avg  Space: O(log n)  Stable: NO
`,

    java: `
// Iterative Lomuto-partition quicksort in Java
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;

public class QuickSort {

    public static int[] quickSort(int[] arr) {
        int[] a = arr.clone(); // work on a defensive copy
        int n = a.length;
        if (n < 2) return a;  // trivially sorted

        // Deque used as explicit stack to avoid recursive call-stack growth
        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(0);      // initial low
        stack.push(n - 1);  // initial high (popped first)

        while (!stack.isEmpty()) {
            int high = stack.pop(); // high was pushed last
            int low  = stack.pop(); // low  was pushed first

            if (low >= high) continue; // base case

            // --- Lomuto partition ---
            int pivot = a[high]; // choose last element as pivot
            int i = low - 1;     // i tracks smaller-region boundary

            for (int j = low; j < high; j++) {
                if (a[j] <= pivot) { // belongs in left partition
                    i++;
                    int tmp = a[i]; a[i] = a[j]; a[j] = tmp; // swap
                }
            }
            // move pivot into its correct sorted position
            int tmp = a[i + 1]; a[i + 1] = a[high]; a[high] = tmp;
            int p = i + 1; // pivot index

            // push left and right sub-arrays
            stack.push(low);  stack.push(p - 1); // left
            stack.push(p + 1); stack.push(high); // right
        }
        return a;
    }

    // --- demo ---
    public static void main(String[] args) {
        int[] input = {38, 27, 43, 3, 9, 82, 10};
        System.out.println("Before: " + Arrays.toString(input));
        System.out.println("After:  " + Arrays.toString(quickSort(input)));
    }
}
// Time: O(n log n) avg  Space: O(log n)  Stable: NO
`,

    c: `
/* Iterative Lomuto-partition quicksort in C */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* swap two ints in place */
static void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }

/* Lomuto partition: rearranges arr[lo..hi] around pivot=arr[hi] */
static int partition(int *arr, int lo, int hi) {
    int pivot = arr[hi]; /* rightmost element is pivot */
    int i = lo - 1;      /* i is right edge of "smaller" region */
    for (int j = lo; j < hi; j++) {
        if (arr[j] <= pivot) { /* element belongs left of pivot */
            i++;
            swap(&arr[i], &arr[j]); /* extend smaller region */
        }
    }
    swap(&arr[i + 1], &arr[hi]); /* pivot to final position */
    return i + 1;                 /* return pivot index */
}

void quickSort(int *arr, int n) {
    if (n < 2) return;
    /* stack stores lo/hi pairs; max depth is O(n) worst-case */
    int *stack = malloc(2 * n * sizeof(int));
    if (!stack) return;
    int top = -1;

    stack[++top] = 0;      /* push initial low */
    stack[++top] = n - 1;  /* push initial high */

    while (top >= 0) {
        int hi = stack[top--]; /* pop high */
        int lo = stack[top--]; /* pop low */

        if (lo >= hi) continue; /* sub-array already sorted */

        int p = partition(arr, lo, hi); /* partition and get pivot index */

        /* push left sub-array if non-trivial */
        if (p - 1 > lo) { stack[++top] = lo;    stack[++top] = p - 1; }
        /* push right sub-array if non-trivial */
        if (p + 1 < hi) { stack[++top] = p + 1; stack[++top] = hi;    }
    }
    free(stack); /* release explicit stack memory */
}

/* --- demo --- */
int main(void) {
    int a[] = {38, 27, 43, 3, 9, 82, 10};
    int n = sizeof(a) / sizeof(a[0]);
    printf("Before:");
    for (int i = 0; i < n; i++) printf(" %d", a[i]);
    printf("\n");
    quickSort(a, n);
    printf("After: ");
    for (int i = 0; i < n; i++) printf(" %d", a[i]);
    printf("\n");
    return 0;
}
/* Time: O(n log n) avg  Space: O(log n)  Stable: NO */
`,

    cpp: `
// Iterative Lomuto-partition quicksort in C++
#include <iostream>
#include <vector>
#include <stack>
#include <utility> // std::swap

// Lomuto scheme: partition arr[lo..hi] around arr[hi] as pivot
static int partition(std::vector<int>& arr, int lo, int hi) {
    int pivot = arr[hi]; // last element is pivot
    int i = lo - 1;      // i marks end of smaller-than-pivot region

    for (int j = lo; j < hi; j++) {
        if (arr[j] <= pivot) { // should be in left partition
            i++;
            std::swap(arr[i], arr[j]); // extend left partition
        }
    }
    std::swap(arr[i + 1], arr[hi]); // place pivot at sorted position
    return i + 1;                    // return pivot's final index
}

void quickSort(std::vector<int>& arr) {
    int n = static_cast<int>(arr.size());
    if (n < 2) return;

    // explicit stack of (lo, hi) pairs avoids recursion
    std::stack<std::pair<int,int>> stk;
    stk.push({0, n - 1}); // seed with full range

    while (!stk.empty()) {
        auto [lo, hi] = stk.top(); stk.pop(); // structured binding (C++17)

        if (lo >= hi) continue; // sub-array of size <= 1: done

        int p = partition(arr, lo, hi); // partition and locate pivot

        // push left sub-problem if it has at least 2 elements
        if (p - 1 > lo) stk.push({lo, p - 1});
        // push right sub-problem if it has at least 2 elements
        if (p + 1 < hi) stk.push({p + 1, hi});
    }
}

// --- demo ---
int main() {
    std::vector<int> v = {38, 27, 43, 3, 9, 82, 10};
    std::cout << "Before:";
    for (int x : v) std::cout << ' ' << x;
    std::cout << '\n';
    quickSort(v);
    std::cout << "After: ";
    for (int x : v) std::cout << ' ' << x;
    std::cout << '\n';
    return 0;
}
// Time: O(n log n) avg  Space: O(log n)  Stable: NO
`,

    rust: `
// Iterative Lomuto-partition quicksort in Rust
fn quick_sort(arr: &[i32]) -> Vec<i32> {
    let mut a = arr.to_vec(); // own a mutable copy
    let n = a.len();
    if n < 2 { return a; }  // trivially sorted

    // explicit stack stores (lo, hi) index pairs
    let mut stack: Vec<(usize, usize)> = Vec::new();
    stack.push((0, n - 1)); // seed with full range

    while let Some((lo, hi)) = stack.pop() {
        if lo >= hi { continue; } // base case: 0 or 1 element

        // --- Lomuto partition around a[hi] ---
        let pivot = a[hi]; // rightmost element chosen as pivot
        let mut i = lo;    // i tracks where next small element goes

        for j in lo..hi {
            if a[j] <= pivot { // belongs left of pivot
                a.swap(i, j);  // move it into left region
                i += 1;        // extend left region
            }
        }
        a.swap(i, hi);  // move pivot to its final sorted position
        let p = i;      // pivot index after partition

        // push left sub-array if more than one element
        if p > 0 && lo < p - 1 { stack.push((lo, p - 1)); }
        // push right sub-array if more than one element
        if p + 1 < hi           { stack.push((p + 1, hi)); }
    }
    a
}

// --- demo ---
fn main() {
    let data = vec![38, 27, 43, 3, 9, 82, 10];
    println!("Before: {:?}", data);
    let sorted = quick_sort(&data);
    println!("After:  {:?}", sorted);
}
// Time: O(n log n) avg  Space: O(log n)  Stable: NO
`,

    go: `
// Iterative Lomuto-partition quicksort in Go
package main

import "fmt"

// partition rearranges a[lo..hi] so elements <= pivot are left, > pivot are right
// returns final pivot index
func partition(a []int, lo, hi int) int {
    pivot := a[hi] // last element is pivot (Lomuto scheme)
    i := lo        // i = insertion point for next small element

    for j := lo; j < hi; j++ {
        if a[j] <= pivot {    // element belongs in left partition
            a[i], a[j] = a[j], a[i] // swap into position
            i++                       // advance left-partition boundary
        }
    }
    a[i], a[hi] = a[hi], a[i] // place pivot at its sorted position
    return i                    // return pivot index
}

// quickSort sorts a copy of arr and returns it
func quickSort(arr []int) []int {
    a := make([]int, len(arr))
    copy(a, arr)          // defensive copy; caller's slice unchanged
    n := len(a)
    if n < 2 { return a } // trivially sorted

    // stack holds [lo, hi] pairs; replaces recursive call-stack
    type pair struct{ lo, hi int }
    stack := []pair{{0, n - 1}} // seed with full array range

    for len(stack) > 0 {
        top := stack[len(stack)-1] // peek top
        stack = stack[:len(stack)-1] // pop
        lo, hi := top.lo, top.hi

        if lo >= hi { continue } // sub-array already sorted

        p := partition(a, lo, hi) // partition; p is pivot's final index

        if lo < p-1 { stack = append(stack, pair{lo, p - 1}) }   // left half
        if p+1 < hi { stack = append(stack, pair{p + 1, hi}) }   // right half
    }
    return a
}

// --- demo ---
func main() {
    input := []int{38, 27, 43, 3, 9, 82, 10}
    fmt.Println("Before:", input)
    fmt.Println("After: ", quickSort(input))
}
// Time: O(n log n) avg  Space: O(log n)  Stable: NO
`,

  },

  // ── HEAP ────────────────────────────────────────────────────────
  "heap": {
    typescript: `// Time: O(n log n)  Space: O(1)  Stable: NO
function heapSort(arr: number[]): number[] {
  const n = arr.length;
  // Build max-heap: start from last non-leaf and heapify up
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(arr, n, i);
  }
  // Extract elements one by one from the heap
  for (let i = n - 1; i > 0; i--) {
    // Move current root (max) to end
    [arr[0], arr[i]] = [arr[i], arr[0]];
    // Heapify the reduced heap
    heapify(arr, i, 0);
  }
  return arr;
}

function heapify(arr: number[], n: number, root: number): void {
  let largest = root;       // Assume root is largest
  const left = 2 * root + 1;  // Left child index
  const right = 2 * root + 2; // Right child index
  // Check if left child is larger than root
  if (left < n && arr[left] > arr[largest]) largest = left;
  // Check if right child is larger than current largest
  if (right < n && arr[right] > arr[largest]) largest = right;
  // If largest is not root, swap and recurse
  if (largest !== root) {
    [arr[root], arr[largest]] = [arr[largest], arr[root]];
    heapify(arr, n, largest); // Fix the affected subtree
  }
}

const data = [12, 11, 13, 5, 6, 7];
console.log("Before:", [...data]);
console.log("After: ", heapSort(data));`,

    javascript: `// Time: O(n log n)  Space: O(1)  Stable: NO
function heapSort(arr) {
  const n = arr.length;
  // Phase 1: build max-heap from unordered array
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(arr, n, i); // start at last non-leaf
  }
  // Phase 2: extract max element one at a time
  for (let i = n - 1; i > 0; i--) {
    // Swap max (root) with last unsorted element
    [arr[0], arr[i]] = [arr[i], arr[0]];
    // Restore heap property for reduced heap
    heapify(arr, i, 0);
  }
  return arr;
}

function heapify(arr, n, root) {
  let largest = root;         // Track index of largest value
  const left = 2 * root + 1; // Left child
  const right = 2 * root + 2;// Right child
  // Update largest if left child is bigger
  if (left < n && arr[left] > arr[largest]) largest = left;
  // Update largest if right child is bigger
  if (right < n && arr[right] > arr[largest]) largest = right;
  // Swap and recursively heapify if root was not largest
  if (largest !== root) {
    [arr[root], arr[largest]] = [arr[largest], arr[root]];
    heapify(arr, n, largest);
  }
}

const data = [12, 11, 13, 5, 6, 7];
console.log("Before:", [...data]);
console.log("After: ", heapSort(data));`,

    python: `# Time: O(n log n)  Space: O(1)  Stable: NO
def heapify(arr, n, root):
    largest = root        # Start assuming root is largest
    left = 2 * root + 1  # Left child index
    right = 2 * root + 2 # Right child index

    # Check left child against current largest
    if left < n and arr[left] > arr[largest]:
        largest = left

    # Check right child against current largest
    if right < n and arr[right] > arr[largest]:
        largest = right

    # If root is not largest, swap and fix subtree
    if largest != root:
        arr[root], arr[largest] = arr[largest], arr[root]
        heapify(arr, n, largest)  # Recurse on swapped subtree

def heap_sort(arr):
    n = len(arr)
    # Build max-heap by heapifying from last non-leaf upward
    for i in range(n // 2 - 1, -1, -1):
        heapify(arr, n, i)
    # Extract elements: swap root with end, shrink heap
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]  # Move max to sorted region
        heapify(arr, i, 0)                # Re-heapify remaining elements
    return arr

data = [12, 11, 13, 5, 6, 7]
print("Before:", data[:])
print("After: ", heap_sort(data))`,

    java: `// Time: O(n log n)  Space: O(1)  Stable: NO
import java.util.Arrays;

public class HeapSort {
    // Maintain max-heap property for subtree rooted at 'root'
    static void heapify(int[] arr, int n, int root) {
        int largest = root;       // Assume root is the largest
        int left  = 2 * root + 1; // Left child index
        int right = 2 * root + 2; // Right child index

        // Compare left child with current largest
        if (left < n && arr[left] > arr[largest]) largest = left;
        // Compare right child with current largest
        if (right < n && arr[right] > arr[largest]) largest = right;

        // Swap if root is not the largest, then recurse
        if (largest != root) {
            int tmp = arr[root];
            arr[root] = arr[largest];
            arr[largest] = tmp;
            heapify(arr, n, largest); // Fix the affected subtree
        }
    }

    static void heapSort(int[] arr) {
        int n = arr.length;
        // Build max-heap starting from last non-leaf node
        for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);
        // Move root (max) to end, reduce heap size, re-heapify
        for (int i = n - 1; i > 0; i--) {
            int tmp = arr[0]; arr[0] = arr[i]; arr[i] = tmp;
            heapify(arr, i, 0);
        }
    }

    public static void main(String[] args) {
        int[] data = {12, 11, 13, 5, 6, 7};
        System.out.println("Before: " + Arrays.toString(data));
        heapSort(data);
        System.out.println("After:  " + Arrays.toString(data));
    }
}`,

    c: `/* Time: O(n log n)  Space: O(1)  Stable: NO */
#include <stdio.h>

/* Restore max-heap property for subtree rooted at 'root' */
void heapify(int arr[], int n, int root) {
    int largest = root;       /* Assume root holds the max */
    int left  = 2 * root + 1; /* Left child position */
    int right = 2 * root + 2; /* Right child position */

    /* Check if left child beats current largest */
    if (left < n && arr[left] > arr[largest]) largest = left;
    /* Check if right child beats current largest */
    if (right < n && arr[right] > arr[largest]) largest = right;

    /* Swap and recurse only when root was not the largest */
    if (largest != root) {
        int tmp = arr[root];
        arr[root] = arr[largest];
        arr[largest] = tmp;
        heapify(arr, n, largest); /* Fix the swapped subtree */
    }
}

void heapSort(int arr[], int n) {
    /* Build max-heap: process non-leaf nodes right to left */
    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);
    /* Repeatedly extract maximum and place at end */
    for (int i = n - 1; i > 0; i--) {
        int tmp = arr[0]; arr[0] = arr[i]; arr[i] = tmp;
        heapify(arr, i, 0); /* Heapify shrunk heap */
    }
}

int main(void) {
    int data[] = {12, 11, 13, 5, 6, 7};
    int n = 6;
    printf("Before: "); for (int i = 0; i < n; i++) printf("%d ", data[i]);
    heapSort(data, n);
    printf("\nAfter:  "); for (int i = 0; i < n; i++) printf("%d ", data[i]);
    printf("\n");
    return 0;
}`,

    cpp: `// Time: O(n log n)  Space: O(1)  Stable: NO
#include <iostream>
#include <vector>
#include <algorithm>

// Restore max-heap property rooted at index 'root' within size n
void heapify(std::vector<int>& arr, int n, int root) {
    int largest = root;        // Start with root as largest
    int left  = 2 * root + 1; // Index of left child
    int right = 2 * root + 2; // Index of right child

    // Promote left child if it beats current largest
    if (left < n && arr[left] > arr[largest]) largest = left;
    // Promote right child if it beats current largest
    if (right < n && arr[right] > arr[largest]) largest = right;

    // Only swap and recurse when the root was out of place
    if (largest != root) {
        std::swap(arr[root], arr[largest]);
        heapify(arr, n, largest); // Recurse into displaced subtree
    }
}

void heapSort(std::vector<int>& arr) {
    int n = arr.size();
    // Phase 1: convert array into a valid max-heap
    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);
    // Phase 2: shrink heap by moving max to sorted tail
    for (int i = n - 1; i > 0; i--) {
        std::swap(arr[0], arr[i]); // Root (max) goes to position i
        heapify(arr, i, 0);        // Fix heap for remaining elements
    }
}

int main() {
    std::vector<int> data = {12, 11, 13, 5, 6, 7};
    std::cout << "Before: "; for (int x : data) std::cout << x << " ";
    heapSort(data);
    std::cout << "\nAfter:  "; for (int x : data) std::cout << x << " ";
    std::cout << "\n";
}`,

    rust: `// Time: O(n log n)  Space: O(1)  Stable: NO

// Restore max-heap property for subtree rooted at 'root'
fn heapify(arr: &mut Vec<i32>, n: usize, root: usize) {
    let mut largest = root;               // Assume root is max
    let left  = 2 * root + 1;            // Left child index
    let right = 2 * root + 2;            // Right child index

    // Check if left child exists and is larger
    if left < n && arr[left] > arr[largest] { largest = left; }
    // Check if right child exists and is larger
    if right < n && arr[right] > arr[largest] { largest = right; }

    // Swap root with largest child, then recurse
    if largest != root {
        arr.swap(root, largest);          // In-place swap
        heapify(arr, n, largest);         // Fix displaced subtree
    }
}

fn heap_sort(arr: &mut Vec<i32>) {
    let n = arr.len();
    // Build max-heap from last non-leaf node upward
    for i in (0..n / 2).rev() {
        heapify(arr, n, i);
    }
    // Extract max repeatedly: swap root to sorted end
    for i in (1..n).rev() {
        arr.swap(0, i);          // Move current max to position i
        heapify(arr, i, 0);      // Restore heap on reduced array
    }
}

fn main() {
    let mut data = vec![12, 11, 13, 5, 6, 7];
    println!("Before: {:?}", data);
    heap_sort(&mut data);
    println!("After:  {:?}", data);
}`,

    go: `// Time: O(n log n)  Space: O(1)  Stable: NO
package main

import "fmt"

// heapify enforces max-heap property for subtree at root index
func heapify(arr []int, n, root int) {
    largest := root       // Track index of largest value seen
    left  := 2*root + 1  // Left child index
    right := 2*root + 2  // Right child index

    // Compare left child with current largest
    if left < n && arr[left] > arr[largest] { largest = left }
    // Compare right child with current largest
    if right < n && arr[right] > arr[largest] { largest = right }

    // If root was not largest: swap, then fix the subtree
    if largest != root {
        arr[root], arr[largest] = arr[largest], arr[root]
        heapify(arr, n, largest) // Recurse into affected branch
    }
}

func heapSort(arr []int) {
    n := len(arr)
    // Build max-heap by heapifying each non-leaf bottom-up
    for i := n/2 - 1; i >= 0; i-- {
        heapify(arr, n, i)
    }
    // Move max element to end, shrink heap, repeat
    for i := n - 1; i > 0; i-- {
        arr[0], arr[i] = arr[i], arr[0] // Swap root with last
        heapify(arr, i, 0)              // Re-heapify reduced heap
    }
}

func main() {
    data := []int{12, 11, 13, 5, 6, 7}
    fmt.Println("Before:", data)
    heapSort(data)
    fmt.Println("After: ", data)
}`,

  },

  // ── SHELL ───────────────────────────────────────────────────────
  "shell": {
    typescript: `// Time: O(n log² n)  Space: O(1)  Stable: NO
function shellSort(arr: number[]): number[] {
  const n = arr.length;
  // Start with gap = n/2, halve each pass until gap = 1
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    // Perform gapped insertion sort for this gap size
    for (let i = gap; i < n; i++) {
      const temp = arr[i]; // Element to be placed correctly
      let j = i;
      // Shift elements that are greater than temp by gap positions
      while (j >= gap && arr[j - gap] > temp) {
        arr[j] = arr[j - gap]; // Move element gap positions ahead
        j -= gap;              // Move j back by gap
      }
      arr[j] = temp; // Place temp in its correct position
    }
  }
  return arr;
}

const data = [64, 34, 25, 12, 22, 11, 90];
console.log("Before:", [...data]);
console.log("After: ", shellSort(data));`,

    javascript: `// Time: O(n log² n)  Space: O(1)  Stable: NO
function shellSort(arr) {
  const n = arr.length;
  // Use Knuth's simple halving sequence: n/2, n/4, ..., 1
  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    // For each starting position beyond the gap
    for (let i = gap; i < n; i++) {
      const temp = arr[i]; // Save the element to insert
      let j = i;
      // Shift gap-sorted elements that are greater than temp
      while (j >= gap && arr[j - gap] > temp) {
        arr[j] = arr[j - gap]; // Shift element forward by gap
        j -= gap;              // Step back by one gap
      }
      arr[j] = temp; // Drop temp into the correct spot
    }
  }
  return arr;
}

const data = [64, 34, 25, 12, 22, 11, 90];
console.log("Before:", [...data]);
console.log("After: ", shellSort(data));`,

    python: `# Time: O(n log² n)  Space: O(1)  Stable: NO
def shell_sort(arr):
    n = len(arr)
    gap = n // 2  # Initial gap is half the array length

    # Keep reducing gap until it reaches 0
    while gap > 0:
        # Gapped insertion sort for current gap size
        for i in range(gap, n):
            temp = arr[i]  # Element being positioned
            j = i
            # Shift elements larger than temp by 'gap' slots right
            while j >= gap and arr[j - gap] > temp:
                arr[j] = arr[j - gap]  # Move element forward
                j -= gap               # Walk back by gap
            arr[j] = temp  # Insert temp at correct position
        gap //= 2  # Halve the gap for next iteration

    return arr

data = [64, 34, 25, 12, 22, 11, 90]
print("Before:", data[:])
print("After: ", shell_sort(data))`,

    java: `// Time: O(n log² n)  Space: O(1)  Stable: NO
import java.util.Arrays;

public class ShellSort {
    static void shellSort(int[] arr) {
        int n = arr.length;
        // Start gap at half array size, halve each outer iteration
        for (int gap = n / 2; gap > 0; gap /= 2) {
            // Gapped insertion sort for elements at distance 'gap'
            for (int i = gap; i < n; i++) {
                int temp = arr[i]; // Element to insert into sorted gap-sequence
                int j = i;
                // Shift elements greater than temp leftward by gap
                while (j >= gap && arr[j - gap] > temp) {
                    arr[j] = arr[j - gap]; // Slide element right by gap
                    j -= gap;              // Move cursor back
                }
                arr[j] = temp; // Place the element in correct position
            }
        }
    }

    public static void main(String[] args) {
        int[] data = {64, 34, 25, 12, 22, 11, 90};
        System.out.println("Before: " + Arrays.toString(data));
        shellSort(data);
        System.out.println("After:  " + Arrays.toString(data));
    }
}`,

    c: `/* Time: O(n log^2 n)  Space: O(1)  Stable: NO */
#include <stdio.h>

void shellSort(int arr[], int n) {
    /* Begin with gap = n/2 and halve each outer pass */
    for (int gap = n / 2; gap > 0; gap /= 2) {
        /* Run insertion sort with elements spaced 'gap' apart */
        for (int i = gap; i < n; i++) {
            int temp = arr[i]; /* Element we want to position */
            int j = i;
            /* Shift gap-sorted elements to the right */
            while (j >= gap && arr[j - gap] > temp) {
                arr[j] = arr[j - gap]; /* Move element right by gap */
                j -= gap;              /* Step backward by gap */
            }
            arr[j] = temp; /* Place temp at the correct slot */
        }
    }
}

int main(void) {
    int data[] = {64, 34, 25, 12, 22, 11, 90};
    int n = 7;
    printf("Before: "); for (int i = 0; i < n; i++) printf("%d ", data[i]);
    shellSort(data, n);
    printf("\nAfter:  "); for (int i = 0; i < n; i++) printf("%d ", data[i]);
    printf("\n");
    return 0;
}`,

    cpp: `// Time: O(n log² n)  Space: O(1)  Stable: NO
#include <iostream>
#include <vector>

void shellSort(std::vector<int>& arr) {
    int n = arr.size();
    // Outer loop: halve gap each round until gap reaches 1 then 0
    for (int gap = n / 2; gap > 0; gap /= 2) {
        // Inner loop: insertion sort over gap-separated elements
        for (int i = gap; i < n; i++) {
            int temp = arr[i]; // Value being moved into sorted position
            int j = i;
            // Shift all elements greater than temp back by gap
            while (j >= gap && arr[j - gap] > temp) {
                arr[j] = arr[j - gap]; // Slide element rightward
                j -= gap;              // Retreat by gap
            }
            arr[j] = temp; // Insert temp at its correct location
        }
    }
}

int main() {
    std::vector<int> data = {64, 34, 25, 12, 22, 11, 90};
    std::cout << "Before: "; for (int x : data) std::cout << x << " ";
    shellSort(data);
    std::cout << "\nAfter:  "; for (int x : data) std::cout << x << " ";
    std::cout << "\n";
}`,

    rust: `// Time: O(n log² n)  Space: O(1)  Stable: NO

fn shell_sort(arr: &mut Vec<i32>) {
    let n = arr.len();
    let mut gap = n / 2; // Start at half the array length

    // Outer loop: keep narrowing gap until it hits zero
    while gap > 0 {
        // Gapped insertion sort for the current gap value
        for i in gap..n {
            let temp = arr[i]; // Hold the value to be placed
            let mut j = i;
            // Walk backwards in gap-steps while shifting larger values
            while j >= gap && arr[j - gap] > temp {
                arr[j] = arr[j - gap]; // Slide element right by gap
                j -= gap;              // Retreat by one gap
            }
            arr[j] = temp; // Drop temp into its correct slot
        }
        gap /= 2; // Halve gap for the next pass
    }
}

fn main() {
    let mut data = vec![64, 34, 25, 12, 22, 11, 90];
    println!("Before: {:?}", data);
    shell_sort(&mut data);
    println!("After:  {:?}", data);
}`,

    go: `// Time: O(n log² n)  Space: O(1)  Stable: NO
package main

import "fmt"

func shellSort(arr []int) {
    n := len(arr)
    // Start gap at n/2 and halve each outer iteration
    for gap := n / 2; gap > 0; gap /= 2 {
        // Apply gapped insertion sort for current gap
        for i := gap; i < n; i++ {
            temp := arr[i] // Element to insert into gap-sorted sequence
            j := i
            // Shift gap-sorted elements that exceed temp
            for j >= gap && arr[j-gap] > temp {
                arr[j] = arr[j-gap] // Move element forward by gap
                j -= gap            // Move cursor back by gap
            }
            arr[j] = temp // Place temp in the right position
        }
    }
}

func main() {
    data := []int{64, 34, 25, 12, 22, 11, 90}
    fmt.Println("Before:", data)
    shellSort(data)
    fmt.Println("After: ", data)
}`,

  },

  // ── COUNTING ────────────────────────────────────────────────────
  "counting": {
    typescript: `// Time: O(n+k)  Space: O(k)  Stable: YES
function countingSort(arr: number[]): number[] {
  if (arr.length === 0) return arr;
  // Find the range of values to size the count array
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min + 1;

  // Count occurrences of each value (offset by min)
  const count = new Array(range).fill(0);
  for (const val of arr) count[val - min]++;

  // Prefix-sum: count[i] now holds number of elements <= i+min
  for (let i = 1; i < range; i++) count[i] += count[i - 1];

  // Build output array by walking input right-to-left (stability)
  const output = new Array(arr.length);
  for (let i = arr.length - 1; i >= 0; i--) {
    const pos = count[arr[i] - min] - 1; // Final sorted index
    output[pos] = arr[i];
    count[arr[i] - min]--;               // Decrement for duplicates
  }
  return output;
}

const data = [4, 2, 2, 8, 3, 3, 1];
console.log("Before:", data);
console.log("After: ", countingSort(data));`,

    javascript: `// Time: O(n+k)  Space: O(k)  Stable: YES
function countingSort(arr) {
  if (arr.length === 0) return arr;
  // Determine range to allocate minimally sized count array
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min + 1;

  // Tally how often each value appears
  const count = new Array(range).fill(0);
  for (const val of arr) count[val - min]++;

  // Convert tallies to prefix sums (cumulative counts)
  for (let i = 1; i < range; i++) count[i] += count[i - 1];

  // Place elements into output using prefix-sum index (right-to-left for stability)
  const output = new Array(arr.length);
  for (let i = arr.length - 1; i >= 0; i--) {
    const idx = count[arr[i] - min] - 1; // Correct sorted position
    output[idx] = arr[i];
    count[arr[i] - min]--;               // Adjust for next duplicate
  }
  return output;
}

const data = [4, 2, 2, 8, 3, 3, 1];
console.log("Before:", data);
console.log("After: ", countingSort(data));`,

    python: `# Time: O(n+k)  Space: O(k)  Stable: YES
def counting_sort(arr):
    if not arr:
        return arr

    # Determine min and max to keep count array compact
    lo, hi = min(arr), max(arr)
    k = hi - lo + 1  # Range of values (k)

    # Count occurrences; offset index by lo to handle negatives
    count = [0] * k
    for val in arr:
        count[val - lo] += 1

    # Prefix-sum transform: count[i] = # elements <= i+lo
    for i in range(1, k):
        count[i] += count[i - 1]

    # Reconstruct sorted output right-to-left to preserve stability
    output = [0] * len(arr)
    for val in reversed(arr):          # Traverse input backwards
        idx = count[val - lo] - 1      # Compute correct position
        output[idx] = val
        count[val - lo] -= 1           # Decrement for next equal value

    return output

data = [4, 2, 2, 8, 3, 3, 1]
print("Before:", data)
print("After: ", counting_sort(data))`,

    java: `// Time: O(n+k)  Space: O(k)  Stable: YES
import java.util.Arrays;

public class CountingSort {
    static int[] countingSort(int[] arr) {
        if (arr.length == 0) return arr;

        // Find min and max to determine count array size
        int min = arr[0], max = arr[0];
        for (int v : arr) { if (v < min) min = v; if (v > max) max = v; }
        int range = max - min + 1; // Number of distinct possible values

        // Accumulate counts for each value (offset by min)
        int[] count = new int[range];
        for (int v : arr) count[v - min]++;

        // Prefix-sum: count[i] = number of elements <= i+min
        for (int i = 1; i < range; i++) count[i] += count[i - 1];

        // Fill output right-to-left to maintain stability
        int[] output = new int[arr.length];
        for (int i = arr.length - 1; i >= 0; i--) {
            int pos = count[arr[i] - min] - 1; // Correct final index
            output[pos] = arr[i];
            count[arr[i] - min]--;              // Adjust for duplicates
        }
        return output;
    }

    public static void main(String[] args) {
        int[] data = {4, 2, 2, 8, 3, 3, 1};
        System.out.println("Before: " + Arrays.toString(data));
        System.out.println("After:  " + Arrays.toString(countingSort(data)));
    }
}`,

    c: `/* Time: O(n+k)  Space: O(k)  Stable: YES */
#include <stdio.h>
#include <stdlib.h>

void countingSort(int arr[], int n, int* out) {
    if (n == 0) return;

    /* Find the value range for this input */
    int min = arr[0], max = arr[0];
    for (int i = 1; i < n; i++) {
        if (arr[i] < min) min = arr[i];
        if (arr[i] > max) max = arr[i];
    }
    int range = max - min + 1; /* k = number of buckets */

    /* Allocate and zero-fill the count array */
    int* count = calloc(range, sizeof(int));
    for (int i = 0; i < n; i++) count[arr[i] - min]++;

    /* Transform counts into prefix sums */
    for (int i = 1; i < range; i++) count[i] += count[i - 1];

    /* Build sorted output traversing right-to-left for stability */
    for (int i = n - 1; i >= 0; i--) {
        out[count[arr[i] - min] - 1] = arr[i]; /* Place at correct index */
        count[arr[i] - min]--;                  /* Handle duplicates */
    }
    free(count);
}

int main(void) {
    int data[] = {4, 2, 2, 8, 3, 3, 1};
    int n = 7;
    int out[7];
    printf("Before: "); for (int i = 0; i < n; i++) printf("%d ", data[i]);
    countingSort(data, n, out);
    printf("\nAfter:  "); for (int i = 0; i < n; i++) printf("%d ", out[i]);
    printf("\n");
    return 0;
}`,

    cpp: `// Time: O(n+k)  Space: O(k)  Stable: YES
#include <iostream>
#include <vector>
#include <algorithm>

std::vector<int> countingSort(const std::vector<int>& arr) {
    if (arr.empty()) return {};

    // Determine the value range (k) with min/max scan
    int lo = *std::min_element(arr.begin(), arr.end());
    int hi = *std::max_element(arr.begin(), arr.end());
    int range = hi - lo + 1; // Size of count bucket array

    // Count frequency of each value, offset by lo
    std::vector<int> count(range, 0);
    for (int v : arr) count[v - lo]++;

    // Prefix-sum: count[i] = how many elements are <= i+lo
    for (int i = 1; i < range; i++) count[i] += count[i - 1];

    // Place each element at its correct output index (right-to-left for stability)
    std::vector<int> output(arr.size());
    for (int i = (int)arr.size() - 1; i >= 0; i--) {
        int pos = count[arr[i] - lo] - 1; // Sorted destination
        output[pos] = arr[i];
        count[arr[i] - lo]--;             // Decrement for next duplicate
    }
    return output;
}

int main() {
    std::vector<int> data = {4, 2, 2, 8, 3, 3, 1};
    std::cout << "Before: "; for (int x : data) std::cout << x << " ";
    auto sorted = countingSort(data);
    std::cout << "\nAfter:  "; for (int x : sorted) std::cout << x << " ";
    std::cout << "\n";
}`,

    rust: `// Time: O(n+k)  Space: O(k)  Stable: YES

fn counting_sort(arr: &[i32]) -> Vec<i32> {
    if arr.is_empty() { return vec![]; }

    // Compute min and max to bound the count array size
    let lo = *arr.iter().min().unwrap();
    let hi = *arr.iter().max().unwrap();
    let range = (hi - lo + 1) as usize; // k distinct buckets

    // Count how many times each value appears
    let mut count = vec![0usize; range];
    for &v in arr { count[(v - lo) as usize] += 1; }

    // Prefix-sum: count[i] becomes end position + 1 for value i+lo
    for i in 1..range { count[i] += count[i - 1]; }

    // Fill output right-to-left to preserve relative order (stable)
    let mut output = vec![0i32; arr.len()];
    for &v in arr.iter().rev() {
        let bucket = (v - lo) as usize;
        count[bucket] -= 1;           // Decrement before use
        output[count[bucket]] = v;    // Place at computed index
    }
    output
}

fn main() {
    let data = vec![4, 2, 2, 8, 3, 3, 1];
    println!("Before: {:?}", data);
    let sorted = counting_sort(&data);
    println!("After:  {:?}", sorted);
}`,

    go: `// Time: O(n+k)  Space: O(k)  Stable: YES
package main

import "fmt"

func countingSort(arr []int) []int {
    if len(arr) == 0 { return arr }

    // Find min and max to size the count slice efficiently
    lo, hi := arr[0], arr[0]
    for _, v := range arr {
        if v < lo { lo = v }
        if v > hi { hi = v }
    }
    k := hi - lo + 1 // Number of distinct value buckets

    // Count frequency of each value using offset index
    count := make([]int, k)
    for _, v := range arr { count[v-lo]++ }

    // Prefix-sum: count[i] = number of elements <= i+lo
    for i := 1; i < k; i++ { count[i] += count[i-1] }

    // Build sorted output traversing right-to-left for stability
    output := make([]int, len(arr))
    for i := len(arr) - 1; i >= 0; i-- {
        pos := count[arr[i]-lo] - 1  // Destination index in output
        output[pos] = arr[i]
        count[arr[i]-lo]--            // Adjust for next duplicate
    }
    return output
}

func main() {
    data := []int{4, 2, 2, 8, 3, 3, 1}
    fmt.Println("Before:", data)
    fmt.Println("After: ", countingSort(data))
}`,

  },

  // ── RADIX ───────────────────────────────────────────────────────
  "radix": {
    typescript: `function countingSort(arr: number[], exp: number): number[] {
  const n = arr.length;
  const output = new Array(n).fill(0); // output array
  const count = new Array(10).fill(0); // digit frequency bucket (base 10)

  // count occurrences of each digit at current place value
  for (let i = 0; i < n; i++) {
    const digit = Math.floor(arr[i] / exp) % 10; // extract target digit
    count[digit]++;
  }

  // transform count into cumulative (prefix sum) positions
  for (let i = 1; i < 10; i++) {
    count[i] += count[i - 1]; // each entry now holds the end index
  }

  // build output right-to-left to preserve stability
  for (let i = n - 1; i >= 0; i--) {
    const digit = Math.floor(arr[i] / exp) % 10;
    output[count[digit] - 1] = arr[i]; // place element at correct position
    count[digit]--;                     // decrement so next equal digit goes left
  }

  return output;
}

function radixSort(arr: number[]): number[] {
  if (arr.length === 0) return arr;

  const max = Math.max(...arr); // find max to know number of digits

  // process each digit place: 1, 10, 100, ...
  let exp = 1;
  let result = [...arr]; // work on a copy
  while (Math.floor(max / exp) > 0) {
    result = countingSort(result, exp); // stable sort by current digit
    exp *= 10; // move to next significant digit
  }
  return result;
}

// Demo
const data = [170, 45, 75, 90, 802, 24, 2, 66];
console.log("Input: ", data);
console.log("Sorted:", radixSort(data)); // [2, 24, 45, 66, 75, 90, 170, 802]`,

    javascript: `function countingSort(arr, exp) {
  const n = arr.length;
  const output = new Array(n).fill(0); // placeholder for sorted output
  const count = new Array(10).fill(0); // bucket per digit 0-9

  // tally frequency of each digit at this place value
  for (let i = 0; i < n; i++) {
    const digit = Math.floor(arr[i] / exp) % 10; // isolate current digit
    count[digit]++;
  }

  // accumulate prefix sums so count[d] = last index for digit d
  for (let i = 1; i < 10; i++) {
    count[i] += count[i - 1];
  }

  // fill output in reverse to maintain relative order (stability)
  for (let i = n - 1; i >= 0; i--) {
    const digit = Math.floor(arr[i] / exp) % 10;
    output[--count[digit]] = arr[i]; // place and decrement pointer
  }

  return output;
}

function radixSort(arr) {
  if (!arr.length) return arr;

  const max = Math.max(...arr); // largest value dictates digit count

  let exp = 1;
  let result = arr.slice(); // avoid mutating original
  // iterate while there are significant digits remaining
  while (Math.floor(max / exp) > 0) {
    result = countingSort(result, exp); // sort pass for current digit
    exp *= 10;
  }
  return result;
}

// Demo
const data = [170, 45, 75, 90, 802, 24, 2, 66];
console.log("Input: ", data);
console.log("Sorted:", radixSort(data));`,

    python: `def counting_sort(arr: list[int], exp: int) -> list[int]:
    n = len(arr)
    output = [0] * n      # result array
    count = [0] * 10      # one bucket per digit 0-9

    # count frequency of each digit at the given place value
    for val in arr:
        digit = (val // exp) % 10  # extract digit at position exp
        count[digit] += 1

    # cumulative sum so count[d] is the ending index for digit d
    for i in range(1, 10):
        count[i] += count[i - 1]

    # traverse right-to-left for stability (preserve original order of ties)
    for i in range(n - 1, -1, -1):
        digit = (arr[i] // exp) % 10
        count[digit] -= 1
        output[count[digit]] = arr[i]  # place at computed position

    return output

def radix_sort(arr: list[int]) -> list[int]:
    if not arr:
        return arr

    max_val = max(arr)  # largest element determines iteration count

    result = arr[:]     # work on a copy to avoid side effects
    exp = 1
    # keep processing while significant digits remain
    while max_val // exp > 0:
        result = counting_sort(result, exp)  # one stable pass per digit
        exp *= 10  # shift to next digit position

    return result

# Demo
data = [170, 45, 75, 90, 802, 24, 2, 66]
print("Input: ", data)
print("Sorted:", radix_sort(data))`,

    java: `import java.util.Arrays;

public class RadixSort {

    // stable sort pass for a single digit position (exp = 1, 10, 100, ...)
    static int[] countingSort(int[] arr, int exp) {
        int n = arr.length;
        int[] output = new int[n]; // sorted output for this pass
        int[] count = new int[10]; // frequency table for digits 0-9

        // count each digit at the current place value
        for (int val : arr) {
            int digit = (val / exp) % 10; // isolate digit
            count[digit]++;
        }

        // convert frequencies to end-positions via prefix sum
        for (int i = 1; i < 10; i++) {
            count[i] += count[i - 1];
        }

        // build output right-to-left to keep sort stable
        for (int i = n - 1; i >= 0; i--) {
            int digit = (arr[i] / exp) % 10;
            output[--count[digit]] = arr[i]; // place and move pointer left
        }

        return output;
    }

    static int[] radixSort(int[] arr) {
        if (arr.length == 0) return arr;

        int max = Arrays.stream(arr).max().getAsInt(); // find maximum value

        int[] result = arr.clone(); // copy to avoid mutating input
        // process each digit until no higher digits remain
        for (int exp = 1; max / exp > 0; exp *= 10) {
            result = countingSort(result, exp); // stable sub-sort
        }
        return result;
    }

    public static void main(String[] args) {
        int[] data = {170, 45, 75, 90, 802, 24, 2, 66};
        System.out.println("Input:  " + Arrays.toString(data));
        System.out.println("Sorted: " + Arrays.toString(radixSort(data)));
    }
}`,

    c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// stable counting sort keyed on the digit at position exp
void counting_sort(int *arr, int *output, int n, int exp) {
    int count[10] = {0}; // digit frequency table

    // tally how many values have each digit at this place
    for (int i = 0; i < n; i++) {
        int digit = (arr[i] / exp) % 10;
        count[digit]++;
    }

    // prefix sum: count[d] becomes end-index for digit d
    for (int i = 1; i < 10; i++) {
        count[i] += count[i - 1];
    }

    // fill output backwards to preserve stability
    for (int i = n - 1; i >= 0; i--) {
        int digit = (arr[i] / exp) % 10;
        output[--count[digit]] = arr[i]; // place element, shift pointer
    }

    memcpy(arr, output, n * sizeof(int)); // copy sorted pass back
}

void radix_sort(int *arr, int n) {
    if (n == 0) return;

    // find the maximum to know how many digit passes are needed
    int max = arr[0];
    for (int i = 1; i < n; i++) if (arr[i] > max) max = arr[i];

    int *output = malloc(n * sizeof(int)); // temporary buffer

    // one pass per digit place value
    for (int exp = 1; max / exp > 0; exp *= 10) {
        counting_sort(arr, output, n, exp);
    }

    free(output);
}

int main(void) {
    int data[] = {170, 45, 75, 90, 802, 24, 2, 66};
    int n = sizeof(data) / sizeof(data[0]);
    radix_sort(data, n);
    printf("Sorted: ");
    for (int i = 0; i < n; i++) printf("%d ", data[i]);
    printf("\n");
    return 0;
}`,

    cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

// one stable counting-sort pass for the given digit place
void countingSort(vector<int>& arr, int exp) {
    int n = arr.size();
    vector<int> output(n);  // sorted output buffer
    int count[10] = {};     // digit frequency array

    // count occurrences of each digit at this place value
    for (int val : arr) {
        count[(val / exp) % 10]++;
    }

    // prefix-sum so count[d] is the end position for digit d
    for (int i = 1; i < 10; i++) {
        count[i] += count[i - 1];
    }

    // right-to-left fill preserves original relative order (stable)
    for (int i = n - 1; i >= 0; i--) {
        int digit = (arr[i] / exp) % 10;
        output[--count[digit]] = arr[i]; // insert at correct slot
    }

    arr = move(output); // replace with sorted result
}

void radixSort(vector<int>& arr) {
    if (arr.empty()) return;

    int maxVal = *max_element(arr.begin(), arr.end()); // find max

    // iterate through digit positions until no significant digits left
    for (int exp = 1; maxVal / exp > 0; exp *= 10) {
        countingSort(arr, exp); // stable sort by current digit
    }
}

int main() {
    vector<int> data = {170, 45, 75, 90, 802, 24, 2, 66};
    radixSort(data);
    cout << "Sorted: ";
    for (int v : data) cout << v << " ";
    cout << "\n";
    return 0;
}`,

    rust: `fn counting_sort(arr: &[u32], exp: u32) -> Vec<u32> {
    let n = arr.len();
    let mut output = vec![0u32; n]; // result buffer
    let mut count = [0usize; 10];   // digit frequency table

    // tally the digit at this place value for every element
    for &val in arr {
        let digit = ((val / exp) % 10) as usize; // isolate digit
        count[digit] += 1;
    }

    // prefix sum converts frequencies into end-indices
    for i in 1..10 {
        count[i] += count[i - 1];
    }

    // iterate backwards to maintain stability
    for &val in arr.iter().rev() {
        let digit = ((val / exp) % 10) as usize;
        count[digit] -= 1;
        output[count[digit]] = val; // deposit at computed position
    }

    output
}

fn radix_sort(arr: &[u32]) -> Vec<u32> {
    if arr.is_empty() {
        return vec![];
    }

    let max = *arr.iter().max().unwrap(); // largest value sets digit count

    let mut result = arr.to_vec(); // start from a copy
    let mut exp = 1u32;
    // one pass per digit while the place value is still relevant
    while max / exp > 0 {
        result = counting_sort(&result, exp); // stable sub-pass
        exp = exp.saturating_mul(10);         // advance to next digit
    }
    result
}

fn main() {
    let data = vec![170u32, 45, 75, 90, 802, 24, 2, 66];
    println!("Input:  {:?}", data);
    println!("Sorted: {:?}", radix_sort(&data));
}`,

    go: `package main

import "fmt"

// countingSort performs one stable pass keyed on the given digit place
func countingSort(arr []int, exp int) []int {
	n := len(arr)
	output := make([]int, n) // sorted output for this pass
	count := [10]int{}       // frequency of each digit 0-9

	// count how many values share each digit at position exp
	for _, val := range arr {
		digit := (val / exp) % 10 // isolate target digit
		count[digit]++
	}

	// build prefix sums so count[d] is the end slot for digit d
	for i := 1; i < 10; i++ {
		count[i] += count[i-1]
	}

	// traverse right-to-left to preserve original order (stable)
	for i := n - 1; i >= 0; i-- {
		digit := (arr[i] / exp) % 10
		count[digit]--
		output[count[digit]] = arr[i] // store at computed position
	}

	return output
}

func radixSort(arr []int) []int {
	if len(arr) == 0 {
		return arr
	}

	// find maximum element to determine digit count
	max := arr[0]
	for _, v := range arr[1:] {
		if v > max {
			max = v
		}
	}

	result := append([]int{}, arr...) // copy to avoid modifying caller's slice
	// one counting-sort pass per digit position
	for exp := 1; max/exp > 0; exp *= 10 {
		result = countingSort(result, exp)
	}
	return result
}

func main() {
	data := []int{170, 45, 75, 90, 802, 24, 2, 66}
	fmt.Println("Input: ", data)
	fmt.Println("Sorted:", radixSort(data))
}`,

  },

  // ── BUCKET ──────────────────────────────────────────────────────
  "bucket": {
    typescript: `function insertionSort(arr: number[]): number[] {
  // insertion sort is stable and efficient for small arrays
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i]; // element to be positioned
    let j = i - 1;
    // shift elements greater than key one position to the right
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key; // insert key in its sorted position
  }
  return arr;
}

function bucketSort(arr: number[]): number[] {
  const n = arr.length;
  if (n <= 1) return arr;

  const min = Math.min(...arr); // find value range boundaries
  const max = Math.max(...arr);
  const range = max - min || 1; // avoid division by zero when all equal

  // create n equally-sized buckets covering [min, max]
  const buckets: number[][] = Array.from({ length: n }, () => []);

  // distribute each element into its corresponding bucket
  for (const val of arr) {
    const idx = Math.min(
      Math.floor(((val - min) / range) * n), // normalise to [0, n)
      n - 1                                   // clamp max element to last bucket
    );
    buckets[idx].push(val);
  }

  // sort each bucket individually then concatenate
  return buckets.flatMap(bucket => insertionSort(bucket));
}

// Demo
const data = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68];
console.log("Input: ", data);
console.log("Sorted:", bucketSort(data));`,

    javascript: `function insertionSort(arr) {
  // stable sort ideal for small bucket contents
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i]; // current element to insert
    let j = i - 1;
    // move larger elements one spot to the right
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key; // drop key into correct slot
  }
  return arr;
}

function bucketSort(arr) {
  const n = arr.length;
  if (n <= 1) return arr;

  const min = Math.min(...arr); // lower bound of value range
  const max = Math.max(...arr); // upper bound
  const range = max - min || 1; // width of the whole range

  // allocate n empty buckets
  const buckets = Array.from({ length: n }, () => []);

  // map each value to a bucket index proportional to its value
  for (const val of arr) {
    const idx = Math.min(
      Math.floor(((val - min) / range) * n), // scale to bucket space
      n - 1                                   // clamp to avoid out-of-bounds
    );
    buckets[idx].push(val);
  }

  // sort every bucket and flatten into final array
  return buckets.flatMap(b => insertionSort(b));
}

// Demo
const data = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68];
console.log("Input: ", data);
console.log("Sorted:", bucketSort(data));`,

    python: `def insertion_sort(arr: list[float]) -> list[float]:
    # stable, in-place sort — ideal for small lists inside each bucket
    for i in range(1, len(arr)):
        key = arr[i]        # element being inserted
        j = i - 1
        # shift right all elements that are larger than key
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key    # place key in its sorted position
    return arr

def bucket_sort(arr: list[float]) -> list[float]:
    n = len(arr)
    if n <= 1:
        return arr

    lo, hi = min(arr), max(arr)   # determine value range
    span = hi - lo or 1           # guard against zero range

    buckets: list[list[float]] = [[] for _ in range(n)]  # n empty buckets

    # place each element into the appropriate bucket
    for val in arr:
        idx = int((val - lo) / span * n)  # normalise value to bucket index
        idx = min(idx, n - 1)             # clamp so max goes into last bucket
        buckets[idx].append(val)

    # sort each bucket then concatenate all buckets
    result: list[float] = []
    for bucket in buckets:
        result.extend(insertion_sort(bucket))  # extend preserves order

    return result

# Demo
data = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68]
print("Input: ", data)
print("Sorted:", bucket_sort(data))`,

    java: `import java.util.*;

public class BucketSort {

    // insertion sort — stable, good for short lists in each bucket
    static void insertionSort(List<Double> list) {
        for (int i = 1; i < list.size(); i++) {
            double key = list.get(i); // element to be inserted
            int j = i - 1;
            // shift elements larger than key to the right
            while (j >= 0 && list.get(j) > key) {
                list.set(j + 1, list.get(j));
                j--;
            }
            list.set(j + 1, key); // place key in sorted position
        }
    }

    static double[] bucketSort(double[] arr) {
        int n = arr.length;
        if (n <= 1) return arr;

        // compute min and max to determine the value range
        double min = Arrays.stream(arr).min().getAsDouble();
        double max = Arrays.stream(arr).max().getAsDouble();
        double span = (max - min == 0) ? 1 : max - min; // guard zero span

        // allocate n buckets as ArrayLists
        List<List<Double>> buckets = new ArrayList<>();
        for (int i = 0; i < n; i++) buckets.add(new ArrayList<>());

        // distribute elements across buckets proportionally
        for (double val : arr) {
            int idx = (int) ((val - min) / span * n); // bucket index
            idx = Math.min(idx, n - 1);               // clamp to last bucket
            buckets.get(idx).add(val);
        }

        // sort each bucket and collect into result array
        double[] result = new double[n];
        int pos = 0;
        for (List<Double> bucket : buckets) {
            insertionSort(bucket); // stable sort per bucket
            for (double v : bucket) result[pos++] = v;
        }
        return result;
    }

    public static void main(String[] args) {
        double[] data = {0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68};
        System.out.println("Input:  " + Arrays.toString(data));
        System.out.println("Sorted: " + Arrays.toString(bucketSort(data)));
    }
}`,

    c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// simple linked-list node for bucket contents
typedef struct Node { double val; struct Node *next; } Node;

// insertion sort on a linked list — stable and allocation-free
Node* insertionSortList(Node *head) {
    Node *sorted = NULL; // sorted sub-list built incrementally
    Node *cur = head;
    while (cur) {
        Node *next = cur->next; // save next pointer before relinking
        // find the right insertion point in sorted list
        Node **loc = &sorted;
        while (*loc && (*loc)->val <= cur->val) loc = &(*loc)->next;
        cur->next = *loc; // splice cur in before *loc
        *loc = cur;
        cur = next;
    }
    return sorted;
}

void bucket_sort(double *arr, int n) {
    if (n <= 1) return;

    double min = arr[0], max = arr[0];
    for (int i = 1; i < n; i++) { // find value range
        if (arr[i] < min) min = arr[i];
        if (arr[i] > max) max = arr[i];
    }
    double span = (max - min == 0) ? 1.0 : max - min;

    Node **buckets = calloc(n, sizeof(Node *)); // n empty bucket heads

    // push each element as a node onto its bucket
    for (int i = 0; i < n; i++) {
        int idx = (int)((arr[i] - min) / span * n);
        if (idx >= n) idx = n - 1; // clamp maximum value
        Node *node = malloc(sizeof(Node));
        node->val = arr[i];
        node->next = buckets[idx]; // prepend to bucket list
        buckets[idx] = node;
    }

    // sort each bucket then read back into arr
    int pos = 0;
    for (int i = 0; i < n; i++) {
        Node *sorted = insertionSortList(buckets[i]);
        while (sorted) {
            arr[pos++] = sorted->val;  // write sorted values back
            Node *tmp = sorted;
            sorted = sorted->next;
            free(tmp); // free each node after use
        }
    }
    free(buckets);
}

int main(void) {
    double data[] = {0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68};
    int n = sizeof(data) / sizeof(data[0]);
    bucket_sort(data, n);
    printf("Sorted: ");
    for (int i = 0; i < n; i++) printf("%.2f ", data[i]);
    printf("\n");
    return 0;
}`,

    cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

// insertion sort — stable, efficient for small sequences
void insertionSort(vector<double>& arr) {
    for (size_t i = 1; i < arr.size(); i++) {
        double key = arr[i]; // element to be placed
        int j = (int)i - 1;
        // shift right all elements larger than key
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key; // insert at correct position
    }
}

vector<double> bucketSort(vector<double> arr) {
    int n = arr.size();
    if (n <= 1) return arr;

    // determine value range to normalise bucket indices
    double mn = *min_element(arr.begin(), arr.end());
    double mx = *max_element(arr.begin(), arr.end());
    double span = (mx - mn == 0) ? 1.0 : mx - mn;

    vector<vector<double>> buckets(n); // n empty buckets

    // place each element in the proportionally correct bucket
    for (double val : arr) {
        int idx = (int)((val - mn) / span * n);
        if (idx >= n) idx = n - 1; // clamp max element
        buckets[idx].push_back(val);
    }

    // sort each bucket then concatenate into result
    vector<double> result;
    result.reserve(n);
    for (auto& b : buckets) {
        insertionSort(b);                      // stable sort per bucket
        result.insert(result.end(), b.begin(), b.end()); // append bucket
    }
    return result;
}

int main() {
    vector<double> data = {0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68};
    auto sorted = bucketSort(data);
    cout << "Sorted: ";
    for (double v : sorted) cout << v << " ";
    cout << "\n";
    return 0;
}`,

    rust: `fn insertion_sort(arr: &mut Vec<f64>) {
    // stable in-place sort — works well for small bucket contents
    for i in 1..arr.len() {
        let key = arr[i]; // element being positioned
        let mut j = i;
        // shift elements rightward while they are greater than key
        while j > 0 && arr[j - 1] > key {
            arr[j] = arr[j - 1];
            j -= 1;
        }
        arr[j] = key; // drop key into correct location
    }
}

fn bucket_sort(arr: &[f64]) -> Vec<f64> {
    let n = arr.len();
    if n <= 1 {
        return arr.to_vec();
    }

    // find the range of input values
    let min = arr.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = arr.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let span = if max == min { 1.0 } else { max - min }; // avoid div-by-zero

    let mut buckets: Vec<Vec<f64>> = vec![vec![]; n]; // n empty buckets

    // distribute values into buckets by proportional index
    for &val in arr {
        let mut idx = ((val - min) / span * n as f64) as usize; // map to index
        if idx >= n { idx = n - 1; } // clamp so maximum lands in last bucket
        buckets[idx].push(val);
    }

    // sort each bucket and collect into one flat vector
    buckets.iter_mut().flat_map(|b| {
        insertion_sort(b); // stable sort within bucket
        b.iter().cloned()  // yield sorted values
    }).collect()
}

fn main() {
    let data = vec![0.78f64, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68];
    println!("Input:  {:?}", data);
    println!("Sorted: {:?}", bucket_sort(&data));
}`,

    go: `package main

import "fmt"

// insertionSort is stable and fast for small slices inside buckets
func insertionSort(arr []float64) {
    for i := 1; i < len(arr); i++ {
        key := arr[i] // element to insert into sorted prefix
        j := i - 1
        // move larger elements one position to the right
        for j >= 0 && arr[j] > key {
            arr[j+1] = arr[j]
            j--
        }
        arr[j+1] = key // insert key at its correct position
    }
}

func bucketSort(arr []float64) []float64 {
    n := len(arr)
    if n <= 1 {
        return arr
    }

    // determine the value range to compute proportional bucket indices
    min, max := arr[0], arr[0]
    for _, v := range arr[1:] {
        if v < min { min = v }
        if v > max { max = v }
    }
    span := max - min
    if span == 0 { span = 1 } // guard: all elements equal

    buckets := make([][]float64, n) // n empty bucket slices

    // assign each value to its proportional bucket
    for _, val := range arr {
        idx := int((val - min) / span * float64(n))
        if idx >= n { idx = n - 1 } // clamp maximum to last bucket
        buckets[idx] = append(buckets[idx], val)
    }

    // sort each bucket then merge all into result
    result := make([]float64, 0, n)
    for _, b := range buckets {
        insertionSort(b)         // stable sort per bucket
        result = append(result, b...) // concatenate bucket
    }
    return result
}

func main() {
    data := []float64{0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68}
    fmt.Println("Input: ", data)
    fmt.Println("Sorted:", bucketSort(data))
}`,

  },

  // ── DEQUE ───────────────────────────────────────────────────────
  "deque": {
    typescript: `class Deque<T> {
  // All operations: O(1) amortized  Space: O(n)
  private data: (T | undefined)[] = []; // internal circular buffer
  private head = 0;  // index of the front element
  private tail = 0;  // index one past the last element
  private count = 0; // current number of stored elements

  // double capacity and re-center items when buffer is full
  private grow(): void {
    const newCap = Math.max(4, this.data.length * 2); // at least 4 slots
    const newData = new Array<T | undefined>(newCap);
    for (let i = 0; i < this.count; i++) {
      newData[i] = this.data[(this.head + i) % this.data.length]; // linearise
    }
    this.data = newData;
    this.head = 0;
    this.tail = this.count; // reset pointers into new buffer
  }

  // insert at the front: decrement head circularly
  pushFront(val: T): void {
    if (this.count === this.data.length) this.grow(); // expand if full
    this.head = (this.head - 1 + this.data.length) % this.data.length;
    this.data[this.head] = val;
    this.count++;
  }

  // append to the back: use tail slot then advance
  pushBack(val: T): void {
    if (this.count === this.data.length) this.grow(); // expand if full
    this.data[this.tail] = val;
    this.tail = (this.tail + 1) % this.data.length; // advance circularly
    this.count++;
  }

  // remove and return front element
  popFront(): T | undefined {
    if (this.count === 0) return undefined; // empty guard
    const val = this.data[this.head];
    this.data[this.head] = undefined;       // allow GC of removed element
    this.head = (this.head + 1) % this.data.length;
    this.count--;
    return val;
  }

  // remove and return back element
  popBack(): T | undefined {
    if (this.count === 0) return undefined; // empty guard
    this.tail = (this.tail - 1 + this.data.length) % this.data.length;
    const val = this.data[this.tail];
    this.data[this.tail] = undefined;       // release reference
    this.count--;
    return val;
  }

  peekFront(): T | undefined { return this.data[this.head]; } // no removal
  peekBack(): T | undefined {
    return this.data[(this.tail - 1 + this.data.length) % this.data.length];
  }
  isEmpty(): boolean { return this.count === 0; }
  size(): number { return this.count; }
}

// Demo
const dq = new Deque<number>();
dq.pushBack(1);  dq.pushBack(2);  dq.pushFront(0);
console.log("Front:", dq.peekFront()); // 0
console.log("Back: ", dq.peekBack());  // 2
console.log("Pop front:", dq.popFront()); // 0
console.log("Pop back: ", dq.popBack());  // 2
console.log("Size:", dq.size());          // 1`,

    javascript: `class Deque {
  // All operations: O(1) amortized  Space: O(n)
  #data = [];    // internal circular buffer (array used as ring)
  #head = 0;     // front pointer
  #tail = 0;     // one-past-back pointer
  #count = 0;    // live element count

  // double the buffer and re-linearise when capacity is exhausted
  #grow() {
    const newCap = Math.max(4, this.#data.length * 2);
    const newData = new Array(newCap);
    for (let i = 0; i < this.#count; i++) {
      newData[i] = this.#data[(this.#head + i) % this.#data.length]; // unwrap ring
    }
    this.#data = newData;
    this.#head = 0;
    this.#tail = this.#count; // reset pointers after linearisation
  }

  // prepend: step head back one slot (with wrap)
  pushFront(val) {
    if (this.#count === this.#data.length) this.#grow();
    this.#head = (this.#head - 1 + this.#data.length) % this.#data.length;
    this.#data[this.#head] = val;
    this.#count++;
  }

  // append: write at tail then advance tail
  pushBack(val) {
    if (this.#count === this.#data.length) this.#grow();
    this.#data[this.#tail] = val;
    this.#tail = (this.#tail + 1) % this.#data.length;
    this.#count++;
  }

  // dequeue from front
  popFront() {
    if (!this.#count) return undefined; // handle empty case
    const val = this.#data[this.#head];
    this.#data[this.#head] = undefined; // release reference for GC
    this.#head = (this.#head + 1) % this.#data.length;
    this.#count--;
    return val;
  }

  // dequeue from back
  popBack() {
    if (!this.#count) return undefined;
    this.#tail = (this.#tail - 1 + this.#data.length) % this.#data.length;
    const val = this.#data[this.#tail];
    this.#data[this.#tail] = undefined; // release reference
    this.#count--;
    return val;
  }

  peekFront() { return this.#data[this.#head]; }
  peekBack()  { return this.#data[(this.#tail - 1 + this.#data.length) % this.#data.length]; }
  isEmpty()   { return this.#count === 0; }
  size()      { return this.#count; }
}

// Demo
const dq = new Deque();
dq.pushBack(1); dq.pushBack(2); dq.pushFront(0);
console.log("Front:", dq.peekFront()); // 0
console.log("Back: ", dq.peekBack());  // 2
console.log("Pop front:", dq.popFront()); // 0
console.log("Pop back: ", dq.popBack());  // 2
console.log("Size:", dq.size());          // 1`,

    python: `from collections import deque as _deque

class Deque:
    # All operations: O(1) amortized  Space: O(n)
    # Backed by collections.deque which is a C-level doubly-linked list of blocks.
    # All operations documented here run in O(1) amortized time.

    def __init__(self):
        self._dq = _deque() # underlying doubly-ended queue from stdlib

    def push_front(self, val):
        self._dq.appendleft(val)  # O(1): insert at left end

    def push_back(self, val):
        self._dq.append(val)      # O(1): insert at right end

    def pop_front(self):
        if not self._dq:
            return None           # guard against empty deque
        return self._dq.popleft() # O(1): remove from left

    def pop_back(self):
        if not self._dq:
            return None           # guard against empty deque
        return self._dq.pop()     # O(1): remove from right

    def peek_front(self):
        return self._dq[0] if self._dq else None  # O(1) index access

    def peek_back(self):
        return self._dq[-1] if self._dq else None # O(1) index access

    def is_empty(self) -> bool:
        return len(self._dq) == 0 # O(1) length query

    def size(self) -> int:
        return len(self._dq)      # O(1) length query

# Demo
dq = Deque()
dq.push_back(1)
dq.push_back(2)
dq.push_front(0)
print("Front:", dq.peek_front())  # 0
print("Back: ", dq.peek_back())   # 2
print("Pop front:", dq.pop_front()) # 0
print("Pop back: ", dq.pop_back())  # 2
print("Size:", dq.size())           # 1`,

    java: `import java.util.Arrays;

public class Deque<T> {
    // All operations: O(1) amortized  Space: O(n)
    private Object[] data;  // circular buffer backing the deque
    private int head;       // index of front element
    private int tail;       // index one past the last element
    private int count;      // number of elements currently stored

    public Deque() {
        data = new Object[4]; // initial capacity — will grow as needed
    }

    // grow: double capacity and linearise elements into new array
    private void grow() {
        int newCap = data.length * 2;
        Object[] newData = new Object[newCap];
        for (int i = 0; i < count; i++) {
            newData[i] = data[(head + i) % data.length]; // unwrap circular layout
        }
        data = newData;
        head = 0;
        tail = count; // pointers reset to linear layout
    }

    // insert at front by stepping head backwards (circular)
    public void pushFront(T val) {
        if (count == data.length) grow(); // expand before writing
        head = (head - 1 + data.length) % data.length;
        data[head] = val;
        count++;
    }

    // insert at back using tail slot then advance
    public void pushBack(T val) {
        if (count == data.length) grow();
        data[tail] = val;
        tail = (tail + 1) % data.length; // advance circularly
        count++;
    }

    // remove and return element from front
    @SuppressWarnings("unchecked")
    public T popFront() {
        if (count == 0) return null; // empty guard
        T val = (T) data[head];
        data[head] = null;           // clear reference for GC
        head = (head + 1) % data.length;
        count--;
        return val;
    }

    // remove and return element from back
    @SuppressWarnings("unchecked")
    public T popBack() {
        if (count == 0) return null;
        tail = (tail - 1 + data.length) % data.length;
        T val = (T) data[tail];
        data[tail] = null; // clear reference for GC
        count--;
        return val;
    }

    @SuppressWarnings("unchecked")
    public T peekFront() { return count == 0 ? null : (T) data[head]; }
    @SuppressWarnings("unchecked")
    public T peekBack()  { return count == 0 ? null : (T) data[(tail - 1 + data.length) % data.length]; }
    public boolean isEmpty() { return count == 0; }
    public int size()        { return count; }

    public static void main(String[] args) {
        Deque<Integer> dq = new Deque<>();
        dq.pushBack(1); dq.pushBack(2); dq.pushFront(0);
        System.out.println("Front: " + dq.peekFront()); // 0
        System.out.println("Back:  " + dq.peekBack());  // 2
        System.out.println("Pop front: " + dq.popFront()); // 0
        System.out.println("Pop back:  " + dq.popBack());  // 2
        System.out.println("Size: " + dq.size());          // 1
    }
}`,

    c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// All operations: O(1) amortized  Space: O(n)
typedef struct {
    int *data;    // heap-allocated circular buffer
    int  head;    // front index
    int  tail;    // one-past-back index
    int  count;   // live element count
    int  cap;     // allocated capacity
} Deque;

// initialise deque with a small starting capacity
void deque_init(Deque *d) {
    d->cap   = 4;
    d->data  = malloc(d->cap * sizeof(int));
    d->head  = d->tail = d->count = 0;
}

// double capacity and re-linearise into new buffer
static void deque_grow(Deque *d) {
    int newCap = d->cap * 2;
    int *newData = malloc(newCap * sizeof(int));
    for (int i = 0; i < d->count; i++) {
        newData[i] = d->data[(d->head + i) % d->cap]; // unwrap ring
    }
    free(d->data);
    d->data = newData;
    d->head = 0;
    d->tail = d->count; // reset to linear layout
    d->cap  = newCap;
}

// insert at front: step head backwards with wrap
void deque_push_front(Deque *d, int val) {
    if (d->count == d->cap) deque_grow(d); // grow before writing
    d->head = (d->head - 1 + d->cap) % d->cap;
    d->data[d->head] = val;
    d->count++;
}

// insert at back: write at tail then advance
void deque_push_back(Deque *d, int val) {
    if (d->count == d->cap) deque_grow(d);
    d->data[d->tail] = val;
    d->tail = (d->tail + 1) % d->cap;
    d->count++;
}

// remove from front and return value (-1 if empty)
int deque_pop_front(Deque *d) {
    if (d->count == 0) return -1; // sentinel for empty
    int val = d->data[d->head];
    d->head = (d->head + 1) % d->cap;
    d->count--;
    return val;
}

// remove from back and return value
int deque_pop_back(Deque *d) {
    if (d->count == 0) return -1;
    d->tail = (d->tail - 1 + d->cap) % d->cap;
    int val = d->data[d->tail];
    d->count--;
    return val;
}

int deque_peek_front(Deque *d) { return d->count ? d->data[d->head] : -1; }
int deque_peek_back(Deque *d)  { return d->count ? d->data[(d->tail - 1 + d->cap) % d->cap] : -1; }
int deque_is_empty(Deque *d)   { return d->count == 0; }
int deque_size(Deque *d)       { return d->count; }
void deque_free(Deque *d)      { free(d->data); }

int main(void) {
    Deque dq;
    deque_init(&dq);
    deque_push_back(&dq, 1);
    deque_push_back(&dq, 2);
    deque_push_front(&dq, 0);
    printf("Front: %d\n", deque_peek_front(&dq)); // 0
    printf("Back:  %d\n", deque_peek_back(&dq));  // 2
    printf("Pop front: %d\n", deque_pop_front(&dq)); // 0
    printf("Pop back:  %d\n", deque_pop_back(&dq));  // 2
    printf("Size: %d\n",   deque_size(&dq));         // 1
    deque_free(&dq);
    return 0;
}`,

    cpp: `#include <iostream>
#include <vector>
#include <stdexcept>
using namespace std;

// All operations: O(1) amortized  Space: O(n)
template<typename T>
class Deque {
    vector<T> data;  // circular buffer
    int head  = 0;   // front index
    int tail  = 0;   // one-past-back index
    int count = 0;   // live element count

    // double capacity and linearise the ring into fresh vector
    void grow() {
        int newCap = max(4, (int)data.size() * 2);
        vector<T> newData(newCap);
        for (int i = 0; i < count; i++) {
            newData[i] = data[(head + i) % (int)data.size()]; // unwrap
        }
        data  = move(newData);
        head  = 0;
        tail  = count; // reset to linear layout
    }

public:
    Deque() : data(4) {} // start with capacity 4

    // insert at front: decrement head circularly
    void pushFront(const T& val) {
        if (count == (int)data.size()) grow();
        head = (head - 1 + (int)data.size()) % (int)data.size();
        data[head] = val;
        count++;
    }

    // insert at back: write then advance tail
    void pushBack(const T& val) {
        if (count == (int)data.size()) grow();
        data[tail] = val;
        tail = (tail + 1) % (int)data.size();
        count++;
    }

    // remove and return front element
    T popFront() {
        if (count == 0) throw underflow_error("Deque is empty");
        T val = data[head];
        head = (head + 1) % (int)data.size(); // advance front pointer
        count--;
        return val;
    }

    // remove and return back element
    T popBack() {
        if (count == 0) throw underflow_error("Deque is empty");
        tail = (tail - 1 + (int)data.size()) % (int)data.size();
        T val = data[tail];
        count--;
        return val;
    }

    T peekFront() const { return data[head]; }
    T peekBack()  const { return data[(tail - 1 + (int)data.size()) % (int)data.size()]; }
    bool isEmpty() const { return count == 0; }
    int  size()    const { return count; }
};

int main() {
    Deque<int> dq;
    dq.pushBack(1); dq.pushBack(2); dq.pushFront(0);
    cout << "Front: " << dq.peekFront() << "\n"; // 0
    cout << "Back:  " << dq.peekBack()  << "\n"; // 2
    cout << "Pop front: " << dq.popFront() << "\n"; // 0
    cout << "Pop back:  " << dq.popBack()  << "\n"; // 2
    cout << "Size: "      << dq.size()     << "\n"; // 1
    return 0;
}`,

    rust: `use std::collections::VecDeque;

// All operations: O(1) amortized  Space: O(n)
// VecDeque in std is a growable ring-buffer deque.
struct Deque<T> {
    inner: VecDeque<T>, // std ring-buffer backing store
}

impl<T> Deque<T> {
    fn new() -> Self {
        Deque { inner: VecDeque::new() } // empty deque, capacity grows as needed
    }

    // O(1) amortized: push to front, grows buffer if necessary
    fn push_front(&mut self, val: T) {
        self.inner.push_front(val);
    }

    // O(1) amortized: push to back, grows buffer if necessary
    fn push_back(&mut self, val: T) {
        self.inner.push_back(val);
    }

    // O(1): remove and return front element
    fn pop_front(&mut self) -> Option<T> {
        self.inner.pop_front() // returns None if empty
    }

    // O(1): remove and return back element
    fn pop_back(&mut self) -> Option<T> {
        self.inner.pop_back()  // returns None if empty
    }

    // O(1): view front without removing
    fn peek_front(&self) -> Option<&T> {
        self.inner.front()
    }

    // O(1): view back without removing
    fn peek_back(&self) -> Option<&T> {
        self.inner.back()
    }

    fn is_empty(&self) -> bool { self.inner.is_empty() }
    fn size(&self)     -> usize { self.inner.len() }      // number of elements
}

fn main() {
    let mut dq: Deque<i32> = Deque::new();
    dq.push_back(1);
    dq.push_back(2);
    dq.push_front(0);
    println!("Front: {:?}", dq.peek_front()); // Some(0)
    println!("Back:  {:?}", dq.peek_back());  // Some(2)
    println!("Pop front: {:?}", dq.pop_front()); // Some(0)
    println!("Pop back:  {:?}", dq.pop_back());  // Some(2)
    println!("Size: {}", dq.size());             // 1
}`,

    go: `package main

import "fmt"

// All operations: O(1) amortized  Space: O(n)
// Deque is a generic circular-buffer double-ended queue.
type Deque[T any] struct {
    data  []T // circular buffer
    head  int // index of front element
    tail  int // index one past the back element
    count int // live element count
}

// NewDeque allocates a Deque with initial capacity 4
func NewDeque[T any]() *Deque[T] {
    return &Deque[T]{data: make([]T, 4)}
}

// grow doubles capacity and re-linearises the ring into a fresh slice
func (d *Deque[T]) grow() {
    newCap := len(d.data) * 2
    newData := make([]T, newCap)
    for i := 0; i < d.count; i++ {
        newData[i] = d.data[(d.head+i)%len(d.data)] // unwrap circular layout
    }
    d.data = newData
    d.head = 0
    d.tail = d.count // reset pointers to linear layout
}

// PushFront inserts val at the front in O(1) amortized
func (d *Deque[T]) PushFront(val T) {
    if d.count == len(d.data) { d.grow() } // expand if at capacity
    d.head = (d.head - 1 + len(d.data)) % len(d.data)
    d.data[d.head] = val
    d.count++
}

// PushBack appends val at the back in O(1) amortized
func (d *Deque[T]) PushBack(val T) {
    if d.count == len(d.data) { d.grow() }
    d.data[d.tail] = val
    d.tail = (d.tail + 1) % len(d.data) // advance tail circularly
    d.count++
}

// PopFront removes and returns the front element
func (d *Deque[T]) PopFront() (T, bool) {
    var zero T
    if d.count == 0 { return zero, false } // empty guard
    val := d.data[d.head]
    d.head = (d.head + 1) % len(d.data)
    d.count--
    return val, true
}

// PopBack removes and returns the back element
func (d *Deque[T]) PopBack() (T, bool) {
    var zero T
    if d.count == 0 { return zero, false }
    d.tail = (d.tail - 1 + len(d.data)) % len(d.data)
    val := d.data[d.tail]
    d.count--
    return val, true
}

func (d *Deque[T]) PeekFront() (T, bool) { // view front without removing
    var zero T
    if d.count == 0 { return zero, false }
    return d.data[d.head], true
}

func (d *Deque[T]) PeekBack() (T, bool) { // view back without removing
    var zero T
    if d.count == 0 { return zero, false }
    return d.data[(d.tail-1+len(d.data))%len(d.data)], true
}

func (d *Deque[T]) IsEmpty() bool { return d.count == 0 }
func (d *Deque[T]) Size() int     { return d.count }

func main() {
    dq := NewDeque[int]()
    dq.PushBack(1); dq.PushBack(2); dq.PushFront(0)
    front, _ := dq.PeekFront(); fmt.Println("Front:", front) // 0
    back, _  := dq.PeekBack();  fmt.Println("Back: ", back)  // 2
    pf, _    := dq.PopFront();  fmt.Println("Pop front:", pf) // 0
    pb, _    := dq.PopBack();   fmt.Println("Pop back: ", pb) // 2
    fmt.Println("Size:", dq.Size())                            // 1
}`,

  },

  // ── BINARY HEAP ─────────────────────────────────────────────────
  "binary-heap": {
    typescript: `// Insert: O(log n)  ExtractMin: O(log n)  Space: O(n)
class MinHeap {
  private heap: number[] = []; // internal array storage

  private parent(i: number) { return Math.floor((i - 1) / 2); } // parent index
  private left(i: number) { return 2 * i + 1; } // left child index
  private right(i: number) { return 2 * i + 2; } // right child index

  private swap(i: number, j: number) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]; // swap two elements
  }

  insert(val: number) {
    this.heap.push(val); // add to end
    this.percolateUp(this.heap.length - 1); // restore heap property upward
  }

  private percolateUp(i: number) {
    while (i > 0 && this.heap[this.parent(i)] > this.heap[i]) { // parent is larger
      this.swap(i, this.parent(i)); // swap with parent
      i = this.parent(i); // move up
    }
  }

  extractMin(): number | null {
    if (!this.heap.length) return null; // empty heap
    const min = this.heap[0]; // root is minimum
    this.heap[0] = this.heap.pop()!; // move last element to root
    this.siftDown(0); // restore heap property downward
    return min;
  }

  private siftDown(i: number) {
    let smallest = i;
    const l = this.left(i), r = this.right(i);
    if (l < this.heap.length && this.heap[l] < this.heap[smallest]) smallest = l; // check left child
    if (r < this.heap.length && this.heap[r] < this.heap[smallest]) smallest = r; // check right child
    if (smallest !== i) { // need to swap
      this.swap(i, smallest);
      this.siftDown(smallest); // recurse downward
    }
  }

  peek(): number | null { return this.heap[0] ?? null; } // view min without removing
}

// Demo
const h = new MinHeap();
[5, 3, 8, 1, 4].forEach(v => h.insert(v)); // insert values
console.log(h.peek());        // 1 (minimum)
console.log(h.extractMin());  // 1
console.log(h.extractMin());  // 3`,

    javascript: `// Insert: O(log n)  ExtractMin: O(log n)  Space: O(n)
class MinHeap {
  constructor() { this.heap = []; } // internal array storage

  parent(i) { return Math.floor((i - 1) / 2); } // parent index
  left(i)   { return 2 * i + 1; }               // left child index
  right(i)  { return 2 * i + 2; }               // right child index

  swap(i, j) { [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]; } // swap elements

  insert(val) {
    this.heap.push(val); // add to end
    this.percolateUp(this.heap.length - 1); // restore heap upward
  }

  percolateUp(i) {
    while (i > 0 && this.heap[this.parent(i)] > this.heap[i]) { // parent too large
      this.swap(i, this.parent(i)); // swap with parent
      i = this.parent(i); // move up
    }
  }

  extractMin() {
    if (!this.heap.length) return null; // empty heap
    const min = this.heap[0]; // root holds minimum
    this.heap[0] = this.heap.pop(); // last element replaces root
    this.siftDown(0); // restore heap downward
    return min;
  }

  siftDown(i) {
    let s = i;
    const l = this.left(i), r = this.right(i);
    if (l < this.heap.length && this.heap[l] < this.heap[s]) s = l; // left child smaller
    if (r < this.heap.length && this.heap[r] < this.heap[s]) s = r; // right child smaller
    if (s !== i) { this.swap(i, s); this.siftDown(s); } // recurse if swapped
  }

  peek() { return this.heap[0] ?? null; } // view min without removing
}

// Demo
const h = new MinHeap();
[5, 3, 8, 1, 4].forEach(v => h.insert(v)); // insert values
console.log(h.peek());        // 1
console.log(h.extractMin());  // 1
console.log(h.extractMin());  // 3`,

    python: `# Insert: O(log n)  ExtractMin: O(log n)  Space: O(n)
class MinHeap:
    def __init__(self):
        self.heap = []  # internal list storage

    def _parent(self, i): return (i - 1) // 2   # parent index
    def _left(self, i):   return 2 * i + 1       # left child index
    def _right(self, i):  return 2 * i + 2       # right child index

    def _swap(self, i, j):
        self.heap[i], self.heap[j] = self.heap[j], self.heap[i]  # swap two elements

    def insert(self, val):
        self.heap.append(val)           # add to end
        self._percolate_up(len(self.heap) - 1)  # restore heap upward

    def _percolate_up(self, i):
        while i > 0 and self.heap[self._parent(i)] > self.heap[i]:  # parent too large
            self._swap(i, self._parent(i))  # swap with parent
            i = self._parent(i)             # move up

    def extract_min(self):
        if not self.heap: return None       # empty heap
        min_val = self.heap[0]              # root is minimum
        self.heap[0] = self.heap.pop()      # last element replaces root
        self._sift_down(0)                  # restore heap downward
        return min_val

    def _sift_down(self, i):
        s, n = i, len(self.heap)
        l, r = self._left(i), self._right(i)
        if l < n and self.heap[l] < self.heap[s]: s = l  # check left child
        if r < n and self.heap[r] < self.heap[s]: s = r  # check right child
        if s != i:                                         # need to swap
            self._swap(i, s)
            self._sift_down(s)              # recurse downward

    def peek(self): return self.heap[0] if self.heap else None  # view min

# Demo
h = MinHeap()
for v in [5, 3, 8, 1, 4]: h.insert(v)  # insert values
print(h.peek())         # 1
print(h.extract_min())  # 1
print(h.extract_min())  # 3`,

    java: `// Insert: O(log n)  ExtractMin: O(log n)  Space: O(n)
import java.util.ArrayList;

public class MinHeap {
    private ArrayList<Integer> heap = new ArrayList<>(); // dynamic array storage

    private int parent(int i) { return (i - 1) / 2; } // parent index
    private int left(int i)   { return 2 * i + 1; }   // left child index
    private int right(int i)  { return 2 * i + 2; }   // right child index

    private void swap(int i, int j) {
        int tmp = heap.get(i); heap.set(i, heap.get(j)); heap.set(j, tmp); // swap
    }

    public void insert(int val) {
        heap.add(val);                   // add to end
        percolateUp(heap.size() - 1);    // restore heap upward
    }

    private void percolateUp(int i) {
        while (i > 0 && heap.get(parent(i)) > heap.get(i)) { // parent too large
            swap(i, parent(i));          // swap with parent
            i = parent(i);              // move up
        }
    }

    public int extractMin() {
        if (heap.isEmpty()) throw new RuntimeException("empty"); // guard
        int min = heap.get(0);           // root is minimum
        heap.set(0, heap.remove(heap.size() - 1)); // last replaces root
        siftDown(0);                     // restore heap downward
        return min;
    }

    private void siftDown(int i) {
        int s = i, l = left(i), r = right(i), n = heap.size();
        if (l < n && heap.get(l) < heap.get(s)) s = l; // left child smaller
        if (r < n && heap.get(r) < heap.get(s)) s = r; // right child smaller
        if (s != i) { swap(i, s); siftDown(s); }        // recurse if swapped
    }

    public static void main(String[] args) {
        MinHeap h = new MinHeap();
        for (int v : new int[]{5,3,8,1,4}) h.insert(v); // insert values
        System.out.println(h.extractMin()); // 1
        System.out.println(h.extractMin()); // 3
    }
}`,

    c: `/* Insert: O(log n)  ExtractMin: O(log n)  Space: O(n) */
#include <stdio.h>
#define MAX 100

int heap[MAX], sz = 0; /* array-based heap and size */

int parent(int i) { return (i - 1) / 2; } /* parent index */
int left_c(int i) { return 2 * i + 1; }   /* left child index */
int right_c(int i){ return 2 * i + 2; }   /* right child index */

void swap(int i, int j) { int t = heap[i]; heap[i] = heap[j]; heap[j] = t; } /* swap */

void insert(int val) {
    heap[sz++] = val;          /* add to end */
    int i = sz - 1;
    while (i > 0 && heap[parent(i)] > heap[i]) { /* parent too large */
        swap(i, parent(i));    /* swap with parent */
        i = parent(i);         /* move up */
    }
}

void sift_down(int i) {
    int s = i, l = left_c(i), r = right_c(i);
    if (l < sz && heap[l] < heap[s]) s = l; /* check left child */
    if (r < sz && heap[r] < heap[s]) s = r; /* check right child */
    if (s != i) { swap(i, s); sift_down(s); } /* recurse if swapped */
}

int extract_min() {
    int min = heap[0];         /* root is minimum */
    heap[0] = heap[--sz];     /* last element replaces root */
    sift_down(0);              /* restore heap downward */
    return min;
}

int main() {
    int vals[] = {5, 3, 8, 1, 4};
    for (int i = 0; i < 5; i++) insert(vals[i]); /* insert values */
    printf("%d\n", extract_min()); /* 1 */
    printf("%d\n", extract_min()); /* 3 */
    return 0;
}`,

    cpp: `// Insert: O(log n)  ExtractMin: O(log n)  Space: O(n)
#include <iostream>
#include <vector>
using namespace std;

class MinHeap {
    vector<int> h; // internal vector storage
    int par(int i) { return (i-1)/2; }  // parent index
    int lft(int i) { return 2*i+1; }   // left child index
    int rgt(int i) { return 2*i+2; }   // right child index
    void swp(int i, int j) { swap(h[i], h[j]); } // swap elements

    void percolate_up(int i) {
        while (i > 0 && h[par(i)] > h[i]) { // parent too large
            swp(i, par(i)); // swap with parent
            i = par(i);     // move up
        }
    }

    void sift_down(int i) {
        int s=i, l=lft(i), r=rgt(i), n=h.size();
        if (l<n && h[l]<h[s]) s=l; // check left child
        if (r<n && h[r]<h[s]) s=r; // check right child
        if (s!=i) { swp(i,s); sift_down(s); } // recurse if swapped
    }
public:
    void insert(int v) {
        h.push_back(v);          // add to end
        percolate_up(h.size()-1); // restore heap upward
    }
    int extractMin() {
        int m = h[0];            // root is minimum
        h[0] = h.back(); h.pop_back(); // last replaces root
        if (!h.empty()) sift_down(0);   // restore heap downward
        return m;
    }
    int peek() { return h[0]; } // view min without removing
};

int main() {
    MinHeap mh;
    for (int v : {5,3,8,1,4}) mh.insert(v); // insert values
    cout << mh.extractMin() << "\n"; // 1
    cout << mh.extractMin() << "\n"; // 3
}`,

    rust: `// Insert: O(log n)  ExtractMin: O(log n)  Space: O(n)
struct MinHeap { data: Vec<i32> } // vec-based storage

impl MinHeap {
    fn new() -> Self { MinHeap { data: vec![] } }
    fn parent(i: usize) -> usize { (i - 1) / 2 }   // parent index
    fn left(i: usize) -> usize { 2 * i + 1 }        // left child index
    fn right(i: usize) -> usize { 2 * i + 2 }       // right child index

    fn insert(&mut self, val: i32) {
        self.data.push(val);                          // add to end
        let mut i = self.data.len() - 1;
        while i > 0 && self.data[Self::parent(i)] > self.data[i] { // parent too large
            self.data.swap(i, Self::parent(i));       // swap with parent
            i = Self::parent(i);                      // move up
        }
    }

    fn extract_min(&mut self) -> Option<i32> {
        if self.data.is_empty() { return None; }      // empty heap
        let min = self.data[0];                       // root is minimum
        let last = self.data.pop().unwrap();          // remove last
        if !self.data.is_empty() {
            self.data[0] = last;                      // last replaces root
            self.sift_down(0);                        // restore heap downward
        }
        Some(min)
    }

    fn sift_down(&mut self, i: usize) {
        let (mut s, n) = (i, self.data.len());
        let (l, r) = (Self::left(i), Self::right(i));
        if l < n && self.data[l] < self.data[s] { s = l; } // check left child
        if r < n && self.data[r] < self.data[s] { s = r; } // check right child
        if s != i { self.data.swap(i, s); self.sift_down(s); } // recurse if swapped
    }
}

fn main() {
    let mut h = MinHeap::new();
    for v in [5,3,8,1,4] { h.insert(v); } // insert values
    println!("{:?}", h.extract_min()); // Some(1)
    println!("{:?}", h.extract_min()); // Some(3)
}`,

    go: `// Insert: O(log n)  ExtractMin: O(log n)  Space: O(n)
package main

import "fmt"

type MinHeap struct { data []int } // slice-based storage

func parent(i int) int { return (i - 1) / 2 }  // parent index
func left(i int) int   { return 2*i + 1 }       // left child index
func right(i int) int  { return 2*i + 2 }       // right child index

func (h *MinHeap) Insert(val int) {
    h.data = append(h.data, val)   // add to end
    i := len(h.data) - 1
    for i > 0 && h.data[parent(i)] > h.data[i] { // parent too large
        h.data[i], h.data[parent(i)] = h.data[parent(i)], h.data[i] // swap
        i = parent(i)              // move up
    }
}

func (h *MinHeap) siftDown(i int) {
    s, n := i, len(h.data)
    if l := left(i);  l < n && h.data[l] < h.data[s] { s = l } // check left child
    if r := right(i); r < n && h.data[r] < h.data[s] { s = r } // check right child
    if s != i {
        h.data[i], h.data[s] = h.data[s], h.data[i] // swap with smallest
        h.siftDown(s)              // recurse downward
    }
}

func (h *MinHeap) ExtractMin() (int, bool) {
    if len(h.data) == 0 { return 0, false }   // empty heap
    min := h.data[0]                           // root is minimum
    last := len(h.data) - 1
    h.data[0] = h.data[last]                  // last replaces root
    h.data = h.data[:last]                    // shrink slice
    if len(h.data) > 0 { h.siftDown(0) }      // restore heap downward
    return min, true
}

func main() {
    h := &MinHeap{}
    for _, v := range []int{5, 3, 8, 1, 4} { h.Insert(v) } // insert values
    fmt.Println(h.ExtractMin()) // 1 true
    fmt.Println(h.ExtractMin()) // 3 true
}`,

  },

  // ── HASH TABLE ──────────────────────────────────────────────────
  "hash-table": {
    typescript: `// Insert/Search/Delete: O(1) avg  Space: O(n)
type Node = { key: string; val: number; next: Node | null }; // linked list node

class HashTable {
  private buckets: (Node | null)[]; // array of chains
  private size: number;

  constructor(size = 53) {
    this.size = size;
    this.buckets = new Array(size).fill(null); // initialize empty buckets
  }

  private hash(key: string): number {
    let h = 0;
    for (const ch of key) h = (h + ch.charCodeAt(0)) % this.size; // sum char codes
    return h; // bucket index
  }

  insert(key: string, val: number) {
    const idx = this.hash(key);         // compute bucket
    let node = this.buckets[idx];
    while (node) {                       // search for existing key
      if (node.key === key) { node.val = val; return; } // update if found
      node = node.next;
    }
    this.buckets[idx] = { key, val, next: this.buckets[idx] }; // prepend new node
  }

  search(key: string): number | null {
    let node = this.buckets[this.hash(key)]; // go to bucket
    while (node) {
      if (node.key === key) return node.val; // found
      node = node.next;                      // traverse chain
    }
    return null; // not found
  }

  delete(key: string): boolean {
    const idx = this.hash(key);
    let prev: Node | null = null, cur = this.buckets[idx];
    while (cur) {
      if (cur.key === key) {             // found target node
        if (prev) prev.next = cur.next; // unlink from chain
        else this.buckets[idx] = cur.next; // update bucket head
        return true;
      }
      prev = cur; cur = cur.next;        // advance pointers
    }
    return false; // not found
  }
}

// Demo
const t = new HashTable();
t.insert("cat", 1); t.insert("dog", 2); t.insert("bat", 3); // insert keys
console.log(t.search("dog")); // 2
t.delete("dog");
console.log(t.search("dog")); // null`,

    javascript: `// Insert/Search/Delete: O(1) avg  Space: O(n)
class HashTable {
  constructor(size = 53) {
    this.size = size;
    this.buckets = new Array(size).fill(null); // array of chains (separate chaining)
  }

  hash(key) {
    let h = 0;
    for (const ch of key) h = (h + ch.charCodeAt(0)) % this.size; // sum of char codes
    return h; // bucket index
  }

  insert(key, val) {
    const idx = this.hash(key);            // find bucket
    let node = this.buckets[idx];
    while (node) {                          // check for duplicate key
      if (node.key === key) { node.val = val; return; } // update existing
      node = node.next;
    }
    this.buckets[idx] = { key, val, next: this.buckets[idx] }; // prepend new node
  }

  search(key) {
    let node = this.buckets[this.hash(key)]; // locate bucket
    while (node) {
      if (node.key === key) return node.val;  // key found
      node = node.next;                       // follow chain
    }
    return null; // not found
  }

  delete(key) {
    const idx = this.hash(key);
    let prev = null, cur = this.buckets[idx];
    while (cur) {
      if (cur.key === key) {               // found target
        if (prev) prev.next = cur.next;   // splice out
        else this.buckets[idx] = cur.next; // new head
        return true;
      }
      prev = cur; cur = cur.next;          // advance
    }
    return false;
  }
}

// Demo
const t = new HashTable();
t.insert("cat", 1); t.insert("dog", 2); t.insert("bat", 3); // insert
console.log(t.search("dog")); // 2
t.delete("dog");
console.log(t.search("dog")); // null`,

    python: `# Insert/Search/Delete: O(1) avg  Space: O(n)
class Node:
    def __init__(self, key, val):
        self.key, self.val, self.next = key, val, None  # linked list node

class HashTable:
    def __init__(self, size=53):
        self.size = size
        self.buckets = [None] * size  # array of chains

    def _hash(self, key):
        return sum(ord(c) for c in key) % self.size  # sum of char codes mod size

    def insert(self, key, val):
        idx = self._hash(key)          # compute bucket index
        node = self.buckets[idx]
        while node:                    # walk chain to find existing key
            if node.key == key: node.val = val; return  # update
            node = node.next
        new_node = Node(key, val)      # create new node
        new_node.next = self.buckets[idx]  # prepend to chain
        self.buckets[idx] = new_node

    def search(self, key):
        node = self.buckets[self._hash(key)]  # go to bucket
        while node:
            if node.key == key: return node.val  # found
            node = node.next                      # follow chain
        return None  # not found

    def delete(self, key):
        idx = self._hash(key)
        prev, cur = None, self.buckets[idx]
        while cur:
            if cur.key == key:         # found target
                if prev: prev.next = cur.next      # unlink
                else: self.buckets[idx] = cur.next # new head
                return True
            prev, cur = cur, cur.next  # advance pointers
        return False  # not found

# Demo
t = HashTable()
t.insert("cat", 1); t.insert("dog", 2); t.insert("bat", 3)  # insert
print(t.search("dog"))  # 2
t.delete("dog")
print(t.search("dog"))  # None`,

    java: `// Insert/Search/Delete: O(1) avg  Space: O(n)
public class HashTable {
    static class Node {
        String key; int val; Node next; // linked list node
        Node(String k, int v) { key=k; val=v; }
    }

    private Node[] buckets; // array of chains
    private int size;

    public HashTable(int size) {
        this.size = size;
        buckets = new Node[size]; // initialize empty buckets
    }

    private int hash(String key) {
        int h = 0;
        for (char c : key.toCharArray()) h = (h + c) % size; // sum char codes
        return h; // bucket index
    }

    public void insert(String key, int val) {
        int idx = hash(key);           // compute bucket
        for (Node n = buckets[idx]; n != null; n = n.next)
            if (n.key.equals(key)) { n.val = val; return; } // update existing
        Node node = new Node(key, val); // create new node
        node.next = buckets[idx];       // prepend to chain
        buckets[idx] = node;
    }

    public Integer search(String key) {
        for (Node n = buckets[hash(key)]; n != null; n = n.next)
            if (n.key.equals(key)) return n.val; // found
        return null; // not found
    }

    public boolean delete(String key) {
        int idx = hash(key);
        Node prev = null, cur = buckets[idx];
        while (cur != null) {
            if (cur.key.equals(key)) {       // found target
                if (prev != null) prev.next = cur.next; // splice out
                else buckets[idx] = cur.next;           // new head
                return true;
            }
            prev = cur; cur = cur.next;      // advance
        }
        return false;
    }

    public static void main(String[] args) {
        HashTable t = new HashTable(53);
        t.insert("cat",1); t.insert("dog",2); t.insert("bat",3); // insert
        System.out.println(t.search("dog")); // 2
        t.delete("dog");
        System.out.println(t.search("dog")); // null
    }
}`,

    c: `/* Insert/Search/Delete: O(1) avg  Space: O(n) */
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#define SIZE 53

typedef struct Node { char key[64]; int val; struct Node* next; } Node; /* chain node */
Node* buckets[SIZE]; /* array of chains, all NULL initially */

int hash(const char* key) {
    int h = 0;
    while (*key) h = (h + *key++) % SIZE; /* sum char codes mod SIZE */
    return h; /* bucket index */
}

void insert(const char* key, int val) {
    int idx = hash(key);            /* compute bucket */
    for (Node* n = buckets[idx]; n; n = n->next)
        if (!strcmp(n->key, key)) { n->val = val; return; } /* update existing */
    Node* node = malloc(sizeof(Node)); /* allocate new node */
    strcpy(node->key, key); node->val = val;
    node->next = buckets[idx];      /* prepend to chain */
    buckets[idx] = node;
}

int search(const char* key, int* out) {
    for (Node* n = buckets[hash(key)]; n; n = n->next)
        if (!strcmp(n->key, key)) { *out = n->val; return 1; } /* found */
    return 0; /* not found */
}

void delete(const char* key) {
    int idx = hash(key);
    Node *prev = NULL, *cur = buckets[idx];
    while (cur) {
        if (!strcmp(cur->key, key)) { /* found target */
            if (prev) prev->next = cur->next;  /* splice out */
            else buckets[idx] = cur->next;     /* new head */
            free(cur); return;
        }
        prev = cur; cur = cur->next; /* advance */
    }
}

int main() {
    insert("cat",1); insert("dog",2); insert("bat",3); /* insert keys */
    int v;
    if (search("dog",&v)) printf("%d\n",v); /* 2 */
    delete("dog");
    printf("%d\n", search("dog",&v)); /* 0 (not found) */
    return 0;
}`,

    cpp: `// Insert/Search/Delete: O(1) avg  Space: O(n)
#include <iostream>
#include <vector>
#include <string>
using namespace std;

struct Node { string key; int val; Node* next; }; // chain node

class HashTable {
    int size;
    vector<Node*> buckets; // array of chains

    int hash(const string& k) {
        int h = 0;
        for (char c : k) h = (h + c) % size; // sum of char codes
        return h; // bucket index
    }
public:
    HashTable(int sz=53) : size(sz), buckets(sz, nullptr) {} // init empty buckets

    void insert(const string& key, int val) {
        int idx = hash(key);              // compute bucket
        for (Node* n=buckets[idx]; n; n=n->next)
            if (n->key==key) { n->val=val; return; } // update existing
        Node* nd = new Node{key, val, buckets[idx]}; // prepend new node
        buckets[idx] = nd;
    }

    int* search(const string& key) {
        for (Node* n=buckets[hash(key)]; n; n=n->next)
            if (n->key==key) return &n->val; // found
        return nullptr; // not found
    }

    bool del(const string& key) {
        int idx = hash(key);
        Node *prev=nullptr, *cur=buckets[idx];
        while (cur) {
            if (cur->key==key) {           // found target
                if (prev) prev->next=cur->next; // splice out
                else buckets[idx]=cur->next;    // new head
                delete cur; return true;
            }
            prev=cur; cur=cur->next;       // advance
        }
        return false;
    }
};

int main() {
    HashTable t;
    t.insert("cat",1); t.insert("dog",2); t.insert("bat",3); // insert keys
    cout << *t.search("dog") << "\n"; // 2
    t.del("dog");
    cout << (t.search("dog") ? "found" : "null") << "\n"; // null
}`,

    rust: `// Insert/Search/Delete: O(1) avg  Space: O(n)
struct HashTable {
    buckets: Vec<Vec<(String, i32)>>, // vector of chains (vec of pairs)
    size: usize,
}

impl HashTable {
    fn new(size: usize) -> Self {
        HashTable { buckets: vec![vec![]; size], size } // empty chains
    }

    fn hash(&self, key: &str) -> usize {
        key.chars().map(|c| c as usize).sum::<usize>() % self.size // sum char codes
    }

    fn insert(&mut self, key: &str, val: i32) {
        let idx = self.hash(key);                   // compute bucket
        for pair in &mut self.buckets[idx] {
            if pair.0 == key { pair.1 = val; return; } // update existing
        }
        self.buckets[idx].push((key.to_string(), val)); // append new pair
    }

    fn search(&self, key: &str) -> Option<i32> {
        let idx = self.hash(key);                   // compute bucket
        self.buckets[idx].iter()
            .find(|p| p.0 == key)                  // linear search in chain
            .map(|p| p.1)                           // return value if found
    }

    fn delete(&mut self, key: &str) -> bool {
        let idx = self.hash(key);                   // compute bucket
        let len_before = self.buckets[idx].len();
        self.buckets[idx].retain(|p| p.0 != key);  // remove matching pair
        self.buckets[idx].len() < len_before        // true if removed
    }
}

fn main() {
    let mut t = HashTable::new(53);
    t.insert("cat", 1); t.insert("dog", 2); t.insert("bat", 3); // insert keys
    println!("{:?}", t.search("dog")); // Some(2)
    t.delete("dog");
    println!("{:?}", t.search("dog")); // None
}`,

    go: `// Insert/Search/Delete: O(1) avg  Space: O(n)
package main

import "fmt"

type Node struct { key string; val int; next *Node } // chain node

type HashTable struct {
    buckets []*Node // array of chains
    size    int
}

func NewHashTable(size int) *HashTable {
    return &HashTable{buckets: make([]*Node, size), size: size} // init empty buckets
}

func (t *HashTable) hash(key string) int {
    h := 0
    for _, c := range key { h = (h + int(c)) % t.size } // sum of char codes
    return h // bucket index
}

func (t *HashTable) Insert(key string, val int) {
    idx := t.hash(key)              // compute bucket
    for n := t.buckets[idx]; n != nil; n = n.next {
        if n.key == key { n.val = val; return } // update existing
    }
    t.buckets[idx] = &Node{key, val, t.buckets[idx]} // prepend new node
}

func (t *HashTable) Search(key string) (int, bool) {
    for n := t.buckets[t.hash(key)]; n != nil; n = n.next {
        if n.key == key { return n.val, true } // found
    }
    return 0, false // not found
}

func (t *HashTable) Delete(key string) bool {
    idx := t.hash(key)
    var prev *Node
    for cur := t.buckets[idx]; cur != nil; cur = cur.next {
        if cur.key == key {           // found target
            if prev != nil { prev.next = cur.next } else { t.buckets[idx] = cur.next } // splice
            return true
        }
        prev = cur // advance
    }
    return false
}

func main() {
    t := NewHashTable(53)
    t.Insert("cat", 1); t.Insert("dog", 2); t.Insert("bat", 3) // insert keys
    fmt.Println(t.Search("dog")) // 2 true
    t.Delete("dog")
    fmt.Println(t.Search("dog")) // 0 false
}`,

  },

  // ── BST ─────────────────────────────────────────────────────────
  "bst": {
    typescript: `// Insert/Search: O(log n) avg  Space: O(n)
class BSTNode { constructor(public val: number, public left: BSTNode|null=null, public right: BSTNode|null=null){} }

class BST {
  private root: BSTNode | null = null; // tree root

  insert(val: number) { this.root = this._insert(this.root, val); }

  private _insert(node: BSTNode|null, val: number): BSTNode {
    if (!node) return new BSTNode(val);         // base case: create leaf
    if (val < node.val) node.left  = this._insert(node.left,  val); // go left
    else if (val > node.val) node.right = this._insert(node.right, val); // go right
    return node; // return unchanged node
  }

  search(val: number): boolean {
    let cur = this.root;
    while (cur) {
      if (val === cur.val) return true;          // found
      cur = val < cur.val ? cur.left : cur.right; // navigate left or right
    }
    return false; // not found
  }

  delete(val: number) { this.root = this._delete(this.root, val); }

  private _delete(node: BSTNode|null, val: number): BSTNode|null {
    if (!node) return null;                      // value not in tree
    if (val < node.val) { node.left  = this._delete(node.left,  val); return node; }
    if (val > node.val) { node.right = this._delete(node.right, val); return node; }
    if (!node.left)  return node.right;          // no left child
    if (!node.right) return node.left;           // no right child
    let succ = node.right;
    while (succ.left) succ = succ.left;          // find in-order successor (min of right subtree)
    node.val = succ.val;                         // replace value with successor
    node.right = this._delete(node.right, succ.val); // delete successor
    return node;
  }

  inorder(): number[] {
    const res: number[] = [];
    const dfs = (n: BSTNode|null) => { if (!n) return; dfs(n.left); res.push(n.val); dfs(n.right); };
    dfs(this.root); // left -> root -> right
    return res;
  }
}

// Demo
const bst = new BST();
[5,3,7,1,4].forEach(v => bst.insert(v)); // insert values
console.log(bst.inorder());      // [1,3,4,5,7]
console.log(bst.search(4));      // true
bst.delete(3);
console.log(bst.inorder());      // [1,4,5,7]`,

    javascript: `// Insert/Search: O(log n) avg  Space: O(n)
class BSTNode {
  constructor(val) { this.val=val; this.left=null; this.right=null; } // tree node
}

class BST {
  constructor() { this.root = null; } // empty tree

  insert(val) { this.root = this._ins(this.root, val); }

  _ins(node, val) {
    if (!node) return new BSTNode(val);          // base case: new leaf
    if (val < node.val) node.left  = this._ins(node.left,  val); // go left
    else if (val > node.val) node.right = this._ins(node.right, val); // go right
    return node;
  }

  search(val) {
    let cur = this.root;
    while (cur) {
      if (val === cur.val) return true;           // found
      cur = val < cur.val ? cur.left : cur.right; // navigate
    }
    return false; // not found
  }

  delete(val) { this.root = this._del(this.root, val); }

  _del(node, val) {
    if (!node) return null;
    if (val < node.val) { node.left  = this._del(node.left,  val); return node; }
    if (val > node.val) { node.right = this._del(node.right, val); return node; }
    if (!node.left)  return node.right;          // single child or leaf
    if (!node.right) return node.left;
    let succ = node.right;
    while (succ.left) succ = succ.left;          // in-order successor (leftmost in right subtree)
    node.val = succ.val;                         // copy successor value
    node.right = this._del(node.right, succ.val); // delete successor
    return node;
  }

  inorder() {
    const res = [];
    const dfs = n => { if (!n) return; dfs(n.left); res.push(n.val); dfs(n.right); };
    dfs(this.root); // left -> node -> right
    return res;
  }
}

// Demo
const bst = new BST();
[5,3,7,1,4].forEach(v => bst.insert(v));
console.log(bst.inorder()); // [1,3,4,5,7]
bst.delete(3);
console.log(bst.inorder()); // [1,4,5,7]`,

    python: `# Insert/Search: O(log n) avg  Space: O(n)
class BSTNode:
    def __init__(self, val):
        self.val, self.left, self.right = val, None, None  # tree node

class BST:
    def __init__(self): self.root = None  # empty tree

    def insert(self, val): self.root = self._ins(self.root, val)

    def _ins(self, node, val):
        if not node: return BSTNode(val)           # base case: create leaf
        if   val < node.val: node.left  = self._ins(node.left,  val)  # go left
        elif val > node.val: node.right = self._ins(node.right, val)  # go right
        return node

    def search(self, val):
        cur = self.root
        while cur:
            if val == cur.val: return True          # found
            cur = cur.left if val < cur.val else cur.right  # navigate
        return False  # not found

    def delete(self, val): self.root = self._del(self.root, val)

    def _del(self, node, val):
        if not node: return None                   # not found
        if   val < node.val: node.left  = self._del(node.left,  val)
        elif val > node.val: node.right = self._del(node.right, val)
        else:
            if not node.left:  return node.right   # no left child
            if not node.right: return node.left    # no right child
            succ = node.right
            while succ.left: succ = succ.left      # find in-order successor
            node.val = succ.val                    # replace with successor value
            node.right = self._del(node.right, succ.val)  # delete successor
        return node

    def inorder(self):
        res = []
        def dfs(n):
            if not n: return
            dfs(n.left); res.append(n.val); dfs(n.right)  # left -> root -> right
        dfs(self.root); return res

# Demo
bst = BST()
for v in [5,3,7,1,4]: bst.insert(v)
print(bst.inorder())  # [1,3,4,5,7]
bst.delete(3)
print(bst.inorder())  # [1,4,5,7]`,

    java: `// Insert/Search: O(log n) avg  Space: O(n)
public class BST {
    static class Node { int val; Node left, right; Node(int v){val=v;} } // tree node

    Node root; // tree root

    public void insert(int val) { root = ins(root, val); }

    Node ins(Node n, int val) {
        if (n == null) return new Node(val);       // base case: create leaf
        if      (val < n.val) n.left  = ins(n.left,  val); // go left
        else if (val > n.val) n.right = ins(n.right, val); // go right
        return n;
    }

    public boolean search(int val) {
        Node cur = root;
        while (cur != null) {
            if (val == cur.val) return true;        // found
            cur = val < cur.val ? cur.left : cur.right; // navigate
        }
        return false; // not found
    }

    public void delete(int val) { root = del(root, val); }

    Node del(Node n, int val) {
        if (n == null) return null;               // not found
        if      (val < n.val) { n.left  = del(n.left,  val); return n; }
        else if (val > n.val) { n.right = del(n.right, val); return n; }
        if (n.left  == null) return n.right;      // no left child
        if (n.right == null) return n.left;       // no right child
        Node succ = n.right;
        while (succ.left != null) succ = succ.left; // find in-order successor
        n.val = succ.val;                          // replace with successor
        n.right = del(n.right, succ.val);          // delete successor
        return n;
    }

    void inorder(Node n, java.util.List<Integer> res) {
        if (n==null) return;
        inorder(n.left,res); res.add(n.val); inorder(n.right,res); // left->root->right
    }

    public static void main(String[] args) {
        BST bst = new BST();
        for (int v : new int[]{5,3,7,1,4}) bst.insert(v); // insert values
        java.util.List<Integer> r = new java.util.ArrayList<>();
        bst.inorder(bst.root,r); System.out.println(r); // [1,3,4,5,7]
        bst.delete(3);
        r.clear(); bst.inorder(bst.root,r); System.out.println(r); // [1,4,5,7]
    }
}`,

    c: `/* Insert/Search: O(log n) avg  Space: O(n) */
#include <stdio.h>
#include <stdlib.h>

typedef struct Node { int val; struct Node *left, *right; } Node; /* tree node */

Node* new_node(int v) { Node* n=malloc(sizeof(Node)); n->val=v; n->left=n->right=NULL; return n; }

Node* insert(Node* n, int v) {
    if (!n) return new_node(v);             /* base case: create leaf */
    if      (v < n->val) n->left  = insert(n->left,  v); /* go left */
    else if (v > n->val) n->right = insert(n->right, v); /* go right */
    return n;
}

int search(Node* n, int v) {
    while (n) {
        if (v == n->val) return 1;           /* found */
        n = v < n->val ? n->left : n->right; /* navigate */
    }
    return 0; /* not found */
}

Node* delete_node(Node* n, int v) {
    if (!n) return NULL;
    if      (v < n->val) { n->left  = delete_node(n->left,  v); return n; }
    else if (v > n->val) { n->right = delete_node(n->right, v); return n; }
    if (!n->left)  return n->right;         /* no left child */
    if (!n->right) return n->left;          /* no right child */
    Node* succ = n->right;
    while (succ->left) succ = succ->left;   /* find in-order successor */
    n->val = succ->val;                     /* replace value */
    n->right = delete_node(n->right, succ->val); /* delete successor */
    return n;
}

void inorder(Node* n) {
    if (!n) return;
    inorder(n->left); printf("%d ", n->val); inorder(n->right); /* left->root->right */
}

int main() {
    Node* root = NULL;
    int vals[] = {5,3,7,1,4};
    for (int i=0;i<5;i++) root=insert(root,vals[i]); /* insert values */
    inorder(root); printf("\n"); /* 1 3 4 5 7 */
    root = delete_node(root,3);
    inorder(root); printf("\n"); /* 1 4 5 7 */
    return 0;
}`,

    cpp: `// Insert/Search: O(log n) avg  Space: O(n)
#include <iostream>
#include <vector>
using namespace std;

struct Node { int val; Node *left=nullptr, *right=nullptr; Node(int v):val(v){} }; // tree node

class BST {
    Node* root = nullptr; // tree root

    Node* ins(Node* n, int v) {
        if (!n) return new Node(v);           // base case: create leaf
        if      (v < n->val) n->left  = ins(n->left,  v); // go left
        else if (v > n->val) n->right = ins(n->right, v); // go right
        return n;
    }

    Node* del(Node* n, int v) {
        if (!n) return nullptr;
        if      (v < n->val) { n->left  = del(n->left,  v); return n; }
        else if (v > n->val) { n->right = del(n->right, v); return n; }
        if (!n->left)  return n->right;        // no left child
        if (!n->right) return n->left;         // no right child
        Node* succ = n->right;
        while (succ->left) succ = succ->left;  // find in-order successor
        n->val = succ->val;                    // replace with successor
        n->right = del(n->right, succ->val);   // delete successor
        return n;
    }

    void inorder(Node* n, vector<int>& res) {
        if (!n) return;
        inorder(n->left,res); res.push_back(n->val); inorder(n->right,res); // left->root->right
    }
public:
    void insert(int v) { root = ins(root, v); }

    bool search(int v) {
        for (Node* c=root; c;)
            if (v==c->val) return true;
            else c = v<c->val ? c->left : c->right; // navigate
        return false;
    }

    void remove(int v) { root = del(root, v); }

    vector<int> inorder() { vector<int> r; inorder(root,r); return r; }
};

int main() {
    BST bst;
    for (int v : {5,3,7,1,4}) bst.insert(v); // insert values
    for (int x : bst.inorder()) cout << x << " "; cout << "\n"; // 1 3 4 5 7
    bst.remove(3);
    for (int x : bst.inorder()) cout << x << " "; cout << "\n"; // 1 4 5 7
}`,

    rust: `// Insert/Search: O(log n) avg  Space: O(n)
type Link = Option<Box<Node>>;

struct Node { val: i32, left: Link, right: Link } // tree node

impl Node { fn new(v: i32) -> Box<Self> { Box::new(Node{val:v, left:None, right:None}) } }

fn insert(node: Link, v: i32) -> Link {
    match node {
        None => Some(Node::new(v)),              // base case: create leaf
        Some(mut n) => {
            if      v < n.val { n.left  = insert(n.left.take(),  v); } // go left
            else if v > n.val { n.right = insert(n.right.take(), v); } // go right
            Some(n)
        }
    }
}

fn search(node: &Link, v: i32) -> bool {
    let mut cur = node;
    while let Some(n) = cur {
        if v == n.val { return true; }           // found
        cur = if v < n.val { &n.left } else { &n.right }; // navigate
    }
    false // not found
}

fn min_val(node: &Box<Node>) -> i32 {
    node.left.as_ref().map_or(node.val, |l| min_val(l)) // leftmost value = minimum
}

fn delete(node: Link, v: i32) -> Link {
    node.map(|mut n| {
        if      v < n.val { n.left  = delete(n.left.take(),  v); Some(n) }
        else if v > n.val { n.right = delete(n.right.take(), v); Some(n) }
        else {
            match (n.left.take(), n.right.take()) {
                (None, r) => r,                  // no left child
                (l, None) => l,                  // no right child
                (l, r) => {                      // two children: use in-order successor
                    let succ_val = min_val(r.as_ref().unwrap());
                    n.val = succ_val; n.left = l;
                    n.right = delete(r, succ_val); // delete successor
                    Some(n)
                }
            }
        }
    }).flatten()
}

fn inorder(node: &Link, res: &mut Vec<i32>) {
    if let Some(n) = node { inorder(&n.left,res); res.push(n.val); inorder(&n.right,res); } // left->root->right
}

fn main() {
    let mut root: Link = None;
    for v in [5,3,7,1,4] { root = insert(root, v); } // insert values
    let mut r = vec![]; inorder(&root, &mut r);
    println!("{:?}", r); // [1,3,4,5,7]
    root = delete(root, 3);
    let mut r2 = vec![]; inorder(&root, &mut r2);
    println!("{:?}", r2); // [1,4,5,7]
}`,

    go: `// Insert/Search: O(log n) avg  Space: O(n)
package main

import "fmt"

type Node struct { val int; left, right *Node } // tree node

func insert(n *Node, v int) *Node {
    if n == nil { return &Node{val: v} }   // base case: create leaf
    if   v < n.val { n.left  = insert(n.left,  v) } // go left
    else if v > n.val { n.right = insert(n.right, v) } // go right
    return n
}

func search(n *Node, v int) bool {
    for n != nil {
        if v == n.val { return true }       // found
        if v < n.val { n = n.left } else { n = n.right } // navigate
    }
    return false // not found
}

func minVal(n *Node) int {
    for n.left != nil { n = n.left }        // leftmost node is minimum
    return n.val
}

func delete(n *Node, v int) *Node {
    if n == nil { return nil }
    if   v < n.val { n.left  = delete(n.left,  v); return n }
    if   v > n.val { n.right = delete(n.right, v); return n }
    if n.left  == nil { return n.right }    // no left child
    if n.right == nil { return n.left }     // no right child
    succ := minVal(n.right)                 // find in-order successor
    n.val = succ                            // replace value
    n.right = delete(n.right, succ)         // delete successor
    return n
}

func inorder(n *Node, res *[]int) {
    if n == nil { return }
    inorder(n.left, res); *res = append(*res, n.val); inorder(n.right, res) // left->root->right
}

func main() {
    var root *Node
    for _, v := range []int{5,3,7,1,4} { root = insert(root, v) } // insert values
    var r []int; inorder(root, &r)
    fmt.Println(r) // [1 3 4 5 7]
    root = delete(root, 3)
    r = nil; inorder(root, &r)
    fmt.Println(r) // [1 4 5 7]
}`,

  },

  // ── GRAPH ───────────────────────────────────────────────────────
  "graph": {
    typescript: `// BFS/DFS: O(V+E)  Space: O(V)
class Graph {
  private adj: Map<number, number[]> = new Map(); // adjacency list

  addVertex(v: number) {
    if (!this.adj.has(v)) this.adj.set(v, []); // initialize empty neighbor list
  }

  addEdge(u: number, v: number) {
    this.addVertex(u); this.addVertex(v);
    this.adj.get(u)!.push(v); // add edge u->v
    this.adj.get(v)!.push(u); // add edge v->u (undirected)
  }

  bfs(start: number): number[] {
    const visited = new Set<number>(); // track visited nodes
    const queue = [start];             // FIFO queue
    const order: number[] = [];
    visited.add(start);
    while (queue.length) {
      const v = queue.shift()!;        // dequeue front
      order.push(v);
      for (const nb of this.adj.get(v) ?? []) { // visit neighbors
        if (!visited.has(nb)) {
          visited.add(nb);             // mark visited
          queue.push(nb);              // enqueue neighbor
        }
      }
    }
    return order; // BFS traversal order
  }

  dfs(start: number): number[] {
    const visited = new Set<number>(); // track visited nodes
    const order: number[] = [];
    const dfsHelper = (v: number) => {
      visited.add(v);                  // mark visited
      order.push(v);
      for (const nb of this.adj.get(v) ?? []) // visit neighbors
        if (!visited.has(nb)) dfsHelper(nb);  // recurse on unvisited
    };
    dfsHelper(start);
    return order; // DFS traversal order
  }
}

// Demo
const g = new Graph();
g.addEdge(1,2); g.addEdge(1,3); g.addEdge(2,4); g.addEdge(3,4); // build graph
console.log(g.bfs(1)); // [1,2,3,4]
console.log(g.dfs(1)); // [1,2,4,3]`,

    javascript: `// BFS/DFS: O(V+E)  Space: O(V)
class Graph {
  constructor() { this.adj = new Map(); } // adjacency list

  addVertex(v) { if (!this.adj.has(v)) this.adj.set(v, []); } // init neighbor list

  addEdge(u, v) {
    this.addVertex(u); this.addVertex(v);
    this.adj.get(u).push(v); // edge u->v
    this.adj.get(v).push(u); // edge v->u (undirected)
  }

  bfs(start) {
    const visited = new Set([start]); // track visited nodes
    const queue = [start];            // FIFO queue
    const order = [];
    while (queue.length) {
      const v = queue.shift();        // dequeue front
      order.push(v);
      for (const nb of this.adj.get(v) || []) { // iterate neighbors
        if (!visited.has(nb)) {
          visited.add(nb);            // mark visited
          queue.push(nb);             // enqueue
        }
      }
    }
    return order; // BFS traversal order
  }

  dfs(start) {
    const visited = new Set();        // track visited nodes
    const order = [];
    const helper = v => {
      visited.add(v); order.push(v); // mark and record
      for (const nb of this.adj.get(v) || [])
        if (!visited.has(nb)) helper(nb); // recurse on unvisited neighbor
    };
    helper(start);
    return order; // DFS traversal order
  }
}

// Demo
const g = new Graph();
g.addEdge(1,2); g.addEdge(1,3); g.addEdge(2,4); g.addEdge(3,4);
console.log(g.bfs(1)); // [1,2,3,4]
console.log(g.dfs(1)); // [1,2,4,3]`,

    python: `# BFS/DFS: O(V+E)  Space: O(V)
from collections import defaultdict, deque

class Graph:
    def __init__(self):
        self.adj = defaultdict(list)  # adjacency list

    def add_edge(self, u, v):
        self.adj[u].append(v)  # edge u->v
        self.adj[v].append(u)  # edge v->u (undirected)

    def bfs(self, start):
        visited = {start}              # track visited nodes
        queue = deque([start])         # FIFO queue
        order = []
        while queue:
            v = queue.popleft()        # dequeue front
            order.append(v)
            for nb in self.adj[v]:     # iterate neighbors
                if nb not in visited:
                    visited.add(nb)    # mark visited
                    queue.append(nb)   # enqueue neighbor
        return order  # BFS traversal order

    def dfs(self, start):
        visited = set()                # track visited nodes
        order = []
        def helper(v):
            visited.add(v); order.append(v)  # mark and record
            for nb in self.adj[v]:
                if nb not in visited: helper(nb)  # recurse on unvisited
        helper(start)
        return order  # DFS traversal order

# Demo
g = Graph()
g.add_edge(1,2); g.add_edge(1,3); g.add_edge(2,4); g.add_edge(3,4)  # build graph
print(g.bfs(1))  # [1, 2, 3, 4]
print(g.dfs(1))  # [1, 2, 4, 3]`,

    java: `// BFS/DFS: O(V+E)  Space: O(V)
import java.util.*;

public class Graph {
    private Map<Integer, List<Integer>> adj = new HashMap<>(); // adjacency list

    public void addVertex(int v) { adj.putIfAbsent(v, new ArrayList<>()); } // init list

    public void addEdge(int u, int v) {
        addVertex(u); addVertex(v);
        adj.get(u).add(v); // edge u->v
        adj.get(v).add(u); // edge v->u (undirected)
    }

    public List<Integer> bfs(int start) {
        Set<Integer> visited = new HashSet<>(); // track visited nodes
        Queue<Integer> queue = new LinkedList<>(); // FIFO queue
        List<Integer> order = new ArrayList<>();
        visited.add(start); queue.add(start);
        while (!queue.isEmpty()) {
            int v = queue.poll();               // dequeue front
            order.add(v);
            for (int nb : adj.getOrDefault(v, List.of())) { // iterate neighbors
                if (!visited.contains(nb)) {
                    visited.add(nb);            // mark visited
                    queue.add(nb);              // enqueue
                }
            }
        }
        return order; // BFS traversal order
    }

    public List<Integer> dfs(int start) {
        Set<Integer> visited = new HashSet<>(); // track visited nodes
        List<Integer> order = new ArrayList<>();
        dfsHelper(start, visited, order);
        return order; // DFS traversal order
    }

    private void dfsHelper(int v, Set<Integer> visited, List<Integer> order) {
        visited.add(v); order.add(v);           // mark and record
        for (int nb : adj.getOrDefault(v, List.of()))
            if (!visited.contains(nb)) dfsHelper(nb, visited, order); // recurse
    }

    public static void main(String[] args) {
        Graph g = new Graph();
        g.addEdge(1,2); g.addEdge(1,3); g.addEdge(2,4); g.addEdge(3,4); // build graph
        System.out.println(g.bfs(1)); // [1,2,3,4]
        System.out.println(g.dfs(1)); // [1,2,4,3]
    }
}`,

    c: `/* BFS/DFS: O(V+E)  Space: O(V) */
#include <stdio.h>
#include <string.h>
#define V 5      /* number of vertices */
#define QMAX 100

int adj[V][V]; /* adjacency matrix for simplicity */

void add_edge(int u, int v) {
    adj[u][v] = adj[v][u] = 1; /* mark edge in both directions (undirected) */
}

void bfs(int start) {
    int visited[V]={0}, queue[QMAX], front=0, back=0; /* visited array and queue */
    visited[start] = 1; queue[back++] = start;         /* enqueue start */
    printf("BFS: ");
    while (front < back) {
        int v = queue[front++];  /* dequeue front */
        printf("%d ", v);
        for (int nb=0; nb<V; nb++)           /* iterate all potential neighbors */
            if (adj[v][nb] && !visited[nb]) { /* edge exists and unvisited */
                visited[nb]=1; queue[back++]=nb; /* mark and enqueue */
            }
    }
    printf("\n");
}

void dfs_helper(int v, int* visited) {
    visited[v] = 1; printf("%d ", v); /* mark and print */
    for (int nb=0; nb<V; nb++)
        if (adj[v][nb] && !visited[nb]) dfs_helper(nb, visited); /* recurse on unvisited */
}

void dfs(int start) {
    int visited[V] = {0};  /* all unvisited initially */
    printf("DFS: ");
    dfs_helper(start, visited);
    printf("\n");
}

int main() {
    memset(adj, 0, sizeof(adj));        /* clear adjacency matrix */
    add_edge(1,2); add_edge(1,3); add_edge(2,4); add_edge(3,4); /* build graph */
    bfs(1); /* BFS: 1 2 3 4 */
    dfs(1); /* DFS: 1 2 4 3 */
    return 0;
}`,

    cpp: `// BFS/DFS: O(V+E)  Space: O(V)
#include <iostream>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <queue>
using namespace std;

class Graph {
    unordered_map<int, vector<int>> adj; // adjacency list
public:
    void addEdge(int u, int v) {
        adj[u].push_back(v); // edge u->v
        adj[v].push_back(u); // edge v->u (undirected)
    }

    vector<int> bfs(int start) {
        unordered_set<int> visited; // track visited nodes
        queue<int> q;               // FIFO queue
        vector<int> order;
        q.push(start); visited.insert(start);
        while (!q.empty()) {
            int v = q.front(); q.pop(); // dequeue front
            order.push_back(v);
            for (int nb : adj[v])        // iterate neighbors
                if (!visited.count(nb)) {
                    visited.insert(nb);  // mark visited
                    q.push(nb);          // enqueue
                }
        }
        return order; // BFS traversal order
    }

    vector<int> dfs(int start) {
        unordered_set<int> visited; // track visited nodes
        vector<int> order;
        function<void(int)> helper = [&](int v) {
            visited.insert(v); order.push_back(v); // mark and record
            for (int nb : adj[v])
                if (!visited.count(nb)) helper(nb); // recurse on unvisited
        };
        helper(start);
        return order; // DFS traversal order
    }
};

int main() {
    Graph g;
    g.addEdge(1,2); g.addEdge(1,3); g.addEdge(2,4); g.addEdge(3,4); // build graph
    for (int x : g.bfs(1)) cout << x << " "; cout << "\n"; // 1 2 3 4
    for (int x : g.dfs(1)) cout << x << " "; cout << "\n"; // 1 2 4 3
}`,

    rust: `// BFS/DFS: O(V+E)  Space: O(V)
use std::collections::{HashMap, HashSet, VecDeque};

struct Graph { adj: HashMap<i32, Vec<i32>> } // adjacency list

impl Graph {
    fn new() -> Self { Graph { adj: HashMap::new() } }

    fn add_edge(&mut self, u: i32, v: i32) {
        self.adj.entry(u).or_default().push(v); // edge u->v
        self.adj.entry(v).or_default().push(u); // edge v->u (undirected)
    }

    fn bfs(&self, start: i32) -> Vec<i32> {
        let mut visited = HashSet::new();        // track visited nodes
        let mut queue = VecDeque::new();         // FIFO queue
        let mut order = vec![];
        visited.insert(start); queue.push_back(start);
        while let Some(v) = queue.pop_front() { // dequeue front
            order.push(v);
            if let Some(neighbors) = self.adj.get(&v) {
                for &nb in neighbors {           // iterate neighbors
                    if visited.insert(nb) {      // insert returns true if newly added
                        queue.push_back(nb);     // enqueue unvisited neighbor
                    }
                }
            }
        }
        order // BFS traversal order
    }

    fn dfs(&self, start: i32) -> Vec<i32> {
        let mut visited = HashSet::new();        // track visited nodes
        let mut order = vec![];
        self.dfs_helper(start, &mut visited, &mut order);
        order // DFS traversal order
    }

    fn dfs_helper(&self, v: i32, visited: &mut HashSet<i32>, order: &mut Vec<i32>) {
        visited.insert(v); order.push(v);        // mark and record
        if let Some(neighbors) = self.adj.get(&v) {
            for &nb in neighbors {
                if !visited.contains(&nb) { self.dfs_helper(nb, visited, order); } // recurse
            }
        }
    }
}

fn main() {
    let mut g = Graph::new();
    g.add_edge(1,2); g.add_edge(1,3); g.add_edge(2,4); g.add_edge(3,4); // build graph
    println!("{:?}", g.bfs(1)); // [1, 2, 3, 4]
    println!("{:?}", g.dfs(1)); // [1, 2, 4, 3]
}`,

    go: `// BFS/DFS: O(V+E)  Space: O(V)
package main

import "fmt"

type Graph struct { adj map[int][]int } // adjacency list

func NewGraph() *Graph { return &Graph{adj: make(map[int][]int)} }

func (g *Graph) AddEdge(u, v int) {
    g.adj[u] = append(g.adj[u], v) // edge u->v
    g.adj[v] = append(g.adj[v], u) // edge v->u (undirected)
}

func (g *Graph) BFS(start int) []int {
    visited := map[int]bool{start: true} // track visited nodes
    queue := []int{start}                // FIFO queue (slice)
    var order []int
    for len(queue) > 0 {
        v := queue[0]; queue = queue[1:] // dequeue front
        order = append(order, v)
        for _, nb := range g.adj[v] {    // iterate neighbors
            if !visited[nb] {
                visited[nb] = true       // mark visited
                queue = append(queue, nb) // enqueue
            }
        }
    }
    return order // BFS traversal order
}

func (g *Graph) DFS(start int) []int {
    visited := map[int]bool{}            // track visited nodes
    var order []int
    var helper func(int)
    helper = func(v int) {
        visited[v] = true                // mark visited
        order = append(order, v)
        for _, nb := range g.adj[v] {
            if !visited[nb] { helper(nb) } // recurse on unvisited
        }
    }
    helper(start)
    return order // DFS traversal order
}

func main() {
    g := NewGraph()
    g.AddEdge(1,2); g.AddEdge(1,3); g.AddEdge(2,4); g.AddEdge(3,4) // build graph
    fmt.Println(g.BFS(1)) // [1 2 3 4]
    fmt.Println(g.DFS(1)) // [1 2 4 3]
}`,

  },

  // ── TIMSORT ────────────────────────────────────────────────────────────────
  timsort: {
    typescript: `// Tim Sort: hybrid of insertion sort + merge sort
const RUN = 32; // size of each small "run" to insertion-sort

// Insertion sort a subarray arr[left..right] in place
function insertionSort(arr: number[], left: number, right: number): void {
  for (let i = left + 1; i <= right; i++) {
    const temp = arr[i]; // element to place
    let j = i - 1;
    // Shift elements right until correct position found
    while (j >= left && arr[j] > temp) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = temp; // insert element in correct spot
  }
}

// Merge two sorted subarrays arr[left..mid] and arr[mid+1..right]
function merge(arr: number[], left: number, mid: number, right: number): void {
  const leftArr = arr.slice(left, mid + 1);  // copy left half
  const rightArr = arr.slice(mid + 1, right + 1); // copy right half
  let i = 0, j = 0, k = left;
  // Merge by picking the smaller front element each time
  while (i < leftArr.length && j < rightArr.length) {
    if (leftArr[i] <= rightArr[j]) { // <= keeps sort stable
      arr[k++] = leftArr[i++];
    } else {
      arr[k++] = rightArr[j++];
    }
  }
  // Drain any remaining elements from either half
  while (i < leftArr.length) arr[k++] = leftArr[i++];
  while (j < rightArr.length) arr[k++] = rightArr[j++];
}

// Main Tim Sort function
function timSort(arr: number[]): void {
  const n = arr.length;
  // Step 1: sort individual runs of size RUN with insertion sort
  for (let i = 0; i < n; i += RUN) {
    insertionSort(arr, i, Math.min(i + RUN - 1, n - 1));
  }
  // Step 2: merge runs bottom-up, doubling size each pass
  for (let size = RUN; size < n; size *= 2) {
    for (let left = 0; left < n; left += 2 * size) {
      const mid = Math.min(left + size - 1, n - 1);
      const right = Math.min(left + 2 * size - 1, n - 1);
      // Only merge if there is a right partition
      if (mid < right) {
        merge(arr, left, mid, right);
      }
    }
  }
}

// Demo
const arr = [64, 34, 25, 12, 22, 11, 90, 42, 5, 77];
console.log("Before:", arr.join(", "));
timSort(arr);
console.log("After: ", arr.join(", "));

// Time: O(n log n)  Space: O(n)  Stable: YES`,

    javascript: `// Tim Sort: hybrid of insertion sort + merge sort
const RUN = 32; // size of each small "run" to insertion-sort

// Insertion sort a subarray arr[left..right] in place
function insertionSort(arr, left, right) {
  for (let i = left + 1; i <= right; i++) {
    const temp = arr[i]; // element to place
    let j = i - 1;
    // Shift elements right until correct position found
    while (j >= left && arr[j] > temp) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = temp; // insert element in correct spot
  }
}

// Merge two sorted subarrays arr[left..mid] and arr[mid+1..right]
function merge(arr, left, mid, right) {
  const leftArr = arr.slice(left, mid + 1);   // copy left half
  const rightArr = arr.slice(mid + 1, right + 1); // copy right half
  let i = 0, j = 0, k = left;
  // Merge by picking the smaller front element each time
  while (i < leftArr.length && j < rightArr.length) {
    if (leftArr[i] <= rightArr[j]) { // <= keeps sort stable
      arr[k++] = leftArr[i++];
    } else {
      arr[k++] = rightArr[j++];
    }
  }
  // Drain any remaining elements from either half
  while (i < leftArr.length) arr[k++] = leftArr[i++];
  while (j < rightArr.length) arr[k++] = rightArr[j++];
}

// Main Tim Sort function
function timSort(arr) {
  const n = arr.length;
  // Step 1: sort individual runs of size RUN with insertion sort
  for (let i = 0; i < n; i += RUN) {
    insertionSort(arr, i, Math.min(i + RUN - 1, n - 1));
  }
  // Step 2: merge runs bottom-up, doubling size each pass
  for (let size = RUN; size < n; size *= 2) {
    for (let left = 0; left < n; left += 2 * size) {
      const mid = Math.min(left + size - 1, n - 1);
      const right = Math.min(left + 2 * size - 1, n - 1);
      // Only merge if there is a right partition
      if (mid < right) {
        merge(arr, left, mid, right);
      }
    }
  }
}

// Demo
const arr = [64, 34, 25, 12, 22, 11, 90, 42, 5, 77];
console.log("Before:", arr.join(", "));
timSort(arr);
console.log("After: ", arr.join(", "));

// Time: O(n log n)  Space: O(n)  Stable: YES`,

    python: `# Tim Sort: hybrid of insertion sort + merge sort
RUN = 32  # size of each small "run" to insertion-sort

def insertion_sort(arr, left, right):
    """Insertion sort a subarray arr[left..right] in place."""
    for i in range(left + 1, right + 1):
        temp = arr[i]  # element to place
        j = i - 1
        # Shift elements right until correct position found
        while j >= left and arr[j] > temp:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = temp  # insert element in correct spot

def merge(arr, left, mid, right):
    """Merge two sorted subarrays arr[left..mid] and arr[mid+1..right]."""
    left_arr = arr[left:mid + 1]        # copy left half
    right_arr = arr[mid + 1:right + 1]  # copy right half
    i = j = 0
    k = left
    # Merge by picking the smaller front element each time
    while i < len(left_arr) and j < len(right_arr):
        if left_arr[i] <= right_arr[j]:  # <= keeps sort stable
            arr[k] = left_arr[i]
            i += 1
        else:
            arr[k] = right_arr[j]
            j += 1
        k += 1
    # Drain any remaining elements from either half
    while i < len(left_arr):
        arr[k] = left_arr[i]
        i += 1
        k += 1
    while j < len(right_arr):
        arr[k] = right_arr[j]
        j += 1
        k += 1

def tim_sort(arr):
    """Main Tim Sort function."""
    n = len(arr)
    # Step 1: sort individual runs of size RUN with insertion sort
    for i in range(0, n, RUN):
        insertion_sort(arr, i, min(i + RUN - 1, n - 1))
    # Step 2: merge runs bottom-up, doubling size each pass
    size = RUN
    while size < n:
        for left in range(0, n, 2 * size):
            mid = min(left + size - 1, n - 1)
            right = min(left + 2 * size - 1, n - 1)
            # Only merge if there is a right partition
            if mid < right:
                merge(arr, left, mid, right)
        size *= 2  # double the merge window

# Demo
arr = [64, 34, 25, 12, 22, 11, 90, 42, 5, 77]
print("Before:", arr)
tim_sort(arr)
print("After: ", arr)

# Time: O(n log n)  Space: O(n)  Stable: YES`,

    java: `import java.util.Arrays;

public class TimSort {
    // Size of each small "run" to insertion-sort
    static final int RUN = 32;

    // Insertion sort a subarray arr[left..right] in place
    static void insertionSort(int[] arr, int left, int right) {
        for (int i = left + 1; i <= right; i++) {
            int temp = arr[i]; // element to place
            int j = i - 1;
            // Shift elements right until correct position found
            while (j >= left && arr[j] > temp) {
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = temp; // insert element in correct spot
        }
    }

    // Merge two sorted subarrays arr[left..mid] and arr[mid+1..right]
    static void merge(int[] arr, int left, int mid, int right) {
        int len1 = mid - left + 1;
        int len2 = right - mid;
        int[] leftArr = Arrays.copyOfRange(arr, left, mid + 1);   // copy left half
        int[] rightArr = Arrays.copyOfRange(arr, mid + 1, right + 1); // copy right half
        int i = 0, j = 0, k = left;
        // Merge by picking the smaller front element each time
        while (i < len1 && j < len2) {
            if (leftArr[i] <= rightArr[j]) { // <= keeps sort stable
                arr[k++] = leftArr[i++];
            } else {
                arr[k++] = rightArr[j++];
            }
        }
        // Drain any remaining elements from either half
        while (i < len1) arr[k++] = leftArr[i++];
        while (j < len2) arr[k++] = rightArr[j++];
    }

    // Main Tim Sort function
    static void timSort(int[] arr) {
        int n = arr.length;
        // Step 1: sort individual runs of size RUN with insertion sort
        for (int i = 0; i < n; i += RUN) {
            insertionSort(arr, i, Math.min(i + RUN - 1, n - 1));
        }
        // Step 2: merge runs bottom-up, doubling size each pass
        for (int size = RUN; size < n; size *= 2) {
            for (int left = 0; left < n; left += 2 * size) {
                int mid = Math.min(left + size - 1, n - 1);
                int right = Math.min(left + 2 * size - 1, n - 1);
                // Only merge if there is a right partition
                if (mid < right) {
                    merge(arr, left, mid, right);
                }
            }
        }
    }

    // Demo
    public static void main(String[] args) {
        int[] arr = {64, 34, 25, 12, 22, 11, 90, 42, 5, 77};
        System.out.println("Before: " + Arrays.toString(arr));
        timSort(arr);
        System.out.println("After:  " + Arrays.toString(arr));
    }
}

// Time: O(n log n)  Space: O(n)  Stable: YES`,

    c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Size of each small "run" to insertion-sort
#define RUN 32

// Insertion sort a subarray arr[left..right] in place
void insertionSort(int arr[], int left, int right) {
    for (int i = left + 1; i <= right; i++) {
        int temp = arr[i]; // element to place
        int j = i - 1;
        // Shift elements right until correct position found
        while (j >= left && arr[j] > temp) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = temp; // insert element in correct spot
    }
}

// Merge two sorted subarrays arr[left..mid] and arr[mid+1..right]
void merge(int arr[], int left, int mid, int right) {
    int len1 = mid - left + 1;
    int len2 = right - mid;
    int *leftArr = (int *)malloc(len1 * sizeof(int));  // copy left half
    int *rightArr = (int *)malloc(len2 * sizeof(int)); // copy right half
    memcpy(leftArr, arr + left, len1 * sizeof(int));
    memcpy(rightArr, arr + mid + 1, len2 * sizeof(int));
    int i = 0, j = 0, k = left;
    // Merge by picking the smaller front element each time
    while (i < len1 && j < len2) {
        if (leftArr[i] <= rightArr[j]) { // <= keeps sort stable
            arr[k++] = leftArr[i++];
        } else {
            arr[k++] = rightArr[j++];
        }
    }
    // Drain any remaining elements from either half
    while (i < len1) arr[k++] = leftArr[i++];
    while (j < len2) arr[k++] = rightArr[j++];
    free(leftArr);
    free(rightArr); // free temporary buffers
}

// Main Tim Sort function
void timSort(int arr[], int n) {
    // Step 1: sort individual runs of size RUN with insertion sort
    for (int i = 0; i < n; i += RUN) {
        int right = i + RUN - 1 < n - 1 ? i + RUN - 1 : n - 1;
        insertionSort(arr, i, right);
    }
    // Step 2: merge runs bottom-up, doubling size each pass
    for (int size = RUN; size < n; size *= 2) {
        for (int left = 0; left < n; left += 2 * size) {
            int mid = left + size - 1 < n - 1 ? left + size - 1 : n - 1;
            int right = left + 2 * size - 1 < n - 1 ? left + 2 * size - 1 : n - 1;
            // Only merge if there is a right partition
            if (mid < right) {
                merge(arr, left, mid, right);
            }
        }
    }
}

// Demo
int main() {
    int arr[] = {64, 34, 25, 12, 22, 11, 90, 42, 5, 77};
    int n = sizeof(arr) / sizeof(arr[0]);
    printf("Before:");
    for (int i = 0; i < n; i++) printf(" %d", arr[i]);
    printf("\n");
    timSort(arr, n);
    printf("After: ");
    for (int i = 0; i < n; i++) printf(" %d", arr[i]);
    printf("\n");
    return 0;
}

// Time: O(n log n)  Space: O(n)  Stable: YES`,

    cpp: `#include <iostream>
#include <vector>
#include <algorithm>

// Size of each small "run" to insertion-sort
const int RUN = 32;

// Insertion sort a subarray arr[left..right] in place
void insertionSort(std::vector<int>& arr, int left, int right) {
    for (int i = left + 1; i <= right; i++) {
        int temp = arr[i]; // element to place
        int j = i - 1;
        // Shift elements right until correct position found
        while (j >= left && arr[j] > temp) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = temp; // insert element in correct spot
    }
}

// Merge two sorted subarrays arr[left..mid] and arr[mid+1..right]
void merge(std::vector<int>& arr, int left, int mid, int right) {
    std::vector<int> leftArr(arr.begin() + left, arr.begin() + mid + 1);   // copy left half
    std::vector<int> rightArr(arr.begin() + mid + 1, arr.begin() + right + 1); // copy right half
    int i = 0, j = 0, k = left;
    // Merge by picking the smaller front element each time
    while (i < (int)leftArr.size() && j < (int)rightArr.size()) {
        if (leftArr[i] <= rightArr[j]) { // <= keeps sort stable
            arr[k++] = leftArr[i++];
        } else {
            arr[k++] = rightArr[j++];
        }
    }
    // Drain any remaining elements from either half
    while (i < (int)leftArr.size()) arr[k++] = leftArr[i++];
    while (j < (int)rightArr.size()) arr[k++] = rightArr[j++];
}

// Main Tim Sort function
void timSort(std::vector<int>& arr) {
    int n = arr.size();
    // Step 1: sort individual runs of size RUN with insertion sort
    for (int i = 0; i < n; i += RUN) {
        insertionSort(arr, i, std::min(i + RUN - 1, n - 1));
    }
    // Step 2: merge runs bottom-up, doubling size each pass
    for (int size = RUN; size < n; size *= 2) {
        for (int left = 0; left < n; left += 2 * size) {
            int mid = std::min(left + size - 1, n - 1);
            int right = std::min(left + 2 * size - 1, n - 1);
            // Only merge if there is a right partition
            if (mid < right) {
                merge(arr, left, mid, right);
            }
        }
    }
}

// Demo
int main() {
    std::vector<int> arr = {64, 34, 25, 12, 22, 11, 90, 42, 5, 77};
    std::cout << "Before:";
    for (int x : arr) std::cout << " " << x;
    std::cout << std::endl;
    timSort(arr);
    std::cout << "After: ";
    for (int x : arr) std::cout << " " << x;
    std::cout << std::endl;
    return 0;
}

// Time: O(n log n)  Space: O(n)  Stable: YES`,

    rust: `// Tim Sort: hybrid of insertion sort + merge sort
const RUN: usize = 32; // size of each small "run" to insertion-sort

// Insertion sort a subarray arr[left..=right] in place
fn insertion_sort(arr: &mut Vec<i32>, left: usize, right: usize) {
    for i in (left + 1)..=right {
        let temp = arr[i]; // element to place
        let mut j = i;
        // Shift elements right until correct position found
        while j > left && arr[j - 1] > temp {
            arr[j] = arr[j - 1];
            j -= 1;
        }
        arr[j] = temp; // insert element in correct spot
    }
}

// Merge two sorted subarrays arr[left..=mid] and arr[mid+1..=right]
fn merge(arr: &mut Vec<i32>, left: usize, mid: usize, right: usize) {
    let left_arr: Vec<i32> = arr[left..=mid].to_vec();   // copy left half
    let right_arr: Vec<i32> = arr[mid + 1..=right].to_vec(); // copy right half
    let (mut i, mut j, mut k) = (0, 0, left);
    // Merge by picking the smaller front element each time
    while i < left_arr.len() && j < right_arr.len() {
        if left_arr[i] <= right_arr[j] { // <= keeps sort stable
            arr[k] = left_arr[i];
            i += 1;
        } else {
            arr[k] = right_arr[j];
            j += 1;
        }
        k += 1;
    }
    // Drain any remaining elements from either half
    while i < left_arr.len() { arr[k] = left_arr[i]; i += 1; k += 1; }
    while j < right_arr.len() { arr[k] = right_arr[j]; j += 1; k += 1; }
}

// Main Tim Sort function
fn tim_sort(arr: &mut Vec<i32>) {
    let n = arr.len();
    // Step 1: sort individual runs of size RUN with insertion sort
    let mut i = 0;
    while i < n {
        let right = std::cmp::min(i + RUN - 1, n - 1);
        insertion_sort(arr, i, right);
        i += RUN;
    }
    // Step 2: merge runs bottom-up, doubling size each pass
    let mut size = RUN;
    while size < n {
        let mut left = 0;
        while left < n {
            let mid = std::cmp::min(left + size - 1, n - 1);
            let right = std::cmp::min(left + 2 * size - 1, n - 1);
            // Only merge if there is a right partition
            if mid < right {
                merge(arr, left, mid, right);
            }
            left += 2 * size;
        }
        size *= 2; // double the merge window
    }
}

// Demo
fn main() {
    let mut arr = vec![64, 34, 25, 12, 22, 11, 90, 42, 5, 77];
    println!("Before: {:?}", arr);
    tim_sort(&mut arr);
    println!("After:  {:?}", arr);
}

// Time: O(n log n)  Space: O(n)  Stable: YES`,

    go: `package main

import "fmt"

// Size of each small "run" to insertion-sort
const RUN = 32

// insertionSort sorts a subarray arr[left..right] in place
func insertionSort(arr []int, left, right int) {
	for i := left + 1; i <= right; i++ {
		temp := arr[i] // element to place
		j := i - 1
		// Shift elements right until correct position found
		for j >= left && arr[j] > temp {
			arr[j+1] = arr[j]
			j--
		}
		arr[j+1] = temp // insert element in correct spot
	}
}

// merge combines two sorted subarrays arr[left..mid] and arr[mid+1..right]
func merge(arr []int, left, mid, right int) {
	leftArr := make([]int, mid-left+1)
	rightArr := make([]int, right-mid)
	copy(leftArr, arr[left:mid+1])      // copy left half
	copy(rightArr, arr[mid+1:right+1])  // copy right half
	i, j, k := 0, 0, left
	// Merge by picking the smaller front element each time
	for i < len(leftArr) && j < len(rightArr) {
		if leftArr[i] <= rightArr[j] { // <= keeps sort stable
			arr[k] = leftArr[i]
			i++
		} else {
			arr[k] = rightArr[j]
			j++
		}
		k++
	}
	// Drain any remaining elements from either half
	for i < len(leftArr) { arr[k] = leftArr[i]; i++; k++ }
	for j < len(rightArr) { arr[k] = rightArr[j]; j++; k++ }
}

// timSort is the main Tim Sort function
func timSort(arr []int) {
	n := len(arr)
	// Step 1: sort individual runs of size RUN with insertion sort
	for i := 0; i < n; i += RUN {
		right := i + RUN - 1
		if right > n-1 {
			right = n - 1
		}
		insertionSort(arr, i, right)
	}
	// Step 2: merge runs bottom-up, doubling size each pass
	for size := RUN; size < n; size *= 2 {
		for left := 0; left < n; left += 2 * size {
			mid := left + size - 1
			if mid > n-1 { mid = n - 1 }
			right := left + 2*size - 1
			if right > n-1 { right = n - 1 }
			// Only merge if there is a right partition
			if mid < right {
				merge(arr, left, mid, right)
			}
		}
	}
}

// Demo
func main() {
	arr := []int{64, 34, 25, 12, 22, 11, 90, 42, 5, 77}
	fmt.Println("Before:", arr)
	timSort(arr)
	fmt.Println("After: ", arr)
}

// Time: O(n log n)  Space: O(n)  Stable: YES`,

  },

  // ── LOGOS SORT (ULTRA) ─────────────────────────────────────────────────────
  logos: {

    typescript: `// ═══════════════════════════════════════════════════════════════════
// LOGOS SORT — λόγος: the reason that orders the cosmos.
//
// Nine gifts, given only when the moment calls:
//   (1) tally before you touch    — count, do not compare, when the range permits
//   (2) read before you act       — already in order? already reversed? then rest
//   (3) cut at the golden section — the ratio no adversary can predict
//   (4) hear three voices         — one witness lies; the middle of three is truth
//   (5) roll the die each level   — randomness closes every door that pattern opens
//   (6) divide into three bands   — less · between · greater, each named in one pass
//   (7) spend the least first     — recurse the small; the large carries itself
//   (8) know when to yield        — depth gone? grace has limits; pass the torch
//   (9) walk the small ones home  — under 48, patience outruns cleverness
// ═══════════════════════════════════════════════════════════════════

// φ⁻¹ and φ⁻² — the most irrational of numbers. No simple fraction
// can name them, so pivot positions born of them elude every adversary
// who would arrange the data against us.
const PHI  = 0.6180339887498949; // the most irrational of numbers
const PHI2 = 0.3819660112501051; // its lesser twin

function logosSort(arr: number[]): number[] {

  // One element needs no ordering. We begin with a copy — one copy — the caller's order untouched.
  const n = arr.length;
  if (n < 2) return arr.slice(); // one copy — the caller's order untouched
  const a = arr.slice();

  // patience, not infinite — two doublings of log₂(n) is generous credit.
  const depthLimit = 2 * Math.floor(Math.log2(n)) + 4; // patience, not infinite

  // Three candidates enter. They are sorted in three swaps.
  // The middle one alone carries the truth of the trio.
  function median3(x: number, y: number, z: number): number {
    if (x > y) { const t = x; x = y; y = t; }
    if (y > z) { const t = y; y = z; z = t; }
    if (x > y) { const t = x; x = y; y = t; }
    return y;
  }

  // A single voice can be swayed. Consult the neighbors —
  // the outlier is overruled; the center of three is closer to the truth.
  function ninther(lo: number, hi: number, idx: number): number {
    return median3(a[Math.max(lo, idx-1)], a[idx], a[Math.min(hi, idx+1)]);
  }

  // Two thresholds cleave the world into three.
  // Three pointers meet in the middle — when the frontier passes the far wall,
  // every element has been named and placed. The middle band rests forever.
  function dualPartition(lo: number, hi: number, p1: number, p2: number): [number, number] {
    if (p1 > p2) { const t = p1; p1 = p2; p2 = t; }
    let lt = lo, gt = hi, i = lo;
    while (i <= gt) {
      if      (a[i] < p1) { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
      else if (a[i] > p2) { [a[i], a[gt]] = [a[gt], a[i]]; gt--; }
      else                 { i++; }
    }
    return [lt, gt];
  }

  // The great descent — a loop where the tail recurses on the largest piece for free.
  // No stack frame spent on what the natural continuation already carries.
  function sort(lo: number, hi: number, depth: number): void {
    while (lo < hi) {
      const size = hi - lo + 1;

      // Wisdom knows its limits. The pivots have failed here —
      // a steadier hand takes the rest without shame.
      if (depth <= 0) {
        const sub = a.slice(lo, hi+1).sort((x, y) => x - y);
        for (let k = lo; k <= hi; k++) a[k] = sub[k - lo];
        return;
      }

      // A hundred miles begins with a single step.
      // Under 48 elements patience walks each one leftward to its home.
      if (size <= 48) {
        for (let i = lo+1; i <= hi; i++) {
          const key = a[i]; let j = i-1;
          while (j >= lo && a[j] > key) { a[j+1] = a[j]; j--; }
          a[j+1] = key;
        }
        return;
      }

      // Before the first comparison — ask if comparison is even needed.
      // When the range is narrow, tally occurrences and rebuild.
      // No pivots. No recursion. No comparisons at all.
      let mn = a[lo], mx = a[lo];
      for (let k = lo+1; k <= hi; k++) { if (a[k]<mn) mn=a[k]; if (a[k]>mx) mx=a[k]; }
      const span = mx - mn;
      if (Number.isInteger(mn) && span < size * 4) {
        const counts = new Array(span+1).fill(0);
        for (let k = lo; k <= hi; k++) counts[a[k]-mn]++;
        let k = lo;
        for (let v = 0; v <= span; v++) { while (counts[v]-- > 0) a[k++] = v + mn; }
        return;
      }

      // Read what is already written. Three ascending — check the whole.
      // Already ordered: a quiet return. Already reversed: one clean O(n) flip.
      // Either way, not a breath of depth budget spent.
      if (a[lo] <= a[lo+1] && a[lo+1] <= a[lo+2]) {
        let sorted = true;
        for (let k = lo; k < hi; k++) { if (a[k] > a[k+1]) { sorted = false; break; } }
        if (sorted) return;
        let reversed = true;
        for (let k = lo; k < hi; k++) { if (a[k] < a[k+1]) { reversed = false; break; } }
        if (reversed) {
          for (let l = lo, r = hi; l < r; l++, r--) { [a[l], a[r]] = [a[r], a[l]]; }
          return;
        }
      }

      // Fixed patterns breed fixed weaknesses. We dissolve them:
      // each level draws a fresh number and no adversary can predict the cut.
      let c = 0;
      while (c === 0) c = Math.random() * 2 - 1;
      const chaos = Math.abs(c); // the die is cast

      // The golden cut, scaled by chaos so the exact position shifts each call.
      // Then smoothed through three neighbors — no single outlier corrupts the pivot.
      const range = hi - lo;
      const idx1 = lo + Math.min(range, Math.floor(range * PHI2 * chaos)); // the golden cut
      const idx2 = lo + Math.min(range, Math.floor(range * PHI  * chaos));
      const p1 = ninther(lo, hi, idx1); // three voices, one truth
      const p2 = ninther(lo, hi, idx2);

      // The great division — less, between, greater, named in one sweep.
      // Like a sculptor removing what does not belong: the form was always there.
      const [lt, gt] = dualPartition(lo, hi, p1, p2);

      // The small pieces earn genuine calls.
      // The largest piece becomes the loop — it costs no stack and asks no return.
      const regions: [number, number, number][] = [
        [lt - lo,     lo,    lt - 1],
        [gt - lt + 1, lt,    gt    ],
        [hi - gt,     gt+1,  hi    ],
      ];
      regions.sort((x, y) => x[0] - y[0]); // the small earn calls; the large becomes the loop
      if (regions[0][1] < regions[0][2]) sort(regions[0][1], regions[0][2], depth-1);
      if (regions[1][1] < regions[1][2]) sort(regions[1][1], regions[1][2], depth-1);
      lo = regions[2][1]; hi = regions[2][2]; depth--;
    }
  }

  sort(0, n-1, depthLimit);
  return a;
}
// n log n time · log n space · unstable · pure

// ── demo ──
const data = [64, 34, 25, 12, 22, 11, 90, 42, 5, 77];
console.log("Before:", [...data]);
console.log("After: ", logosSort(data));
// Run: npx ts-node solution.ts`,

    javascript: `// Logos Sort — λόγος: the reason that orders the cosmos
const PHI  = 0.6180339887498949; // the most irrational of numbers
const PHI2 = 0.3819660112501051; // its lesser twin

function logosSort(arr) {
  const n = arr.length;
  if (n < 2) return arr.slice(); // one copy — the caller's order untouched
  const a = arr.slice();
  const depthLimit = 2 * Math.floor(Math.log2(n)) + 4; // patience, not infinite

  function median3(x, y, z) {
    if (x>y){const t=x;x=y;y=t;} if(y>z){const t=y;y=z;z=t;} if(x>y){const t=x;x=y;y=t;}
    return y;
  }
  function ninther(lo, hi, idx) {
    return median3(a[Math.max(lo,idx-1)], a[idx], a[Math.min(hi,idx+1)]);
  }
  function dualPartition(lo, hi, p1, p2) {
    if (p1>p2){const t=p1;p1=p2;p2=t;}
    let lt=lo, gt=hi, i=lo;
    while (i<=gt) {
      if      (a[i]<p1){[a[lt],a[i]]=[a[i],a[lt]];lt++;i++;}
      else if (a[i]>p2){[a[i],a[gt]]=[a[gt],a[i]];gt--;}
      else               {i++;}
    }
    return [lt, gt];
  }

  function sort(lo, hi, depth) {
    while (lo < hi) {
      const size = hi - lo + 1;
      if (depth<=0) {                                              // wisdom yields
        const sub=a.slice(lo,hi+1).sort((x,y)=>x-y);
        for (let k=lo;k<=hi;k++) a[k]=sub[k-lo]; return;
      }
      if (size<=48) {                                             // patience walks the small ones home
        for (let i=lo+1;i<=hi;i++){const key=a[i];let j=i-1;while(j>=lo&&a[j]>key){a[j+1]=a[j];j--;}a[j+1]=key;}
        return;
      }
      let mn=a[lo],mx=a[lo];                                     // tally, do not compare
      for (let k=lo+1;k<=hi;k++){if(a[k]<mn)mn=a[k];if(a[k]>mx)mx=a[k];}
      const span=mx-mn;
      if (Number.isInteger(mn)&&span<size*4) {
        const counts=new Array(span+1).fill(0);
        for (let k=lo;k<=hi;k++) counts[a[k]-mn]++;
        let k=lo; for(let v=0;v<=span;v++){while(counts[v]-->0)a[k++]=v+mn;} return;
      }
      if (a[lo]<=a[lo+1]&&a[lo+1]<=a[lo+2]) {                   // read what is already written
        let ok=true; for(let k=lo;k<hi;k++){if(a[k]>a[k+1]){ok=false;break;}}
        if (ok) return;
        let rev=true; for(let k=lo;k<hi;k++){if(a[k]<a[k+1]){rev=false;break;}}
        if (rev){for(let l=lo,r=hi;l<r;l++,r--){[a[l],a[r]]=[a[r],a[l]];}return;}
      }
      let c=0; while(c===0) c=Math.random()*2-1;                // the die is cast
      const chaos=Math.abs(c), range=hi-lo;
      const idx1=lo+Math.min(range,Math.floor(range*PHI2*chaos)); // the golden cut
      const idx2=lo+Math.min(range,Math.floor(range*PHI *chaos));
      const p1=ninther(lo,hi,idx1), p2=ninther(lo,hi,idx2);     // three voices, one truth
      const [lt,gt]=dualPartition(lo,hi,p1,p2);                 // the great division
      const regions=[                                             // the small earn calls; the large becomes the loop
        [lt-lo,lo,lt-1],[gt-lt+1,lt,gt],[hi-gt,gt+1,hi]
      ].sort((x,y)=>x[0]-y[0]);
      if(regions[0][1]<regions[0][2]) sort(regions[0][1],regions[0][2],depth-1);
      if(regions[1][1]<regions[1][2]) sort(regions[1][1],regions[1][2],depth-1);
      lo=regions[2][1]; hi=regions[2][2]; depth--;
    }
  }
  sort(0, n-1, depthLimit);
  return a;
}
// n log n time · log n space · unstable

// ── demo ──
const data = [64, 34, 25, 12, 22, 11, 90, 42, 5, 77];
console.log("Before:", [...data]);
console.log("After: ", logosSort(data));
// Run: node solution.js`,

    python: `import random
import math

# φ constants — the most irrational of numbers, fixed-point for exact positioning
PHI_SHIFT = 61
PHI_NUM   = round(0.6180339887498949 * (1 << PHI_SHIFT))  # the most irrational of numbers
PHI2_NUM  = round(0.3819660112501051 * (1 << PHI_SHIFT))  # its lesser twin


def logos_ultra_sort(arr):
    import math as _math

    n = len(arr)
    if n < 2:
        return arr[:]  # one copy — the caller's order untouched

    depth_limit = 2 * int(_math.log2(n)) + 4  # patience, not infinite

    def _ninther(a, lo, hi, idx):
        i0, i2 = max(lo, idx - 1), min(hi, idx + 1)
        x, y, z = a[i0], a[idx], a[i2]
        if x > y: x, y = y, x
        if y > z: y, z = z, y
        if x > y: x, y = y, x
        return y  # three voices, one truth

    def _dual_partition(a, lo, hi, p1, p2):
        if p1 > p2:
            p1, p2 = p2, p1
        lt, gt, i = lo, hi, lo
        while i <= gt:
            v = a[i]
            if v < p1:
                a[lt], a[i] = a[i], a[lt]
                lt += 1; i += 1
            elif v > p2:
                a[i], a[gt] = a[gt], a[i]
                gt -= 1
            else:
                i += 1
        return lt, gt

    def _sort(a, lo, hi, depth):
        while lo < hi:
            size = hi - lo + 1

            if depth <= 0:                          # wisdom yields
                a[lo:hi + 1] = sorted(a[lo:hi + 1])
                return

            if size <= 48:                          # patience walks the small ones home
                a[lo:hi + 1] = sorted(a[lo:hi + 1])
                break

            if isinstance(a[lo], int):              # tally, do not compare
                mn = min(a[lo:hi + 1])
                mx = max(a[lo:hi + 1])
                span = mx - mn
                if span < size * 4:
                    counts = [0] * (span + 1)
                    for i in range(lo, hi + 1):
                        counts[a[i] - mn] += 1
                    k = lo
                    for v, cnt in enumerate(counts):
                        if cnt:
                            a[k:k + cnt] = [v + mn] * cnt
                            k += cnt
                    break

            if a[lo] <= a[lo+1] <= a[lo+2]:        # read what is already written
                if all(a[i] <= a[i+1] for i in range(lo, hi)):
                    break
                if all(a[i] >= a[i+1] for i in range(lo, hi)):
                    a[lo:hi+1] = a[lo:hi+1][::-1]
                    break

            c = 0.0
            while c == 0.0:
                c = random.uniform(-1.0, 1.0)
            chaos_int = int(abs(c) * (1 << 53))    # the die is cast

            pn1 = PHI2_NUM * chaos_int              # the golden cut
            pn2 = PHI_NUM  * chaos_int
            ps  = PHI_SHIFT + 53
            span = hi - lo
            idx1 = lo + (span * pn1 >> ps)
            idx2 = lo + (span * pn2 >> ps)

            p1 = _ninther(a, lo, hi, idx1)          # three voices, one truth
            p2 = _ninther(a, lo, hi, idx2)

            lt, gt = _dual_partition(a, lo, hi, p1, p2)  # the great division

            left_n  = lt - lo
            mid_n   = gt - lt + 1
            right_n = hi - gt

            regions = sorted(                       # the small earn calls; the large becomes the loop
                [(left_n, lo, lt-1), (mid_n, lt, gt), (right_n, gt+1, hi)],
                key=lambda r: r[0]
            )
            for _, r_lo, r_hi in regions[:2]:
                if r_lo < r_hi:
                    _sort(a, r_lo, r_hi, depth - 1)
            lo, hi = regions[2][1], regions[2][2]
            depth -= 1

    a = arr[:]
    _sort(a, 0, n - 1, depth_limit)
    return a
# n log n time · log n space · unstable

# ── demo ──
data = [64, 34, 25, 12, 22, 11, 90, 42, 5, 77]
print("Before:", data[:])
print("After: ", logos_ultra_sort(data))
# Run: python solution.py`,

    java: `import java.util.*;

// Logos Sort — λόγος: the reason that orders the cosmos
public class Solution {
    private static final double PHI  = 0.6180339887498949; // the most irrational of numbers
    private static final double PHI2 = 0.3819660112501051; // its lesser twin
    private static final int    BASE = 48;
    private static final Random RNG  = new Random();

    public static int[] logosSort(int[] input) {
        int[] a = Arrays.copyOf(input, input.length);
        if (a.length < 2) return a;
        int depth = 2 * (int)(Math.log(a.length) / Math.log(2)) + 4; // patience, not infinite
        sort(a, 0, a.length - 1, depth);
        return a;
    }

    private static int median3(int x, int y, int z) {
        if (x>y){int t=x;x=y;y=t;} if(y>z){int t=y;y=z;z=t;} if(x>y){int t=x;x=y;y=t;}
        return y;
    }
    private static int ninther(int[] a, int lo, int hi, int idx) {
        return median3(a[Math.max(lo,idx-1)], a[idx], a[Math.min(hi,idx+1)]);
    }
    private static int[] dualPartition(int[] a, int lo, int hi, int p1, int p2) {
        if (p1>p2){int t=p1;p1=p2;p2=t;}
        int lt=lo, gt=hi, i=lo;
        while (i<=gt) {
            if      (a[i]<p1){int t=a[lt];a[lt++]=a[i];a[i++]=t;}
            else if (a[i]>p2){int t=a[i];a[i]=a[gt];a[gt--]=t;}
            else               {i++;}
        }
        return new int[]{lt, gt};
    }
    private static void ins(int[] a, int lo, int hi) {
        for (int i=lo+1;i<=hi;i++){int key=a[i],j=i-1;while(j>=lo&&a[j]>key)a[j+1]=a[j--];a[j+1]=key;}
    }

    private static void sort(int[] a, int lo, int hi, int depth) {
        while (lo < hi) {
            int size = hi - lo + 1;
            if (depth<=0){Arrays.sort(a,lo,hi+1);return;}          // wisdom yields
            if (size<=BASE){ins(a,lo,hi);return;}                    // patience walks the small ones home
            int mn=a[lo],mx=a[lo];
            for(int k=lo+1;k<=hi;k++){if(a[k]<mn)mn=a[k];if(a[k]>mx)mx=a[k];}
            int span=mx-mn;
            if((long)span<(long)size*4){                             // tally, do not compare
                int[] c=new int[span+1];
                for(int k=lo;k<=hi;k++)c[a[k]-mn]++;
                int k=lo;for(int v=0;v<=span;v++)while(c[v]-->0)a[k++]=v+mn;
                return;
            }
            if(a[lo]<=a[lo+1]&&a[lo+1]<=a[lo+2]){                  // read what is already written
                boolean ok=true;for(int k=lo;k<hi;k++)if(a[k]>a[k+1]){ok=false;break;}
                if(ok)return;
                boolean rev=true;for(int k=lo;k<hi;k++)if(a[k]<a[k+1]){rev=false;break;}
                if(rev){for(int l=lo,r=hi;l<r;l++,r--){int t=a[l];a[l]=a[r];a[r]=t;}return;}
            }
            double ch=0;while(ch==0)ch=Math.abs(RNG.nextDouble()*2-1); // the die is cast
            int range=hi-lo;
            int idx1=lo+(int)Math.min(range,range*PHI2*ch);           // the golden cut
            int idx2=lo+(int)Math.min(range,range*PHI *ch);
            int p1=ninther(a,lo,hi,idx1),p2=ninther(a,lo,hi,idx2);   // three voices, one truth
            int[] b=dualPartition(a,lo,hi,p1,p2);                     // the great division
            int lt=b[0],gt=b[1];
            int[][] regions={{lt-lo,lo,lt-1},{gt-lt+1,lt,gt},{hi-gt,gt+1,hi}};
            Arrays.sort(regions,(x,y)->x[0]-y[0]);                    // the small earn calls; the large becomes the loop
            if(regions[0][1]<regions[0][2])sort(a,regions[0][1],regions[0][2],depth-1);
            if(regions[1][1]<regions[1][2])sort(a,regions[1][1],regions[1][2],depth-1);
            lo=regions[2][1];hi=regions[2][2];depth--;
        }
    }

    public static void main(String[] args) {
        int[] data={64,34,25,12,22,11,90,42,5,77};
        System.out.println("Before: "+Arrays.toString(data));
        System.out.println("After:  "+Arrays.toString(logosSort(data)));
    }
}
// n log n time · log n space · unstable
// Run: javac Solution.java && java Solution`,

    c: `#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

/* Logos Sort — λόγος: the reason that orders the cosmos */
#define PHI  0.6180339887498949 /* the most irrational of numbers */
#define PHI2 0.3819660112501051 /* its lesser twin */
#define BASE 48

static int cmp_int(const void *x, const void *y){return *(int*)x-*(int*)y;}

static int median3(int x,int y,int z){
    if(x>y){int t=x;x=y;y=t;} if(y>z){int t=y;y=z;z=t;} if(x>y){int t=x;x=y;y=t;}
    return y;
}
static int ninther(int *a,int lo,int hi,int idx){
    int i0=idx-1>lo?idx-1:lo, i2=idx+1<hi?idx+1:hi;
    return median3(a[i0],a[idx],a[i2]);
}
static void sw(int *a,int i,int j){int t=a[i];a[i]=a[j];a[j]=t;}
static void ins(int *a,int lo,int hi){
    for(int i=lo+1;i<=hi;i++){int key=a[i],j=i-1;while(j>=lo&&a[j]>key)a[j+1]=a[j--];a[j+1]=key;}
}

static void logos_rec(int *a,int lo,int hi,int depth){
    while(lo<hi){
        int size=hi-lo+1;
        if(depth<=0){qsort(a+lo,size,sizeof(int),cmp_int);return;} /* wisdom yields */
        if(size<=BASE){ins(a,lo,hi);return;}                          /* patience walks the small ones home */
        int mn=a[lo],mx=a[lo];
        for(int k=lo+1;k<=hi;k++){if(a[k]<mn)mn=a[k];if(a[k]>mx)mx=a[k];}
        int span=mx-mn;
        if((long long)span<(long long)size*4){                        /* tally, do not compare */
            int *c=(int*)calloc(span+1,sizeof(int));
            for(int k=lo;k<=hi;k++)c[a[k]-mn]++;
            int k=lo;for(int v=0;v<=span;v++)while(c[v]-->0)a[k++]=v+mn;
            free(c);return;
        }
        if(a[lo]<=a[lo+1]&&a[lo+1]<=a[lo+2]){                       /* read what is already written */
            int ok=1;for(int k=lo;k<hi;k++)if(a[k]>a[k+1]){ok=0;break;}
            if(ok)return;
            int rev=1;for(int k=lo;k<hi;k++)if(a[k]<a[k+1]){rev=0;break;}
            if(rev){for(int l=lo,r=hi;l<r;l++,r--)sw(a,l,r);return;}
        }
        double ch=(double)rand()/RAND_MAX; if(ch==0.0)ch=0.5;        /* the die is cast */
        int range=hi-lo;
        int idx1=lo+(int)(range*PHI2*ch); if(idx1>hi)idx1=hi;        /* the golden cut */
        int idx2=lo+(int)(range*PHI *ch); if(idx2>hi)idx2=hi;
        int p1=ninther(a,lo,hi,idx1),p2=ninther(a,lo,hi,idx2);       /* three voices, one truth */
        if(p1>p2){int t=p1;p1=p2;p2=t;}
        int lt=lo,gt=hi,i=lo;                                         /* the great division */
        while(i<=gt){
            if(a[i]<p1)sw(a,lt++,i++); else if(a[i]>p2)sw(a,i,gt--); else i++;
        }
        /* the small earn calls; the large becomes the loop */
        int sz[3]={lt-lo,gt-lt+1,hi-gt};
        int rlo[3]={lo,lt,gt+1},rhi[3]={lt-1,gt,hi};
        for(int x=0;x<2;x++)for(int y=0;y<2;y++)if(sz[y]>sz[y+1]){
            int ts=sz[y];sz[y]=sz[y+1];sz[y+1]=ts;
            int tl=rlo[y];rlo[y]=rlo[y+1];rlo[y+1]=tl;
            int th=rhi[y];rhi[y]=rhi[y+1];rhi[y+1]=th;
        }
        if(rlo[0]<rhi[0])logos_rec(a,rlo[0],rhi[0],depth-1);
        if(rlo[1]<rhi[1])logos_rec(a,rlo[1],rhi[1],depth-1);
        lo=rlo[2];hi=rhi[2];depth--;
    }
}

void logos_ultra_sort(int *arr,int n){
    if(n<2)return;
    srand((unsigned)time(NULL));
    logos_rec(arr,0,n-1,(int)(2*log2(n))+4);
}

int main(void){
    int data[]={64,34,25,12,22,11,90,42,5,77};
    int n=sizeof(data)/sizeof(data[0]);
    printf("Before:"); for(int i=0;i<n;i++)printf(" %d",data[i]);
    logos_ultra_sort(data,n);
    printf("\nAfter: "); for(int i=0;i<n;i++)printf(" %d",data[i]);
    printf("\n"); return 0;
}
/* n log n time · log n space · unstable */
/* Run: gcc -O2 -lm -o solution solution.c && ./solution */`,

    cpp: `#include <iostream>
#include <vector>
#include <algorithm>
#include <cmath>
#include <random>

// Logos Sort — λόγος: the reason that orders the cosmos
constexpr double PHI  = 0.6180339887498949; // the most irrational of numbers
constexpr double PHI2 = 0.3819660112501051; // its lesser twin
constexpr int    BASE = 48;

namespace {
std::mt19937_64 rng(std::random_device{}());
double chaos() {
    std::uniform_real_distribution<double> d(-1.0,1.0);
    double c=0.0; while(c==0.0) c=d(rng); return std::abs(c);
}
int median3(int x,int y,int z){
    if(x>y)std::swap(x,y); if(y>z)std::swap(y,z); if(x>y)std::swap(x,y); return y;
}
int ninther(std::vector<int>&a,int lo,int hi,int idx){
    return median3(a[std::max(lo,idx-1)],a[idx],a[std::min(hi,idx+1)]);
}
std::pair<int,int> dualPart(std::vector<int>&a,int lo,int hi,int p1,int p2){
    if(p1>p2)std::swap(p1,p2);
    int lt=lo,gt=hi,i=lo;
    while(i<=gt){
        if(a[i]<p1)std::swap(a[lt++],a[i++]);
        else if(a[i]>p2)std::swap(a[i],a[gt--]);
        else i++;
    }
    return {lt,gt};
}
void ins(std::vector<int>&a,int lo,int hi){
    for(int i=lo+1;i<=hi;i++){int key=a[i],j=i-1;while(j>=lo&&a[j]>key)a[j+1]=a[j--];a[j+1]=key;}
}
void sort_rec(std::vector<int>&a,int lo,int hi,int depth){
    while(lo<hi){
        int size=hi-lo+1;
        if(depth<=0){std::sort(a.begin()+lo,a.begin()+hi+1);return;}     // wisdom yields
        if(size<=BASE){ins(a,lo,hi);return;}                               // patience walks the small ones home
        auto [mn,mx]=std::minmax_element(a.begin()+lo,a.begin()+hi+1);
        int span=*mx-*mn;
        if((long long)span<(long long)size*4){                             // tally, do not compare
            std::vector<int>c(span+1,0);
            int base=*mn;
            for(int k=lo;k<=hi;k++)c[a[k]-base]++;
            int k=lo;for(int v=0;v<=span;v++)while(c[v]-->0)a[k++]=v+base;
            return;
        }
        if(a[lo]<=a[lo+1]&&a[lo+1]<=a[lo+2]){                            // read what is already written
            if(std::is_sorted(a.begin()+lo,a.begin()+hi+1))return;
            if(std::is_sorted(a.begin()+lo,a.begin()+hi+1,std::greater<int>())){
                std::reverse(a.begin()+lo,a.begin()+hi+1);return;
            }
        }
        double ch=chaos(); int range=hi-lo;                                // the die is cast
        int idx1=lo+(int)std::min((double)range,range*PHI2*ch);            // the golden cut
        int idx2=lo+(int)std::min((double)range,range*PHI *ch);
        int p1=ninther(a,lo,hi,idx1),p2=ninther(a,lo,hi,idx2);            // three voices, one truth
        auto[lt,gt]=dualPart(a,lo,hi,p1,p2);                              // the great division
        std::array<std::array<int,3>,3> regions{{{lt-lo,lo,lt-1},{gt-lt+1,lt,gt},{hi-gt,gt+1,hi}}};
        std::sort(regions.begin(),regions.end(),[](auto&x,auto&y){return x[0]<y[0];}); // the small earn calls; the large becomes the loop
        if(regions[0][1]<regions[0][2])sort_rec(a,regions[0][1],regions[0][2],depth-1);
        if(regions[1][1]<regions[1][2])sort_rec(a,regions[1][1],regions[1][2],depth-1);
        lo=regions[2][1];hi=regions[2][2];depth--;
    }
}
}

std::vector<int> logosSort(std::vector<int> arr){
    if((int)arr.size()<2)return arr;
    int depth=(int)(2*std::log2(arr.size()))+4;
    sort_rec(arr,0,(int)arr.size()-1,depth);
    return arr;
}

int main(){
    std::vector<int>data={64,34,25,12,22,11,90,42,5,77};
    std::cout<<"Before:"; for(int x:data)std::cout<<" "<<x;
    auto s=logosSort(data);
    std::cout<<"\nAfter: "; for(int x:s)std::cout<<" "<<x;
    std::cout<<"\n"; return 0;
}
// n log n time · log n space · unstable
// Run: g++ -std=c++20 -O2 -o solution solution.cpp && ./solution`,

    rust: `// Logos Sort — λόγος: the reason that orders the cosmos
const PHI:  f64 = 0.618_033_988_749_894_9; // the most irrational of numbers
const PHI2: f64 = 0.381_966_011_250_105_1; // its lesser twin
const BASE: usize = 48;

fn median3(x: i32, y: i32, z: i32) -> i32 {
    let mut a = [x, y, z];
    if a[0]>a[1]{a.swap(0,1);} if a[1]>a[2]{a.swap(1,2);} if a[0]>a[1]{a.swap(0,1);}
    a[1]
}
fn ninther(a: &[i32], lo: usize, hi: usize, idx: usize) -> i32 {
    let i0 = lo.max(idx.saturating_sub(1));
    let i2 = hi.min(idx + 1);
    median3(a[i0], a[idx], a[i2])
}
fn dual_partition(a: &mut [i32], lo: usize, hi: usize, mut p1: i32, mut p2: i32) -> (usize, usize) {
    if p1 > p2 { std::mem::swap(&mut p1, &mut p2); }
    let (mut lt, mut gt, mut i) = (lo, hi, lo);
    while i <= gt {
        if      a[i] < p1 { a.swap(lt, i); lt += 1; i += 1; }
        else if a[i] > p2 { a.swap(i, gt); if gt == 0 { break; } gt -= 1; }
        else               { i += 1; }
    }
    (lt, gt)
}
fn ins(a: &mut [i32], lo: usize, hi: usize) {
    for i in (lo + 1)..=hi {
        let key = a[i]; let mut j = i;
        while j > lo && a[j-1] > key { a[j] = a[j-1]; j -= 1; }
        a[j] = key;
    }
}
// each call draws a fresh number — no adversary can predict the cut
fn chaos_val() -> f64 {
    use std::sync::atomic::{AtomicU64, Ordering};
    static CTR: AtomicU64 = AtomicU64::new(0x9e3779b97f4a7c15);
    let s = CTR.fetch_add(0x6c62272e07bb0142, Ordering::Relaxed);
    let s = s ^ (s >> 30); let s = s.wrapping_mul(0xbf58476d1ce4e5b9);
    let s = s ^ (s >> 27); let s = s.wrapping_mul(0x94d049bb133111eb);
    let f = (s >> 11) as f64 / (1u64 << 53) as f64;
    if f == 0.0 { 0.5 } else { f }
}

fn logos_rec(a: &mut [i32], lo: usize, hi: usize, depth: i32) {
    let (mut lo, mut hi, mut depth) = (lo, hi, depth);
    while lo < hi {
        let size = hi - lo + 1;
        if depth <= 0 { a[lo..=hi].sort_unstable(); return; }         // wisdom yields
        if size <= BASE { ins(a, lo, hi); return; }                    // patience walks the small ones home
        let mn = *a[lo..=hi].iter().min().unwrap();
        let mx = *a[lo..=hi].iter().max().unwrap();
        let span = (mx - mn) as usize;
        if span < size * 4 {                                           // tally, do not compare
            let mut c = vec![0usize; span + 1];
            for k in lo..=hi { c[(a[k]-mn) as usize] += 1; }
            let mut k = lo;
            for v in 0..=span { while c[v]>0 { a[k]=(v as i32)+mn; k+=1; c[v]-=1; } }
            return;
        }
        if a[lo]<=a[lo+1] && a[lo+1]<=a[lo+2] {                      // read what is already written
            if a[lo..=hi].windows(2).all(|w|w[0]<=w[1]) { return; }
            if a[lo..=hi].windows(2).all(|w|w[0]>=w[1]) { a[lo..=hi].reverse(); return; }
        }
        let ch = chaos_val(); let range = hi - lo;                     // the die is cast
        let idx1 = lo + ((range as f64*PHI2*ch) as usize).min(range); // the golden cut
        let idx2 = lo + ((range as f64*PHI *ch) as usize).min(range);
        let p1 = ninther(a, lo, hi, idx1);                             // three voices, one truth
        let p2 = ninther(a, lo, hi, idx2);
        let (lt, gt) = dual_partition(a, lo, hi, p1, p2);             // the great division
        let mut regions = [                                             // the small earn calls; the large becomes the loop
            (lt.saturating_sub(lo), lo,   lt.saturating_sub(1)),
            (gt - lt + 1,           lt,   gt),
            (if hi>gt{hi-gt}else{0},gt+1, hi),
        ];
        regions.sort_unstable_by_key(|r| r.0);
        if regions[0].1 < regions[0].2 { logos_rec(a, regions[0].1, regions[0].2, depth-1); }
        if regions[1].1 < regions[1].2 { logos_rec(a, regions[1].1, regions[1].2, depth-1); }
        lo = regions[2].1; hi = regions[2].2; depth -= 1;
    }
}

pub fn logos_ultra_sort(arr: &mut Vec<i32>) {
    let n = arr.len();
    if n < 2 { return; }
    let depth = (2.0 * (n as f64).log2()) as i32 + 4;
    logos_rec(arr, 0, n - 1, depth);
}

fn main() {
    let mut data = vec![64, 34, 25, 12, 22, 11, 90, 42, 5, 77];
    println!("Before: {:?}", data);
    logos_ultra_sort(&mut data);
    println!("After:  {:?}", data);
}
// n log n time · log n space · unstable
// Run: rustc solution.rs && ./solution`,

    go: `package main

import (
	"fmt"
	"math"
	"math/rand"
	"sort"
)

// Logos Sort — λόγος: the reason that orders the cosmos
const (
	phi  = 0.6180339887498949 // the most irrational of numbers
	phi2 = 0.3819660112501051 // its lesser twin
	base = 48
)

func median3(x, y, z int) int {
	if x > y { x, y = y, x }
	if y > z { y, z = z, y }
	if x > y { x, y = y, x }
	return y
}
func ninther(a []int, lo, hi, idx int) int {
	i0, i2 := lo, hi
	if idx-1 >= lo { i0 = idx - 1 }
	if idx+1 <= hi { i2 = idx + 1 }
	return median3(a[i0], a[idx], a[i2])
}
func dualPartition(a []int, lo, hi, p1, p2 int) (int, int) {
	if p1 > p2 { p1, p2 = p2, p1 }
	lt, gt, i := lo, hi, lo
	for i <= gt {
		switch {
		case a[i] < p1: a[lt], a[i] = a[i], a[lt]; lt++; i++
		case a[i] > p2: a[i], a[gt] = a[gt], a[i]; gt--
		default:        i++
		}
	}
	return lt, gt
}
func insSort(a []int, lo, hi int) {
	for i := lo + 1; i <= hi; i++ {
		key, j := a[i], i-1
		for j >= lo && a[j] > key { a[j+1] = a[j]; j-- }
		a[j+1] = key
	}
}
func logosRec(a []int, lo, hi, depth int) {
	for lo < hi {
		size := hi - lo + 1
		if depth <= 0 { sort.Ints(a[lo:hi+1]); return }     // wisdom yields
		if size <= base { insSort(a, lo, hi); return }        // patience walks the small ones home
		mn, mx := a[lo], a[lo]
		for k := lo+1; k <= hi; k++ {
			if a[k]<mn { mn=a[k] } else if a[k]>mx { mx=a[k] }
		}
		span := mx - mn
		if span < size*4 {                                    // tally, do not compare
			counts := make([]int, span+1)
			for k := lo; k <= hi; k++ { counts[a[k]-mn]++ }
			k := lo
			for v, c := range counts { for ; c>0; c-- { a[k]=v+mn; k++ } }
			return
		}
		if a[lo]<=a[lo+1] && a[lo+1]<=a[lo+2] {             // read what is already written
			sorted := true
			for k := lo; k < hi; k++ { if a[k]>a[k+1] { sorted=false; break } }
			if sorted { return }
			rev := true
			for k := lo; k < hi; k++ { if a[k]<a[k+1] { rev=false; break } }
			if rev { for l,r:=lo,hi;l<r;l,r=l+1,r-1{a[l],a[r]=a[r],a[l]}; return }
		}
		ch := rand.Float64(); if ch==0 { ch=0.5 }            // the die is cast
		rng := hi - lo
		idx1 := lo + int(math.Min(float64(rng), float64(rng)*phi2*ch)) // the golden cut
		idx2 := lo + int(math.Min(float64(rng), float64(rng)*phi *ch))
		p1 := ninther(a, lo, hi, idx1)                        // three voices, one truth
		p2 := ninther(a, lo, hi, idx2)
		lt, gt := dualPartition(a, lo, hi, p1, p2)            // the great division
		type reg struct{ sz, lo, hi int }
		regions := []reg{                                      // the small earn calls; the large becomes the loop
			{lt - lo,     lo,   lt - 1},
			{gt - lt + 1, lt,   gt},
			{hi - gt,     gt+1, hi},
		}
		sort.Slice(regions, func(i, j int) bool { return regions[i].sz < regions[j].sz })
		if regions[0].lo < regions[0].hi { logosRec(a, regions[0].lo, regions[0].hi, depth-1) }
		if regions[1].lo < regions[1].hi { logosRec(a, regions[1].lo, regions[1].hi, depth-1) }
		lo, hi, depth = regions[2].lo, regions[2].hi, depth-1
	}
}

func logosSort(arr []int) {
	n := len(arr)
	if n < 2 { return }
	logosRec(arr, 0, n-1, int(2*math.Log2(float64(n)))+4)
}

func main() {
	arr := []int{64, 34, 25, 12, 22, 11, 90, 42, 5, 77}
	fmt.Println("Before:", arr)
	logosSort(arr)
	fmt.Println("After: ", arr)
}

// n log n time · log n space · unstable`,

  },
};