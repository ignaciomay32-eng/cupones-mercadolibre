// Cuenta cuántas personas tocaron "Copiar e ir a Mercado Libre" en cada cupón (cada persona cuenta una vez).

import { existeCupon, json, leerCuerpo, mismoOrigen, prepararDB, votante } from "../_lib/comun.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "No disponible" }, 503);
  if (!mismoOrigen(request)) return json({ error: "Origen no permitido" }, 403);
  const db = env.DB;
  await prepararDB(db);

  const { id } = await leerCuerpo(request);
  if (!(await existeCupon(db, id))) return json({ error: "Cupón no encontrado" }, 404);
  const yo = await votante(request, env);

  await db.prepare("INSERT OR IGNORE INTO usos (cupon_id, votante, fecha) VALUES (?1, ?2, ?3)").bind(id, yo, new Date().toISOString()).run();
  const { n } = await db.prepare("SELECT COUNT(*) AS n FROM usos WHERE cupon_id = ?1").bind(id).first();
  return json({ usos: n });
}
