// apply.js — build the variant-N docx from the variant-20 source by surgical
// text replacement: math (m:t slots), paragraphs (w:t), tables (cells), core props.
// Slot redistribution uses a char-level LCS alignment between the doc text and
// the regenerated text, so fractions/subscripts/OMML structure are preserved.
// usage: node apply.js [variant]   (default 13)
const fs = require('fs');
const AdmZip = require('adm-zip');

const v = parseInt(process.argv[2] || '13', 10);
const SRC = 'C:/Users/DSV/Desktop/Lucrare/Proiect_Varianta20_verificat.docx';
const OUT = process.argv[3] || `C:/Users/DSV/Desktop/Lucrare/New folder/${v === 13 ? 'Varianta mea' : 'Varianta ' + v}.docx`;

const { compute, getInputs } = require('./compute');
const templates = require('./templates');
const paraT = require('./para_templates');
const { buildTables } = require('./tables');
const { slotRegions } = require('./slot_lib');

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- token-based alignment: doc char -> new-text region start ----------
// Tokens: single digit characters + runs of non-digits. Non-digit tokens are
// highly distinctive structural anchors; matching them positionally prevents
// the classic greedy-LCS failure where an identical digit in one formula part
// cross-matches a distant digit in another. Score = 2·matched − gap chars,
// so long jumps are always rejected in favour of local edits.
function tokenize(s) {
  const toks = [];
  let i = 0;
  const isDig = c => c >= '0' && c <= '9';
  while (i < s.length) {
    if (isDig(s[i])) { toks.push({ text: s[i] }); i++; }
    else {
      let j = i + 1;
      while (j < s.length && !isDig(s[j])) j++;
      toks.push({ text: s.slice(i, j) });
      i = j;
    }
  }
  return toks;
}

function alignStarts(Cdoc, Cnew) {
  if (Cdoc === Cnew) return null;
  const td = tokenize(Cdoc), tn = tokenize(Cnew);
  const n = td.length, m = tn.length;
  const W = m + 1;
  const dp = new Float64Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) {
    let acc = 0;
    for (let t = i; t < n; t++) acc -= td[t].text.length;
    dp[i * W + m] = acc;
  }
  for (let j = m - 1; j >= 0; j--) {
    let acc = 0;
    for (let t = j; t < m; t++) acc -= tn[t].text.length;
    dp[n * W + j] = acc;
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      let best = -Infinity;
      if (td[i].text === tn[j].text) best = 2 * td[i].text.length + dp[(i + 1) * W + j + 1];
      const del = -td[i].text.length + dp[(i + 1) * W + j];
      if (del > best) best = del;
      const ins = -tn[j].text.length + dp[i * W + j + 1];
      if (ins > best) best = ins;
      dp[i * W + j] = best;
    }
  }
  const start = new Int32Array(Cdoc.length);
  const matched = new Uint8Array(Cdoc.length);
  let i = 0, j = 0, docPos = 0, newPos = 0;
  while (i < n || j < m) {
    if (i < n && j < m && td[i].text === tn[j].text
      && dp[i * W + j] === 2 * td[i].text.length + dp[(i + 1) * W + j + 1]) {
      for (let c = 0; c < td[i].text.length; c++) { start[docPos + c] = newPos + c; matched[docPos + c] = 1; }
      docPos += td[i].text.length; newPos += td[i].text.length; i++; j++;
    } else if (i < n && dp[i * W + j] === -td[i].text.length + dp[(i + 1) * W + j]) {
      for (let c = 0; c < td[i].text.length; c++) start[docPos + c] = newPos;   // deleted -> insertion point
      docPos += td[i].text.length; i++;
    } else {
      newPos += tn[j].text.length; j++;               // inserted -> attaches to previous region
    }
  }
  // the last slot's region extends to the end of Cnew: trailing deletions map
  // to the insertion point, and any trailing inserted chars belong to it.
  return { start, matched, tail: Cnew.length };
}

