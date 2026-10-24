const $ = (s, el = document) => el.querySelector(s);
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const ETIQUETA_ESTADO = {
  activo: "Activo",
  pocas: "Quedan pocos",
  proximamente: "Próximamente",
  agotado: "Agotado",
  vencido: "Vencido",
  finalizado: "Finalizado",
};
const ICONO = {
  corazon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 4.2 2.4h2c.6-1.3 2.1-2.4 4.2-2.4 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  flecha: '<svg class="flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3z"/></svg>',
};

let datos = { cupones: [], historial: [], funciones: false };
let categoria = "Todos";
let primeraVez = true;
let reintentado = false;
const revelados = new Set();

// ---------- utilidades ----------

function escapar(t) {
  const d = document.createElement("div");
  d.textContent = t ?? "";
  return d.innerHTML;
}

// Solo se ven las primeras 3 letras hasta que la persona toca "Copiar e ir a Mercado Libre".
function ocultar(codigo) {
  return codigo.slice(0, 3) + "•".repeat(Math.max(codigo.length - 3, 3));
}

function diasHasta(fecha) {
  return Math.round((new Date(fecha) - new Date(hoy)) / 86400000);
}

function fechaCorta(iso) {
  return new Date(iso.length === 10 ? iso + "T12:00:00" : iso)
    .toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });
}

function textoVence(c) {
  if (!c.vence) return "";
  const dias = diasHasta(c.vence);
  if (dias <= 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return "Vence el " + fechaCorta(c.vence);
}

function haceCuanto(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return "el " + fechaCorta(iso);
}

function numero(n) {
  return Number(n || 0).toLocaleString("es-MX");
}

// "$1,800 OFF" -> monto "$1,800" y sufijo "OFF"
function partirMonto(descuento) {
  const m = (descuento || "").match(/^(.+?)\s+(OFF)$/i);
  return m ? [m[1], m[2].toUpperCase()] : [descuento || "Cupón", ""];
}

// Copia en el mismo instante del toque (funciona en todos los navegadores) y, si no se pudo,
// intenta con la API del portapapeles. Devuelve si la copia síncrona funcionó.
function copiar(texto) {
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, texto.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  area.remove();
  if (!ok && navigator.clipboard) navigator.clipboard.writeText(texto).catch(() => {});
  return ok;
}

let toastTimer;
function avisar(texto) {
  const toast = $("#toast");
  toast.textContent = texto;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2000);
}

async function enviar(ruta, cuerpo) {
  const r = await fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Algo salió mal. Intenta de nuevo.");
  return data;
}

// ---------- tarjeta de cupón ----------

// Los contadores se muestran solo cuando ya son significativos; los números son siempre los reales.
const MOSTRAR_DESDE = 10;

function condiciones(c, monto) {
  const porcentaje = c.porcentaje && c.porcentaje.includes("%") ? c.porcentaje : null;
  const partes = [];
  if (c.compra_minima) partes.push(`Compra mínima <b>${escapar(c.compra_minima)}</b>`);
  if (porcentaje && c.tope) partes.push(`${escapar(porcentaje)} hasta <b>${escapar(c.tope)}</b>`);
  else if (c.tope && c.tope !== monto) partes.push(`Tope <b>${escapar(c.tope)}</b>`);
  return partes.join(" · ");
}

function corazon(c) {
  const n = c.likes >= MOSTRAR_DESDE ? numero(c.likes) : "";
  return `<button class="like ${c.me_gusta ? "activo" : ""}" data-like="${escapar(c.id)}" aria-pressed="${!!c.me_gusta}" aria-label="Me gusta">
      ${ICONO.corazon}<span>${n}</span>
    </button>`;
}

