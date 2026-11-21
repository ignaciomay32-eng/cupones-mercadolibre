// Código compartido por las rutas de /api: lectura del origen, base de datos y utilidades.

export const ORIGEN = "https://www.cuponesmercadolibre.mx/";
// Enlace del botón de TODOS los cupones (del día, bancarios, flash y activables).
export const AFILIADO = "https://meli.la/1tucCjM";
// Enlace del botón de TODOS los cupones de Amazon (vienen de cupondeldia.com).
export const AMAZON = "https://link.amazon/B04UV6nj2";
// Segunda fuente: cupones vigentes de Mercado Libre y Amazon publicados en cupondeldia.com (sin enlaces; aquí se pone el propio).
export const CUPONDELDIA = "https://cupondeldia.com/api/cupones/compartir";
// Códigos que NO se muestran nunca en esta página (ni en AhorraMX, que toma los cupones de aquí).
// Para ocultar otro, agrégalo a la lista (mayúsculas o minúsculas da igual).
export const OCULTAR_CODIGOS = ["DIRECT-2AA80C7A"];
const ocultos = new Set(OCULTAR_CODIGOS.map((c) => c.trim().toUpperCase()));
export const oculto = (c) => ocultos.has((c.codigo || "").trim().toUpperCase());

// INTERRUPTOR (pedido del dueño, 21 de noviembre de 2026: "por el momento no hay cupones"): mientras sea false, esta
// página (y AhorraMX, que toma los cupones de aquí) muestra SOLO las promociones bancarias sin código de cupondeldia.com:
// nada de cupones de Mercado Libre ni de Amazon, tampoco en el historial. Se siguen guardando en la base, así que al
// cambiarlo a true vuelven a salir tal cual.
export const MOSTRAR_CUPONES = false;
export const esPromo = (c) => /^cdd-bp-/.test(c.id || "");
export const visible = (c) => !oculto(c) && (MOSTRAR_CUPONES || esPromo(c));
export const enlacePara = (tienda) => (tienda === "amazon" ? AMAZON : AFILIADO);
export const SINCRONIZAR_CADA_MS = 5 * 60 * 1000; // datos buenos: se vuelven a revisar a los 5 minutos
const REINTENTAR_CADA_MS = 60 * 1000; // si una fuente falló, se reintenta al minuto

// conCache: guarda la respuesta 5 minutos en Cloudflare. Solo se usa sin base de datos, donde cada visita
// leería las fuentes. Con base de datos la sincronización ya limita las lecturas, y una segunda copia
// guardada solo haría que los datos llegaran más viejos.
// (Sin "cache: no-store" a propósito: falla en proyectos de Cloudflare con fecha de compatibilidad vieja.)
const cachePara = (conCache) => (conCache ? { cf: { cacheTtl: 300, cacheEverything: true } } : {});

const TIPOS = {
  dia: "Cupón del día",
  banco: "Bancos",
  bancos: "Bancos",
  activable: "Activables",
  activables: "Activables",
};

export function hoyMX() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}

// ---------- Lectura de la página de origen ----------

// Next.js manda los datos dentro de llamadas self.__next_f.push([1,"..."]).
function extraerPayload(html) {
  let texto = "";
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  for (const m of html.matchAll(re)) {
    try { texto += JSON.parse(`"${m[1]}"`); } catch {}
  }
  return texto;
}

// Devuelve la posición de la llave que cierra el objeto que empieza en i.
function cierre(t, i) {
  let prof = 0, enTexto = false;
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (enTexto) {
      if (c === "\\") j++;
      else if (c === '"') enTexto = false;
    } else if (c === '"') enTexto = true;
    else if (c === "{") prof++;
    else if (c === "}" && --prof === 0) return j;
  }
  return -1;
}

