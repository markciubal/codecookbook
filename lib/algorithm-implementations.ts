import type { LangCode } from "@/components/MultiLangPanel";

export const ALGORITHM_IMPLEMENTATIONS: Record<string, LangCode[]> = {
  // ────────────────────────────────────────────────────────────────────────────
  // Bubble Sort
  // ────────────────────────────────────────────────────────────────────────────
  bubble: [
    {
      language: "python",
      code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n - 1):
        # Each pass bubbles the largest remaining element to its position
        swapped = False
        for j in range(n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        # Early exit if no swaps occurred (already sorted)
        if not swapped:
            break
    return arr`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

void bubble_sort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        // Each pass pushes the largest unsorted element to the end
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                swap(arr[j], arr[j + 1]);
                swapped = true;
            }
        }
        // Early exit: array is already sorted
        if (!swapped) break;
    }
}`,
    },
    {
      language: "java",
      code: `public class BubbleSort {
    public static void bubbleSort(int[] arr) {
        int n = arr.length;
        for (int i = 0; i < n - 1; i++) {
            boolean swapped = false;
            // Each pass bubbles the largest element into place
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                    swapped = true;
                }
            }
            // Early exit if already sorted
            if (!swapped) break;
        }
    }
}`,
    },
    {
      language: "javascript",
      code: `function bubbleSort(arr) {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
        let swapped = false;
        // Each pass bubbles the largest remaining element to its position
        for (let j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                swapped = true;
            }
        }
        // Early exit if no swaps (already sorted)
        if (!swapped) break;
    }
    return arr;
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Selection Sort
  // ────────────────────────────────────────────────────────────────────────────
  selection: [
    {
      language: "python",
      code: `def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        # Find the index of the minimum element in arr[i..n-1]
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        # Swap the found minimum with arr[i]
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

void selection_sort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n - 1; i++) {
        // Find the minimum in the unsorted portion
        int min_idx = i;
        for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[min_idx])
                min_idx = j;
        }
        // Place the minimum at position i
        swap(arr[i], arr[min_idx]);
    }
}`,
    },
    {
      language: "java",
      code: `public class SelectionSort {
    public static void selectionSort(int[] arr) {
        int n = arr.length;
        for (int i = 0; i < n - 1; i++) {
            // Find the minimum element in arr[i+1..n-1]
            int minIdx = i;
            for (int j = i + 1; j < n; j++) {
                if (arr[j] < arr[minIdx])
                    minIdx = j;
            }
            // Swap the minimum into the sorted prefix
            int temp = arr[minIdx];
            arr[minIdx] = arr[i];
            arr[i] = temp;
        }
    }
}`,
    },
    {
      language: "javascript",
      code: `function selectionSort(arr) {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
        // Find the minimum in the unsorted portion
        let minIdx = i;
        for (let j = i + 1; j < n; j++) {
            if (arr[j] < arr[minIdx]) minIdx = j;
        }
        // Swap minimum into sorted position
        [arr[i], arr[minIdx]] = [arr[minIdx], arr[i]];
    }
    return arr;
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Insertion Sort
  // ────────────────────────────────────────────────────────────────────────────
  insertion: [
    {
      language: "python",
      code: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        # Shift elements greater than key one position to the right
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

void insertion_sort(vector<int>& arr) {
    int n = arr.size();
    for (int i = 1; i < n; i++) {
        int key = arr[i];
        int j = i - 1;
        // Shift elements to the right to make room for key
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}`,
    },
    {
      language: "java",
      code: `public class InsertionSort {
    public static void insertionSort(int[] arr) {
        int n = arr.length;
        for (int i = 1; i < n; i++) {
            int key = arr[i];
            int j = i - 1;
            // Shift sorted elements to make room for key
            while (j >= 0 && arr[j] > key) {
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = key;
        }
    }
}`,
    },
    {
      language: "javascript",
      code: `function insertionSort(arr) {
    for (let i = 1; i < arr.length; i++) {
        const key = arr[i];
        let j = i - 1;
        // Shift sorted portion to make room for key
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
    return arr;
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Merge Sort
  // ────────────────────────────────────────────────────────────────────────────
  merge: [
    {
      language: "python",
      code: `def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left  = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

void merge(vector<int>& arr, int l, int m, int r) {
    vector<int> left(arr.begin() + l, arr.begin() + m + 1);
    vector<int> right(arr.begin() + m + 1, arr.begin() + r + 1);
    int i = 0, j = 0, k = l;
    while (i < (int)left.size() && j < (int)right.size())
        arr[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];
    while (i < (int)left.size())  arr[k++] = left[i++];
    while (j < (int)right.size()) arr[k++] = right[j++];
}

void merge_sort(vector<int>& arr, int l, int r) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    merge_sort(arr, l, m);
    merge_sort(arr, m + 1, r);
    merge(arr, l, m, r);
}`,
    },
    {
      language: "java",
      code: `public class MergeSort {
    public static void mergeSort(int[] arr, int l, int r) {
        if (l >= r) return;
        int m = l + (r - l) / 2;
        mergeSort(arr, l, m);
        mergeSort(arr, m + 1, r);
        merge(arr, l, m, r);
    }

    private static void merge(int[] arr, int l, int m, int r) {
        int[] left  = Arrays.copyOfRange(arr, l, m + 1);
        int[] right = Arrays.copyOfRange(arr, m + 1, r + 1);
        int i = 0, j = 0, k = l;
        while (i < left.length && j < right.length)
            arr[k++] = (left[i] <= right[j]) ? left[i++] : right[j++];
        while (i < left.length)  arr[k++] = left[i++];
        while (j < right.length) arr[k++] = right[j++];
    }
}`,
    },
    {
      language: "javascript",
      code: `function mergeSort(arr) {
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    const left  = mergeSort(arr.slice(0, mid));
    const right = mergeSort(arr.slice(mid));
    return merge(left, right);
}

function merge(left, right) {
    const result = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length)
        result.push(left[i] <= right[j] ? left[i++] : right[j++]);
    return result.concat(left.slice(i), right.slice(j));
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Quick Sort
  // ────────────────────────────────────────────────────────────────────────────
  quick: [
    {
      language: "python",
      code: `def quick_sort(arr, lo=0, hi=None):
    if hi is None:
        hi = len(arr) - 1
    if lo < hi:
        p = partition(arr, lo, hi)
        quick_sort(arr, lo, p - 1)
        quick_sort(arr, p + 1, hi)
    return arr

def partition(arr, lo, hi):
    pivot = arr[hi]   # Lomuto partition scheme
    i = lo - 1
    for j in range(lo, hi):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[hi] = arr[hi], arr[i + 1]
    return i + 1`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

int partition(vector<int>& arr, int lo, int hi) {
    int pivot = arr[hi];  // Lomuto scheme
    int i = lo - 1;
    for (int j = lo; j < hi; j++) {
        if (arr[j] <= pivot)
            swap(arr[++i], arr[j]);
    }
    swap(arr[i + 1], arr[hi]);
    return i + 1;
}

void quick_sort(vector<int>& arr, int lo, int hi) {
    if (lo < hi) {
        int p = partition(arr, lo, hi);
        quick_sort(arr, lo, p - 1);
        quick_sort(arr, p + 1, hi);
    }
}`,
    },
    {
      language: "java",
      code: `public class QuickSort {
    public static void quickSort(int[] arr, int lo, int hi) {
        if (lo < hi) {
            int p = partition(arr, lo, hi);
            quickSort(arr, lo, p - 1);
            quickSort(arr, p + 1, hi);
        }
    }

    private static int partition(int[] arr, int lo, int hi) {
        int pivot = arr[hi];  // Lomuto partition scheme
        int i = lo - 1;
        for (int j = lo; j < hi; j++) {
            if (arr[j] <= pivot) {
                int tmp = arr[++i]; arr[i] = arr[j]; arr[j] = tmp;
            }
        }
        int tmp = arr[i + 1]; arr[i + 1] = arr[hi]; arr[hi] = tmp;
        return i + 1;
    }
}`,
    },
    {
      language: "javascript",
      code: `function quickSort(arr, lo = 0, hi = arr.length - 1) {
    if (lo < hi) {
        const p = partition(arr, lo, hi);
        quickSort(arr, lo, p - 1);
        quickSort(arr, p + 1, hi);
    }
    return arr;
}

function partition(arr, lo, hi) {
    const pivot = arr[hi];  // Lomuto scheme
    let i = lo - 1;
    for (let j = lo; j < hi; j++) {
        if (arr[j] <= pivot)
            [arr[++i], arr[j]] = [arr[j], arr[i]];
    }
    [arr[i + 1], arr[hi]] = [arr[hi], arr[i + 1]];
    return i + 1;
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Heap Sort
  // ────────────────────────────────────────────────────────────────────────────
  heap: [
    {
      language: "python",
      code: `def heap_sort(arr):
    n = len(arr)
    # Build a max-heap (heapify all non-leaf nodes bottom-up)
    for i in range(n // 2 - 1, -1, -1):
        sift_down(arr, n, i)
    # Extract elements one by one
    for i in range(n - 1, 0, -1):
        arr[0], arr[i] = arr[i], arr[0]  # Move max to end
        sift_down(arr, i, 0)
    return arr

def sift_down(arr, n, i):
    largest = i
    l, r = 2 * i + 1, 2 * i + 2
    if l < n and arr[l] > arr[largest]: largest = l
    if r < n and arr[r] > arr[largest]: largest = r
    if largest != i:
        arr[i], arr[largest] = arr[largest], arr[i]
        sift_down(arr, n, largest)`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

void sift_down(vector<int>& arr, int n, int i) {
    int largest = i, l = 2*i+1, r = 2*i+2;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest != i) {
        swap(arr[i], arr[largest]);
        sift_down(arr, n, largest);
    }
}

void heap_sort(vector<int>& arr) {
    int n = arr.size();
    // Build max-heap
    for (int i = n/2 - 1; i >= 0; i--)
        sift_down(arr, n, i);
    // Sort by extracting max repeatedly
    for (int i = n - 1; i > 0; i--) {
        swap(arr[0], arr[i]);
        sift_down(arr, i, 0);
    }
}`,
    },
    {
      language: "java",
      code: `public class HeapSort {
    public static void heapSort(int[] arr) {
        int n = arr.length;
        // Build max-heap bottom-up
        for (int i = n / 2 - 1; i >= 0; i--)
            siftDown(arr, n, i);
        // Extract elements one by one
        for (int i = n - 1; i > 0; i--) {
            int tmp = arr[0]; arr[0] = arr[i]; arr[i] = tmp;
            siftDown(arr, i, 0);
        }
    }

    private static void siftDown(int[] arr, int n, int i) {
        int largest = i, l = 2*i+1, r = 2*i+2;
        if (l < n && arr[l] > arr[largest]) largest = l;
        if (r < n && arr[r] > arr[largest]) largest = r;
        if (largest != i) {
            int tmp = arr[i]; arr[i] = arr[largest]; arr[largest] = tmp;
            siftDown(arr, n, largest);
        }
    }
}`,
    },
    {
      language: "javascript",
      code: `function heapSort(arr) {
    const n = arr.length;
    // Build max-heap
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--)
        siftDown(arr, n, i);
    // Extract elements one by one
    for (let i = n - 1; i > 0; i--) {
        [arr[0], arr[i]] = [arr[i], arr[0]];
        siftDown(arr, i, 0);
    }
    return arr;
}

function siftDown(arr, n, i) {
    let largest = i;
    const l = 2*i+1, r = 2*i+2;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest !== i) {
        [arr[i], arr[largest]] = [arr[largest], arr[i]];
        siftDown(arr, n, largest);
    }
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Binary Search
  // ────────────────────────────────────────────────────────────────────────────
  "binary-search": [
    {
      language: "python",
      code: `def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2  # Avoids overflow
        if arr[mid] == target:
            return mid          # Found
        elif arr[mid] < target:
            lo = mid + 1        # Target is in the right half
        else:
            hi = mid - 1        # Target is in the left half
    return -1  # Not found`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

int binary_search(const vector<int>& arr, int target) {
    int lo = 0, hi = (int)arr.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;  // Prevents overflow
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target)    lo = mid + 1;
        else                           hi = mid - 1;
    }
    return -1;  // Not found
}`,
    },
    {
      language: "java",
      code: `public class BinarySearch {
    public static int binarySearch(int[] arr, int target) {
        int lo = 0, hi = arr.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;  // Prevents integer overflow
            if (arr[mid] == target)      return mid;
            else if (arr[mid] < target)  lo = mid + 1;
            else                         hi = mid - 1;
        }
        return -1;  // Not found
    }
}`,
    },
    {
      language: "javascript",
      code: `function binarySearch(arr, target) {
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 2);
        if (arr[mid] === target)     return mid;
        else if (arr[mid] < target)  lo = mid + 1;
        else                         hi = mid - 1;
    }
    return -1;  // Not found
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Linear Search
  // ────────────────────────────────────────────────────────────────────────────
  "linear-search": [
    {
      language: "python",
      code: `def linear_search(arr, target):
    # Scan every element from left to right
    for i, val in enumerate(arr):
        if val == target:
            return i    # Return the index of the first match
    return -1           # Not found`,
    },
    {
      language: "cpp",
      code: `#include <vector>
using namespace std;

int linear_search(const vector<int>& arr, int target) {
    for (int i = 0; i < (int)arr.size(); i++) {
        if (arr[i] == target) return i;  // First match
    }
    return -1;  // Not found
}`,
    },
    {
      language: "java",
      code: `public class LinearSearch {
    public static int linearSearch(int[] arr, int target) {
        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == target) return i;  // Return first match index
        }
        return -1;  // Not found
    }
}`,
    },
    {
      language: "javascript",
      code: `function linearSearch(arr, target) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === target) return i;  // Return first match index
    }
    return -1;  // Not found
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // BFS
  // ────────────────────────────────────────────────────────────────────────────
  bfs: [
    {
      language: "python",
      code: `from collections import deque

def bfs(graph, start):
    """Breadth-first traversal; returns visited order."""
    visited = set([start])
    queue   = deque([start])
    order   = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order`,
    },
    {
      language: "cpp",
      code: `#include <vector>
#include <queue>
#include <unordered_set>
using namespace std;

vector<int> bfs(const vector<vector<int>>& graph, int start) {
    unordered_set<int> visited = {start};
    queue<int> q;
    q.push(start);
    vector<int> order;
    while (!q.empty()) {
        int node = q.front(); q.pop();
        order.push_back(node);
        for (int neighbor : graph[node]) {
            if (!visited.count(neighbor)) {
                visited.insert(neighbor);
                q.push(neighbor);
            }
        }
    }
    return order;
}`,
    },
    {
      language: "java",
      code: `import java.util.*;

public class BFS {
    public static List<Integer> bfs(Map<Integer, List<Integer>> graph, int start) {
        Set<Integer>    visited = new HashSet<>();
        Queue<Integer>  queue   = new LinkedList<>();
        List<Integer>   order   = new ArrayList<>();
        visited.add(start);
        queue.add(start);
        while (!queue.isEmpty()) {
            int node = queue.poll();
            order.add(node);
            for (int neighbor : graph.getOrDefault(node, Collections.emptyList())) {
                if (!visited.contains(neighbor)) {
                    visited.add(neighbor);
                    queue.add(neighbor);
                }
            }
        }
        return order;
    }
}`,
    },
    {
      language: "javascript",
      code: `function bfs(graph, start) {
    // graph: Map<node, node[]>
    const visited = new Set([start]);
    const queue   = [start];
    const order   = [];
    while (queue.length > 0) {
        const node = queue.shift();
        order.push(node);
        for (const neighbor of (graph.get(node) ?? [])) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return order;
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // DFS
  // ────────────────────────────────────────────────────────────────────────────
  dfs: [
    {
      language: "python",
      code: `def dfs(graph, start, visited=None):
    """Recursive depth-first traversal; returns visited order."""
    if visited is None:
        visited = set()
    visited.add(start)
    order = [start]
    for neighbor in graph[start]:
        if neighbor not in visited:
            order.extend(dfs(graph, neighbor, visited))
    return order`,
    },
    {
      language: "cpp",
      code: `#include <vector>
#include <unordered_set>
using namespace std;

void dfs(const vector<vector<int>>& graph, int node,
         unordered_set<int>& visited, vector<int>& order) {
    visited.insert(node);
    order.push_back(node);
    for (int neighbor : graph[node]) {
        if (!visited.count(neighbor))
            dfs(graph, neighbor, visited, order);
    }
}

vector<int> dfs_start(const vector<vector<int>>& graph, int start) {
    unordered_set<int> visited;
    vector<int> order;
    dfs(graph, start, visited, order);
    return order;
}`,
    },
    {
      language: "java",
      code: `import java.util.*;

public class DFS {
    public static List<Integer> dfs(Map<Integer, List<Integer>> graph, int start) {
        List<Integer> order   = new ArrayList<>();
        Set<Integer>  visited = new HashSet<>();
        dfsHelper(graph, start, visited, order);
        return order;
    }

    private static void dfsHelper(Map<Integer, List<Integer>> graph,
                                   int node, Set<Integer> visited,
                                   List<Integer> order) {
        visited.add(node);
        order.add(node);
        for (int neighbor : graph.getOrDefault(node, Collections.emptyList())) {
            if (!visited.contains(neighbor))
                dfsHelper(graph, neighbor, visited, order);
        }
    }
}`,
    },
    {
      language: "javascript",
      code: `function dfs(graph, start, visited = new Set()) {
    // graph: Map<node, node[]>
    visited.add(start);
    const order = [start];
    for (const neighbor of (graph.get(start) ?? [])) {
        if (!visited.has(neighbor))
            order.push(...dfs(graph, neighbor, visited));
    }
    return order;
}`,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // Dijkstra's Algorithm
  // ────────────────────────────────────────────────────────────────────────────
  dijkstra: [
    {
      language: "python",
      code: `import heapq

def dijkstra(graph, start):
    """Returns shortest distances from start to all reachable nodes.
    graph: {node: [(neighbor, weight), ...]}
    """
    dist = {start: 0}
    heap = [(0, start)]   # (distance, node)
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, float('inf')):
            continue  # Outdated entry
        for v, w in graph.get(u, []):
            nd = d + w
            if nd < dist.get(v, float('inf')):
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist`,
    },
    {
      language: "cpp",
      code: `#include <vector>
#include <queue>
#include <unordered_map>
#include <limits>
using namespace std;

using Edge = pair<int,int>;  // {neighbor, weight}
using PII  = pair<int,int>;  // {dist, node}

unordered_map<int,int> dijkstra(
    const unordered_map<int,vector<Edge>>& graph, int start) {
    unordered_map<int,int> dist;
    dist[start] = 0;
    priority_queue<PII, vector<PII>, greater<PII>> pq;
    pq.push({0, start});
    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist.count(u) ? dist[u] : INT_MAX) continue;
        for (auto [v, w] : graph.count(u) ? graph.at(u) : vector<Edge>{}) {
            int nd = d + w;
            if (!dist.count(v) || nd < dist[v]) {
                dist[v] = nd;
                pq.push({nd, v});
            }
        }
    }
    return dist;
}`,
    },
    {
      language: "java",
      code: `import java.util.*;

public class Dijkstra {
    // graph: node -> list of [neighbor, weight]
    public static Map<Integer,Integer> dijkstra(
            Map<Integer, List<int[]>> graph, int start) {
        Map<Integer,Integer> dist = new HashMap<>();
        dist.put(start, 0);
        // Min-heap: [distance, node]
        PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[0]));
        pq.offer(new int[]{0, start});
        while (!pq.isEmpty()) {
            int[] cur = pq.poll();
            int d = cur[0], u = cur[1];
            if (d > dist.getOrDefault(u, Integer.MAX_VALUE)) continue;
            for (int[] edge : graph.getOrDefault(u, Collections.emptyList())) {
                int v = edge[0], w = edge[1], nd = d + w;
                if (nd < dist.getOrDefault(v, Integer.MAX_VALUE)) {
                    dist.put(v, nd);
                    pq.offer(new int[]{nd, v});
                }
            }
        }
        return dist;
    }
}`,
    },
    {
      language: "javascript",
      code: `function dijkstra(graph, start) {
    // graph: Map<node, {neighbor, weight}[]>
    const dist = new Map([[start, 0]]);
    // MinHeap simulation with sorted array (for clarity)
    const heap = [[0, start]];  // [dist, node]
    while (heap.length > 0) {
        heap.sort((a, b) => a[0] - b[0]);
        const [d, u] = heap.shift();
        if (d > (dist.get(u) ?? Infinity)) continue;
        for (const { neighbor: v, weight: w } of (graph.get(u) ?? [])) {
            const nd = d + w;
            if (nd < (dist.get(v) ?? Infinity)) {
                dist.set(v, nd);
                heap.push([nd, v]);
            }
        }
    }
    return dist;
}`,
    },
  ],
};
