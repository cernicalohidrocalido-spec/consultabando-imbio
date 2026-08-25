/**
 * Worker de Cloudflare — "Buzón de observaciones" para consultabando.imbio.info
 * ------------------------------------------------------------------------------
 * Reemplaza a Jotform como buzón de dudas/observaciones de la consulta pública.
 * Ventajas frente a Jotform gratis: sin límite de 100 envíos/mes, sin borrado
 * automático al llegar a 500 respuestas guardadas — los datos son tuyos, viven
 * en una base de datos D1 de Cloudflare (gratis hasta 5 GB).
 *
 * Rutas:
 *   POST /enviar   — recibe una observación del formulario público y la guarda.
 *   GET  /panel     — lista las observaciones guardadas (requiere ADMIN_TOKEN).
 *   GET  /exportar  — descarga todas las observaciones en CSV (requiere ADMIN_TOKEN).
 *
 * Autenticación de /panel y /exportar (misma):
 *   - Header: Authorization: Bearer <ADMIN_TOKEN>  (preferido; no deja el token en la URL)
 *   - Query:  ?token=<ADMIN_TOKEN>                 (compatibilidad)
 * Sin token válido → 401. La URL /exportar sola no entrega datos.
 *
 * Variables / bindings que necesita este Worker:
 *   DB            (binding D1 — la base de datos, ver README_DEPLOY.md)
 *   ALLOWED_ORIGIN (texto plano — ej. "https://consultabando.imbio.info")
 *   ADMIN_TOKEN    (secret — contraseña simple para ver/exportar las respuestas)
 *
 * Cómo desplegarlo: ver README_DEPLOY.md en esta misma carpeta, paso a paso.
 */

const MAX_LEN = {
  nombre: 200,
  contacto: 200,
  reglamento: 300,
  articulo: 60,
  comentario: 5000,
};

const FOLIO_ANIO = "2026";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(allowedOrigin) });
    }

    if (url.pathname === "/enviar" && request.method === "POST") {
      return handleEnviar(request, env, allowedOrigin);
    }
    if (url.pathname === "/panel" && request.method === "GET") {
      return handlePanel(request, env, allowedOrigin);
    }
    if (url.pathname === "/exportar" && request.method === "GET") {
      return handleExportar(request, env, allowedOrigin);
    }

    return json({ error: "Ruta no encontrada." }, 404, allowedOrigin);
  },
};

async function handleEnviar(request, env, allowedOrigin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Solicitud inválida." }, 400, allowedOrigin);
  }

  const comentario = (body.comentario || "").toString().trim().slice(0, MAX_LEN.comentario);
  if (!comentario) {
    return json({ error: "Falta tu duda, comentario u observación." }, 400, allowedOrigin);
  }

  const nombre = (body.nombre || "").toString().trim().slice(0, MAX_LEN.nombre);
  const contacto = (body.contacto || "").toString().trim().slice(0, MAX_LEN.contacto);
  const reglamento = (body.reglamento || "").toString().trim().slice(0, MAX_LEN.reglamento);
  const articulo = (body.articulo || "").toString().trim().slice(0, MAX_LEN.articulo);
  const ip = request.headers.get("CF-Connecting-IP") || "";

  try {
    await env.DB.prepare(
      `INSERT INTO observaciones (nombre, contacto, reglamento, articulo, comentario, origen_ip)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(nombre, contacto, reglamento, articulo, comentario, ip)
      .run();
  } catch (err) {
    console.log("Error guardando observación:", err);
    return json({ error: "No se pudo guardar tu observación. Intenta de nuevo en un momento." }, 500, allowedOrigin);
  }

  return json({ ok: true, mensaje: "Gracias, tu observación fue recibida." }, 200, allowedOrigin);
}

async function handlePanel(request, env, allowedOrigin) {
  if (!checkToken(request, env)) {
    return json({ error: "No autorizado." }, 401, allowedOrigin);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, creado_en, nombre, contacto, reglamento, articulo, comentario
     FROM observaciones ORDER BY creado_en DESC LIMIT 500`
  ).all();
  const observaciones = (results || []).map((r) => ({
    ...r,
    folio: folioDe(r.id),
  }));
  return json({ total: observaciones.length, observaciones }, 200, allowedOrigin);
}

async function handleExportar(request, env, allowedOrigin) {
  if (!checkToken(request, env)) {
    return json({ error: "No autorizado." }, 401, allowedOrigin);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, creado_en, nombre, contacto, reglamento, articulo, comentario
     FROM observaciones ORDER BY creado_en ASC`
  ).all();

  const headers = ["folio", "id", "fecha", "nombre", "contacto", "reglamento", "articulo", "comentario"];
  const rows = (results || []).map((r) => [
    folioDe(r.id),
    r.id,
    r.creado_en,
    csvEscape(r.nombre),
    csvEscape(r.contacto),
    csvEscape(r.reglamento),
    csvEscape(r.articulo),
    csvEscape(r.comentario),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="observaciones_consulta_publica.csv"',
      "cache-control": "no-store",
      ...corsHeaders(allowedOrigin),
    },
  });
}

/** Folio ciudadano: CP-2026-0001 (año fijo + id D1 con 4 dígitos). */
function folioDe(id) {
  const n = Number(id);
  const num = Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  return `CP-${FOLIO_ANIO}-${String(num).padStart(4, "0")}`;
}

/**
 * Exige ADMIN_TOKEN. Acepta:
 *   Authorization: Bearer <token>
 *   ?token=<token>
 * Sin coincidencia exacta con env.ADMIN_TOKEN → false.
 */
function checkToken(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token") || "";
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  const fromHeader = bearer ? bearer[1].trim() : "";
  const token = fromHeader || fromQuery;
  return token.length > 0 && token === env.ADMIN_TOKEN;
}

function csvEscape(v) {
  const s = (v ?? "").toString().replace(/"/g, '""');
  return `"${s}"`;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}
