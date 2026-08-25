# Consulta pública — Paquete normativo municipal (IMBIO)

Sitio estático de consulta ciudadana para el municipio de **Pabellón de Arteaga, Aguascalientes**. Permite explorar 12 reglamentos nuevos, buscar **artículos reales** por palabras clave (sin IA) y, de forma opcional, pedir una respuesta en lenguaje natural a un Worker de Cloudflare respaldado por la API de Anthropic.

Publicación: **GitHub Pages** en el subdominio [consultabando.imbio.info](https://consultabando.imbio.info). El sitio institucional sigue en [imbio.info](https://imbio.info).

## Estructura del repositorio

```
/
├── index.html          # Sitio autocontenido (HTML + CSS + JS)
├── CNAME               # Dominio personalizado: consultabando.imbio.info
├── data/
│   └── articulos.json  # 2,277 artículos reales (fuente de verdad legal)
├── worker.js           # Cloudflare Worker (asistente opcional)
└── wrangler.toml       # Configuración de despliegue del Worker
```

Se usa la **raíz del repositorio** (no `/docs`) como carpeta de GitHub Pages.

## `data/articulos.json` — no editar a mano

Este archivo es la **fuente de verdad legal**: 2,277 artículos extraídos de los 12 documentos `.docx` oficiales tras auditoría exhaustiva.

- **No** modificar el texto de los artículos ni inventar contenido.
- Para actualizarlo: volver a extraer desde los `.docx` oficiales con el pipeline de extracción del proyecto y reemplazar el JSON completo solo tras nueva verificación.
- Campos: `doc`, `reglamento`, `articulo`, `texto`.

## Configurar el sitio (`index.html`)

Al inicio del bloque `<script>`:

| Constante | Uso |
|-----------|-----|
| `FORM_URL` | Enlace del formulario (Jotform / Google Forms) del botón «Enviar mi duda u observación» |
| `ASISTENTE_URL` | URL pública del Worker (ej. `https://asistente.imbio.info`). Si queda `""`, la búsqueda sigue funcionando solo con artículos reales |

## Desplegar el Worker (`worker.js`)

Requisitos: cuenta Cloudflare, [Wrangler](https://developers.cloudflare.com/workers/wrangler/) y una API key de Anthropic.

```bash
npm i -g wrangler
wrangler login
wrangler secret put ANTHROPIC_API_KEY
# ALLOWED_ORIGIN ya está en wrangler.toml como https://consultabando.imbio.info
wrangler deploy
```

Luego pon la URL del Worker en `ASISTENTE_URL` dentro de `index.html` y vuelve a publicar Pages.

El Worker recibe `POST { pregunta, fragmentos }` y llama a `api.anthropic.com/v1/messages` con un system prompt que **prohíbe inventar citas**.

## GitHub Pages

1. Settings → Pages → Source: **Deploy from a branch**
2. Branch: `main`, folder: **/ (root)**
3. Custom domain: `consultabando.imbio.info` (debe coincidir con el archivo `CNAME`)
4. Activa «Enforce HTTPS» cuando el certificado esté listo

### DNS (Cloudflare → GitHub Pages)

En Cloudflare DNS, crea:

| Tipo | Nombre | Destino | Proxy |
|------|--------|---------|--------|
| CNAME | `consultabando` | `USUARIO.github.io` | **DNS only** (nube gris) al menos hasta que GitHub verifique el dominio |

Sustituye `USUARIO` por tu usuario u organización de GitHub. No toques los registros del apex `imbio.info` (sitio institucional).

## Prueba local

```bash
npx --yes serve -l 8080 .
# Abrir http://localhost:8080 y probar el buscador
```

El fetch usa la ruta relativa `data/articulos.json` (sin barra inicial), correcta para Pages y para un servidor estático local.
