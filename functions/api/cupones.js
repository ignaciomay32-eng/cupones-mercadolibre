// Agente de cupones. Lee el origen como mucho cada 5 minutos, guarda todo en la base
// (para tener historial) y devuelve los cupones vigentes, el historial y los contadores.

import { AFILIADO, hoyMX, json, leerOrigen, prepararDB, sincronizar, votante } from "../_lib/comun.js";

const VIGENTES = new Set(["activo", "pocas", "agotado", "proximamente"]);

export async function onRequestGet({ request, env, waitUntil }) {
  // Sin base de datos conectada: funciona como antes, sin likes, opiniones ni historial.
  if (!env.DB) {
    try {
      const cupones = (await leerOrigen()).filter((c) => VIGENTES.has(c.estado)).map((c) => ({ ...c, link: AFILIADO }));
      return json({ actualizado: new Date().toISOString(), funciones: false, cupones, historial: [] });
    } catch (e) {
      return json({ error: String(e.message || e), cupones: [], historial: [] }, 502);
    }
  }

  const db = env.DB;
  await prepararDB(db);
  // Si ya hay cupones guardados, respondemos al instante y revisamos el origen por detrás.
  // Solo la primera vez (base vacía) esperamos a que termine la revisión.
  const meta = await db.prepare("SELECT valor FROM meta WHERE clave = 'ultima_sync'").first();
  let actualizado = meta?.valor || null;
  if (actualizado) waitUntil(sincronizar(db));
  else actualizado = await sincronizar(db);
  const yo = await votante(request, env);
  const hoy = hoyMX();

  const [{ results: filas }, { results: misLikes }, totales] = await Promise.all([
    db.prepare(`SELECT c.*,
        (SELECT COUNT(*) FROM likes l WHERE l.cupon_id = c.id) AS likes,
        (SELECT COUNT(*) FROM usos u WHERE u.cupon_id = c.id) AS usos,
        (SELECT COUNT(*) FROM opiniones o WHERE o.cupon_id = c.id) AS opiniones
      FROM cupones c ORDER BY c.visto_ultimo DESC LIMIT 200`).all(),
    db.prepare("SELECT cupon_id FROM likes WHERE votante = ?1").bind(yo).all(),
    db.prepare("SELECT (SELECT COUNT(*) FROM usos) AS usos, (SELECT COUNT(*) FROM cupones) AS cupones").first(),
  ]);

  const mios = new Set(misLikes.map((f) => f.cupon_id));
  const cupones = [];
  const historial = [];
  for (const f of filas) {
    const c = { ...f, link: AFILIADO, me_gusta: mios.has(f.id) };
    const vigente = f.en_origen === 1 && VIGENTES.has(f.estado) && (!f.vence || f.vence >= hoy);
    if (vigente) cupones.push(c);
    else historial.push({ ...c, estado: f.estado === "vencido" || (f.vence && f.vence < hoy) ? "vencido" : "finalizado" });
  }

  return json({
    actualizado,
    funciones: true,
    totales: { usos: totales.usos, cupones: totales.cupones },
    cupones,
    historial: historial.slice(0, 60),
  });
}
