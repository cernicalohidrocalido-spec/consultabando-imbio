/**
 * Cloudflare Worker — asistente de consulta pública IMBIO
 * Recibe { pregunta, fragmentos } y pide a Anthropic una respuesta
 * en lenguaje natural SOLO a partir de los fragmentos reales.
 *
 * Secrets / vars (wrangler):
 *   ANTHROPIC_API_KEY  — secret
 *   ALLOWED_ORIGIN     — ej. https://imbio.info
 */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "https://imbio.info";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Método no permitido" }, 405, cors);
    }

    if (allowed !== "*" && origin && origin !== allowed) {
      return json({ error: "Origen no permitido" }, 403, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400, cors);
    }

    const pregunta = (body.pregunta || "").toString().trim();
    const fragmentos = Array.isArray(body.fragmentos) ? body.fragmentos : [];

    if (!pregunta || fragmentos.length === 0) {
      return json({ error: "Faltan pregunta o fragmentos" }, 400, cors);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "API key no configurada" }, 500, cors);
    }

    const contexto = fragmentos
      .map(
        (f, i) =>
          `[${i + 1}] ${f.reglamento} — Artículo ${f.articulo}\n${f.texto}`
      )
      .join("\n\n");

    const system = `Eres un asistente de consulta pública del municipio de Pabellón de Arteaga, Aguascalientes (IMBIO).
Respondes en español claro y cercano, sin tecnicismos innecesarios.
REGLAS ESTRICTAS:
- Usa ÚNICAMENTE la información de los fragmentos de artículos que te entregan.
- NO inventes citas, números de artículo, reglamentos ni normas que no aparezcan en los fragmentos.
- Si los fragmentos no bastan para responder, dilo con claridad y sugiere enviar una observación al IMBIO.
- Cuando cites, indica reglamento y número de artículo tal como aparecen en los fragmentos.
- No des asesoría legal vinculante; aclara que es orientación de consulta pública.`;

    const user = `Pregunta de la ciudadana o el ciudadano:\n${pregunta}\n\nFragmentos reales encontrados:\n${contexto}`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Anthropic error", resp.status, errText);
        return json({ error: "Error del servicio de IA" }, 502, cors);
      }

      const data = await resp.json();
      const respuesta =
        (data.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim() || "No pude generar una respuesta.";

      return json({ respuesta }, 200, cors);
    } catch (e) {
      console.error(e);
      return json({ error: "Error interno" }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}