// ---------- raw-XML span helpers ----------
// Paired-open patterns use [^/]*[^/] so a self-closing tag (<w:p .../>) is
// never consumed as an opening tag (which would swallow everything up to the
// next closing tag).
function findSpans(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*[^/])?>[\\s\\S]*?<\\/${tag}>`, 'g');
  const spans = [];
  let mch;
  while ((mch = re.exec(xml)) !== null) spans.push({ s: mch.index, e: mch.index + mch[0].length });
  return spans;
}
function findInnerSpans(spanXml, tag) {
  const rePair = new RegExp(`<${tag}(?:\\s[^>]*[^/])?>[\\s\\S]*?<\\/${tag}>|<${tag}(?:\\s[^>]*)?\\/>`, 'g');
  const spans = [];
  let mch;
  while ((mch = rePair.exec(spanXml)) !== null) spans.push({ s: mch.index, e: mch.index + mch[0].length });
  return spans;
}
function textSlots(spanXml, tag) {
  const re = new RegExp(`<${tag}(\\s[^>]*[^/])?>([\\s\\S]*?)<\\/${tag}>|<${tag}(\\s[^>]*)?\\/>`, 'g');
  const out = [];
  let mch;
  while ((mch = re.exec(spanXml)) !== null) {
    out.push({ s: mch.index, e: mch.index + mch[0].length, content: mch[2] !== undefined ? mch[2] : '' });
  }
  return out;
}

// rewrite each slot's element with new content, preserving attributes
function applyRedistribution(spanXml, slots, newTexts) {
  let res = '';
  let pos = 0;
  slots.forEach((sl, k) => {
    res += spanXml.slice(pos, sl.s);
    const el = spanXml.slice(sl.s, sl.e);
    const openEnd = el.indexOf('>');
    const open = el.slice(0, openEnd + 1);
    const tagName = /^<([^\s/>]+)/.exec(open)[1];
    if (open.endsWith('/>')) {
      res += newTexts[k] === '' ? el : `${open.slice(0, -2)}>${esc(newTexts[k])}</${tagName}>`;
    } else {
      res += open + esc(newTexts[k]) + `</${tagName}>`;
    }
    pos = sl.e;
  });
  res += spanXml.slice(pos);
  return res;
}

// ---------- paragraph run rebuild with formatting transfer ----------
// The v13 prose can restructure sentences, so text cannot always be
// redistributed across the v20 runs. Instead the paragraph is rebuilt:
// matched chars keep the formatting of their source run, inserted prose gets
// the paragraph's base format, and a deleted formatted phrase that reappears
// verbatim in the new text recovers its formatting (e.g. italic "csp").
function paraRuns(spanXml) {
  const pprM = /<w:pPr\b[\s\S]*?<\/w:pPr>/.exec(spanXml);
  const openM = /<w:p(?:\s[^>]*[^/])?>/.exec(spanXml);
  const runs = [];
  const re = /<w:r(?:\s[^>]*[^/])?>([\s\S]*?)<\/w:r>/g;
  let m;
  while ((m = re.exec(spanXml)) !== null) {
    const body = m[1];
    const rprM = /<w:rPr\b[\s\S]*?<\/w:rPr>/.exec(body);
    let text = '';
    for (const t of body.matchAll(/<w:t(\s[^>]*[^/])?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>/g)) {
      text += t[2] !== undefined ? unesc(t[2]) : '';
    }
    if (text.length > 0) runs.push({ text, rpr: rprM ? rprM[0] : '' });
  }
  return { open: openM ? openM[0] : '<w:p>', ppr: pprM ? pprM[0] : '', runs };
}

function locatePattern(pattern, target, center) {
  // semi-global alignment of pattern into target (free start/end), minimizing
  // edit distance with a tiny bias toward `center`. Returns per-pattern-char
  // target positions (-1 for deletions), or null if impossible.
  const n = pattern.length, m = target.length;
  if (n === 0 || m === 0) return null;
  const W = m + 1;
  const dp = new Float64Array((n + 1) * W);
  for (let j = 0; j <= m; j++) dp[j] = 0;                     // free start
  for (let i = 1; i <= n; i++) {
    dp[i * W] = i;
    const pi = pattern.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const sub = dp[(i - 1) * W + j - 1] + (pi === target.charCodeAt(j - 1) ? 0 : 1);
      const del = dp[(i - 1) * W + j] + 1;
      const ins = dp[i * W + j - 1] + 1;
      let best = sub;
      if (del < best) best = del;
      if (ins < best) best = ins;
      dp[i * W + j] = best;
    }
  }
  let bestJ = m, bestC = Infinity;
  for (let j = 0; j <= m; j++) {
    const c = dp[n * W + j] + Math.abs(j - center) * 1e-4;
    if (c < bestC) { bestC = c; bestJ = j; }
  }
  const pos = new Int32Array(n).fill(-1);
  let i = n, j = bestJ;
  const eps = 1e-9;
  while (i > 0 && j >= 0) {
    const cur = dp[i * W + j];
    const pi = pattern.charCodeAt(i - 1);
    if (j > 0 && dp[(i - 1) * W + j - 1] + (pi === target.charCodeAt(j - 1) ? 0 : 1) <= cur + eps) {
      pos[i - 1] = j - 1; i--; j--;
    } else if (dp[(i - 1) * W + j] + 1 <= cur + eps) {
      i--;                                                    // deletion
    } else {
      j--;                                                    // insertion
    }
  }
  return pos;
}

function rebuildPara(spanXml, newText) {
  const { open, ppr, runs } = paraRuns(spanXml);
  const docText = runs.map(r => r.text).join('');
  if (docText === newText) return null;                     // unchanged -> keep original XML
  const A = alignStarts(docText, newText);
  // formatting (rpr string) per doc char
  const props = [];
  for (const r of runs) for (let c = 0; c < r.text.length; c++) props.push(r.rpr);
  // base format = majority rpr by char count
  const counts = new Map();
  for (const p of props) counts.set(p, (counts.get(p) || 0) + 1);
  let base = '', bestN = -1;
  for (const [p, n] of counts) if (n > bestN) { bestN = n; base = p; }
  // deleted clusters of special (non-base) formatting — recovered into the new
  // text by context-anchored fuzzy alignment: the cluster plus up to 16 chars
  // of doc context on each side is aligned (semi-global edit distance, biased
  // toward the DP insertion point) into the new text, and the aligned cluster
  // chars receive the cluster's formatting.
  const clusters = [];
  let ci = -1;
  for (let i = 0; i < docText.length; i++) {
    if (props[i] !== base && !A.matched[i]) {
      if (ci >= 0 && clusters[ci].rpr === props[i] && clusters[ci].end === i) clusters[ci].end = i + 1;
      else { ci = clusters.length; clusters.push({ rpr: props[i], begin: i, end: i + 1 }); }
    } else ci = -1;
  }
  // formatting per new char
  const fmt = new Array(newText.length).fill(null);
  for (let i = 0; i < docText.length; i++) if (A.matched[i]) fmt[A.start[i]] = props[i];
  for (const c of clusters) {
    const b = Math.max(0, c.begin - 16);
    const a = Math.min(docText.length, c.end + 16);
    const pattern = docText.slice(b, a);
    const off = c.begin - b;
    const pos = locatePattern(pattern, newText, Math.min(A.start[c.begin], newText.length));
    if (!pos) continue;
    for (let q = off; q < off + (c.end - c.begin); q++) {
      const p = pos[q];
      if (p >= 0 && p < newText.length && (fmt[p] === null || fmt[p] === base)) fmt[p] = c.rpr;
    }
  }
  for (let k = 0; k < newText.length; k++) if (fmt[k] === null) fmt[k] = base;
  // emit runs grouped by identical formatting
  let runsXml = '';
  let k = 0;
  while (k < newText.length) {
    const rpr = fmt[k];
    let e = k;
    while (e < newText.length && fmt[e] === rpr) e++;
    runsXml += `<w:r>${rpr}<w:t xml:space="preserve">${esc(newText.slice(k, e))}</w:t></w:r>`;
    k = e;
  }
  return `${open}${ppr}${runsXml}</w:p>`;
}

// ---------- cell elements: w:t slots + fixed w:br/w:tab pseudo-slots ----------
// Extraction semantics: w:br/w:cr -> ' ', w:tab -> '\t'. The pseudo-slots stay
// in the XML unchanged and claim their aligned character in the new text.
function cellElements(spanXml) {
  const re = /<w:t(\s[^>]*[^/])?>([\s\S]*?)<\/w:t>|<w:t(\s[^>]*)?\/>|<w:(?:br|cr|tab)(?:\s[^>]*)?\/>|<w:(?:br|cr|tab)(?:\s[^>]*)?>/g;
  const els = [];
  let m;
  while ((m = re.exec(spanXml)) !== null) {
    if (m[0].startsWith('<w:t')) els.push({ kind: 't', s: m.index, e: m.index + m[0].length, text: m[2] !== undefined ? unesc(m[2]) : '' });
    else els.push({ kind: m[0].startsWith('<w:tab') ? 'tab' : 'br', s: m.index, e: m.index + m[0].length });
  }
  return els;
}
const elChar = e => (e.kind === 't' ? e.text : e.kind === 'tab' ? '\t' : ' ');

function redistributeEls(els, Cnew) {
  const regions = slotRegions(els.map(elChar), Cnew);
  if (regions === null) return null;                       // unchanged -> keep original XML
  els.forEach((el, k) => {
    if (el.kind !== 't' && regions[k] !== elChar(el)) console.warn(`warn: fixed element ${k} (${el.kind}) region ${JSON.stringify(regions[k])}`);
  });
  return regions;
}

function applyEls(spanXml, els, newTexts) {
  let res = '';
  let pos = 0;
  els.forEach((el, k) => {
    res += spanXml.slice(pos, el.s);
    if (el.kind === 't') {
      const elXml = spanXml.slice(el.s, el.e);
      const openEnd = elXml.indexOf('>');
      const open = elXml.slice(0, openEnd + 1);
      const tagName = /^<([^\s/>]+)/.exec(open)[1];
      if (open.endsWith('/>')) {
        res += newTexts[k] === '' ? elXml : `${open.slice(0, -2)}>${esc(newTexts[k])}</${tagName}>`;
      } else {
        res += open + esc(newTexts[k]) + `</${tagName}>`;
      }
    } else {
      res += spanXml.slice(el.s, el.e);                    // br/tab kept verbatim
    }
    pos = el.e;
  });
  res += spanXml.slice(pos);
  return res;
}

// slot-boundary DP lives in slot_lib.js

// bold every run in a row's XML (used to mark the wheel with max nmot)
function boldRow(xml) {
  let out = xml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (m, inner) =>
    inner.includes('<w:b') || inner.includes('<w:b ') ? m : '<w:rPr><w:b/>' + inner + '</w:rPr>');
  out = out.replace(/<w:r(\s[^>]*[^/])?>(<w:t)/g, '<w:r$1><w:rPr><w:b/></w:rPr>$2');
  return out;
}
function unboldRow(xml) {
  return xml.replace(/<w:b\s*\/>/g, '').replace(/<w:bCs\s*\/>/g, '');
}
// ---------- main ----------
function main() {
  const V = compute(getInputs(v));
  const M = templates.build(V);
  const P = paraT.build(V);
  const TB = buildTables(V);

  const zip = new AdmZip(SRC);
  const xml = zip.readAsText(zip.getEntry('word/document.xml'));

  const units = JSON.parse(fs.readFileSync('units.json', 'utf8')).units;
  const mathUnits = units.filter(u => u.type === 'math');
  const paraUnits = units.filter(u => u.type === 'para');
  const tableUnits = units.filter(u => u.type === 'table');

  const tblSpans = findSpans(xml, 'w:tbl');
  if (tblSpans.length !== tableUnits.length) throw new Error(`tbl spans ${tblSpans.length} != ${tableUnits.length}`);
  const pSpansAll = findSpans(xml, 'w:p');
  const pSpans = pSpansAll.filter(sp => !tblSpans.some(t => sp.s >= t.s && sp.e <= t.e));
  if (pSpans.length !== paraUnits.length) throw new Error(`para spans ${pSpans.length} != ${paraUnits.length}`);

  const regions = [
    ...tblSpans.map((sp, i) => ({ ...sp, kind: 'tbl', idx: i })),
    ...pSpans.map((sp, i) => ({ ...sp, kind: 'para', idx: i })),
  ].sort((a, b) => a.s - b.s);

  const stats = { math: 0, para: 0, table: 0 };
  let outXml = '';
  let pos = 0;

  for (const rg of regions) {
    outXml += xml.slice(pos, rg.s);
    const spanXml = xml.slice(rg.s, rg.e);
    if (rg.kind === 'tbl') {
      const tbUnit = tableUnits[rg.idx];
      const gen = TB[tbUnit.id];
      if (gen) {
        const rowSpans = findInnerSpans(spanXml, 'w:tr');
        if (rowSpans.length !== tbUnit.rows.length) throw new Error(`table ${tbUnit.id}: rows ${rowSpans.length} != ${tbUnit.rows.length}`);
        let tOut = '';
        let rp = 0;
        // for wheel tables, compute max nmot to bold the best wheel
        const isWheel = (tbUnit.id === 279 || tbUnit.id === 360);
        const nmotCol = 4; // "nmot [rot/min]" column index
        const maxNmot = isWheel ? Math.max(...gen.map(r => parseInt(String(r[nmotCol]).replace(/\D/g, ''), 10) || 0)) : 0;
        rowSpans.forEach((row, ri) => {
          const rowXml = spanXml.slice(row.s, row.e);
          const cellSpans = findInnerSpans(rowXml, 'w:tc');
          if (cellSpans.length !== tbUnit.rows[ri].length) throw new Error(`table ${tbUnit.id} row ${ri}: cells ${cellSpans.length} != ${tbUnit.rows[ri].length}`);
          let rOut = '';
          let cp = 0;
          cellSpans.forEach((cell, ci) => {
            const cellXml = rowXml.slice(cell.s, cell.e);
            let newCellXml = cellXml;
            const els = cellElements(cellXml);
            const newTexts = redistributeEls(els, String(gen[ri][ci]));
            if (newTexts !== null) {
              newCellXml = applyEls(cellXml, els, newTexts);
              stats.table++;
            }
            rOut += rowXml.slice(cp, cell.s) + newCellXml;
            cp = cell.e;
          });
          rOut += rowXml.slice(cp);
          if (isWheel) {
            const rowNmot = parseInt(String(gen[ri][nmotCol]).replace(/\D/g, ''), 10) || 0;
            if (ri > 0) rOut = (rowNmot === maxNmot) ? boldRow(rOut) : unboldRow(rOut);
          }
          tOut += spanXml.slice(rp, row.s) + rOut;
          rp = row.e;
        });
        tOut += spanXml.slice(rp);
        outXml += tOut;
      } else {
        outXml += spanXml;
      }
    } else {
      const pUnit = paraUnits[rg.idx];
      const gen = P[pUnit.id];
      if (gen && !pUnit.text.startsWith('⟦')) {
        const rebuilt = rebuildPara(spanXml, gen());
        if (rebuilt !== null) { outXml += rebuilt; stats.para++; }
        else outXml += spanXml;
      } else {
        outXml += spanXml;
      }
    }
    pos = rg.e;
  }
  outXml += xml.slice(pos);

  if (process.env.DEBUG_OUTXML) fs.writeFileSync('outXml_debug.xml', outXml, 'utf8');

  // math pass over the (edited) xml
  {
    const spans = findSpans(outXml, 'm:oMath');
    if (spans.length !== mathUnits.length) throw new Error(`math spans after edit ${spans.length} != ${mathUnits.length}`);
    let res = '';
    let mp = 0;
    spans.forEach((sp, k) => {
      res += outXml.slice(mp, sp.s);
      const spanXml = outXml.slice(sp.s, sp.e);
      const slots = textSlots(spanXml, 'm:t');
      const docTexts = slots.map(sl => unesc(sl.content));
      const gen = M[mathUnits[k].id];
      if (!gen) throw new Error(`no math template for id ${mathUnits[k].id}`);
      const newTexts = slotRegions(docTexts, gen());
      if (newTexts !== null) {
        res += applyRedistribution(spanXml, slots, newTexts);
        stats.math++;
      } else {
        res += spanXml;
      }
      mp = sp.e;
    });
    res += outXml.slice(mp);
    outXml = res;
  }

  const newZip = new AdmZip();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    let data;
    if (entry.entryName === 'word/document.xml') data = Buffer.from(outXml, 'utf8');
    else if (entry.entryName === 'docProps/core.xml') data = Buffer.from(zip.readAsText(entry).replace('(varianta 20)', `(varianta ${v})`), 'utf8');
    else data = zip.readFile(entry);
    newZip.addFile(entry.entryName, data);
  }
  newZip.writeZip(OUT);
  console.log(`written ${OUT}`);
  console.log(`changed: math ${stats.math}, paragraphs ${stats.para}, table cells ${stats.table}`);
}

main();
