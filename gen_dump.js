// gen_dump.js — dump all generated texts (math + paras + tables) for a variant
const c = require('./compute');
const templates = require('./templates');
const partA = require('./para_partA');
const partB = require('./para_partB');
const tables = require('./tables');
const v = parseInt(process.argv[2] || '20');
const V = c.compute(c.getInputs(v));
const mathRaw = templates.build(V);
const math = {};
for (const k of Object.keys(mathRaw)) math[k] = mathRaw[k]();   // invoke generators
const tRaw = {};
partA.buildA(V, tRaw);
partB.buildB(V, tRaw);
const paras = {};
for (const k of Object.keys(tRaw)) paras[k] = tRaw[k]();   // invoke generators (JSON.stringify drops functions)
const tabs = tables.buildTables(V);
console.log(JSON.stringify({ math, paras, tables: tabs }, null, 1));
