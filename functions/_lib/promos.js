// Promociones de tiendas en Mercado Libre SIN código (cupones que se activan con un clic en Mercado Libre).
// Las pasa el dueño, cada una con SU enlace de afiliado (generado por él en su Central de Afiliados).
// Se muestran aquí y en AhorraMX (cuponmercadolibre.com), las dos con el enlace de cada promoción.
// Se quedan hasta que el dueño pida quitarlas: para quitar una, bórrala de la lista; para agregar, copia una línea.
//   marca: la tienda o marca · descuento: el monto · minima / tope: como en Mercado Libre · link: enlace del dueño
// Publicadas el 23 de noviembre de 2026.
export const PROMOS_TIENDAS = [
  { id: "neutrogena-15", marca: "Neutrogena", descuento: "15% OFF", minima: "$500", tope: "$1,500", link: "https://meli.la/1jKyjaC" },
  { id: "guess-10", marca: "GUESS", descuento: "10% OFF", minima: "$1,900", tope: "$3,000", link: "https://meli.la/2cvMJoY" },
  { id: "hp-1000", marca: "HP", descuento: "$1,000 OFF", minima: "$8,000", tope: "$1,000", link: "https://meli.la/2XQ8j9F" },
  { id: "amd-3500", marca: "AMD", descuento: "$3,500 OFF", minima: "$9,000", tope: "$3,500", link: "https://meli.la/2LyDzsM" },
  { id: "amd-3000", marca: "AMD", descuento: "$3,000 OFF", minima: "$9,000", tope: "$3,000", link: "https://meli.la/2M5dhkY" },
  { id: "volkswagen-10", marca: "Volkswagen", descuento: "10% OFF", minima: "$750", tope: "$263", link: "https://meli.la/27tDYGg" },
  { id: "asus-500", marca: "Asus", descuento: "$500 OFF", minima: "$9,999", tope: "$500", link: "https://meli.la/1mpWZLt" },
  { id: "mac-clinique-15", marca: "MAC y Clinique", descuento: "15% OFF", minima: "$100", tope: "$2,000", link: "https://meli.la/1QuynDp" },
  { id: "converse-15", marca: "Converse", descuento: "15% OFF", minima: "$1,200", tope: "$500", link: "https://meli.la/2ECAxYd" },
  { id: "autos-10-8200", marca: "Autos", descuento: "10% OFF", minima: "$8,200", tope: "$990", link: "https://meli.la/2tvWJPL" },
  { id: "china-20", marca: "Ofertas desde China", descuento: "20% OFF", minima: "$259", tope: "$86.10", link: "https://meli.la/2BzLmxf" },
  { id: "autos-10-2500", marca: "Autos", descuento: "10% OFF", minima: "$2,500", tope: "$263", link: "https://meli.la/1gySNAh" },
  { id: "autos-10-3900", marca: "Autos", descuento: "10% OFF", minima: "$3,900", tope: "$470", link: "https://meli.la/23rH8rm" },
  { id: "electronicos-5", marca: "Electrónicos", descuento: "5% OFF", minima: "$1,500", tope: "$300", link: "https://meli.la/2TuoS3k" },
  { id: "converse-moda-20", marca: "Converse Moda", descuento: "20% OFF", minima: "$1,200", tope: "$500", link: "https://meli.la/2itijsF" },
  { id: "skintific-50", marca: "Skintific", descuento: "$50 OFF", minima: "$500", tope: "$50", link: "https://meli.la/1Pse4xM", donde: "En productos de Skintific" },
  { id: "home-electronics-5", marca: "Home electronics", descuento: "5% OFF", minima: "$500", tope: "$100", link: "https://meli.la/2afqruX" },
  { id: "stanhome-15", marca: "Stanhome México", descuento: "15% OFF", minima: "$400", tope: "$1,000", link: "https://meli.la/2mD1B7u", donde: "En productos de Kiotis", nota: "Cupón para seguidores de la tienda en Mercado Libre." },
  { id: "stanhome-10", marca: "Stanhome México", descuento: "10% OFF", minima: "$400", tope: "$1,000", link: "https://meli.la/1GuWsX9", donde: "En productos de STANHOME MÉXICO", nota: "Cupón para seguidores de la tienda en Mercado Libre." },
];

// Solo enlaces de afiliado https de meli.la o mercadolibre.com.mx; cualquier otro se ignora.
export const ENLACE_ML = /^https:\/\/([a-z0-9-]+\.)*(mercadolibre\.com\.mx|meli\.la)(\/|$)/i;
export const PREFIJO = "cdd-pt-"; // "cdd-" para que la sincronización las trate como fuente de promociones

export function promosTiendas(hoy) {
  return PROMOS_TIENDAS.filter((p) => ENLACE_ML.test(p.link)).map((p) => ({
    id: PREFIJO + p.id,
    tienda: "mercadolibre",
    codigo: null,
    descuento: p.descuento,
    detalle: null, // la tarjeta ya pone "de descuento"
    porcentaje: /%/.test(p.descuento) ? p.descuento : null,
    compra_minima: p.minima,
    tope: p.tope,
    descripcion: p.donde || "En productos seleccionados",
    nota: p.nota || "Se activa en Mercado Libre. No requiere código.",
    categoria: "Tiendas",
    banco: p.marca,
    boton: "Ver promoción en Mercado Libre",
    vence: null,
    publicado: hoy,
    destacado: 0,
    prioridad: 0,
    estado: "activo",
    inicia: null,
    termina: null,
    link: p.link,
  }));
}

const enlaces = new Map(PROMOS_TIENDAS.filter((p) => ENLACE_ML.test(p.link)).map((p) => [PREFIJO + p.id, p.link]));
// Enlace propio de una promoción de tienda (o null si no es una).
export const enlacePromo = (id) => enlaces.get(id) || null;