function extraerCupones(texto) {
  const porId = new Map();
  const re = /\{"id":"[0-9a-f-]{36}","code":/g;
  let m;
  while ((m = re.exec(texto))) {
    const fin = cierre(texto, m.index);
    if (fin < 0) continue;
    try {
      const c = JSON.parse(texto.slice(m.index, fin + 1));
      porId.set(c.id, c);
    } catch {}
  }
  return [...porId.values()];
}

// En los datos de Next.js "$" viene escapado como "$$".
function limpiar(v) {
  if (typeof v !== "string") return v ?? null;
  return v.replace(/\$\$/g, "$").replace(/\bOF$/, "OFF").trim() || null;
}

function estadoDe(c, hoy) {
  if (c.active === false) return "finalizado";
  if (c.expiry_date && c.expiry_date < hoy) return "vencido";
  if (c.show_as_upcoming) return "proximamente";
  if (c.sold_out) return "agotado";
  if (c.low_stock) return "pocas";
  return "activo";
}

function normalizar(c, hoy) {
  return {
    id: c.id,
    codigo: limpiar(c.code),
    descuento: limpiar(c.discount),
    porcentaje: limpiar(c.discount_percent),
    compra_minima: limpiar(c.min_purchase),
    tope: limpiar(c.max_discount),
    descripcion: limpiar(c.description) || "En productos seleccionados",
    nota: limpiar(c.eligibility_note),
    categoria: TIPOS[c.type] || limpiar(c.type) || "Cupones",
    banco: limpiar(c.bank),
    boton: limpiar(c.button_label),
    vence: c.expiry_date || null,
    publicado: (c.created_at || "").slice(0, 10),
    destacado: c.featured ? 1 : 0,
    prioridad: c.priority || 0,
    estado: estadoDe(c, hoy),
  };
}

export async function leerOrigen({ conCache = false } = {}) {
  const r = await fetch(ORIGEN, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cupones-mercadolibre.com)" },
    ...cachePara(conCache),
  });
  if (!r.ok) throw new Error(`Origen respondió ${r.status}`);
  const hoy = hoyMX();
  const cupones = extraerCupones(extraerPayload(await r.text())).map((c) => normalizar(c, hoy));
  if (!cupones.length) throw new Error("No se encontraron cupones en el origen");
  return cupones;
}

// ---------- Segunda fuente: cupondeldia.com ----------

const TIPOS_CDD = { bancario: "Bancos", flash: "Flash", meliplus: "Meli+", tienda: "Cupones" };

export function normalizarCdd(c) {
  const tienda = c.tienda === "amazon" ? "amazon" : "mercadolibre";
  const codigo = limpiar(c.codigo);
  if (!codigo || typeof c.id !== "string" || !c.id.startsWith("cdd-") || c.id.length > 64) return null;
  return {
    id: c.id,
    tienda,
    codigo,
    descuento: limpiar(c.descuento),
    porcentaje: /%/.test(c.descuento || "") ? limpiar(c.descuento) : null,
    compra_minima: limpiar(c.compra_minima),
    tope: limpiar(c.tope),
    descripcion: limpiar(c.condiciones) || "En productos seleccionados",
    nota: c.estado === "sin_confirmar" ? "Sin confirmar: revisa que aplique antes de pagar." : null,
    categoria: tienda === "amazon" ? "Amazon" : TIPOS_CDD[c.tipo] || "Cupones",
    banco: null,
    boton: null,
    vence: typeof c.vence === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.vence) ? c.vence : null,
    publicado: hoyMX(),
    destacado: 0,
    prioridad: 0,
    // horario puesto en cupondeldia.com (ISO UTC): "proximamente" antes de la hora; "vencido" si ya terminó
    estado: c.estado === "proximamente" ? "proximamente" : c.estado === "vencido" ? "vencido" : "activo",
    inicia: fechaISO(c.inicia),
    termina: fechaISO(c.termina),
  };
}

const fechaISO = (v) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);

// Estado según el horario (si lo tiene): antes de iniciar, "proximamente"; después de terminar, "vencido".
export function conHorario(c, ahora = Date.now()) {
  if (c.termina && Date.parse(c.termina) <= ahora) return { ...c, estado: "vencido" };
  if (c.inicia && Date.parse(c.inicia) > ahora && c.estado !== "agotado") return { ...c, estado: "proximamente" };
  if (c.inicia && Date.parse(c.inicia) <= ahora && c.estado === "proximamente") return { ...c, estado: "activo" };
  return c;
}

