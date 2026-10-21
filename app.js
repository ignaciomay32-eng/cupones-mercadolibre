const $ = (s) => document.querySelector(s);
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const ORDEN_ESTADO = { activo: 0, pocas: 0, proximamente: 1, agotado: 2 };
const ETIQUETA_ESTADO = {
  activo: "✓ Activo",
  pocas: "⚡ Quedan pocos",
  proximamente: "Próximamente",
  agotado: "Agotado",
};
let cupones = [];
let categoria = "Todos";
const revelados = new Set();

// Solo se ven las primeras 3 letras hasta que la persona toca "Ver código".
function ocultar(codigo) {
  return codigo.slice(0, 3) + "•".repeat(Math.max(codigo.length - 3, 3));
}

function diasHasta(fecha) {
  return Math.round((new Date(fecha) - new Date(hoy)) / 86400000);
}

function formatoFecha(fecha) {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function escapar(t) {
  const d = document.createElement("div");
  d.textContent = t ?? "";
  return d.innerHTML;
}

function textoVence(c) {
  if (!c.vence) return "";
  const dias = diasHasta(c.vence);
  return dias <= 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `Vence el ${formatoFecha(c.vence)}`;
}

function dato(etiqueta, valor) {
  return valor ? `<div><dt>${etiqueta}</dt><dd>${escapar(valor)}</dd></div>` : "";
}

function tarjeta(c) {
  const link = escapar(c.link);
  const agotado = c.estado === "agotado";
  const usable = c.estado === "activo" || c.estado === "pocas";
  const vence = textoVence(c);

  let accion;
  if (c.codigo && usable) {
    const visto = revelados.has(c.id);
    accion = `<div class="codigo">
        <code>${escapar(visto ? c.codigo : ocultar(c.codigo))}</code>
        <button class="btn" data-id="${escapar(c.id)}" data-codigo="${escapar(c.codigo)}" data-link="${link}">${visto ? "Copiar" : "Ver código"}</button>
      </div>
      <a class="ir" href="${link}" target="_blank" rel="nofollow sponsored noopener">Ir a Mercado Libre →</a>`;
  } else if (c.codigo) {
    accion = `<div class="codigo apagado"><code>${escapar(ocultar(c.codigo))}</code></div>`;
  } else {
    accion = `<a class="btn full" href="${link}" target="_blank" rel="nofollow sponsored noopener">${escapar(c.boton || "Activar cupón")} →</a>`;
  }

  return `<article class="cupon ${agotado ? "es-agotado" : ""}">
    <div class="fila">
      <span class="badge">${escapar(c.descuento)}</span>
      <span class="estado estado-${c.estado}">${ETIQUETA_ESTADO[c.estado] || ""}</span>
    </div>
    <span class="cat">${escapar(c.banco ? `${c.categoria} · ${c.banco}` : c.categoria)}</span>
    <p>${escapar(c.descripcion)}</p>
    <dl class="datos">
      ${dato("Compra mínima", c.compra_minima)}
      ${dato("Descuento", c.porcentaje)}
      ${dato("Tope", c.tope)}
    </dl>
    ${c.nota ? `<p class="nota">${escapar(c.nota)}</p>` : ""}
    ${accion}
    ${vence ? `<span class="vence ${diasHasta(c.vence) <= 0 && !agotado ? "pronto" : ""}">${vence}</span>` : ""}
  </article>`;
}

function render() {
  const q = $("#buscar").value.trim().toLowerCase();
  const filtrados = cupones.filter((c) =>
    (categoria === "Todos" || c.categoria === categoria) &&
    (!q || `${c.descuento} ${c.descripcion} ${c.categoria} ${c.banco ?? ""} ${c.codigo ?? ""}`.toLowerCase().includes(q))
  );
  $("#lista").innerHTML = filtrados.map(tarjeta).join("");
  $("#vacio").hidden = filtrados.length > 0;
  const activos = filtrados.filter((c) => c.estado === "activo" || c.estado === "pocas").length;
  $("#contador").textContent = activos === 1 ? "1 cupón activo" : `${activos} cupones activos`;
}

function renderCategorias() {
  const cats = ["Todos", ...new Set(cupones.map((c) => c.categoria))];
  $("#categorias").innerHTML = cats
    .map((c) => `<button class="chip" role="tab" aria-selected="${c === categoria}">${escapar(c)}</button>`)
    .join("");
}

$("#categorias").addEventListener("click", (e) => {
  if (!e.target.matches(".chip")) return;
  categoria = e.target.textContent;
  renderCategorias();
  render();
});

$("#buscar").addEventListener("input", render);

$("#lista").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-codigo]");
  if (!btn) return;
  revelados.add(btn.dataset.id);
  btn.previousElementSibling.textContent = btn.dataset.codigo;
  try { await navigator.clipboard.writeText(btn.dataset.codigo); } catch {}
  btn.textContent = "¡Copiado!";
  const toast = $("#toast");
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; btn.textContent = "Copiar"; }, 1800);
  window.open(btn.dataset.link, "_blank", "noopener");
});

$("#anio").textContent = new Date().getFullYear();

function cargar() {
  return fetch("/api/cupones", { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      cupones = (data.cupones || [])
        .filter((c) => !c.vence || c.vence >= hoy)
        .sort((a, b) =>
          (ORDEN_ESTADO[a.estado] ?? 1) - (ORDEN_ESTADO[b.estado] ?? 1) ||
          b.destacado - a.destacado ||
          b.prioridad - a.prioridad ||
          b.publicado.localeCompare(a.publicado)
        );
      renderCategorias();
      render();
    })
    .catch(() => {
      if (cupones.length) return;
      $("#vacio").hidden = false;
      $("#vacio").textContent = "No pudimos cargar los cupones. Recarga la página.";
    });
}

cargar();
setInterval(cargar, 5 * 60 * 1000); // refresca solo cada 5 minutos si la página queda abierta
