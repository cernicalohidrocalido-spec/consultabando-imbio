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

  // Notas editoriales (no son texto normativo; se muestran aparte en cursiva)
  // Solo corta ante TÍTULO/CAPÍTULO estructurales (mayúsculas + número/romano), no ante "Capítulo" en prosa.
  s = s.replace(
    /\s*(Nota editorial(?:\s*\([^)]*\))?:\s*.+?)(?=\s+(?:TÍTULO|TITULO)\s+(?:PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|[IVXLCDM]+)|\s+CAP[ÍI]TULO\s+(?:[IVXLCDM]+|\d+)\b|$)/g,
    '</p><p class="nota-editorial">$1</p><p class="texto-p">'
  );

  // TÍTULO y CAPÍTULO estructurales (p. ej. al cierre de un artículo)
  s = s.replace(
    /\s+(TÍTULO|TITULO)\s+(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|SEPTIMO|OCTAVO|NOVENO|DÉCIMO|DECIMO|UNDÉCIMO|UNDECIMO|DUODÉCIMO|DUODECIMO|[IVXLCDM]+)\s+(.+?)(?=\s+(?:CAPÍTULO|CAPITULO|TÍTULO|TITULO)\s+(?:[IVXLCDM\d]+|PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO)|$)/gi,
    '</p><p class="titulo-norma">TÍTULO $2 $3</p><p class="texto-p">'
  );
  s = s.replace(
    /\s+(CAPÍTULO|CAPITULO)\s+([IVXLCDM]+|\d+)\s+(.+?)(?=\s+(?:CAPÍTULO|CAPITULO|TÍTULO|TITULO|Secci[oó]n)\s|$)/gi,
    '</p><p class="capitulo-norma">CAPÍTULO $2 — $3</p><p class="texto-p">'
  );

  s = s.replace(
    /\s*(Secci[oó]n\s+[A-ZÁÉÍÓÚÑIVXLCDM]+\.\s*)/gi,
    '</p><p class="seccion-titulo">$1</p><p class="texto-p">'
  );

  // TRANSITORIOS: encabezado + PRIMERO.-, SEGUNDO.-, …
  const ORD =
    "PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|SEPTIMO|OCTAVO|NOVENO|DÉCIMO|DECIMO|UNDÉCIMO|UNDECIMO|DUODÉCIMO|DUODECIMO";
  s = s.replace(/\s*(TRANSITORIOS)\s+/g, '</p><p class="titulo-norma">$1</p><p class="texto-p">');
  if (new RegExp("(?:" + ORD + ")\\.-").test(s)) {
    s = s.replace(
      new RegExp("(" + ORD + ")\\.-\\s+"),
      '</p><ol class="fracciones transitorios"><li><span class="num">$1.-</span> '
    );
    s = s.replace(
      new RegExp("\\s+(" + ORD + ")\\.-\\s+", "g"),
      '</li><li><span class="num">$1.-</span> '
    );
    if (s.includes('class="fracciones transitorios"')) {
      s = s.replace(/(<\/p><p class="(?:titulo-norma|capitulo-norma|seccion-titulo|nota-editorial)">)/, '</li></ol>$1');
      if (!/fracciones transitorios[\s\S]*?<\/ol>/.test(s)) s += '</li></ol>';
      s = s.replace(/<\/ol><\/p>/g, '</ol>');
    }
  }

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
  s = s.replace(/<p class="texto-p">\s*(?=<ol|<ul|<p class="titulo-norma|<p class="capitulo-norma|<p class="nota-editorial)/g, "");
  s = s.replace(/<p class="texto-p">\s*<\/p>/g, "");
  return s;
}
