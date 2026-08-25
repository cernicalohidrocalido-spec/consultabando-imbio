/* Formato de lectura: no altera el texto legal, solo lo presenta con saltos y listas. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ORD_NOMBRE =
  "PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|SEPTIMO|OCTAVO|NOVENO|DÉCIMO|DECIMO|UNDÉCIMO|UNDECIMO|DUODÉCIMO|DUODECIMO";
const ORD_ROMANO = "[IVXLCDM]+|\\d+";
const ORD_CUALQUIERA = "(?:" + ORD_NOMBRE + "|" + ORD_ROMANO + ")";

function formatTextoLegal(texto) {
  let s = escapeHtml(texto);

  // Notas editoriales (no son texto normativo; se muestran aparte en cursiva)
  s = s.replace(
    new RegExp(
      "\\s*(Nota editorial(?:\\s*\\([^)]*\\))?:\\s*.+?)(?=\\s+(?:TÍTULO|TITULO)\\s+" +
        ORD_CUALQUIERA +
        "|\\s+CAP[ÍI]TULO\\s+" +
        ORD_CUALQUIERA +
        "\\b|$)",
      "g"
    ),
    '</p><p class="nota-editorial">$1</p><p class="texto-p">'
  );

  // TÍTULO y CAPÍTULO estructurales (romanos u ordinales: SEGUNDO, PRIMERO…)
  s = s.replace(
    new RegExp(
      "\\s+(TÍTULO|TITULO)\\s+(" +
        ORD_CUALQUIERA +
        ")\\s+(.+?)(?=\\s+(?:CAPÍTULO|CAPITULO|TÍTULO|TITULO)\\s+" +
        ORD_CUALQUIERA +
        "|$)",
      "gi"
    ),
    '</p><p class="titulo-norma">TÍTULO $2 $3</p><p class="texto-p">'
  );
  s = s.replace(
    new RegExp(
      "\\s+(CAPÍTULO|CAPITULO)\\s+(" +
        ORD_CUALQUIERA +
        ")\\s+(.+?)(?=\\s+(?:CAPÍTULO|CAPITULO|TÍTULO|TITULO|Secci[oó]n)\\s|$)",
      "gi"
    ),
    '</p><p class="capitulo-norma">CAPÍTULO $2 — $3</p><p class="texto-p">'
  );

  s = s.replace(
    /\s*(Secci[oó]n\s+[A-ZÁÉÍÓÚÑIVXLCDM]+\.\s*)/gi,
    '</p><p class="seccion-titulo">$1</p><p class="texto-p">'
  );

  // TRANSITORIOS: encabezado + PRIMERO.-, SEGUNDO.-, …
  s = s.replace(/\s*(TRANSITORIOS)\s+/g, '</p><p class="titulo-norma">$1</p><p class="texto-p">');
  if (new RegExp("(?:" + ORD_NOMBRE + ")\\.-").test(s)) {
    s = s.replace(
      new RegExp("(" + ORD_NOMBRE + ")\\.-\\s+"),
      '</p><ol class="fracciones transitorios"><li><span class="num">$1.-</span> '
    );
    s = s.replace(
      new RegExp("\\s+(" + ORD_NOMBRE + ")\\.-\\s+", "g"),
      '</li><li><span class="num">$1.-</span> '
    );
    if (s.includes('class="fracciones transitorios"')) {
      s = cerrarListaAntesDeEncabezado(s, "ol");
      if (!/fracciones transitorios[\s\S]*?<\/ol>/.test(s)) s += "</li></ol>";
      s = s.replace(/<\/ol><\/p>/g, "</ol>");
    }
  }

  if (/[a-z]\)\s/.test(s)) {
    s = s.replace(/(:\s*)([a-z]\))\s+/gi, '$1<ul class="incisos"><li><span class="num">$2</span> ');
    s = s.replace(/;\s*([a-z]\))\s+/gi, '</li><li><span class="num">$1</span> ');
    if (s.includes('<ul class="incisos">')) {
      // Cerrar ante la siguiente fracción romana (no confundir con "y XXV.-" de fracciones)
      s = s.replace(/\.\s+((?:[IVXLCDM]+|\d+)\.-)/g, ".</li></ul> $1");
      s = s.replace(/;\s+((?:[IVXLCDM]+|\d+)\.-)/g, "</li></ul> $1");
      s = cerrarListaAntesDeEncabezado(s, "ul");
      const opens = (s.match(/<ul class="incisos">/g) || []).length;
      const closes = (s.match(/<\/ul>/g) || []).length;
      for (let i = 0; i < opens - closes; i++) s += "</li></ul>";
    }
  }

  if (/(?:[IVXLCDM]+|\d+)\.-/.test(s)) {
    s = s.replace(
      /(:\s*)((?:[IVXLCDM]+|\d+)\.-)\s+/i,
      '$1</p><ol class="fracciones"><li><span class="num">$2</span> '
    );
    s = s.replace(/;\s*((?:[IVXLCDM]+|\d+)\.-)\s+/gi, '</li><li><span class="num">$1</span> ');
    // Última fracción: "; y XXV.-" / ", y XXV.-" / " y XXV.-"
    s = s.replace(
      /(?:;|,)?\s+y\s+((?:[IVXLCDM]+|\d+)\.-)\s+/gi,
      '</li><li><span class="num">$1</span> '
    );
    s = s.replace(/(<\/ul>)\s*((?:[IVXLCDM]+|\d+)\.-)\s+/gi, '$1</li><li><span class="num">$2</span> ');
    if (s.includes('<ol class="fracciones">')) {
      s = cerrarListaAntesDeEncabezado(s, "ol");
      if (!s.includes("</ol>")) s += "</li></ol>";
      s = s.replace(/<\/ol><\/p>/g, "</ol>");
    }
  }

  if (!/^\s*</.test(s)) s = `<p class="texto-p">${s}</p>`;
  s = s.replace(/^<\/p>/, "");
  s = s.replace(
    /<p class="texto-p">\s*(?=<ol|<ul|<p class="titulo-norma|<p class="capitulo-norma|<p class="nota-editorial)/g,
    ""
  );
  s = s.replace(/<p class="texto-p">\s*<\/p>/g, "");
  return s;
}

function cerrarListaAntesDeEncabezado(s, tag) {
  const openNeedle = tag === "ul" ? '<ul class="incisos">' : '<ol class="fracciones';
  const closeTag = tag === "ul" ? "</ul>" : "</ol>";
  const close = tag === "ul" ? "</li></ul>" : "</li></ol>";
  const lastOpen = s.lastIndexOf(openNeedle);
  if (lastOpen < 0) return s;
  if (s.slice(lastOpen).includes(closeTag)) return s;
  return s.replace(
    /(<\/p><p class="(?:titulo-norma|capitulo-norma|seccion-titulo|nota-editorial)">)/,
    close + "$1"
  );
}
