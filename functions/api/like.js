// Me gusta: un voto por persona y cupón. Tocar de nuevo lo quita.

import { existeCupon, json, leerCuerpo, mismoOrigen, prepararDB, votante } from "../_lib/comun.js";

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "No disponible" }, 503);
  if (!mismoOrigen(request)) return json({ error: "Origen no permitido" }, 403);
  const db = env.DB;
  await prepararDB(db);

  const { id } = await leerCuerpo(request);
  if (!(await existeCupon(db, id))) return json({ error: "Cupón no encontrado" }, 404);
  const yo = await votante(request, env);

  const ya = await db.prepare("SELECT 1 FROM likes WHERE cupon_id = ?1 AND votante = ?2").bind(id, yo).first();
  if (ya) await db.prepare("DELETE FROM likes WHERE cupon_id = ?1 AND votante = ?2").bind(id, yo).run();
  else await db.prepare("INSERT OR IGNORE INTO likes (cupon_id, votante, fecha) VALUES (?1, ?2, ?3)").bind(id, yo, new Date().toISOString()).run();

  const { n } = await db.prepare("SELECT COUNT(*) AS n FROM likes WHERE cupon_id = ?1").bind(id).first();
  return json({ likes: n, me_gusta: !ya });
}
