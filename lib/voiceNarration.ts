/**
 * Natural-language narrations for each pseudocode line, keyed by algorithm slug.
 * Index matches the pseudocode array in ALGORITHM_META.
 */
export const VOICE_NARRATION: Record<string, string[]> = {
  bubble: [
    "Starting a new outer pass over the array.",
    "Scanning adjacent pairs in the unsorted region.",
    "The left element is larger than the right — they're out of order.",
    "Swapping the two adjacent elements so the larger one moves right toward its final position.",
  ],

  selection: [
    "Starting a new pass — we'll hunt for the smallest remaining element.",
    "Assuming the current position holds the minimum — we'll verify by scanning the rest.",
    "Scanning the unsorted region for something smaller.",
    "Found a smaller value — updating the minimum index.",
    "Recording this position as the new minimum.",
    "Placing the smallest found value into its final sorted position.",
  ],

  insertion: [
    "Picking up the next unsorted element to insert into the sorted region.",
    "Saving the current element as the key — the card we're about to slide into place.",
    "Starting to compare against the element just to the left.",
    "The element to the left is larger than the key — it needs to shift right.",
    "Shifting the larger element one position to the right to make room.",
    "Moving one step further left to keep comparing.",
    "Found the right spot — placing the key into its correct sorted position.",
  ],

  merge: [
    "Starting merge sort on a subarray.",
    "Base case — a single element is already sorted, returning.",
    "Splitting the subarray in half at the midpoint.",
    "Recursively sorting the left half.",
    "Recursively sorting the right half.",
    "Both halves are sorted — merging them by repeatedly taking the smaller of the two front elements.",
  ],

  quick: [
    "Starting quick sort on this partition.",
    "Base case — partition has one or zero elements, already sorted.",
    "Choosing the last element as the pivot — the value everything else will be compared against.",
    "Setting up the boundary pointer — elements to its left will be smaller than the pivot.",
    "Scanning each element and deciding which side of the pivot it belongs on.",
    "This element is smaller than or equal to the pivot — swapping it into the left partition.",
    "Placing the pivot in its final sorted position — smaller values to its left, larger to its right.",
    "Pivot is in place — recursively sorting the left and right partitions.",
  ],

  heap: [
    "Building a max-heap — rearranging the array so the largest element rises to the root.",
    "Heapifying each internal node from bottom to top to establish the heap property.",
    "Extracting the maximum — shrinking the heap one element at a time.",
    "Moving the root — the largest remaining element — to its final sorted position at the end.",
    "Sifting the new root down to restore the heap property.",
    "Comparing the parent with its children and swapping downward until the heap is balanced.",
  ],

  shell: [
    "Setting the initial gap — we'll compare and swap elements this far apart.",
    "Continuing with the current gap size — we'll keep halving until the gap reaches one.",
    "Running a gapped insertion sort pass — picking up the next element to place.",
    "Saving the current element — the value we're trying to insert.",
    "Starting to scan backward in steps of the current gap.",
    "The element one gap behind is larger — it needs to shift forward.",
    "Shifting the larger element forward by one gap to make room.",
    "Placing the saved element into its correct position within this gap pass.",
    "Halving the gap — the next pass will compare elements that are closer together.",
  ],

  counting: [
    "Initializing the count array to zero — one slot for each possible value in the range.",
    "Tallying — incrementing the count for each value we encounter in the input.",
    "Computing prefix sums — each count slot now holds the final sorted position for that value.",
    "Building the output array — iterating the input in reverse to keep equal elements in their original order.",
    "Placing the current element at its correct position in the output, as given by its count.",
    "Decrementing the count so the next identical value slots in just before this one.",
  ],

  radix: [
    "Processing a new digit position — starting at the ones place and moving left.",
    "Running a stable counting sort on just this digit position.",
    "Extracting the digit at the current position from each element.",
    "Tallying how many elements carry each digit value.",
    "Computing prefix sums to determine where each digit group lands in the output.",
    "Placing elements into their sorted positions based on the current digit.",
  ],

  bucket: [
    "Creating empty buckets — one for each portion of the value range.",
    "Distributing elements into buckets based on their value.",
    "Calculating which bucket this element belongs in and inserting it.",
    "Sorting each individual bucket with insertion sort — they're small, so it's fast.",
    "Collecting all buckets in order to form the final sorted array.",
  ],

  timsort: [
    "Setting the run size — small chunks of this length will each be sorted individually.",
    "Phase one: sorting small runs using insertion sort, which excels on short sequences.",
    "Moving through the array in run-sized chunks.",
    "Saving the current element as the key — the value we're inserting into its run.",
    "The element to the left is larger — shifting it right to make room for the key.",
    "Placing the key into its correct position within this run.",
    "Phase two: merging the sorted runs together using merge sort's strategy.",
    "Merging two adjacent sorted runs into one larger sorted sequence.",
  ],
};
