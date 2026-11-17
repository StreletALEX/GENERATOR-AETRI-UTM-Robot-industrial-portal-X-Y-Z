// verify_final.js — end-to-end verification of the written docx
// usage: node verify_final.js [variant]   (default 13)
const fs = require('fs');
const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');
const { compute, getInputs } = require('./compute');
const templates = require('./templates');
const paraT = require('./para_templates');
const { buildTables } = require('./tables');

const v = parseInt(process.argv[2] || '13', 10);
const SRC = 'C:/Users/DSV/Desktop/Lucrare/New folder/Proiect_Varianta20_verificat.docx';
const OUT = process.argv[3] || `C:/Users/DSV/Desktop/Lucrare/New folder/${v === 13 ? 'Varianta mea' : 'Varianta ' + v}.docx`;

const V = compute(getInputs(v));
const M = templates.build(V);
const P = paraT.build(V);
const TB = buildTables(V);

const srcUnits = JSON.parse(fs.readFileSync('units.json', 'utf8')).units;
const outUnits = JSON.parse(fs.readFileSync(v === 13 ? 'units_out.json' : `units_${v}.json`, 'utf8')).units;

let fail = 0;
const bad = (msg) => { fail++; if (fail <= 20) console.log('FAIL:', msg); };

// 0. positional type alignment
if (srcUnits.length !== outUnits.length) bad(`unit count ${srcUnits.length} != ${outUnits.length}`);
for (let i = 0; i < Math.min(srcUnits.length, outUnits.length); i++) {
  if (srcUnits[i].type !== outUnits[i].type) bad(`type mismatch at ${i}: ${srcUnits[i].type} vs ${outUnits[i].type}`);
}

// 1. math
const srcMath = srcUnits.filter(u => u.type === 'math');
const outMath = outUnits.filter(u => u.type === 'math');
if (srcMath.length !== outMath.length) bad('math count mismatch');
srcMath.forEach((u, k) => {
  const gen = M[u.id];
  if (!gen) { bad(`no math template id ${u.id}`); return; }
  const want = gen();
  if (outMath[k].text !== want) bad(`math id ${u.id} (#${k}):\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(outMath[k].text)}`);
});
console.log('math checked:', srcMath.length);

// 2. paragraphs
const srcPara = srcUnits.filter(u => u.type === 'para');
const outPara = outUnits.filter(u => u.type === 'para');
let genN = 0, mathwrapN = 0, statN = 0;
srcPara.forEach((u, k) => {
  const got = outPara[k].text;
  if (u.text.startsWith('⟦')) {
    // ⟦-para: paired math unit is the immediately preceding math unit in unit order
    mathwrapN++;
    const inner = u.text.slice(1, -1);
    const kMath = srcUnits.indexOf(u) - 1;
    const paired = srcUnits[kMath];
    if (paired.type !== 'math') { bad(`⟦-para id ${u.id}: previous unit not math (${paired.type})`); return; }
    const gen = M[paired.id];
    if (!gen) { bad(`⟦-para id ${u.id}: no math template id ${paired.id}`); return; }
    const want = `⟦${gen()}⟧`;
    if (got !== want) bad(`⟦-para id ${u.id}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
  } else if (P[u.id]) {
    genN++;
    const want = P[u.id]();
    if (got !== want) bad(`para id ${u.id}:\n  want ${JSON.stringify(want.slice(0, 100))}\n  got  ${JSON.stringify(got.slice(0, 100))}`);
  } else {
    statN++;
    if (got !== u.text) bad(`static para id ${u.id} changed:\n  src ${JSON.stringify(u.text.slice(0, 80))}\n  out ${JSON.stringify(got.slice(0, 80))}`);
  }
});
console.log(`paras checked: ${srcPara.length} (generated ${genN}, ⟦-wrapped ${mathwrapN}, static ${statN})`);

// 3. tables
const srcTbl = srcUnits.filter(u => u.type === 'table');
const outTbl = outUnits.filter(u => u.type === 'table');
let cellN = 0;
srcTbl.forEach((u, k) => {
  const gen = TB[u.id];
  if (!gen) { bad(`no table generator id ${u.id}`); return; }
  if (outTbl[k].rows.length !== gen.length) { bad(`table ${u.id}: rows ${outTbl[k].rows.length} != ${gen.length}`); return; }
  gen.forEach((row, ri) => {
    if (outTbl[k].rows[ri].length !== row.length) { bad(`table ${u.id} row ${ri}: cols ${outTbl[k].rows[ri].length} != ${row.length}`); return; }
    row.forEach((want, ci) => {
      cellN++;
      if (outTbl[k].rows[ri][ci] !== String(want)) bad(`table ${u.id} R${ri}C${ci}: want ${JSON.stringify(String(want))} got ${JSON.stringify(outTbl[k].rows[ri][ci])}`);
    });
  });
});
console.log('table cells checked:', cellN);

// 4. core.xml title
{
  const zo = new AdmZip(OUT);
  const core = zo.readAsText(zo.getEntry('docProps/core.xml'));
  if (!core.includes(`(varianta ${v})`)) bad(`core.xml title missing "(varianta ${v})": ${JSON.stringify(core.slice(0, 400))}`);
  else console.log('core.xml title OK');
}

// 5. document.xml parses cleanly
{
  const zo = new AdmZip(OUT);
  const xml = zo.readAsText(zo.getEntry('word/document.xml'));
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false });
  try {
    parser.parse(xml);
    console.log('document.xml parses OK, length', xml.length);
  } catch (e) { bad(`document.xml parse error: ${e.message}`); }
  // no duplicated table tails
  const dupTail = xml.split('</w:tbl></w:tc>').length - 1; // sanity only
}

// 6. non-document zip parts byte-identical (except docProps/core.xml)
{
  const za = new AdmZip(SRC), zo = new AdmZip(OUT);
  const namesA = za.getEntries().map(e => e.entryName).sort();
  const namesB = zo.getEntries().map(e => e.entryName).sort();
  if (JSON.stringify(namesA) !== JSON.stringify(namesB)) bad(`zip entry lists differ: ${JSON.stringify(namesA)} vs ${JSON.stringify(namesB)}`);
  const exceptions = new Set(['word/document.xml', 'docProps/core.xml']);
  for (const name of namesA) {
    if (exceptions.has(name)) continue;
    const a = za.getEntry(name).getData();
    const b = zo.getEntry(name).getData();
    if (Buffer.compare(a, b) !== 0) bad(`zip part differs: ${name}`);
  }
  console.log('zip parts compared (excluding document.xml, core.xml)');
}

console.log(fail === 0 ? '\nALL CHECKS PASSED' : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
