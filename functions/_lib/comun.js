// Código compartido por las rutas de /api: lectura del origen, base de datos y utilidades.

export const ORIGEN = "https://www.cuponesmercadolibre.mx/";
export const AFILIADO = "https://www.mercadolibre.com.mx/social/maya5629565";
const SINCRONIZAR_CADA_MS = 5 * 60 * 1000; // 5 minutos

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
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
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

export async function leerOrigen() {
  const r = await fetch(ORIGEN, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cupones-mercadolibre.com)" },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!r.ok) throw new Error(`Origen respondió ${r.status}`);
  const hoy = hoyMX();
  const cupones = extraerCupones(extraerPayload(await r.text())).map((c) => normalizar(c, hoy));
  if (!cupones.length) throw new Error("No se encontraron cupones en el origen");
  return cupones;
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
  tablasListas = true;
}

// Guarda en la base lo que hay en el origen, como mucho una vez cada 5 minutos.
// Nunca borra cupones: así siempre queda el historial.
export async function sincronizar(db) {
  const fila = await db.prepare("SELECT valor FROM meta WHERE clave = 'ultima_sync'").first();
  if (fila && Date.now() - new Date(fila.valor).getTime() < SINCRONIZAR_CADA_MS) return fila.valor;

  const ahora = new Date().toISOString();
  await db.prepare("INSERT INTO meta (clave, valor) VALUES ('ultima_sync', ?1) ON CONFLICT(clave) DO UPDATE SET valor = ?1")
    .bind(ahora).run();

  let cupones;
  try {
    cupones = await leerOrigen();
  } catch {
    return fila?.valor || null; // si el origen falla, se sigue mostrando lo guardado
  }

  const guardar = db.prepare(`INSERT INTO cupones (id, codigo, descuento, porcentaje, compra_minima, tope, descripcion, nota,
      categoria, banco, boton, vence, publicado, destacado, prioridad, estado, visto_primero, visto_ultimo, en_origen)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17, 1)
    ON CONFLICT(id) DO UPDATE SET codigo = ?2, descuento = ?3, porcentaje = ?4, compra_minima = ?5, tope = ?6,
      descripcion = ?7, nota = ?8, categoria = ?9, banco = ?10, boton = ?11, vence = ?12, publicado = ?13,
      destacado = ?14, prioridad = ?15, estado = ?16, visto_ultimo = ?17, en_origen = 1`);

  const ids = cupones.map((c) => c.id);
  await db.batch([
    ...cupones.map((c) => guardar.bind(c.id, c.codigo, c.descuento, c.porcentaje, c.compra_minima, c.tope,
      c.descripcion, c.nota, c.categoria, c.banco, c.boton, c.vence, c.publicado, c.destacado, c.prioridad, c.estado, ahora)),
    db.prepare(`UPDATE cupones SET en_origen = 0 WHERE en_origen = 1 AND id NOT IN (${ids.map(() => "?").join(",")})`).bind(...ids),
  ]);
  return ahora;
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