export async function leerCupondeldia({ conCache = false } = {}) {
  const r = await fetch(CUPONDELDIA, {
    headers: { Accept: "application/json", "User-Agent": "cupones-mercadolibre.com/1.0 (+https://cupones-mercadolibre.com)" },
    ...cachePara(conCache),
  });
  if (!r.ok) throw new Error(`cupondeldia respondió ${r.status}`);
  const d = await r.json();
  if (!Array.isArray(d.cupones)) throw new Error("cupondeldia no trajo la lista");
  const promos = Array.isArray(d.promociones) ? d.promociones.map(normalizarPromo).filter(Boolean) : [];
  return [...d.cupones.map(normalizarCdd).filter(Boolean), ...promos];
}

// Promoción bancaria de Mercado Libre SIN código (cupondeldia.com): se activa pagando con la tarjeta en Mercado Libre.
// Sale como tarjeta sin código y con el botón "Ver promoción en Mercado Libre" (con el enlace de esta página).
export function normalizarPromo(p) {
  if (!p || typeof p.id !== "string" || !p.id.startsWith("cdd-bp-") || p.id.length > 64 || p.tienda !== "mercadolibre") return null;
  const beneficio = limpiar(p.beneficio);
  const banco = limpiar(p.banco);
  if (!beneficio || !banco) return null;
  const nota = [limpiar(p.descripcion), p.requiere_registro ? "Requiere registro previo con tu banco." : null].filter(Boolean).join(" ");
  return {
    id: p.id,
    tienda: "mercadolibre",
    codigo: null,
    descuento: beneficio,
    detalle: limpiar(p.detalle),
    porcentaje: /%/.test(beneficio) ? beneficio : null,
    compra_minima: limpiar(p.compra_minima),
    tope: limpiar(p.tope),
    descripcion: "Se activa pagando con tu tarjeta en Mercado Libre. No requiere código.",
    nota: nota || null,
    categoria: "Bancos",
    banco,
    boton: "Ver promoción en Mercado Libre",
    vence: typeof p.vence === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.vence) ? p.vence : null,
    publicado: hoyMX(),
    destacado: 0,
    prioridad: 0,
    estado: "activo",
    inicia: null,
    termina: null,
  };
}

// Junta las dos fuentes. Cada código sale una sola vez por tienda: si un código de Mercado Libre ya viene del origen
// principal, no se repite, y si cupondeldia lo trae dos veces, se queda el verificado (los "sin confirmar" llevan nota).
export function juntar(origen, cdd, ahora = Date.now()) {
  // Horario puesto en cupondeldia.com: manda también sobre el mismo código que llega del origen principal.
  const horarios = new Map();
  for (const c of cdd) if (c.codigo && c.tienda === "mercadolibre" && (c.inicia || c.termina || c.estado === "vencido")) horarios.set(c.codigo.toUpperCase(), c);
  const base = origen.map((c) => {
    const h = horarios.get((c.codigo || "").toUpperCase());
    const o = { ...c, tienda: "mercadolibre", inicia: c.inicia ?? null, termina: c.termina ?? null };
    return h ? conHorario({ ...o, inicia: h.inicia, termina: h.termina, estado: h.estado === "vencido" ? "vencido" : o.estado }, ahora) : o;
  });
  const vistos = new Set(base.map((c) => `mercadolibre|${(c.codigo || "").toUpperCase()}`));
  const extra = [];
  for (const c of [...cdd].sort((a, b) => Number(!!a.nota) - Number(!!b.nota))) {
    // las promociones bancarias no tienen código: se distinguen por su id
    const llave = c.codigo ? `${c.tienda}|${c.codigo.toUpperCase()}` : `id|${c.id}`;
    if (vistos.has(llave) || c.estado === "vencido") continue;
    vistos.add(llave);
    extra.push(conHorario(c, ahora));
  }
  return [...base, ...extra].filter((c) => !oculto(c));
}

// ---------- Base de datos (Cloudflare D1) ----------

let tablasListas = false;

