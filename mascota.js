// Mascota: un perrito habanero blanco que espera sentado en la esquina de abajo.
// En computadora camina hacia el cursor y se vuelve a sentar; en el celular no cruza la pantalla:
// se agacha mientras deslizas y vuelve a sentarse al parar. A veces "ladra" con un consejo.
// Los mensajes salen de lo que hay en la página, así que siempre son ciertos.
(() => {
  const CLAVE_OCULTO = "perrito-oculto-hasta";
  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

  const enlaceMostrar = document.getElementById("mostrar-perrito");
  const oculto = () => Number(leer(CLAVE_OCULTO) || 0) > Date.now();

  // ---------- dibujo ----------

  const SVG = `
<svg viewBox="0 0 120 100" aria-hidden="true">
  <ellipse class="p-sombra" cx="60" cy="95" rx="34" ry="4"/>
  <ellipse class="p-anca" cx="42" cy="84" rx="18" ry="10"/>
  <g class="p-pata p-pata-1"><rect x="34" y="70" width="10" height="23" rx="5"/></g>
  <g class="p-pata p-pata-2"><rect x="46" y="70" width="10" height="23" rx="5"/></g>
  <g class="p-pata p-pata-3"><rect x="70" y="70" width="10" height="23" rx="5"/></g>
  <g class="p-pata p-pata-4"><rect x="82" y="70" width="10" height="23" rx="5"/></g>
  <g class="p-cuerpo">
    <g class="p-cola">
      <circle cx="30" cy="50" r="9"/><circle cx="24" cy="40" r="8"/><circle cx="31" cy="31" r="7.5"/><circle cx="40" cy="30" r="6"/>
    </g>
    <circle class="p-pelo" cx="36" cy="76" r="7"/><circle class="p-pelo" cx="48" cy="80" r="7"/><circle class="p-pelo" cx="60" cy="81" r="7"/>
    <circle class="p-pelo" cx="72" cy="80" r="7"/><circle class="p-pelo" cx="84" cy="76" r="7"/>
    <ellipse class="p-torso" cx="60" cy="64" rx="32" ry="19"/>
    <path class="p-collar" d="M71 51 Q79 63 94 59"/>
    <circle class="p-placa" cx="83" cy="62" r="3.6"/>
    <g class="p-cabeza">
      <circle class="p-pelo" cx="78" cy="25" r="7.5"/><circle class="p-pelo" cx="88" cy="21" r="8.5"/><circle class="p-pelo" cx="98" cy="25" r="7.5"/>
      <circle class="p-craneo" cx="87" cy="40" r="19"/>
      <ellipse class="p-oreja" cx="75" cy="46" rx="7.5" ry="14" transform="rotate(14 75 46)"/>
      <ellipse class="p-hocico" cx="101" cy="47" rx="10" ry="7.5"/>
      <ellipse class="p-nariz" cx="109" cy="44" rx="3.8" ry="3"/>
      <circle class="p-ojo" cx="93" cy="37" r="3.5"/><circle class="p-brillo" cx="94.3" cy="35.7" r="1.2"/>
      <ellipse class="p-chapeta" cx="96" cy="46" rx="3.2" ry="2"/>
      <path class="p-boca-cerrada" d="M100 52 q3 2.5 6 0"/>
      <g class="p-boca-abierta"><ellipse cx="103" cy="54" rx="4.5" ry="3.6"/><ellipse class="p-lengua" cx="103" cy="56" rx="2.6" ry="1.7"/></g>
    </g>
  </g>
</svg>`;

  const perro = document.createElement("div");
  perro.className = "perrito sentado";
  perro.innerHTML = `
    <div class="perrito-globo" role="status" hidden>
      <span class="perrito-texto"></span>
      <button class="perrito-cerrar" type="button" aria-label="Ocultar al perrito">×</button>
    </div>
    <button class="perrito-cuerpo" type="button" aria-label="Perrito: tócalo para un consejo">${SVG}</button>`;

  const globo = perro.querySelector(".perrito-globo");
  const texto = perro.querySelector(".perrito-texto");
  const cuerpo = perro.querySelector(".perrito-cuerpo");

  // ---------- mensajes ----------

  function mensajes() {
    const lista = [];
    const activos = document.querySelectorAll("#lista .cupon:not(.es-apagado)").length;
    if (activos > 1) lista.push(`¡Guau! Hay ${activos} cupones activos hoy.`);
    if (document.querySelector("#lista .pronto")) lista.push("¡Apúrate! Hay cupones que vencen hoy.");
    lista.push("¡Apúrate y aprovecha los cupones de hoy!");
    lista.push("Toca «Copiar e ir a Mercado Libre» y pega el código al pagar.");
    lista.push("Revisa la compra mínima antes de pagar. ¡Guau!");
    const temporada = document.querySelector(".temp-lista li:not(.terminada) .temp-estado");
    const nombre = temporada?.closest("li")?.querySelector("h3")?.textContent;
    if (temporada && nombre && /Faltan|mañana|hoy|empezó/i.test(temporada.textContent)) {
      lista.push(`${nombre}: ${temporada.textContent.toLowerCase()}.`);
    }
    return lista;
  }

  let indice = 0;
  let globoTimer = 0;
  let ladridoTimer = 0;

  function ladrar(mensaje) {
    const opciones = mensajes();
    texto.textContent = mensaje || opciones[indice++ % opciones.length];
    globo.hidden = false;
    perro.classList.remove("ladrando");
    void perro.offsetWidth; // reinicia la animación del ladrido
    perro.classList.add("ladrando");
    clearTimeout(globoTimer);
    globoTimer = setTimeout(() => { globo.hidden = true; perro.classList.remove("ladrando"); }, 4200);
  }

  // Ladra solo de vez en cuando: la primera a los 6 s y luego cada 35 s, máximo 5 veces por visita.
  let automaticos = 0;
  function programar(ms) {
    clearTimeout(ladridoTimer);
    ladridoTimer = setTimeout(() => {
      if (!document.hidden && automaticos < 5) { automaticos++; ladrar(); }
      if (automaticos < 5) programar(35000);
    }, ms);
  }

  // ---------- movimiento ----------

  const ancho = () => perro.offsetWidth || 92;
  let x = 8;
  let objetivo = 8;
  let mirandoDerecha = true;
  let cuadro = 0;

  const limitar = (v) => Math.max(8, Math.min(innerWidth - ancho() - 8, v));

  function mover() {
    const dx = objetivo - x;
    const caminando = Math.abs(dx) > 1.5;
    if (caminando) {
      x += Math.sign(dx) * Math.min(Math.abs(dx), 3.2); // velocidad de paseo, no de salto
      mirandoDerecha = dx > 0;
    }
    perro.classList.toggle("caminando", caminando);
    if (caminando) perro.classList.remove("sentado");
    else sentarLuego();
    perro.classList.toggle("a-la-izquierda", !mirandoDerecha);
    perro.classList.toggle("globo-derecha", x > innerWidth / 2);
    perro.style.transform = `translateX(${x}px)`;
    cuadro = caminando ? requestAnimationFrame(mover) : 0;
  }

  let sentarTimer = 0;
  function sentarLuego() {
    clearTimeout(sentarTimer);
    sentarTimer = setTimeout(() => { if (!perro.classList.contains("caminando")) perro.classList.add("sentado"); }, 500);
  }

  function irA(destino) {
    if (sinMovimiento) return;
    objetivo = limitar(destino);
    if (!cuadro) cuadro = requestAnimationFrame(mover);
  }

  const tactil = matchMedia("(pointer: coarse)");

  // Con mouse, camina hacia el cursor.
  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && !tactil.matches) irA(e.clientX - ancho() / 2); }, { passive: true });

  // En el celular se queda en su esquina: al deslizar se agacha (baja) y al parar se vuelve a sentar.
  let agachadoTimer = 0;
  addEventListener("scroll", () => {
    if (!tactil.matches) return;
    perro.classList.add("agachado");
    clearTimeout(agachadoTimer);
    agachadoTimer = setTimeout(() => perro.classList.remove("agachado"), 420);
  }, { passive: true });
  addEventListener("resize", () => { objetivo = limitar(objetivo); x = limitar(x); perro.style.transform = `translateX(${x}px)`; });

  // ---------- eventos ----------

  cuerpo.addEventListener("click", () => ladrar());
  perro.querySelector(".perrito-cerrar").addEventListener("click", () => {
    guardar(CLAVE_OCULTO, String(Date.now() + 7 * 24 * 3600 * 1000));
    quitar();
  });
  document.addEventListener("cupon-copiado", () => ladrar("¡Guau! Código copiado. Pégalo al pagar en Mercado Libre."));

  function poner() {
    if (perro.isConnected) return;
    document.body.appendChild(perro);
    x = objetivo = 8;
    perro.style.transform = `translateX(${x}px)`;
    if (enlaceMostrar) enlaceMostrar.hidden = true;
    programar(6000);
  }

  function quitar() {
    clearTimeout(ladridoTimer);
    clearTimeout(globoTimer);
    cancelAnimationFrame(cuadro);
    cuadro = 0;
    perro.remove();
    if (enlaceMostrar) enlaceMostrar.hidden = false;
  }

  if (enlaceMostrar) {
    enlaceMostrar.addEventListener("click", (e) => {
      e.preventDefault();
      guardar(CLAVE_OCULTO, null);
      poner();
      ladrar("¡Guau! Volví.");
    });
  }

  if (oculto()) quitar();
  else poner();
})();
