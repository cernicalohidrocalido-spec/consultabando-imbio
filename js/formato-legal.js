/* Formato de lectura: no altera el texto legal, solo lo presenta con saltos y listas. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTextoLegal(texto) {
  let s = escapeHtml(texto);

  s = s.replace(
    /\s*(Secci[oó]n\s+[A-ZÁÉÍÓÚÑIVXLCDM]+\.\s*)/gi,
    '</p><p class="seccion-titulo">$1</p><p class="texto-p">'
  );

  if (/[a-z]\)\s/.test(s)) {
    s = s.replace(/(:\s*)([a-z]\))\s+/gi, '$1<ul class="incisos"><li><span class="num">$2</span> ');
    s = s.replace(/;\s*([a-z]\))\s+/gi, '</li><li><span class="num">$1</span> ');
    if (s.includes('<ul class="incisos">')) {
      s = s.replace(/(?:,\s*)?y\s+((?:[IVXLCDM]+|\d+)\.-)/gi, '</li></ul> $1');
      s = s.replace(/\.\s+((?:[IVXLCDM]+|\d+)\.-)/g, '.</li></ul> $1');
      s = s.replace(/;\s+((?:[IVXLCDM]+|\d+)\.-)/g, '</li></ul> $1');
      s = s.split('</p><p class="seccion-titulo">').map((part, i, arr) => {
        if (i === arr.length - 1) return part;
        const opens = (part.match(/<ul class="incisos">/g) || []).length;
        const closes = (part.match(/<\/ul>/g) || []).length;
        let p = part;
        for (let j = 0; j < opens - closes; j++) p += '</li></ul>';
        return p;
      }).join('</p><p class="seccion-titulo">');
      const opens = (s.match(/<ul class="incisos">/g) || []).length;
      const closes = (s.match(/<\/ul>/g) || []).length;
      for (let i = 0; i < opens - closes; i++) s += '</li></ul>';
    }
  }

  if (/(?:[IVXLCDM]+|\d+)\.-/.test(s)) {
    s = s.replace(/(:\s*)((?:[IVXLCDM]+|\d+)\.-)\s+/i, '$1</p><ol class="fracciones"><li><span class="num">$2</span> ');
    s = s.replace(/;\s*((?:[IVXLCDM]+|\d+)\.-)\s+/gi, '</li><li><span class="num">$1</span> ');
    s = s.replace(/(<\/ul>)\s*((?:[IVXLCDM]+|\d+)\.-)\s+/gi, '$1</li><li><span class="num">$2</span> ');
    if (s.includes('<ol class="fracciones">')) {
      s = s.replace(/(<\/p><p class="seccion-titulo">)/, '</li></ol>$1');
      if (!s.includes('</ol>')) s += '</li></ol>';
      s = s.replace(/<\/ol><\/p>/g, '</ol>');
    }
  }

  if (!/^\s*</.test(s)) s = `<p class="texto-p">${s}</p>`;
  s = s.replace(/^<\/p>/, "");
  s = s.replace(/<p class="texto-p">\s*(?=<ol|<ul)/g, "");
  s = s.replace(/<p class="texto-p">\s*<\/p>/g, "");
  return s;
}
