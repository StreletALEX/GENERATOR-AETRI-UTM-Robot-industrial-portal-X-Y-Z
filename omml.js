// omml.js - Convert simple math markup to OMML XML
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function wrapText(s) { if (s === '') return ''; return '<m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t>' + esc(s) + '</m:t></m:r>'; }

function parse(markup) {
  const nodes = [];
  let i = 0;
  let textBuf = '';
  function flushText() { if (textBuf !== '') { nodes.push({ type: 'text', value: textBuf }); textBuf = ''; } }
  function parseGroup(str, startIdx) {
    let depth = 0; let j = startIdx; let buf = '';
    while (j < str.length) {
      if (str[j] === '{') { depth++; buf += str[j]; j++; }
      else if (str[j] === '}') { if (depth === 0) break; depth--; buf += str[j]; j++; }
      else { buf += str[j]; j++; }
    }
    return { content: buf, end: j };
  }
  while (i < markup.length) {
    if (markup[i] === '{') {
      const g = parseGroup(markup, i + 1);
      const inner = g.content;
      if (inner.includes('/') && !inner.includes('{')) {
        const slashIdx = inner.indexOf('/');
        flushText();
        nodes.push({ type: 'frac', num: inner.slice(0, slashIdx), den: inner.slice(slashIdx + 1) });
        i = g.end + 1;
      } else {
        textBuf += '{' + inner + '}';
        i = g.end + 1;
      }
    } else if (markup[i] === '^') {
      let supText = '';
      if (i + 1 < markup.length && markup[i+1] === '{') { const g = parseGroup(markup, i + 2); supText = g.content; i = g.end + 1; }
      else if (i + 1 < markup.length) { supText = markup[i+1]; i += 2; }
      else { i++; continue; }
      flushText();
      const last = nodes.pop();
      if (last && last.type === 'text') { nodes.push({ type: 'sup', base: last.value, exp: supText }); }
      else { if (last) nodes.push(last); nodes.push({ type: 'sup', base: '', exp: supText }); }
    } else if (markup[i] === '_') {
      let subText = '';
      if (i + 1 < markup.length && markup[i+1] === '{') { const g = parseGroup(markup, i + 2); subText = g.content; i = g.end + 1; }
      else if (i + 1 < markup.length) { subText = markup[i+1]; i += 2; }
      else { i++; continue; }
      flushText();
      const last = nodes.pop();
      if (last && last.type === 'text') { nodes.push({ type: 'sub', base: last.value, idx: subText }); }
      else { if (last) nodes.push(last); nodes.push({ type: 'sub', base: '', idx: subText }); }
    } else if (markup.startsWith('\\sqrt{', i)) {
      const g = parseGroup(markup, i + 6);
      flushText();
      nodes.push({ type: 'sqrt', radicand: g.content });
      i = g.end + 1;
    } else if (markup.startsWith('\\pi', i)) { textBuf += '\u03C0'; i += 4; }
    else if (markup.startsWith('\\cdot', i)) { textBuf += '\u00B7'; i += 5; }
    else { textBuf += markup[i]; i++; }
  }
  flushText();
  return nodes;
}

function nodeToOMML(node) {
  switch (node.type) {
    case 'text': return wrapText(node.value);
    case 'frac':
      return '<m:f><m:fPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:fPr>' +
        '<m:num>' + genOMML(node.num) + '</m:num>' +
        '<m:den>' + genOMML(node.den) + '</m:den></m:f>';
    case 'sup':
      return '<m:sSup><m:sSupPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSupPr>' +
        '<m:e>' + wrapText(node.base) + '</m:e>' +
        '<m:sup>' + genOMML(node.exp) + '</m:sup></m:sSup>';
    case 'sub':
      return '<m:sSub><m:sSubPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSubPr>' +
        '<m:e>' + wrapText(node.base) + '</m:e>' +
        '<m:sub>' + genOMML(node.idx) + '</m:sub></m:sSub>';
    case 'sqrt':
      return '<m:rad><m:radPr><m:degHide m:val="1"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:radPr><m:deg/><m:e>' +
        genOMML(node.radicand) + '</m:e></m:rad>';
    default: return '';
  }
}

function genOMML(markup) { return parse(markup).map(nodeToOMML).join(''); }
function makeMathSpan(markup) { return '<m:oMathPara><m:oMath>' + genOMML(markup) + '</m:oMath></m:oMathPara>'; }

module.exports = { parse, genOMML, makeMathSpan };
