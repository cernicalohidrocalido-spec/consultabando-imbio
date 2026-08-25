-- Base de datos de observaciones ciudadanas — Consulta Pública Pabellón de Arteaga
-- Ejecutar una sola vez al crear la base de datos D1 (ver instrucciones en README_DEPLOY.md)

CREATE TABLE IF NOT EXISTS observaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now')),
  nombre TEXT,
  contacto TEXT,
  reglamento TEXT,
  articulo TEXT,
  comentario TEXT NOT NULL,
  origen_ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_observaciones_reglamento ON observaciones(reglamento);
CREATE INDEX IF NOT EXISTS idx_observaciones_creado_en ON observaciones(creado_en);
