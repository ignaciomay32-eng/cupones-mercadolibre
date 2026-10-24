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
  personas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6v1H2v-1zm15.5 1v-1c0-1.9-.7-3.6-1.9-4.9 3.4.2 6.4 2.4 6.4 5.4V21h-4.5z"/></svg>',
  globo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>',
  candado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z"/></svg>',
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

// Solo se ven las primeras 3 letras hasta que la persona toca "Ver código".
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

function cuadro(etiqueta, valor) {
  return `<div><dt>${etiqueta}</dt><dd>${escapar(valor || "—")}</dd></div>`;
}

function tarjeta(c, i, enHistorial = false) {
  const link = escapar(c.link);
  const usable = c.estado === "activo" || c.estado === "pocas";
  const apagado = !usable;
  const [monto, sufijo] = partirMonto(c.descuento);
  const visto = revelados.has(c.id);
  const porcentaje = c.porcentaje && c.porcentaje.includes("%") ? c.porcentaje : null;

  let accion = "";
  if (c.codigo && usable) {
    accion = `<div class="accion">
        <code class="codigo ${visto ? "visto" : ""}">${visto ? ICONO.check : ICONO.candado}<span>${escapar(visto ? c.codigo : ocultar(c.codigo))}</span></code>
        <button class="btn" data-ver="${escapar(c.id)}" data-codigo="${escapar(c.codigo)}" data-link="${link}">${visto ? "Copiar" : "Ver código"}</button>
      </div>`;
  } else if (c.codigo) {
    accion = `<div class="accion"><code class="codigo">${ICONO.candado}<span>${escapar(ocultar(c.codigo))}</span></code></div>`;
  } else if (usable) {
    accion = `<div class="accion"><a class="btn full" href="${link}" target="_blank" rel="nofollow sponsored noopener">${escapar(c.boton || "Activar cupón")}</a></div>`;
  }

  let linea = "";
  if (enHistorial) {
    linea = `Publicado el ${fechaCorta(c.visto_primero)} · visto por última vez el ${fechaCorta(c.visto_ultimo)}`;
  } else if (usable) {
    const pronto = diasHasta(c.vence || "9999-12-31") <= 0;
    linea = [
      c.visto_ultimo ? `Verificado ${haceCuanto(c.visto_ultimo)}` : "",
      textoVence(c) ? `<span class="${pronto ? "pronto" : ""}">${textoVence(c)}</span>` : "",
    ].filter(Boolean).join(" · ");
  }

  const social = datos.funciones ? `<div class="social">
      <button class="pill like ${c.me_gusta ? "activo" : ""}" data-like="${escapar(c.id)}" aria-pressed="${!!c.me_gusta}" aria-label="Me gusta">
        ${ICONO.corazon}<span>${numero(c.likes)}</span>
      </button>
      <span class="pill dato" title="Personas que tocaron Ver código en este sitio">${ICONO.personas}<span><b data-usos="${escapar(c.id)}">${numero(c.usos)}</b> ${c.usos === 1 ? "persona lo copió" : "personas lo copiaron"}</span></span>
      <button class="pill opinar" data-opinar="${escapar(c.id)}" aria-expanded="false">
        ${ICONO.globo}<span>${c.opiniones ? `Opiniones (${numero(c.opiniones)})` : "Deja tu opinión"}</span>
      </button>
    </div>
    <div class="opiniones" id="op-${escapar(c.id)}" hidden></div>` : "";

  return `<article class="cupon ${apagado ? "es-apagado" : ""} ${enHistorial ? "es-historial" : ""}" style="--i:${i}">
    <div class="talon">
      <span class="monto">${escapar(monto)}</span>
      ${sufijo ? `<span class="monto-sufijo">de descuento</span>` : ""}
    </div>
    <div class="cuerpo">
      <div class="fila">
        <span class="cat">${escapar(c.banco ? `${c.categoria} · ${c.banco}` : c.categoria)}</span>
        <span class="estado estado-${c.estado}">${usable ? ICONO.check : ""}${ETIQUETA_ESTADO[c.estado] || ""}</span>
      </div>
      <dl class="cuadros">
        ${cuadro("Compra mínima", c.compra_minima)}
        ${cuadro("Descuento", porcentaje || monto)}
        ${cuadro("Tope", c.tope)}
      </dl>
      ${c.nota ? `<p class="nota">${escapar(c.nota)}</p>` : ""}
      ${accion}
      ${linea || usable ? `<div class="pie-cupon">
        <span class="vence">${linea}</span>
        ${usable ? `<a class="ir" href="${link}" target="_blank" rel="nofollow sponsored noopener" title="Abre el sitio oficial de Mercado Libre">${ICONO.candado}mercadolibre.com.mx</a>` : ""}
      </div>` : ""}
      ${social}
    </div>
  </article>`;
}

// ---------- render ----------

