// Agente de cupones. Lee el origen como mucho cada 5 minutos, guarda todo en la base
// (para tener historial) y devuelve los cupones vigentes, el historial y los contadores.

import { conHorario, enlacePara, esReciente, estadoSync, hoyMX, oculto, json, juntar, leerCupondeldia, leerOrigen, prepararDB, sincronizar, votante } from "../_lib/comun.js";

const VIGENTES = new Set(["activo", "pocas", "agotado", "proximamente"]);
const VIEJO_MS = 20 * 60 * 1000; // con más de 20 minutos sin una lectura completa, la página avisa

export async function onRequestGet({ request, env, waitUntil }) {
  // Sin base de datos conectada: funciona como antes, sin likes, opiniones ni historial.
  if (!env.DB) {
    try {
      const [principal, cdd] = await Promise.allSettled([leerOrigen({ conCache: true }), leerCupondeldia({ conCache: true })]);
      if (principal.status !== "fulfilled" && cdd.status !== "fulfilled") throw principal.reason;
      const cupones = juntar(principal.value || [], cdd.value || []).filter((c) => VIGENTES.has(c.estado)).map((c) => ({ ...c, link: enlacePara(c.tienda) }));
      return json({ actualizado: new Date().toISOString(), funciones: false, cupones, historial: [] });
    } catch (e) {
      return json({ error: String(e.message || e), cupones: [], historial: [] }, 502);
    }
  }

  const db = env.DB;
  await prepararDB(db);
  // Si ya hay cupones guardados, respondemos al instante y revisamos las fuentes por detrás
  // (la página vuelve a pedir los datos unos segundos después para recibir lo nuevo).
  // Solo la primera vez (nunca hubo un intento) esperamos a que termine la revisión.
  const sync = await estadoSync(db);
  let actualizado = sync.actualizado;
  let sincronizando = false;
  if (!sync.intento && !actualizado) actualizado = await sincronizar(db);
  else if (!esReciente(actualizado)) {
    waitUntil(sincronizar(db));
    sincronizando = true;
  }
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
    if (oculto(f)) continue;
    const c = conHorario({ ...f, tienda: f.tienda || "mercadolibre", link: enlacePara(f.tienda), me_gusta: mios.has(f.id) });
    const vigente = f.en_origen === 1 && VIGENTES.has(c.estado) && (!f.vence || f.vence >= hoy);
    if (vigente) cupones.push(c);
    else historial.push({ ...c, estado: c.estado === "vencido" || (f.vence && f.vence < hoy) ? "vencido" : "finalizado" });
  }

  return json({
    actualizado, // última lectura completa de las fuentes, nunca la de un intento fallido
    sincronizando, // true: se están revisando las fuentes ahora mismo
    desactualizado: !esReciente(actualizado, VIEJO_MS),
    funciones: true,
    totales: { usos: totales.usos, cupones: totales.cupones },
    cupones,
    historial: historial.slice(0, 60),
  });
}