function tarjeta(c, i, enHistorial = false) {
  const link = escapar(c.link);
  const usable = c.estado === "activo" || c.estado === "pocas";
  const [monto, sufijo] = partirMonto(c.descuento);
  const visto = revelados.has(c.id);

  let codigo = "";
  if (c.codigo) {
    const mostrar = visto && usable ? c.codigo : ocultar(c.codigo);
    codigo = `<div class="codigo ${visto && usable ? "visto" : ""}"><span class="codigo-etq">Código</span><span class="codigo-txt">${escapar(mostrar)}</span></div>`;
  }

  let boton = "";
  if (usable && c.codigo) {
    boton = `<button class="btn full" data-ver="${escapar(c.id)}" data-codigo="${escapar(c.codigo)}" data-link="${link}">Copiar e ir a Mercado Libre${ICONO.flecha}</button>`;
  } else if (usable) {
    boton = `<a class="btn full" href="${link}" target="_blank" rel="nofollow sponsored noopener">${escapar(c.boton || "Activar en Mercado Libre")}</a>`;
  }

  let linea = "";
  if (enHistorial) {
    linea = `Publicado el ${fechaCorta(c.visto_primero)} · visto por última vez el ${fechaCorta(c.visto_ultimo)}`;
  } else if (usable) {
    const pronto = diasHasta(c.vence || "9999-12-31") <= 0;
    linea = [
      c.visto_ultimo ? `Verificado ${haceCuanto(c.visto_ultimo)}` : "",
      textoVence(c) ? `<span class="${pronto ? "pronto" : ""}">${textoVence(c)}</span>` : "",
      c.usos >= MOSTRAR_DESDE ? `${numero(c.usos)} lo copiaron` : "",
    ].filter(Boolean).join(" · ");
  }

  const estado = c.estado !== "activo" && ETIQUETA_ESTADO[c.estado]
    ? `<span class="estado estado-${c.estado}">${ETIQUETA_ESTADO[c.estado]}</span>` : "";
  const cat = c.banco ? `${c.categoria} · ${c.banco}` : c.categoria;
  const cond = condiciones(c, monto);

  return `<article class="cupon ${usable ? "" : "es-apagado"} ${enHistorial ? "es-historial" : ""}" style="--i:${i}">
    <div class="cupon-cabeza">
      <span class="cupon-cat">${escapar(cat || "")}</span>
      <span class="tienda">Válido en Mercado Libre</span>
    </div>
    <p class="cupon-monto"><span class="monto">${escapar(monto)}</span>${sufijo ? ` <span class="monto-sufijo">de descuento</span>` : ""}</p>
    ${cond ? `<p class="cupon-cond">${cond}</p>` : ""}
    ${c.nota ? `<p class="nota">${escapar(c.nota)}</p>` : ""}
    ${codigo}
    ${boton}
    <div class="cupon-pie">
      <span class="vence">${estado}${linea}</span>
      ${datos.funciones && usable ? corazon(c) : ""}
    </div>
  </article>`;
}

// ---------- render ----------

// Los cupones aparecen al entrar en pantalla, solo la primera vez (no al filtrar ni al refrescar).
const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
const observador = "IntersectionObserver" in window && !sinMovimiento
  ? new IntersectionObserver((vistas) => {
      let n = 0;
      for (const v of vistas) {
        if (!v.isIntersecting) continue;
        v.target.style.setProperty("--retraso", `${Math.min(n++, 4) * 70}ms`);
        v.target.classList.add("visible");
        observador.unobserve(v.target);
      }
    }, { rootMargin: "0px 0px -6% 0px" })
  : null;
if (observador) document.body.classList.add("js-anim");

function entradas(animar) {
  for (const c of document.querySelectorAll(".cupon:not(.esqueleto)")) {
    if (animar && observador) observador.observe(c);
    else c.classList.add("visible");
  }
}


function render() {
  const lista = datos.cupones.filter((c) => categoria === "Todos" || c.categoria === categoria);
  const vigentes = lista.filter((c) => c.estado !== "agotado");
  const agotados = lista.filter((c) => c.estado === "agotado");
  const historial = datos.historial || [];

  const animar = primeraVez;
  primeraVez = false;

  $("#lista").innerHTML = vigentes.map((c, i) => tarjeta(c, i)).join("");
  $("#agotados").innerHTML = agotados.map((c, i) => tarjeta(c, i + vigentes.length)).join("");
  $("#historial").innerHTML = historial.map((c, i) => tarjeta(c, i, true)).join("");
  $("#agotados-sec").hidden = agotados.length === 0;
  $("#historial-sec").hidden = historial.length === 0;
  $("#vacio").hidden = vigentes.length > 0;
  entradas(animar);

}

