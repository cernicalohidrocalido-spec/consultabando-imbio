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

function listTagForLevel(level) {
  return level === 1 ? "ol" : "ul";
}

function listClassForLevel(level) {
  if (level === 1) return "fracciones";
  if (level === 2) return "incisos";
  return "subincisos";
}

/**
 * Detecta marcadores jerárquicos en texto ya escapado:
 *   1 = fracción I.- / 1.-
 *   2 = inciso a).- / a) / a).
 *   3 = subinciso a.1.-
 */
function clasificarMarcador(match, gSub, gInc, gFrac, index, full) {
  if (gSub) return { level: 3, marker: gSub };
  if (gInc) return { level: 2, marker: gInc };
  if (gFrac) {
    // Evitar tomar "1.-" de dentro de "a.1.-" si la alternancia fallara
    const prev = full.slice(Math.max(0, index - 2), index);
    if (/[a-z]\.$/i.test(prev)) return null;
    return { level: 1, marker: gFrac };
  }
  return null;
}

function limpiarSeparadorFinal(t) {
  return String(t || "")
    .replace(/(?:[;,]|\.)?\s*y\s*$/i, "")
    .replace(/[;:]\s*$/, "")
    .replace(/\.\s*$/, "")
    .trim();
}

function limpiarSeparadorInicial(t) {
  return String(t || "")
    .replace(/^(?:[;,]?\s*y\s+|[;:]\s*)/i, "")
    .trim();
}

/** Separa un epílogo narrativo que quedó pegado al último inciso/fracción. */
function separarEpilogo(content) {
  const m = String(content || "").match(
    /^(.+?\.)\s+([A-ZÁÉÍÓÚÑÜ][^]*)$/
  );
  if (!m) return { content, epilogo: "" };
  const resto = m[2].trim();
  // Epílogo: frase larga sin aspecto de continuación de lista
  if (resto.length < 40) return { content, epilogo: "" };
  if (/^(?:[IVXLCDM]+|\d+)\.-|^[a-z](?:\.\d+)?\)/.test(resto)) {
    return { content, epilogo: "" };
  }
  return { content: m[1].trim(), epilogo: resto };
}

function itemsAnidadosAHtml(items) {
  if (!items.length) return "";
  let html = "";
  let prevLevel = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const level = item.level;

    if (level > prevLevel) {
      for (let L = prevLevel + 1; L <= level; L++) {
        html += `<${listTagForLevel(L)} class="${listClassForLevel(L)}">`;
      }
    } else if (level < prevLevel) {
      html += "</li>";
      for (let L = prevLevel; L > level; L--) {
        html += `</${listTagForLevel(L)}></li>`;
      }
    } else if (prevLevel > 0) {
      html += "</li>";
    }

    const cuerpo = limpiarSeparadorFinal(item.content);
    html += `<li><span class="num">${item.marker}</span> ${cuerpo}`;
    prevLevel = level;
  }

  html += "</li>";
  for (let L = prevLevel; L >= 1; L--) {
    html += `</${listTagForLevel(L)}>`;
    if (L > 1) html += "</li>";
  }
  return html;
}

function formatearListasJerarquicas(s) {
  // subinciso | inciso (a) / a). / a).-) | fracción romana o arábiga
  // Incisos/subincisos: solo minúsculas y tras separador (evita (IMBIO), (sic), etc.)
  const re =
    /(?<=[\s;,]|^)([a-z]\.\d+\.-)|(?<=[\s;,]|^)([a-z]\)\.?-?)|((?:[IVXLCDM]+|\d+)\.-)/g;
  if (!re.test(s)) return s;
  re.lastIndex = 0;

  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    const info = clasificarMarcador(m[0], m[1], m[2], m[3], m.index, s);
    if (!info) continue;
    parts.push({ type: "text", value: s.slice(last, m.index) });
    parts.push({ type: "marker", level: info.level, marker: info.marker });
    last = m.index + m[0].length;
  }
  parts.push({ type: "text", value: s.slice(last) });

  const markers = parts.filter((p) => p.type === "marker");
  if (!markers.length) return s;
  // Solo reformatear si hay al menos una fracción o varios incisos
  const hasFrac = markers.some((p) => p.level === 1);
  const nInc = markers.filter((p) => p.level === 2).length;
  if (!hasFrac && nInc < 2 && !markers.some((p) => p.level === 3)) return s;

  let i = 0;
  while (i < parts.length && parts[i].type !== "marker") i++;
  let preamble = parts
    .slice(0, i)
    .map((p) => p.value)
    .join("");
  preamble = preamble.replace(/\s+$/, " ").trimEnd();

  const items = [];
  for (; i < parts.length; i++) {
    const p = parts[i];
    if (p.type === "marker") {
      items.push({ level: p.level, marker: p.marker, content: "" });
    } else if (items.length) {
      items[items.length - 1].content += p.value;
    }
  }

  for (const it of items) {
    it.content = limpiarSeparadorInicial(it.content);
  }

  let epilogo = "";
  if (items.length) {
    const lastItem = items[items.length - 1];
    const sep = separarEpilogo(lastItem.content);
    lastItem.content = sep.content;
    epilogo = sep.epilogo;
  }

  let html = "";
  if (preamble) {
    html += `<p class="texto-p">${preamble.trim()}</p>`;
  }
  html += itemsAnidadosAHtml(items);
  if (epilogo) {
    html += `<p class="texto-p">${epilogo}</p>`;
  }
  return html;
}

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

  // Listas I.- / a).- / a.1.- (y variantes)
  s = formatearListasJerarquicas(s);

  if (!/^\s*</.test(s)) s = `<p class="texto-p">${s}</p>`;
  s = s.replace(/^<\/p>/, "");
  s = s.replace(
    /<p class="texto-p">\s*(?=<ol|<ul|<p class="titulo-norma|<p class="capitulo-norma|<p class="nota-editorial)/g,
    ""
  );
  s = s.replace(/<p class="texto-p">\s*<\/p>/g, "");
  // Si formatearListas ya devolvió HTML completo, evitar envolver de más
  s = s.replace(/<p class="texto-p">\s*(<ol class="fracciones">)/g, "$1");
  s = s.replace(/(<\/ol>)\s*<\/p>/g, "$1");
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
