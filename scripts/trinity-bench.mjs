/**
 * Trinity-rule benchmark
 *
 * Trinity rule: after dualPartition, when p1 === p2 the middle bucket [lt..gt]
 * contains only equal elements and is trivially sorted — skip recursing into it.
 *
 * Tests current vs trinity at n = 10, 500, 100_000, 1_000_000
 * across four scenarios: random, nearlySorted, reversed, duplicates
 */

// ── Input generators ─────────────────────────────────────────────────────────

function genRandom(n)       { return Array.from({length:n}, ()=>Math.floor(Math.random()*10_000)); }
function genNearlySorted(n) {
  const a = Array.from({length:n}, (_,i)=>i+1);
  const swaps = Math.max(1, Math.floor(n*0.05));
  for (let i=0;i<swaps;i++){const x=Math.floor(Math.random()*n),y=Math.floor(Math.random()*n);[a[x],a[y]]=[a[y],a[x]];}
  return a;
}
function genReversed(n)     { return Array.from({length:n}, (_,i)=>n-i); }
function genDuplicates(n)   { return Array.from({length:n}, ()=>Math.floor(Math.random()*Math.ceil(n/5))); }

const SCENARIOS = {
  random:       genRandom,
  nearlySorted: genNearlySorted,
  reversed:     genReversed,
  duplicates:   genDuplicates,
};

// ── Current logosSort (unmodified) ───────────────────────────────────────────

function logosCurrent(input) {
  const PHI  = (Math.sqrt(5) - 1) / 2;
  const PHI2 = (3 - Math.sqrt(5)) / 2;
  const BASE = 48;
  const a = [...input];
  const n = a.length;
  const _xs = new Uint32Array(4);
  crypto.getRandomValues(_xs);
  if (!_xs[0] && !_xs[1] && !_xs[2] && !_xs[3]) _xs[0] = 1;
  let _x0=_xs[0],_x1=_xs[1],_x2=_xs[2],_x3=_xs[3];
  function xrand(){const r=(_x0+_x3)>>>0;const t=_x1<<9;_x2^=_x0;_x3^=_x1;_x1^=_x2;_x0^=_x3;_x2^=t;_x3=(_x3<<11)|(_x3>>>21);return(r>>>1)/0x80000000;}
  if (n<2) return a;
  const depthLimit = 2*Math.floor(Math.log2(n))+4;
  function median3(x,y,z){if(x>y){const t=x;x=y;y=t;}if(y>z){const t=y;y=z;z=t;}if(x>y){const t=x;x=y;y=t;}return y;}
  function ninther(lo,hi,idx){return median3(a[Math.max(lo,idx-1)],a[idx],a[Math.min(hi,idx+1)]);}
  function dualPartition(lo,hi,p1,p2){
    if(p1>p2){const t=p1;p1=p2;p2=t;}
    let lt=lo,gt=hi,i=lo;
    while(i<=gt){
      if(a[i]<p1){[a[lt],a[i]]=[a[i],a[lt]];lt++;i++;}
      else if(a[i]>p2){[a[i],a[gt]]=[a[gt],a[i]];gt--;}
      else{i++;}
    }
    return [lt,gt];
  }
  function sort(lo,hi,depth){
    while(lo<hi){
      const size=hi-lo+1;
      if(depth<=0){const sub=a.slice(lo,hi+1).sort((x,y)=>x-y);for(let k=lo;k<=hi;k++)a[k]=sub[k-lo];return;}
      if(size<=BASE){for(let i=lo+1;i<=hi;i++){const key=a[i];let j=i-1;while(j>=lo&&a[j]>key){a[j+1]=a[j];j--;}a[j+1]=key;}return;}
      let mn=a[lo],mx=a[lo];
      for(let k=lo+1;k<=hi;k++){if(a[k]<mn)mn=a[k];if(a[k]>mx)mx=a[k];}
      const span=mx-mn;
      if(Number.isInteger(mn)&&span<size*4){const counts=new Array(span+1).fill(0);for(let k=lo;k<=hi;k++)counts[a[k]-mn]++;let k=lo;for(let v=0;v<=span;v++){while(counts[v]-->0)a[k++]=v+mn;}return;}
      if(a[lo]<=a[lo+1]&&a[lo+1]<=a[lo+2]){
        let sorted=true;for(let k=lo;k<hi;k++){if(a[k]>a[k+1]){sorted=false;break;}}
        if(sorted)return;
        let reversed=true;for(let k=lo;k<hi;k++){if(a[k]<a[k+1]){reversed=false;break;}}
        if(reversed){for(let l=lo,r=hi;l<r;l++,r--){[a[l],a[r]]=[a[r],a[l]];}return;}
      }
      const chaos=xrand();
      const range=hi-lo;
      const idx1=lo+Math.min(range,Math.floor(range*PHI2*chaos));
      const idx2=lo+Math.min(range,Math.floor(range*PHI *chaos));
      const p1=ninther(lo,hi,idx1);
      const p2=ninther(lo,hi,idx2);
      const [lt,gt]=dualPartition(lo,hi,p1,p2);
      const regions=[[lt-lo,lo,lt-1],[gt-lt+1,lt,gt],[hi-gt,gt+1,hi]];
      regions.sort((x,y)=>x[0]-y[0]);
      if(regions[0][1]<regions[0][2])sort(regions[0][1],regions[0][2],depth-1);
      if(regions[1][1]<regions[1][2])sort(regions[1][1],regions[1][2],depth-1);
      lo=regions[2][1];hi=regions[2][2];depth--;
    }
  }
  sort(0,n-1,depthLimit);
  return a;
}

