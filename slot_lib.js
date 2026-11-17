// slot_lib.js — slot-boundary DP: assign each slot a region of Cnew
// Chooses region boundaries e_0=0 <= e_1 <= ... <= e_nS = |Cnew| minimizing
// the total edit distance between each doc slot text and its region. Uses the
// known slot structure directly, so edits land in the slot they belong to
// even when char-level matches are ambiguous (repeated digits around
// fractions, subscripts, etc.).
function slotRegions(slotTexts, Cnew) {
  const nS = slotTexts.length;
  const m = Cnew.length;
  if (slotTexts.join('') === Cnew) return null;
  const W = m + 1;
  const INF = 1e15;
  // ed[k][a*W+b] = edit distance between slotTexts[k] and Cnew[a..b)
  const ed = [];
  for (let k = 0; k < nS; k++) {
    const D = slotTexts[k];
    const n = D.length;
    const arr = new Float64Array(W * W).fill(INF);
    if (n === 0) {
      for (let a = 0; a <= m; a++) for (let b = a; b <= m; b++) arr[a * W + b] = b - a;
    } else if (n === 1) {
      const ch = D[0];
      for (let a = 0; a <= m; a++) for (let b = a; b <= m; b++) {
        const len = b - a;
        arr[a * W + b] = len === 0 ? 1 : (Cnew.slice(a, b).includes(ch) ? len - 1 : len);
      }
    } else {
      let prev = new Float64Array(W);
      let cur = new Float64Array(W);
      for (let a = 0; a <= m; a++) {
        const len = m - a;
        for (let j = 0; j <= len; j++) prev[j] = j;           // ED("", prefix) = j
        arr[a * W + a] = 0;
        for (let i = 1; i <= n; i++) {
          cur[0] = i;
          const di = D.charCodeAt(i - 1);
          for (let j = 1; j <= len; j++) {
            const sub = prev[j - 1] + (di === Cnew.charCodeAt(a + j - 1) ? 0 : 1);
            const del = prev[j] + 1;
            const ins = cur[j - 1] + 1;
            cur[j] = sub < del ? (sub < ins ? sub : ins) : (del < ins ? del : ins);
          }
          for (let j = 0; j <= len; j++) arr[a * W + a + j] = cur[j];
          [prev, cur] = [cur, prev];
        }
      }
    }
    ed.push(arr);
  }
  // f[k][p] = min cost to align slots k..nS-1 against Cnew[p..]
  const f = [];
  for (let k = 0; k <= nS; k++) f.push(new Float64Array(W).fill(INF));
  f[nS][m] = 0;
  for (let k = nS - 1; k >= 0; k--) {
    for (let p = 0; p <= m; p++) {
      let best = INF;
      for (let e = p; e <= m; e++) {
        const c = ed[k][p * W + e] + f[k + 1][e];
        if (c < best) best = c;
      }
      f[k][p] = best;
    }
  }
  if (f[0][0] >= INF) throw new Error('slotRegions: no feasible alignment');
  // reconstruct boundaries (strict < keeps the earliest optimum)
  const ends = new Array(nS);
  let p = 0;
  for (let k = 0; k < nS; k++) {
    let best = INF, bestE = p;
    for (let e = p; e <= m; e++) {
      const c = ed[k][p * W + e] + f[k + 1][e];
      if (c < best - 1e-9) { best = c; bestE = e; }
    }
    ends[k] = bestE;
    p = bestE;
  }
  const out = [];
  let prev = 0;
  for (let k = 0; k < nS; k++) { out.push(Cnew.slice(prev, ends[k])); prev = ends[k]; }
  for (let k = 0; k < nS; k++) {
    if (slotTexts[k].length > 0 && out[k] === '') throw new Error(`slotRegions: slot ${k} (${JSON.stringify(slotTexts[k])}) emptied`);
  }
  return out;
}

module.exports = { slotRegions };
