const $ = (s) => document.querySelector(s);
const hoy = new Date().toISOString().slice(0, 10);
let cupones = [];
let categoria = "Todas";

function diasHasta(fecha) {
  return Math.round((new Date(fecha) - new Date(hoy)) / 86400000);
}

function formatoFecha(fecha) {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function escapar(t) {
  const d = document.createElement("div");
  d.textContent = t ?? "";
  return d.innerHTML;
}

function tarjeta(c) {
  const dias = diasHasta(c.vence);
  const vence = dias === 0 ? "Vence hoy" : dias === 1 ? "Vence mañana" : `Vence el ${formatoFecha(c.vence)}`;
  const esNuevo = diasHasta(c.publicado) >= -2;
  const link = escapar(c.link);

  const accion = c.codigo
    ? `<div class="codigo">
         <code>${escapar(c.codigo)}</code>
         <button class="btn" data-codigo="${escapar(c.codigo)}" data-link="${link}">Copiar</button>
       </div>
       <a class="ir" href="${link}" target="_blank" rel="nofollow sponsored noopener">Ir a la oferta →</a>`
    : `<a class="btn full" href="${link}" target="_blank" rel="nofollow sponsored noopener">Ver oferta →</a>`;

  return `<article class="cupon">
    <div class="fila">
      <span class="badge">${escapar(c.descuento)}</span>
      ${esNuevo ? '<span class="nuevo">NUEVO</span>' : ""}
    </div>
    <span class="cat">${escapar(c.categoria)}</span>
    <h2>${escapar(c.titulo)}</h2>
    <p>${escapar(c.descripcion)}</p>
    ${accion}
    <span class="vence ${dias <= 3 ? "pronto" : ""}">${vence}</span>
  </article>`;
}

function render() {
  const q = $("#buscar").value.trim().toLowerCase();
  const filtrados = cupones.filter((c) =>
    (categoria === "Todas" || c.categoria === categoria) &&
    (!q || `${c.titulo} ${c.descripcion} ${c.categoria} ${c.codigo ?? ""}`.toLowerCase().includes(q))
  );
  $("#lista").innerHTML = filtrados.map(tarjeta).join("");
  $("#vacio").hidden = filtrados.length > 0;
  $("#contador").textContent = `${filtrados.length} cupón${filtrados.length === 1 ? "" : "es"} activo${filtrados.length === 1 ? "" : "s"}`;
}

function renderCategorias() {
  const cats = ["Todas", ...new Set(cupones.map((c) => c.categoria))];
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
  try { await navigator.clipboard.writeText(btn.dataset.codigo); } catch {}
  btn.textContent = "¡Copiado!";
  const toast = $("#toast");
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; btn.textContent = "Copiar"; }, 1800);
  window.open(btn.dataset.link, "_blank", "noopener");
});

$("#anio").textContent = new Date().getFullYear();

fetch("cupones.json", { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    cupones = data
      .filter((c) => c.vence >= hoy)
      .sort((a, b) => b.publicado.localeCompare(a.publicado));
    renderCategorias();
    render();
  })
  .catch(() => {
    $("#vacio").hidden = false;
    $("#vacio").textContent = "No pudimos cargar los cupones. Recargá la página.";
  });
