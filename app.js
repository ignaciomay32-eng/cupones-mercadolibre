const $ = (s) => document.querySelector(s);
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const ETIQUETA_ESTADO = {
  activo: "Activo",
  pocas: "Quedan pocos",
  proximamente: "Próximamente",
};
let cupones = [];
let categoria = "Todos";
let actualizado = null;
let primeraVez = true;
const revelados = new Set();

// Solo se ven las primeras 3 letras hasta que la persona toca "Ver código".
function ocultar(codigo) {
  return codigo.slice(0, 3) + "•".repeat(Math.max(codigo.length - 3, 3));
}

function escapar(t) {
  const d = document.createElement("div");
  d.textContent = t ?? "";
  return d.innerHTML;
}

function diasHasta(fecha) {
  return Math.round((new Date(fecha) - new Date(hoy)) / 86400000);
}

function textoVence(c) {
  if (!c.vence) return "";
  const dias = diasHasta(c.vence);
  if (dias <= 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return "Vence el " + new Date(c.vence + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// "$1,800 OFF" -> monto "$1,800" y sufijo "OFF"
function partirMonto(descuento) {
  const m = (descuento || "").match(/^(.+?)\s+(OFF)$/i);
  return m ? [m[1], m[2].toUpperCase()] : [descuento || "Cupón", ""];
}

function condiciones(c) {
  const partes = [];
  if (c.porcentaje && c.porcentaje.includes("%")) partes.push(`<strong>${escapar(c.porcentaje)}</strong> de descuento`);
  if (c.tope) partes.push(`tope <strong>${escapar(c.tope)}</strong>`);
  if (c.compra_minima) partes.push(`compra mínima <strong>${escapar(c.compra_minima)}</strong>`);
  return partes.length ? partes.join(" · ") : escapar(c.descripcion);
}

function tarjeta(c, i) {
  const link = escapar(c.link);
  const agotado = c.estado === "agotado";
  const usable = c.estado === "activo" || c.estado === "pocas";
  const [monto, sufijo] = partirMonto(c.descuento);
  const vence = textoVence(c);
  const visto = revelados.has(c.id);

  let accion = "";
  if (c.codigo && usable) {
    accion = `<div class="accion">
        <code class="codigo ${visto ? "visto" : ""}">${escapar(visto ? c.codigo : ocultar(c.codigo))}</code>
        <button class="btn" data-id="${escapar(c.id)}" data-codigo="${escapar(c.codigo)}" data-link="${link}">${visto ? "Copiar" : "Ver código"}</button>
      </div>`;
  } else if (c.codigo) {
    accion = `<div class="accion"><code class="codigo">${escapar(ocultar(c.codigo))}</code></div>`;
  } else if (usable) {
    accion = `<div class="accion"><a class="btn full" href="${link}" target="_blank" rel="nofollow sponsored noopener">${escapar(c.boton || "Activar cupón")}</a></div>`;
  }

  const etiqueta = ETIQUETA_ESTADO[c.estado];
  return `<article class="cupon ${agotado ? "es-agotado" : ""}" style="--i:${i}">
    <div class="talon">
      <span class="monto">${escapar(monto)}</span>
      ${sufijo ? `<span class="monto-sufijo">${sufijo}</span>` : ""}
    </div>
    <div class="cuerpo">
      <div class="fila">
        <span class="cat">${escapar(c.banco ? `${c.categoria} · ${c.banco}` : c.categoria)}</span>
        ${etiqueta ? `<span class="estado estado-${c.estado}">${etiqueta}</span>` : ""}
      </div>
      <p class="condiciones">${condiciones(c)}</p>
      ${c.nota ? `<p class="nota">${escapar(c.nota)}</p>` : ""}
      ${accion}
      ${!agotado && (vence || usable) ? `<div class="pie-cupon">
        <span class="vence ${diasHasta(c.vence || "9999-12-31") <= 0 ? "pronto" : ""}">${vence}</span>
        ${usable ? `<a class="ir" href="${link}" target="_blank" rel="nofollow sponsored noopener">Ir a Mercado Libre →</a>` : ""}
      </div>` : ""}
    </div>
  </article>`;
}

function render() {
  const filtrados = cupones.filter((c) => categoria === "Todos" || c.categoria === categoria);
  const vigentes = filtrados.filter((c) => c.estado !== "agotado");
  const agotados = filtrados.filter((c) => c.estado === "agotado");

  // La animación de entrada solo se ve en la primera carga, no al filtrar ni al refrescar.
  $("#lista").classList.toggle("sin-animar", !primeraVez);
  $("#agotados").classList.toggle("sin-animar", !primeraVez);
  primeraVez = false;

  $("#lista").innerHTML = vigentes.map(tarjeta).join("");
  $("#agotados").innerHTML = agotados.map((c, i) => tarjeta(c, i + vigentes.length)).join("");
  $("#agotados-sec").hidden = agotados.length === 0;
  $("#vacio").hidden = vigentes.length > 0;
}

function renderCategorias() {
  const cats = [...new Set(cupones.map((c) => c.categoria))];
  $("#categorias").hidden = cats.length < 2;
  $("#categorias").innerHTML = ["Todos", ...cats]
    .map((c) => `<button class="chip" role="tab" aria-selected="${c === categoria}">${escapar(c)}</button>`)
    .join("");
}

function renderVivo() {
  if (!actualizado) return;
  const min = Math.max(0, Math.round((Date.now() - new Date(actualizado)) / 60000));
  $("#vivo-texto").innerHTML = `<span class="largo">Actualizado </span>${min < 1 ? "ahora" : `hace ${min} min`}`;
}

$("#categorias").addEventListener("click", (e) => {
  if (!e.target.matches(".chip")) return;
  categoria = e.target.textContent;
  renderCategorias();
  render();
});

let toastTimer;
function avisar(texto) {
  const toast = $("#toast");
  toast.textContent = texto;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-codigo]");
  if (!btn) return;
  revelados.add(btn.dataset.id);
  const codigo = btn.previousElementSibling;
  codigo.textContent = btn.dataset.codigo;
  codigo.classList.add("visto");
  btn.textContent = "Copiar";
  try { await navigator.clipboard.writeText(btn.dataset.codigo); } catch {}
  avisar(`Código ${btn.dataset.codigo} copiado`);
  window.open(btn.dataset.link, "_blank", "noopener");
});

$("#anio").textContent = new Date().getFullYear();
const fecha = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City" });
$("#fecha").textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);

function cargar() {
  return fetch("/api/cupones", { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      actualizado = data.actualizado || null;
      cupones = (data.cupones || [])
        .filter((c) => !c.vence || c.vence >= hoy)
        .sort((a, b) =>
          (b.estado === "pocas") - (a.estado === "pocas") ||
          b.destacado - a.destacado ||
          b.prioridad - a.prioridad ||
          b.publicado.localeCompare(a.publicado)
        );
      renderCategorias();
      render();
      renderVivo();
    })
    .catch(() => {
      if (cupones.length) return;
      $("#lista").innerHTML = "";
      $("#vacio").hidden = false;
      $("#vacio").textContent = "No pudimos cargar los cupones. Recarga la página.";
    });
}

cargar();
setInterval(cargar, 5 * 60 * 1000); // refresca solo cada 5 minutos si la página queda abierta
setInterval(renderVivo, 30 * 1000);
