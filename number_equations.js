// number_equations.js — append (chapter.n) to every displayed equation paragraph
// Usage: node number_equations.js <input.docx> <output.docx>
const fs = require('fs');
const AdmZip = require('adm-zip');

const input = process.argv[2];
const output = process.argv[3] || input.replace('.docx', ' (numerotat).docx');

const zip = new AdmZip(input);
const xml = zip.readAsText(zip.getEntry('word/document.xml'));

// We need to walk paragraphs in order, track chapter, and append number to paragraphs containing m:oMath.
// Use regex to find <w:p>...</w:p> blocks (top-level, not in tables). Tables contain equations too?
// For simplicity, process all <w:p> blocks containing <m:oMath> that are NOT inside tables.
// Actually, let's process ALL w:p blocks with m:oMath (including table cells) for completeness.

// Strategy: split by <w:p> blocks, for each, check if contains m:oMath.
// Track chapter: if paragraph text matches /^\d+\./ or /^§\d/, update chapter.

const parser = null;
// We'll do regex-based replacement.

// First, find all w:p blocks
const pRe = /<w:p(?:\s[^>]*[^/])?>[\s\S]*?<\/w:p>/g;
let chapter = 0;
const counters = {};
function getChapter(text) {
  const m = text.match(/^\s*(\d+)\./);
  if (m) return parseInt(m[1]);
  return null;
}
function stripTags(s) { return s.replace(/<[^>]+>/g, ''); }

let result = xml;
// We need to process in order, tracking chapter. Use a manual scan.
let out = '';
let pos = 0;
let match;
// Reset regex
const re = /<w:p(?:\s[^>]*[^/])?>[\s\S]*?<\/w:p>/g;
let lastIdx = 0;
// Collect all matches with positions
const matches = [];
let m;
while ((m = re.exec(xml)) !== null) {
  matches.push({ index: m.index, length: m[0].length, text: m[0] });
}

// Now build output
let cursor = 0;
let eqCounter = {}; // chapter -> count
for (const mt of matches) {
  out += xml.slice(cursor, mt.index);
  const block = mt.text;
  const plainText = stripTags(block);
  // update chapter if heading
  const ch = getChapter(plainText);
  if (ch !== null) chapter = ch;
  // if contains m:oMath, append number
  if (block.includes('<m:oMath') || block.includes('<m:oMathPara')) {
    if (chapter === 0) chapter = 1;
    eqCounter[chapter] = (eqCounter[chapter] || 0) + 1;
    const num = ` (${chapter}.${eqCounter[chapter]})`;
    // Append as a new run before </w:p>. Find the last </w:r> or just insert before </w:p>.
    // Insert a run with the number text.
    const runXml = `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${num}</w:t></w:r>`;
    const newBlock = block.replace(/<\/w:p>$/, runXml + '</w:p>');
    out += newBlock;
  } else {
    out += block;
  }
  cursor = mt.index + mt.length;
}
out += xml.slice(cursor);

const newZip = new AdmZip();
for (const entry of zip.getEntries()) {
  if (entry.isDirectory) continue;
  let data;
  if (entry.entryName === 'word/document.xml') data = Buffer.from(out, 'utf8');
  else data = zip.readFile(entry);
  newZip.addFile(entry.entryName, data);
}
newZip.writeZip(output);
console.log('Written:', output);
console.log('Equations numbered:', Object.values(eqCounter).reduce((a,b)=>a+b,0));
console.log('Per chapter:', JSON.stringify(eqCounter));
