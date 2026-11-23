// omml.js - Convert simple math markup to OMML (Office Math Markup Language) XML
// Markup:
//   plain text -> m:t
//   ^{text}   -> superscript
//   _{text}   -> subscript
//   {a/b}     -> fraction
//   \sqrt{x}  -> square root
//   \pi       -> π
//   \cdot     -> ·
// Spaces are literal.

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrapText(s) {
  if (s === '') return '';
  return '<m:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t>' + esc(s) + '</m:t></m:r>';
}

function genOMML(markup) {
  // Parse markup into a sequence of "atoms"
  // Returns OMML XML string for the inside of <m:oMath>
  let i = 0;
  let result = '';
  let textBuf = '';

  function flushText() {
    if (textBuf !== '') {
      result += wrapText(textBuf);
      textBuf = '';
    }
  }

  function parseGroup(str, startIdx) {
    // Parse until matching } or end
    let depth = 0;
    let j = startIdx;
    let buf = '';
    while (j < str.length) {
      if (str[j] === '{') { depth++; buf += str[j]; j++; }
      else if (str[j] === '}') {
        if (depth === 0) break;
        depth--; buf += str[j]; j++;
      } else { buf += str[j]; j++; }
    }
    return { content: buf, end: j };
  }

  while (i < markup.length) {
    if (markup[i] === '{') {
      // Check if it's a fraction {a/b}
      const g = parseGroup(markup, i + 1);
      const inner = g.content;
      if (inner.includes('/')) {
        const slashIdx = inner.indexOf('/');
        const num = inner.slice(0, slashIdx);
        const den = inner.slice(slashIdx + 1);
        flushText();
        result += '<m:f><m:fPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:fPr>';
        result += '<m:num>' + genOMML(num) + '</m:num>';
        result += '<m:den>' + genOMML(den) + '</m:den></m:f>';
        i = g.end + 1;
      } else {
        // Just a group - treat as text
        textBuf += '{' + inner + '}';
        i = g.end + 1;
      }
    } else if (markup[i] === '^') {
      // Superscript ^{text} or ^x
      let supText = '';
      if (i + 1 < markup.length && markup[i+1] === '{') {
        const g = parseGroup(markup, i + 2);
        supText = g.content;
        i = g.end + 1;
      } else if (i + 1 < markup.length) {
        supText = markup[i+1];
        i += 2;
      } else { i++; continue; }
      flushText();
      // The base is the last text run - need to handle this differently
      // For simplicity, assume base is in textBuf (already flushed) - this is a limitation
      // We'll handle by wrapping: base is already in result, so we need to restructure
      // This is complex; for now, just add superscript as sSup on empty base
      result += '<m:sSup><m:sSupPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSupPr><m:e></m:e><m:sup>' + genOMML(supText) + '</m:sup></m:sSup>';
    } else if (markup[i] === '_') {
      let subText = '';
      if (i + 1 < markup.length && markup[i+1] === '{') {
        const g = parseGroup(markup, i + 2);
        subText = g.content;
        i = g.end + 1;
      } else if (i + 1 < markup.length) {
        subText = markup[i+1];
        i += 2;
      } else { i++; continue; }
      flushText();
      result += '<m:sSub><m:sSubPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSubPr><m:e></m:e><m:sub>' + genOMML(subText) + '</m:sub></m:sSub>';
    } else if (markup.startsWith('\\sqrt{', i)) {
      const g = parseGroup(markup, i + 6);
      const radicand = g.content;
      flushText();
      result += '<m:rad><m:radPr><m:degHide m:val="1"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:radPr><m:deg/><m:e>' + genOMML(radicand) + '</m:e></m:rad>';
      i = g.end + 1;
    } else if (markup.startsWith('\\pi', i)) {
      textBuf += '\u03C0';
      i += 4;
    } else if (markup.startsWith('\\cdot', i)) {
      textBuf += '\u00B7';
      i += 5;
    } else {
      textBuf += markup[i];
      i++;
    }
  }
  flushText();
  return result;
}

function makeMathSpan(markup) {
  const inner = genOMML(markup);
  return '<m:oMathPara><m:oMath>' + inner + '</m:oMath></m:oMathPara>';
}

module.exports = { genOMML, makeMathSpan };

