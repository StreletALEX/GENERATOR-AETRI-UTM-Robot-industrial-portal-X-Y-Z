// generate.js — one-command pipeline: data -> docx -> verify -> images
// Usage:
//   node generate.js <variant>                       # existing variant (12/13/20)
//   node generate.js --data <file.json> [--variant N] # new variant from a JSON data file
//   node generate.js --data <file.csv>  [--variant N] # new variant from a CSV (key,value)
//
// Creates a separate folder per variant: <BASE>/Varianta N/
// Contents: varianta.csv, Varianta N.docx, ciclograma.png, diagrame_sarcina.png
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = 'C:/Users/DSV/Desktop/Lucrare';
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
  const map = { Mp:'mp', Mg:'mg', sx:'SX', tx:'tX', Mx:'mX', F0x:'F0X', sy:'SY', ty:'tY', My:'mY', F0y:'F0Y', sz:'hZ', tz:'tZ', Mz:'mZ', a:'alpha', F0z:'F0Z', Tp:'tp', Aadm:'aadm', '????':'ds', S:'ds', Lh:'Lh', Tamb:'Tamb' };
  const norm = {};
  for (const [k, v] of Object.entries(out)) {
    if (k === '_variant') { norm._variant = v; continue; }
    const nk = map[k] || k;
    norm[nk] = v;
  }
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
    const existing = Object.keys(JSON.parse(fs.readFileSync(ROOT + '/variants.json', 'utf8') || '{}'));
    const nums = existing.map(Number).filter(n => !isNaN(n));
    data.varianta = variant || (Math.max(12, 13, 20, ...nums) + 1);
  }
  if (variant) data.varianta = variant;
  let store = {};
  try { store = JSON.parse(fs.readFileSync(ROOT + '/variants.json', 'utf8')); } catch (e) {}
  store[data.varianta] = data;
  fs.writeFileSync(ROOT + '/variants.json', JSON.stringify(store, null, 2), 'utf8');
  const computeSrc = fs.readFileSync(ROOT + '/compute.js', 'utf8');
  if (!computeSrc.includes(`if (v == ${data.varianta})`)) {
    const branch = `  if (v == ${data.varianta}) return ${JSON.stringify(data)};\n`;
    const patched = computeSrc.replace("  throw new Error('unknown variant');", branch + "  throw new Error('unknown variant');");
    fs.writeFileSync(ROOT + '/compute.js', patched, 'utf8');
    console.log(`Registered variant ${data.varianta} in compute.js`);
  }
  variant = data.varianta;
  console.log(`Variant ${variant} data saved.`);
}

if (!variant) { console.error('Usage: node generate.js <variant>  OR  node generate.js --data <file> [--variant N]'); process.exit(1); }

// ---------- create variant folder ----------
const variantDir = path.join(BASE, `Varianta ${variant}`);
fs.mkdirSync(variantDir, { recursive: true });

// copy CSV if exists
const srcCsv = path.join(BASE, 'New folder', 'varianta.csv');
// also check if there's a variant-specific CSV
let csvContent = null;
if (dataFile && dataFile.toLowerCase().endsWith('.csv')) {
  csvContent = fs.readFileSync(dataFile, 'utf8');
} else if (fs.existsSync(srcCsv)) {
  csvContent = fs.readFileSync(srcCsv, 'utf8');
  // update varianta number in CSV
  csvContent = csvContent.replace(/^varianta,\d+/m, `varianta,${variant}`);
}
if (csvContent) {
  fs.writeFileSync(path.join(variantDir, 'varianta.csv'), csvContent, 'utf8');
  console.log(`CSV written to ${variantDir}/varianta.csv`);
}

const docxName = (variant === 13) ? 'Varianta mea.docx' : `Varianta ${variant}.docx`;
const docxPath = path.join(variantDir, docxName);
const unitsFile = path.join(ROOT, `units_${variant}.json`);

// ---------- run pipeline ----------
console.log(`\n=== Generating variant ${variant} ===`);
run('node', ['apply.js', String(variant), docxPath]);
run('node', ['extract.js', docxPath, unitsFile]);
run('node', ['verify_final.js', String(variant), docxPath]);

// ---------- generate images ----------
// Write plot data JSON for Python (input data + belt/wheel selection from compute)
const plotDataPath = path.join(variantDir, '_plot_data.json');
run('node', ['-e', `const c=require('./compute');const V=c.compute(c.getInputs(${variant}));const d=Object.assign({},V.inp,{z:V.axX.z_ales,i_red:V.axX.i,b_belt:V.axX.bw,m_belt_pm:V.axX.mp_belt,p_belt:V.axX.dp_m,eta_c:0.96,eta_red:0.94,Jred:0.08e-4,Jc_X:0.2e-4,Jr_X:V.motX['Jr_1e-4']*1e-4,MN_X:V.motX.MN,Jp_Y:V.axY.Jp||3.0e-4,Jc_Y:0.6e-4,Jr_Y:V.motY['Jr_1e-4']*1e-4,MN_Y:V.motY.MN,Jp_Z:0.5e-4,Jc_Z:0.2e-4,Jr_Z:V.motZ['Jr_1e-4']*1e-4,Jfr_Z:V.motZ['Jfr_1e-4']*1e-4,MN_Z:V.motZ.MN,P_Z:0.016,eta_Z:0.93,P_Y:0.025,eta_Y:0.93});require('fs').writeFileSync(${JSON.stringify(plotDataPath)}, JSON.stringify(d));`]);
// Generate images
run('python', [path.join(ROOT, 'gen_images.py'), plotDataPath, variantDir]);
// Clean up plot data
fs.unlinkSync(plotDataPath);

console.log(`\nDONE. Output folder: ${variantDir}`);
console.log(`  - varianta.csv`);
console.log(`  - ${docxName}`);
console.log(`  - ciclograma.png`);
console.log(`  - diagrame_sarcina.png`);
