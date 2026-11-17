// extract.js — extract ordered replaceable units from a docx:
//  - math units (linearized OMML text + the list of its m:t runs)
//  - paragraph units outside tables (concatenated w:t + per-run texts)
//  - table units (grid of cell texts, each cell = list of run texts)
// Writes JSON: { units: [...] }
const fs = require('fs');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

const file = process.argv[2];
const out = process.argv[3] || 'units.json';

const zip = new AdmZip(file);
const xml = zip.readAsText(zip.getEntry('word/document.xml'));
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, trimValues: false, parseTagValue: false, parseAttributeValue: false });
const tree = parser.parse(xml);

const asArray = x => Array.isArray(x) ? x : (x == null || x === '' ? [] : [x]);
const tagOf = n => Object.keys(n)[0];

// collect all text pieces (w:t and m:t) in document order under a node
function collectText(nodes, out, runs, inMath) {
  for (const n of asArray(nodes)) {
    if (!n || typeof n !== 'object') continue;
    const tag = tagOf(n);
    if (tag === '#text') { out.push(String(n['#text'])); if (runs) runs.push(String(n['#text'])); continue; }
    if (tag === ':@') continue;
    const kids = n[tag];
    if (tag === 'w:t' || tag === 'm:t') { collectText(kids, out, runs, inMath); continue; }
    if (tag === 'w:tab') { out.push('\t'); continue; }
    if (tag === 'w:br' || tag === 'w:cr') { out.push('\n'); continue; }
    collectText(kids, out, runs, inMath);
  }
}

const units = [];
let id = 0;

// Linearize a node list into flat text; math wrapped in ⟦...⟧; returns string.
function linearText(nodes) {
  const out = [];
  const walk = (ns) => {
    for (const n of asArray(ns)) {
      if (!n || typeof n !== 'object') continue;
      const tag = tagOf(n);
      if (tag === ':@') continue;
      if (tag === '#text') { out.push(String(n['#text'])); continue; }
      if (tag === 'w:t' || tag === 'm:t') { walk(n[tag]); continue; }
      if (tag === 'w:tab') { out.push('\t'); continue; }
      if (tag === 'w:br' || tag === 'w:cr') { out.push(' '); continue; }
      if (tag === 'm:oMath' || tag === 'm:oMathPara') {
        const t2 = [];
        const w2 = (ns2) => { for (const m of asArray(ns2)) { if (!m || typeof m !== 'object') continue; const tg = tagOf(m); if (tg === ':@') continue; if (tg === '#text') { t2.push(String(m['#text'])); continue; } if (tg === 'w:t' || tg === 'm:t') { w2(m[tg]); continue; } w2(m[tg]); } };
        w2(n[tag]);
        out.push('⟦' + t2.join('') + '⟧');
        continue;
      }
      walk(n[tag]);
    }
  };
  walk(nodes);
  return out.join('');
}

function handleParagraph(pnode) {
  // math sub-units in order
  const walk = (nodes) => {
    for (const n of asArray(nodes)) {
      if (!n || typeof n !== 'object') continue;
      const tag = tagOf(n);
      if (tag === ':@') continue;
      if (tag === 'm:oMath' || tag === 'm:oMathPara') {
        units.push({ id: id++, type: 'math', text: linearText(n[tag]).replace(/[⟦⟧]/g, '') });
        continue;
      }
      walk(n[tag]);
    }
  };
  walk(pnode['w:p']);
  units.push({ id: id++, type: 'para', text: linearText(pnode['w:p']) });
}

function handleTable(tnode) {
  const rows = [];
  for (const r of asArray(tnode['w:tbl'])) {
    if (tagOf(r) !== 'w:tr') continue;
    const cells = [];
    for (const c of asArray(r['w:tr'])) {
      if (tagOf(c) !== 'w:tc') continue;
      cells.push(linearText(c['w:tc']));
    }
    rows.push(cells);
  }
  units.push({ id: id++, type: 'table', rows });
}

function walkBody(children) {
  for (const n of asArray(children)) {
    if (!n || typeof n !== 'object') continue;
    const tag = tagOf(n);
    if (tag === 'w:p') handleParagraph(n);
    else if (tag === 'w:tbl') handleTable(n);
    else if (tag === 'w:sdt' || tag === 'w:sdtContent' || tag === 'w:body' || tag === 'w:document') walkBody(n[tag]);
  }
}
walkBody(tree);

fs.writeFileSync(out, JSON.stringify({ units }, null, 1), 'utf8');
console.log(`units: ${units.length} (math: ${units.filter(u => u.type === 'math').length}, para: ${units.filter(u => u.type === 'para').length}, table: ${units.filter(u => u.type === 'table').length}) -> ${out}`);