function render() {
  const lista = datos.cupones.filter((c) => categoria === "Todos" || c.categoria === categoria);
  const vigentes = lista.filter((c) => c.estado !== "agotado");
  const agotados = lista.filter((c) => c.estado === "agotado");
  const historial = datos.historial || [];

  // La animación de entrada solo se ve en la primera carga, no al filtrar ni al refrescar.
  document.body.classList.toggle("sin-animar", !primeraVez);
  primeraVez = false;

  $("#lista").innerHTML = vigentes.map((c, i) => tarjeta(c, i)).join("");
  $("#agotados").innerHTML = agotados.map((c, i) => tarjeta(c, i + vigentes.length)).join("");
  $("#historial").innerHTML = historial.map((c, i) => tarjeta(c, i, true)).join("");
  $("#agotados-sec").hidden = agotados.length === 0;
  $("#historial-sec").hidden = historial.length === 0;
  $("#vacio").hidden = vigentes.length > 0;

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

// ---------- opiniones ----------

function renderOpiniones(panel, id, opiniones) {
  const lista = opiniones.length
    ? opiniones.map((o) => `<li>
        <div class="op-cabeza"><strong>${escapar(o.nombre || "Anónimo")}</strong><span>${haceCuanto(o.fecha)}</span></div>
        <p>${escapar(o.texto)}</p>
      </li>`).join("")
    : `<li class="op-vacio">Todavía no hay opiniones. ¡Sé el primero en contar si te funcionó!</li>`;

  panel.innerHTML = `
    <form class="op-form" data-form="${escapar(id)}">
      <input name="nombre" maxlength="30" placeholder="Tu nombre (opcional)" autocomplete="nickname">
      <textarea name="texto" maxlength="280" rows="2" required placeholder="¿Te funcionó el cupón? Cuéntanos…"></textarea>
      <div class="op-acciones">
        <span class="op-regla">Sin enlaces ni datos personales.</span>
        <button class="btn btn-chico" type="submit">Publicar</button>
      </div>
      <p class="op-error" hidden></p>
    </form>
    <ul class="op-lista">${lista}</ul>`;
}

async function abrirOpiniones(boton) {
  const id = boton.dataset.opinar;
  const panel = document.getElementById("op-" + id);
  const abrir = panel.hidden;
  panel.hidden = !abrir;
  boton.setAttribute("aria-expanded", String(abrir));
  if (!abrir) return;
  panel.innerHTML = `<p class="op-cargando">Cargando opiniones…</p>`;
  try {
    const r = await fetch(`/api/opiniones?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await r.json();
    renderOpiniones(panel, id, data.opiniones || []);
  } catch {
    panel.innerHTML = `<p class="op-cargando">No pudimos cargar las opiniones.</p>`;
  }
}

async function publicarOpinion(form) {
  const id = form.dataset.form;
  const boton = $("button[type=submit]", form);
  const error = $(".op-error", form);
  error.hidden = true;
  boton.disabled = true;
  try {
    const data = await enviar("/api/opiniones", { id, nombre: form.nombre.value, texto: form.texto.value });
    const panel = document.getElementById("op-" + id);
    renderOpiniones(panel, id, data.opiniones);
    const c = buscarCupon(id);
    if (c) c.opiniones = data.opiniones.length;
    const abrir = document.querySelector(`[data-opinar="${CSS.escape(id)}"] span`);
    if (abrir) abrir.textContent = `Opiniones (${numero(data.opiniones.length)})`;
    avisar("¡Gracias por tu opinión!");
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
    boton.disabled = false;
  }
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
    const codigo = ver.previousElementSibling;
    codigo.innerHTML = `${ICONO.check}<span>${escapar(ver.dataset.codigo)}</span>`;
    codigo.classList.add("visto");
    ver.textContent = "Copiar";
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
        const b = document.querySelector(`[data-usos="${CSS.escape(id)}"]`);
        if (b) b.textContent = numero(r.usos);
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
    return;
  }

  const opinar = e.target.closest("[data-opinar]");
  if (opinar) abrirOpiniones(opinar);
});

function pintarLike(boton, c) {
  boton.classList.toggle("activo", c.me_gusta);
  boton.setAttribute("aria-pressed", String(c.me_gusta));
  $("span", boton).textContent = numero(c.likes);
}

document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  publicarOpinion(form);
});

// ---------- carga ----------

$("#anio").textContent = new Date().getFullYear();

function hayOpinionAbierta() {
  return [...document.querySelectorAll(".opiniones")].some((p) => !p.hidden);
}

function cargar({ automatica = false } = {}) {
  // Si alguien está leyendo o escribiendo una opinión, no le cambiamos la página.
  if (automatica && hayOpinionAbierta()) return Promise.resolve();
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
      // El servidor responde con lo guardado y revisa el origen por detrás. Si lo guardado
      // tiene más de 5 minutos, pedimos otra vez en unos segundos para mostrar la revisión nueva.
      const viejo = Date.now() - new Date(datos.actualizado) > 5 * 60 * 1000;
      if (viejo && !reintentado) {
        reintentado = true;
        setTimeout(() => cargar({ automatica: true }), 4000);
      }
    })
    .catch(() => {
      if (datos.cupones.length) return;
      $("#lista").innerHTML = "";
      $("#vacio").hidden = false;
      $("#vacio").textContent = "No pudimos cargar los cupones. Recarga la página.";
    });
}

cargar();
setInterval(() => cargar({ automatica: true }), 5 * 60 * 1000); // refresca cada 5 minutos
setInterval(renderVivo, 30 * 1000);