function renderCategorias() {
  const cats = [...new Set(datos.cupones.map((c) => c.categoria))];
  $("#categorias").hidden = cats.length < 2;
  $("#categorias").innerHTML = ["Todos", ...cats]
    .map((c) => `<button class="chip" aria-pressed="${c === categoria}">${escapar(c)}</button>`)
    .join("");
}

function renderVivo() {
  if (!datos.actualizado) return;
  const activos = datos.cupones.filter((c) => c.estado === "activo" || c.estado === "pocas").length;
  const cuantos = activos === 1 ? "1 cupón activo" : `${numero(activos)} cupones activos`;
  $("#vivo-texto").textContent = `${cuantos} · revisados ${haceCuanto(datos.actualizado)}`;
}

function buscarCupon(id) {
  return datos.cupones.find((c) => c.id === id) || datos.historial.find((c) => c.id === id);
}

// ---------- opiniones (sección aparte) ----------

let opiniones = [];

function opcionesCupones() {
  return datos.cupones
    .filter((c) => c.estado === "activo" || c.estado === "pocas")
    .map((c) => {
      const [monto] = partirMonto(c.descuento);
      const extra = c.compra_minima ? ` · compra mínima ${c.compra_minima}` : "";
      return `<option value="${escapar(c.id)}">${escapar(monto)} de descuento${escapar(extra)}</option>`;
    }).join("");
}

function renderFormOpinion() {
  const select = $("#op-cupon");
  if (!select || document.activeElement === select) return;
  const elegido = select.value;
  select.innerHTML = opcionesCupones();
  if (elegido && [...select.options].some((o) => o.value === elegido)) select.value = elegido;
  $("#opiniones-sec").hidden = !datos.funciones || (!select.options.length && !opiniones.length);
  $("#op-form").hidden = !select.options.length;
}

function renderListaOpiniones() {
  $("#op-lista").innerHTML = opiniones.length
    ? opiniones.map((o) => `<li>
        <div class="op-cabeza"><strong>${escapar(o.nombre || "Anónimo")}</strong><span>${haceCuanto(o.fecha)}</span></div>
        ${o.descuento ? `<span class="op-sobre">Sobre el cupón de ${escapar(partirMonto(o.descuento)[0])}</span>` : ""}
        <p>${escapar(o.texto)}</p>
      </li>`).join("")
    : `<li class="op-vacio">Todavía no hay opiniones. ¡Cuéntanos si te funcionó un cupón!</li>`;
}

async function cargarOpiniones() {
  try {
    const r = await fetch("/api/opiniones", { cache: "no-store" });
    const data = await r.json();
    opiniones = data.opiniones || [];
  } catch {
    opiniones = [];
  }
  renderListaOpiniones();
  renderFormOpinion();
}

async function publicarOpinion(form) {
  const boton = $("button[type=submit]", form);
  const error = $(".op-error", form);
  error.hidden = true;
  boton.disabled = true;
  try {
    const data = await enviar("/api/opiniones", { id: form.cupon.value, nombre: form.nombre.value, texto: form.texto.value });
    opiniones = data.recientes || opiniones;
    renderListaOpiniones();
    form.texto.value = "";
    avisar("¡Gracias por tu opinión!");
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
  }
  boton.disabled = false;
}

// ---------- eventos ----------

$("#categorias").addEventListener("click", (e) => {
  if (!e.target.matches(".chip")) return;
  categoria = e.target.textContent;
  renderCategorias();
  render();
});

