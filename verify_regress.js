// verify_regress.js — regression: generated units for a variant vs an existing docx extraction
// usage: node verify_regress.js <variant> <extract.json>
const fs = require('fs');
const { compute, getInputs } = require('./compute');
const templates = require('./templates');
const paraT = require('./para_templates');
const { buildTables } = require('./tables');

const variant = parseInt(process.argv[2] || '20');
const extract = process.argv[3] || 'units.json';

const V = compute(getInputs(variant));
const M = templates.build(V);
const P = paraT.build(V);
const TB = buildTables(V);

const units = JSON.parse(fs.readFileSync(extract, 'utf8')).units;

let fail = 0;
const bad = (msg) => { fail++; if (fail <= 20) console.log('FAIL:', msg); };

// math
const gMath = units.filter(u => u.type === 'math');
let mathN = 0;
gMath.forEach((u, k) => {
  const gen = M[u.id];
  if (!gen) return;                      // ⟦-wrapped handled below
  const want = gen();
  if (u.text !== want) bad(`math id ${u.id} (#${k}):\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(u.text)}`);
  mathN++;
});
console.log('math checked:', mathN);

// paragraphs
const gPara = units.filter(u => u.type === 'para');
let genN = 0, wrapN = 0, statN = 0;
gPara.forEach((u, k) => {
  if (u.text.startsWith('⟦')) {
    wrapN++;
    const kMath = units.indexOf(u) - 1;
    const paired = units[kMath];
    if (paired.type !== 'math') { bad(`⟦-para id ${u.id}: previous unit not math`); return; }
    const gen = M[paired.id];
    if (!gen) { bad(`⟦-para id ${u.id}: no math template id ${paired.id}`); return; }
    const want = `⟦${gen()}⟧`;
    if (u.text !== want) bad(`⟦-para id ${u.id}: want ${JSON.stringify(want)} got ${JSON.stringify(u.text)}`);
  } else if (P[u.id]) {
    genN++;
    const want = P[u.id]();
    if (u.text !== want) bad(`para id ${u.id}:\n  want ${JSON.stringify(want.slice(0, 120))}\n  got  ${JSON.stringify(u.text.slice(0, 120))}`);
  } else {
    statN++;
  }
});
console.log(`paras checked: ${gPara.length} (generated ${genN}, ⟦-wrapped ${wrapN}, static ${statN})`);

// tables
const gTbl = units.filter(u => u.type === 'table');
let cellN = 0;
gTbl.forEach((u, k) => {
  const gen = TB[u.id];
  if (!gen) { bad(`no table generator id ${u.id}`); return; }
  if (u.rows.length !== gen.length) { bad(`table ${u.id}: rows ${u.rows.length} != ${gen.length}`); return; }
  gen.forEach((row, ri) => {
    if (u.rows[ri].length !== row.length) { bad(`table ${u.id} row ${ri}: cols ${u.rows[ri].length} != ${row.length}`); return; }
    row.forEach((want, ci) => {
      cellN++;
      if (u.rows[ri][ci] !== String(want)) bad(`table ${u.id} R${ri}C${ci}: want ${JSON.stringify(String(want))} got ${JSON.stringify(u.rows[ri][ci])}`);
    });
  });
});
console.log('table cells checked:', cellN);

console.log(fail === 0 ? `\nREGRESSION OK (v${variant} vs ${extract})` : `\n${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
