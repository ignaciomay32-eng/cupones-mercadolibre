// Opiniones de cada cupón. Reglas para evitar spam y contenido que ponga en riesgo el sitio:
// sin enlaces, sin teléfonos, largo limitado y máximo 3 opiniones cada 10 minutos por persona.

import { existeCupon, json, leerCuerpo, mismoOrigen, prepararDB, votante } from "../_lib/comun.js";

const MAX_TEXTO = 280;
const MAX_NOMBRE = 30;
const LIMITE = 3;
const VENTANA_MS = 10 * 60 * 1000;

const PARECE_ENLACE = /(https?:|www\.|\.(com|mx|net|org|ly|me|io|co|link|xyz)\b|@\w+\.\w+)/i;
const PARECE_TELEFONO = /\d[\d\s.-]{7,}\d/;
const GROSERIAS = /\b(put[ao]s?|pendej[ao]s?|chinga|verga|cabr[oó]n|mierda|culer[ao])\b/i;

function limpiarTexto(t, max) {
  return String(t ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function listar(db, id) {
  const { results } = await db.prepare(
    "SELECT nombre, texto, fecha FROM opiniones WHERE cupon_id = ?1 ORDER BY id DESC LIMIT 50"
  ).bind(id).all();
  return results;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ opiniones: [] });
  const db = env.DB;
  await prepararDB(db);
  const id = new URL(request.url).searchParams.get("id");
  if (!(await existeCupon(db, id))) return json({ error: "Cupón no encontrado" }, 404);
  return json({ opiniones: await listar(db, id) });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "No disponible" }, 503);
  if (!mismoOrigen(request)) return json({ error: "Origen no permitido" }, 403);
  const db = env.DB;
  await prepararDB(db);

  const cuerpo = await leerCuerpo(request);
  const id = cuerpo.id;
  const nombre = limpiarTexto(cuerpo.nombre, MAX_NOMBRE) || null;
  const texto = limpiarTexto(cuerpo.texto, MAX_TEXTO);

  if (!(await existeCupon(db, id))) return json({ error: "Cupón no encontrado" }, 404);
  if (texto.length < 3) return json({ error: "Escribe tu opinión (mínimo 3 letras)." }, 400);
  const todo = `${nombre || ""} ${texto}`;
  if (PARECE_ENLACE.test(todo)) return json({ error: "Por seguridad no se permiten enlaces ni correos." }, 400);
  if (PARECE_TELEFONO.test(todo)) return json({ error: "Por seguridad no se permiten números de teléfono." }, 400);
  if (GROSERIAS.test(todo)) return json({ error: "Tu opinión tiene palabras no permitidas." }, 400);

  const yo = await votante(request, env);
  const desde = new Date(Date.now() - VENTANA_MS).toISOString();
  const { n } = await db.prepare("SELECT COUNT(*) AS n FROM opiniones WHERE votante = ?1 AND fecha > ?2").bind(yo, desde).first();
  if (n >= LIMITE) return json({ error: "Ya dejaste varias opiniones. Intenta en unos minutos." }, 429);

  await db.prepare("INSERT INTO opiniones (cupon_id, nombre, texto, fecha, votante) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(id, nombre, texto, new Date().toISOString(), yo).run();
  return json({ opiniones: await listar(db, id) });
}