document.addEventListener("click", async (e) => {
  const ver = e.target.closest("[data-ver]");
  if (ver) {
    const id = ver.dataset.ver;
    const primera = !revelados.has(id);
    revelados.add(id);
    const codigo = ver.closest(".cupon").querySelector(".codigo");
    if (codigo) {
      codigo.classList.add("visto", "revela");
      codigo.addEventListener("animationend", () => codigo.classList.remove("revela"), { once: true });
      $(".codigo-txt", codigo).textContent = ver.dataset.codigo;
    }
    document.dispatchEvent(new CustomEvent("cupon-copiado"));
    // Copiar y abrir sin esperar nada: Safari bloquea la pestaña nueva si se abre después de un await.
    const copiado = copiar(ver.dataset.codigo);
    window.open(ver.dataset.link, "_blank", "noopener");
    avisar(copiado
      ? `Código ${ver.dataset.codigo} copiado · abriendo mercadolibre.com.mx`
      : `Copia el código ${ver.dataset.codigo} · abriendo mercadolibre.com.mx`);
    if (primera && datos.funciones) {
      enviar("/api/usar", { id }).then((r) => {
        const c = buscarCupon(id);
        if (c) c.usos = r.usos;
      }).catch(() => {});
    }
    return;
  }

  const like = e.target.closest("[data-like]");
  if (like) {
    const id = like.dataset.like;
    const c = buscarCupon(id);
    const antes = { me_gusta: !!c.me_gusta, likes: c.likes || 0 };
    // Respuesta inmediata en pantalla; si el servidor falla, se revierte.
    c.me_gusta = !antes.me_gusta;
    c.likes = antes.likes + (c.me_gusta ? 1 : -1);
    pintarLike(like, c);
    try {
      const r = await enviar("/api/like", { id });
      c.me_gusta = r.me_gusta;
      c.likes = r.likes;
    } catch {
      Object.assign(c, antes);
      avisar("No se pudo guardar tu me gusta.");
    }
    pintarLike(like, c);
  }
});

function pintarLike(boton, c) {
  boton.classList.toggle("activo", c.me_gusta);
  boton.setAttribute("aria-pressed", String(c.me_gusta));
  $("span", boton).textContent = c.likes >= MOSTRAR_DESDE ? numero(c.likes) : "";
}

$("#op-form").addEventListener("submit", (e) => {
  e.preventDefault();
  publicarOpinion(e.target);
});

// ---------- temporadas de ofertas ----------

// Cuenta los días que faltan para cada temporada con la fecha de México.
function renderTemporadas() {
  for (const li of document.querySelectorAll(".temp-lista li[data-inicio]")) {
    const inicio = diasHasta(li.dataset.inicio);
    const fin = diasHasta(li.dataset.fin);
    let texto = `Faltan ${inicio} días`;
    if (fin < 0) texto = "Ya terminó";
    else if (inicio <= 0) texto = li.dataset.inicio === li.dataset.fin ? "¡Es hoy!" : "¡Ya empezó!";
    else if (inicio === 1) texto = "Empieza mañana";
    li.classList.toggle("en-curso", inicio <= 0 && fin >= 0);
    li.classList.toggle("terminada", fin < 0);
    $(".temp-estado", li).textContent = texto;
  }
}

renderTemporadas();

// ---------- carga ----------

$("#anio").textContent = new Date().getFullYear();

function cargar() {
  return fetch("/api/cupones", { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      datos = { cupones: [], historial: [], ...data };
      datos.cupones = datos.cupones
        .filter((c) => !c.vence || c.vence >= hoy)
        .sort((a, b) =>
          (b.estado === "pocas") - (a.estado === "pocas") ||
          b.destacado - a.destacado ||
          b.prioridad - a.prioridad ||
          String(b.publicado).localeCompare(String(a.publicado))
        );
      renderCategorias();
      render();
      renderVivo();
      renderFormOpinion();
      // El servidor responde con lo guardado y revisa el origen por detrás. Si lo guardado
      // tiene más de 5 minutos, pedimos otra vez en unos segundos para mostrar la revisión nueva.
      const viejo = Date.now() - new Date(datos.actualizado) > 5 * 60 * 1000;
      if (viejo && !reintentado) {
        reintentado = true;
        setTimeout(cargar, 4000);
      }
    })
    .catch(() => {
      if (datos.cupones.length) return;
      $("#lista").innerHTML = "";
      $("#vacio").hidden = false;
      $("#vacio").textContent = "No pudimos cargar los cupones. Recarga la página.";
    });
}

cargar().then(cargarOpiniones);
setInterval(cargar, 5 * 60 * 1000); // refresca cada 5 minutos
setInterval(renderVivo, 30 * 1000);