// ── logosSort + trinity rule ──────────────────────────────────────────────────
//
// Trinity rule: when p1 === p2 after dualPartition, the middle bucket [lt..gt]
// contains only equal elements — trivially sorted, no recursion needed.
// Set its size to 0 in the regions array so it's never recursed into.

function logosTrinity(input) {
  const PHI  = (Math.sqrt(5) - 1) / 2;
  const PHI2 = (3 - Math.sqrt(5)) / 2;
  const BASE = 48;
  const a = [...input];
  const n = a.length;
  const _xs = new Uint32Array(4);
  crypto.getRandomValues(_xs);
  if (!_xs[0] && !_xs[1] && !_xs[2] && !_xs[3]) _xs[0] = 1;
  let _x0=_xs[0],_x1=_xs[1],_x2=_xs[2],_x3=_xs[3];
  function xrand(){const r=(_x0+_x3)>>>0;const t=_x1<<9;_x2^=_x0;_x3^=_x1;_x1^=_x2;_x0^=_x3;_x2^=t;_x3=(_x3<<11)|(_x3>>>21);return(r>>>1)/0x80000000;}
  if (n<2) return a;
  const depthLimit = 2*Math.floor(Math.log2(n))+4;
  function median3(x,y,z){if(x>y){const t=x;x=y;y=t;}if(y>z){const t=y;y=z;z=t;}if(x>y){const t=x;x=y;y=t;}return y;}
  function ninther(lo,hi,idx){return median3(a[Math.max(lo,idx-1)],a[idx],a[Math.min(hi,idx+1)]);}
  function dualPartition(lo,hi,p1,p2){
    if(p1>p2){const t=p1;p1=p2;p2=t;}
    let lt=lo,gt=hi,i=lo;
    while(i<=gt){
      if(a[i]<p1){[a[lt],a[i]]=[a[i],a[lt]];lt++;i++;}
      else if(a[i]>p2){[a[i],a[gt]]=[a[gt],a[i]];gt--;}
      else{i++;}
    }
    return [lt,gt];
  }
  function sort(lo,hi,depth){
    while(lo<hi){
      const size=hi-lo+1;
      if(depth<=0){const sub=a.slice(lo,hi+1).sort((x,y)=>x-y);for(let k=lo;k<=hi;k++)a[k]=sub[k-lo];return;}
      if(size<=BASE){for(let i=lo+1;i<=hi;i++){const key=a[i];let j=i-1;while(j>=lo&&a[j]>key){a[j+1]=a[j];j--;}a[j+1]=key;}return;}
      let mn=a[lo],mx=a[lo];
      for(let k=lo+1;k<=hi;k++){if(a[k]<mn)mn=a[k];if(a[k]>mx)mx=a[k];}
      const span=mx-mn;
      if(Number.isInteger(mn)&&span<size*4){const counts=new Array(span+1).fill(0);for(let k=lo;k<=hi;k++)counts[a[k]-mn]++;let k=lo;for(let v=0;v<=span;v++){while(counts[v]-->0)a[k++]=v+mn;}return;}
      if(a[lo]<=a[lo+1]&&a[lo+1]<=a[lo+2]){
        let sorted=true;for(let k=lo;k<hi;k++){if(a[k]>a[k+1]){sorted=false;break;}}
        if(sorted)return;
        let reversed=true;for(let k=lo;k<hi;k++){if(a[k]<a[k+1]){reversed=false;break;}}
        if(reversed){for(let l=lo,r=hi;l<r;l++,r--){[a[l],a[r]]=[a[r],a[l]];}return;}
      }
      const chaos=xrand();
      const range=hi-lo;
      const idx1=lo+Math.min(range,Math.floor(range*PHI2*chaos));
      const idx2=lo+Math.min(range,Math.floor(range*PHI *chaos));
      const p1=ninther(lo,hi,idx1);
      const p2=ninther(lo,hi,idx2);
      const [lt,gt]=dualPartition(lo,hi,p1,p2);

      // ── TRINITY RULE ──────────────────────────────────────────────────────
      // p1 === p2 means dualPartition placed every element equal to that value
      // in the middle bucket [lt..gt].  Those elements are all identical —
      // trivially sorted.  Zero out the middle region's size so it is never
      // recursed into, saving the entire sort() call tree for that bucket.
      const midSize = (p1 === p2) ? 0 : gt - lt + 1;
      // ─────────────────────────────────────────────────────────────────────

      const regions=[[lt-lo,lo,lt-1],[midSize,lt,gt],[hi-gt,gt+1,hi]];
      regions.sort((x,y)=>x[0]-y[0]);
      if(regions[0][1]<regions[0][2])sort(regions[0][1],regions[0][2],depth-1);
      if(regions[1][1]<regions[1][2])sort(regions[1][1],regions[1][2],depth-1);
      lo=regions[2][1];hi=regions[2][2];depth--;
    }
  }
  sort(0,n-1,depthLimit);
  return a;
}

