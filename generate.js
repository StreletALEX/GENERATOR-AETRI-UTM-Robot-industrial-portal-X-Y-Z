// generate.js — one-command pipeline: data -> docx -> verify
// Usage:
//   node generate.js <variant>                       # existing variant (12/13/20)
//   node generate.js --data <file.json> [--variant N] # new variant from a data file
//   node generate.js --data <file.csv>  [--variant N] # new variant from a CSV (key,value)
//
// Data file format (JSON): object with the variant fields, e.g.
//   { "mp":30, "mg":8, "SX":2.5, "tX":3.5, "mX":120, "F0X":100,
//     "SY":1, "tY":1.8, "mY":45, "F0Y":50, "hZ":0.6, "tZ":1.4, "mZ":40,
//     "alpha":1, "mu":0.01, "tp":0.8, "aadm":2, "ds":0.5, "Lh":25000,
//     "Tamb":25, "U_retea":400, "trans_X":"CD", "trans_Y":"CD", "trans_Z":"SB" }
// CSV format: "key,value" per line (varianta,<n> optional).
//
// Output: "Varianta <n>.docx" (or "Varianta mea.docx" for 13) + units_<n>.json
//         in C:/Users/DSV/Desktop/Lucrare/New folder/
const fs = require('fs');
const { spawnSync } = require('child_process');

const BASE = 'C:/Users/DSV/Desktop/Lucrare/New folder';
const ROOT = 'C:/Users/DSV/Documents/Default Project';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.status !== 0) { console.error(`FAILED: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); }
}

function parseCSV(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf(',');
    if (idx < 0) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim();
    if (!k) continue;
    if (k.toLowerCase() === 'varianta') { out._variant = v; continue; }
    const num = Number(v);
    out[k] = isNaN(num) ? v : num;
  }
  // normalize keys to the compute.js field names
  const map = { Mp:'mp', Mg:'mg', sx:'SX', tx:'tX', Mx:'mX', F0x:'F0X', sy:'SY', ty:'tY', My:'mY', F0y:'F0Y', sz:'hZ', tz:'tZ', Mz:'mZ', a:'alpha', F0z:'F0Z', Tp:'tp', Aadm:'aadm', '????':'ds', Lh:'Lh', Tamb:'Tamb' };
  const norm = {};
  for (const [k, v] of Object.entries(out)) {
    if (k === '_variant') { norm._variant = v; continue; }
    const nk = map[k] || k;
    norm[nk] = v;
  }
  // defaults for fields not in CSV
  if (norm.mu === undefined) norm.mu = 0.01;
  if (norm.ds === undefined && norm['????'] !== undefined) norm.ds = norm['????'];
  if (norm.U_retea === undefined) norm.U_retea = 400;
  if (norm.trans_X === undefined) norm.trans_X = 'CD';
  if (norm.trans_Y === undefined) norm.trans_Y = 'CD';
  if (norm.trans_Z === undefined) norm.trans_Z = 'SB';
  if (norm.varianta === undefined && norm._variant !== undefined) norm.varianta = Number(norm._variant);
  delete norm._variant;
  delete norm['????'];
  return norm;
}

// ---------- argument parsing ----------
const args = process.argv.slice(2);
let variant = null;
let dataFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--data') { dataFile = args[++i]; }
  else if (args[i] === '--variant') { variant = parseInt(args[++i], 10); }
  else if (!variant && !dataFile) { variant = parseInt(args[i], 10); }
}

// ---------- new variant from data file ----------
if (dataFile) {
  const raw = fs.readFileSync(dataFile, 'utf8');
  const data = dataFile.toLowerCase().endsWith('.csv') ? parseCSV(raw) : JSON.parse(raw);
  if (!data.varianta) {
    // pick next free variant number
    const existing = Object.keys(JSON.parse(fs.readFileSync(ROOT + '/variants.json', 'utf8') || '{}'));
    const nums = existing.map(Number).filter(n => !isNaN(n));
    data.varianta = variant || (Math.max(12, 13, 20, ...nums) + 1);
  }
  if (variant) data.varianta = variant;
  // store
  let store = {};
  try { store = JSON.parse(fs.readFileSync(ROOT + '/variants.json', 'utf8')); } catch (e) {}
  store[data.varianta] = data;
  fs.writeFileSync(ROOT + '/variants.json', JSON.stringify(store, null, 2), 'utf8');
  // register in compute.js if not already
  const computeSrc = fs.readFileSync(ROOT + '/compute.js', 'utf8');
  if (!computeSrc.includes(`if (v == ${data.varianta})`)) {
    // insert a new branch before "throw new Error('unknown variant')"
    const branch = `  if (v == ${data.varianta}) return ${JSON.stringify(data)};\n`;
    const patched = computeSrc.replace("  throw new Error('unknown variant');", branch + "  throw new Error('unknown variant');");
    fs.writeFileSync(ROOT + '/compute.js', patched, 'utf8');
    console.log(`Registered variant ${data.varianta} in compute.js`);
  }
  variant = data.varianta;
  console.log(`Variant ${variant} data saved.`);
}

if (!variant) { console.error('Usage: node generate.js <variant>  OR  node generate.js --data <file> [--variant N]'); process.exit(1); }

// ---------- run pipeline ----------
console.log(`\n=== Generating variant ${variant} ===`);
run('node', ['apply.js', String(variant)]);
run('node', ['extract.js', `${BASE}/Varianta ${variant === 13 ? 'mea' : variant}.docx`, `units_${variant}.json`]);
run('node', ['verify_final.js', String(variant)]);
console.log(`\nDONE. Output: ${BASE}/${variant === 13 ? 'Varianta mea' : 'Varianta ' + variant}.docx`);
