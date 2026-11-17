// para_templates.js — aggregates paragraph generators; returns { id: () => string }
const { buildA } = require('./para_partA');
const { buildB } = require('./para_partB');

function build(V) {
  const t = {};
  buildA(V, t);
  buildB(V, t);
  return t;
}

module.exports = { build };