export async function prepararDB(db) {
  if (tablasListas) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS cupones (
      id TEXT PRIMARY KEY, codigo TEXT, descuento TEXT, porcentaje TEXT, compra_minima TEXT, tope TEXT,
      descripcion TEXT, nota TEXT, categoria TEXT, banco TEXT, boton TEXT, vence TEXT, publicado TEXT,
      destacado INTEGER, prioridad INTEGER, estado TEXT,
      visto_primero TEXT NOT NULL, visto_ultimo TEXT NOT NULL, en_origen INTEGER NOT NULL DEFAULT 1)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS likes (
      cupon_id TEXT NOT NULL, votante TEXT NOT NULL, fecha TEXT NOT NULL, PRIMARY KEY (cupon_id, votante))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS usos (
      cupon_id TEXT NOT NULL, votante TEXT NOT NULL, fecha TEXT NOT NULL, PRIMARY KEY (cupon_id, votante))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS opiniones (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cupon_id TEXT NOT NULL, nombre TEXT, texto TEXT NOT NULL,
      fecha TEXT NOT NULL, votante TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS opiniones_cupon ON opiniones (cupon_id, id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT)`),
  ]);
  // columna nueva (cupones de Amazon que llegan de cupondeldia.com); si ya existe, no pasa nada
  await db.prepare("ALTER TABLE cupones ADD COLUMN tienda TEXT NOT NULL DEFAULT 'mercadolibre'").run().catch(() => null);
  // horario puesto en cupondeldia.com (ISO UTC)
  await db.prepare("ALTER TABLE cupones ADD COLUMN inicia TEXT").run().catch(() => null);
  await db.prepare("ALTER TABLE cupones ADD COLUMN termina TEXT").run().catch(() => null);
  // texto junto al monto en promociones bancarias ("de bonificación", "sin intereses")
  await db.prepare("ALTER TABLE cupones ADD COLUMN detalle TEXT").run().catch(() => null);
  tablasListas = true;
}

// Marcas de tiempo de la sincronización:
// - ultima_sync: última vez que LAS DOS fuentes se leyeron bien (es lo que la página muestra como "actualizado").
// - ultimo_intento: última vez que se intentó leer, haya salido bien o mal.
// - ultimo_error: hora y motivo del último fallo (se borra cuando todo vuelve a salir bien).
export async function estadoSync(db) {
  const { results } = await db.prepare(
    "SELECT clave, valor FROM meta WHERE clave IN ('ultima_sync', 'ultimo_intento', 'ultimo_error')").all();
  const m = Object.fromEntries(results.map((f) => [f.clave, f.valor]));
  let error = null;
  try { error = m.ultimo_error ? JSON.parse(m.ultimo_error) : null; } catch {}
  return { actualizado: m.ultima_sync || null, intento: m.ultimo_intento || null, error };
}

export function esReciente(iso, ms = SINCRONIZAR_CADA_MS) {
  return !!iso && Date.now() - new Date(iso).getTime() < ms;
}

const metaSql = (db, clave, valor) =>
  db.prepare("INSERT INTO meta (clave, valor) VALUES (?1, ?2) ON CONFLICT(clave) DO UPDATE SET valor = ?2").bind(clave, valor);

// Guarda en la base lo que hay en las fuentes: si los datos tienen más de 5 minutos, o al minuto si
// la última lectura falló. Nunca borra cupones: así siempre queda el historial.
// Devuelve la hora de la última lectura completa (o null si nunca hubo una).
export async function sincronizar(db) {
  const antes = await estadoSync(db);
  if (esReciente(antes.actualizado)) return antes.actualizado;

  // Varias visitas pueden llegar a la vez: solo la que logra "apartar" el intento lee las fuentes.
  // El UPDATE solo cambia la fila si el intento anterior tiene más de un minuto, y eso es atómico.
  const ahora = new Date().toISOString();
  const limite = new Date(Date.now() - REINTENTAR_CADA_MS).toISOString();
  const apartado = await db.prepare(`INSERT INTO meta (clave, valor) VALUES ('ultimo_intento', ?1)
      ON CONFLICT(clave) DO UPDATE SET valor = ?1 WHERE meta.valor < ?2`).bind(ahora, limite).run();
  if (!(apartado.meta?.changes > 0)) return antes.actualizado;

  // Las dos fuentes por separado: si una falla, la otra se sigue actualizando y lo guardado se sigue mostrando.
  const [principal, cdd] = await Promise.allSettled([leerOrigen(), leerCupondeldia()]);
  const okPrincipal = principal.status === "fulfilled";
  const okCdd = cdd.status === "fulfilled";
  const fallas = [
    !okPrincipal && `cuponesmercadolibre.mx: ${principal.reason?.message || principal.reason}`,
    !okCdd && `cupondeldia.com: ${cdd.reason?.message || cdd.reason}`,
  ].filter(Boolean);
  // Si algo falló, NO se mueve la hora de "actualizado": así la página nunca dice que está al día sin estarlo.
  const marcas = fallas.length
    ? [metaSql(db, "ultimo_error", JSON.stringify({ fecha: ahora, motivo: fallas.join(" | ").slice(0, 300) }))]
    : [metaSql(db, "ultima_sync", ahora), db.prepare("DELETE FROM meta WHERE clave = 'ultimo_error'")];
  if (!okPrincipal && !okCdd) {
    await db.batch(marcas);
    return antes.actualizado;
  }
  const cupones = juntar(okPrincipal ? principal.value : [], okCdd ? cdd.value : []);

  const guardar = db.prepare(`INSERT INTO cupones (id, codigo, descuento, porcentaje, compra_minima, tope, descripcion, nota,
      categoria, banco, boton, vence, publicado, destacado, prioridad, estado, visto_primero, visto_ultimo, en_origen, tienda, inicia, termina, detalle)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17, 1, ?18, ?19, ?20, ?21)
    ON CONFLICT(id) DO UPDATE SET codigo = ?2, descuento = ?3, porcentaje = ?4, compra_minima = ?5, tope = ?6,
      descripcion = ?7, nota = ?8, categoria = ?9, banco = ?10, boton = ?11, vence = ?12,
      publicado = CASE WHEN id LIKE 'cdd-%' THEN publicado ELSE ?13 END, destacado = ?14, prioridad = ?15, estado = ?16, visto_ultimo = ?17, en_origen = 1, tienda = ?18, inicia = ?19, termina = ?20, detalle = ?21`);

  // Lo que ya no aparece en su fuente deja de mostrarse (solo si esa fuente respondió bien).
  const salieron = (esCdd, ids) => db.prepare(`UPDATE cupones SET en_origen = 0 WHERE en_origen = 1 AND id ${esCdd ? "LIKE" : "NOT LIKE"} 'cdd-%'`
    + (ids.length ? ` AND id NOT IN (${ids.map(() => "?").join(",")})` : "")).bind(...ids);
  await db.batch([
    ...cupones.map((c) => guardar.bind(c.id, c.codigo, c.descuento, c.porcentaje, c.compra_minima, c.tope,
      c.descripcion, c.nota, c.categoria, c.banco, c.boton, c.vence, c.publicado, c.destacado, c.prioridad, c.estado, ahora, c.tienda,
      c.inicia ?? null, c.termina ?? null, c.detalle ?? null)),
    ...(okPrincipal ? [salieron(false, cupones.filter((c) => !c.id.startsWith("cdd-")).map((c) => c.id))] : []),
    ...(okCdd ? [salieron(true, cupones.filter((c) => c.id.startsWith("cdd-")).map((c) => c.id))] : []),
    // Las marcas de tiempo se guardan junto con los cupones: o se guarda todo, o nada.
    ...marcas,
  ]);
  return fallas.length ? antes.actualizado : ahora;
}

// ---------- Personas ----------

// Identificador anónimo: un hash de la IP y el navegador. No se guarda la IP.
export async function votante(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("User-Agent") || "";
  const sal = env.SAL || "cupones-mercadolibre";
  const datos = new TextEncoder().encode(`${sal}|${ip}|${ua}`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Solo se aceptan envíos desde el propio sitio.
export function mismoOrigen(request) {
  const origen = request.headers.get("Origin");
  return !origen || new URL(origen).host === new URL(request.url).host;
}

export async function leerCuerpo(request) {
  try { return await request.json(); } catch { return {}; }
}

export async function existeCupon(db, id) {
  if (typeof id !== "string" || id.length > 64) return false;
  return !!(await db.prepare("SELECT 1 FROM cupones WHERE id = ?1").bind(id).first());
}
