// Agente de cupones: corre en Cloudflare (Pages Functions) cada vez que alguien pide /api/cupones.
// Lee la página de origen como mucho una vez cada 5 minutos (caché de Cloudflare),
// extrae los cupones, detecta si están activos o agotados y les pone NUESTRO link de afiliado.

const ORIGEN = "https://www.cuponesmercadolibre.mx/";
const AFILIADO = "https://www.mercadolibre.com.mx/social/maya5629565";
const CACHE_SEGUNDOS = 300; // 5 minutos

const TIPOS = {
  dia: "Cupón del día",
  banco: "Bancos",
  bancos: "Bancos",
  activable: "Activables",
  activables: "Activables",
};

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

function estadoDe(c) {
  if (c.show_as_upcoming) return "proximamente";
  if (c.sold_out) return "agotado";
  if (c.low_stock) return "pocas";
  return "activo";
}

function transformar(crudos, hoy) {
  return crudos
    .filter((c) => c.active !== false)
    .filter((c) => !c.expiry_date || c.expiry_date >= hoy)
    .map((c) => ({
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
      link: AFILIADO,
      vence: c.expiry_date || null,
      publicado: (c.created_at || "").slice(0, 10),
      destacado: !!c.featured,
      prioridad: c.priority || 0,
      estado: estadoDe(c),
    }));
}

export async function onRequestGet() {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  try {
    const r = await fetch(ORIGEN, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cupones-mercadolibre.com)" },
      cf: { cacheTtl: CACHE_SEGUNDOS, cacheEverything: true },
    });
    if (!r.ok) throw new Error(`Origen respondió ${r.status}`);
    const cupones = transformar(extraerCupones(extraerPayload(await r.text())), hoy);
    if (!cupones.length) throw new Error("No se encontraron cupones");
    return Response.json(
      { actualizado: new Date().toISOString(), cupones },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch (e) {
    return Response.json({ error: String(e.message || e), cupones: [] }, { status: 502 });
  }
}