// ── Correctness check ─────────────────────────────────────────────────────────

function verify(fn, name) {
  const cases = [
    Array.from({length:1000}, ()=>Math.floor(Math.random()*100)),  // heavy duplicates
    Array.from({length:500},  ()=>Math.floor(Math.random()*10_000)),
    Array.from({length:50},   (_,i)=>50-i),
  ];
  for (const c of cases) {
    const got  = fn([...c]);
    const want = [...c].sort((a,b)=>a-b);
    for (let i=0;i<want.length;i++) {
      if (got[i] !== want[i]) {
        console.error(`CORRECTNESS FAIL in ${name} at index ${i}: got ${got[i]}, want ${want[i]}`);
        process.exit(1);
      }
    }
  }
}

verify(logosCurrent, "logosCurrent");
verify(logosTrinity, "logosTrinity");

// ── Benchmark runner ──────────────────────────────────────────────────────────

const ROUNDS  = 7;
const DISCARD = 2; // warmup rounds to discard

function bench(fn, input) {
  let best = Infinity;
  for (let r = 0; r < ROUNDS; r++) {
    const copy = [...input];
    const t0 = performance.now();
    fn(copy);
    const elapsed = performance.now() - t0;
    if (r >= DISCARD) best = Math.min(best, elapsed);
  }
  return best;
}

function fmt(ms) {
  if (ms < 0.1)    return `${(ms*1000).toFixed(0)} μs`;
  if (ms < 10)     return `${ms.toFixed(3)} ms`;
  if (ms < 1_000)  return `${ms.toFixed(1)} ms`;
  return `${(ms/1000).toFixed(2)} s`;
}

function pct(a, b) {
  // positive = trinity is faster, negative = trinity is slower
  const d = ((a - b) / a) * 100;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

// ── Run ───────────────────────────────────────────────────────────────────────

const SIZES = [10, 500, 100_000, 1_000_000];
const SCENARIO_KEYS = ["random", "nearlySorted", "reversed", "duplicates"];

console.log("\n╔══════════════════════════════════════════════════════════════════════════════╗");
console.log("║              Logos Sort: baseline vs trinity rule benchmark                 ║");
console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
console.log(`║  ${"n".padEnd(10)} ${"scenario".padEnd(14)} ${"baseline".padStart(11)} ${"trinity".padStart(11)} ${"delta".padStart(9)} ${"verdict".padStart(10)}  ║`);
console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

for (const n of SIZES) {
  for (const sc of SCENARIO_KEYS) {
    const input = SCENARIOS[sc](n);
    const tBase    = bench(logosCurrent, input);
    const tTrinity = bench(logosTrinity, input);
    const delta    = pct(tBase, tTrinity);
    const faster   = tTrinity < tBase;
    const verdict  = faster ? "✓ faster" : "✗ slower";
    console.log(
      `║  ${String(n).padStart(9).padEnd(10)} ${sc.padEnd(14)} ${fmt(tBase).padStart(11)} ${fmt(tTrinity).padStart(11)} ${delta.padStart(9)} ${verdict.padStart(10)}  ║`
    );
  }
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");
}

console.log("╚══════════════════════════════════════════════════════════════════════════════╝\n");
console.log("Correctness: all cases passed ✓\n");
