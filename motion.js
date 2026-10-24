// Animación "Cómo usar un cupón": 27 segundos, en bucle, dibujada con HTML y animada aquí.
// Todo se calcula a partir del segundo actual (t), así que se puede pausar o saltar a cualquier punto.
(() => {
  const fig = document.getElementById("mg");
  if (!fig) return;
  const $ = (s) => fig.querySelector(s);
  const DURACION = 27;
  const escena = $(".mg-escena");

  // La escena mide 1600×900 y se escala al ancho disponible.
  // En pantallas chicas el texto secundario no se alcanza a leer: se oculta (está escrito debajo) y crecen los títulos.
  const ajustar = () => {
    escena.style.setProperty("--k", fig.clientWidth / 1600);
    fig.classList.toggle("chico", fig.clientWidth < 560);
  };
  new ResizeObserver(ajustar).observe(fig);
  ajustar();

  // ---------- interpolación ----------

  const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const BASE = { x: 0, y: 0, s: 1, r: 0, o: 1 };

  // keys: [[segundo, {x, y, s, r, o}], ...]. Lo que no se indica, se hereda del paso anterior.
  function valor(keys, t) {
    let a = { ...BASE, ...keys[0][1] };
    if (t <= keys[0][0]) return a;
    for (let i = 1; i < keys.length; i++) {
      const b = { ...a, ...keys[i][1] };
      const [t0] = keys[i - 1];
      const [t1] = keys[i];
      if (t < t1) {
        const p = suave((t - t0) / (t1 - t0));
        const v = {};
        for (const k in b) v[k] = a[k] + (b[k] - a[k]) * p;
        return v;
      }
      a = b;
    }
    return a;
  }

  function poner(el, v, dx = 0, dy = 0) {
    el.style.opacity = v.o;
    el.style.transform = `translate(${v.x - dx}px, ${v.y - dy}px) scale(${v.s}) rotate(${v.r}deg)`;
  }

  // Bloque de texto: sube al entrar y se va hacia arriba al salir.
  const bloque = (entra, sale) => [
    [entra, { y: 40, o: 0 }], [entra + 0.8, { y: 0, o: 1 }],
    [sale, { y: 0, o: 1 }], [sale + 0.5, { y: -30, o: 0 }],
  ];

  // ---------- guion ----------

  const PRECIO = 5299;
  const DESCUENTO = 480;
  const pesos = (n) => "$" + Math.round(n).toLocaleString("en-US");

  const pistas = [
    // Texto de la izquierda
    [$('[data-b="titulo"]'), bloque(0.2, 3.0)],
    [$('[data-b="1"]'), bloque(3.4, 7.0)],
    [$('[data-b="2"]'), bloque(7.6, 10.6)],
    [$('[data-b="3"]'), bloque(11.0, 14.6)],
    [$('[data-b="4"]'), bloque(15.0, 20.3)],
    [$('[data-b="final"]'), bloque(20.9, 26.4)],

    // El cupón entra, se toca y se va
    [$(".mg-ticket"), [
      [0.6, { x: 140, y: 40, r: 3, o: 0 }], [1.7, { x: 0, y: 0, r: 0, o: 1 }],
      [6.9, {}], [8.0, { x: -280, s: 0.75, o: 0 }],
    ]],

    // El teléfono sube y se queda hasta el final
    [$(".mg-tel"), [
      [7.1, { y: 560, o: 0 }], [7.3, { o: 1 }], [8.3, { y: 0 }],
      [20.8, {}], [22.0, { x: 0, s: 0.96 }],
      [26.4, {}], [27, { o: 0 }],
    ]],

    // Las vistas dentro del teléfono
    [$('[data-v="carga"]'), [[8.0, { o: 0 }], [8.3, { o: 1 }], [10.2, {}], [10.6, { o: 0 }]]],
    [$('[data-v="producto"]'), [[10.3, { x: 60, o: 0 }], [10.9, { x: 0, o: 1 }], [14.8, {}], [15.3, { x: -60, o: 0 }]]],
    [$('[data-v="pago"]'), [[15.0, { x: 60, o: 0 }], [15.6, { x: 0, o: 1 }]]],
    [$("[data-linea-cupon]"), [[17.95, { y: -12, o: 0 }], [18.4, { y: 0, o: 1 }]]],

    // Aviso de copiado
    [$(".mg-toast"), [[4.9, { y: 24, o: 0 }], [5.3, { y: 0, o: 1 }], [6.4, {}], [6.8, { o: 0 }]]],

    // El toque del dedo: aparece, aprieta y se va
    [$(".mg-dedo"), [
      [3.9, { x: 820, y: 640, o: 0 }], [4.4, { x: 600, y: 585, o: 1 }],
      [4.55, { s: 0.72 }], [4.8, { s: 1.2 }], [5.1, { s: 1, o: 0 }],
      [12.9, { x: 560, y: 840, o: 0 }], [13.4, { x: 470, y: 760, o: 1 }],
      [13.55, { s: 0.72 }], [13.8, { s: 1.2 }], [14.1, { s: 1, o: 0 }],
      [15.9, { x: 360, y: 520, o: 0 }], [16.25, { x: 410, y: 418, o: 1 }],
      [16.35, { s: 0.72 }], [16.6, { s: 1.15 }], [16.8, { s: 1 }],
      [17.4, { x: 568, y: 418 }],
      [17.55, { s: 0.72 }], [17.8, { s: 1.2 }], [18.1, { s: 1, o: 0 }],
    ]],
  ];

  // La cámara del panel: acerca y aleja sobre lo que importa en cada paso.
  const camara = [
    [0, { x: 470, y: 450, s: 1 }], [3.4, {}], [4.4, { x: 470, y: 480, s: 1.2 }],
    [6.6, {}], [7.9, { x: 470, y: 450, s: 1 }],
    [11.3, {}], [12.4, { x: 470, y: 600, s: 1.28 }],
    [14.5, {}], [15.3, { x: 470, y: 450, s: 1 }],
    [15.7, {}], [16.4, { x: 470, y: 450, s: 1.5 }],
    [19.6, {}], [20.7, { x: 470, y: 450, s: 1 }],
  ];

  // El código copiado viaja del cupón al teléfono y cae en el campo de cupones.
  const chip = [
    [6.9, { x: 580, y: 513, s: 0.9, o: 0 }], [7.2, { s: 1, o: 1 }],
    [8.3, { x: 770, y: 115, s: 0.8 }],
    [15.9, {}], [16.35, { x: 420, y: 418, s: 0.7 }], [16.45, { o: 0 }],
  ];

  const el = {
    camara: $(".mg-camara"),
    chip: $(".mg-chip"),
    codigo: $(".mg-codigo"),
    codigoTxt: $("[data-codigo]"),
    giro: $(".mg-giro"),
    carrito: $("[data-carrito]"),
    campo: $(".mg-campo"),
    campoTxt: $("[data-campo]"),
    aplicar: $("[data-aplicar]"),
    total: $("[data-total]"),
    progreso: $(".mg-progreso span"),
  };

  function cambiar(nodo, texto) {
    if (nodo.textContent !== texto) nodo.textContent = texto;
  }

  function pintar(t) {
    for (const [nodo, keys] of pistas) poner(nodo, valor(keys, t));

    const c = valor(camara, t);
    el.camara.style.transform = `translate(${470 - c.x * c.s}px, ${450 - c.y * c.s}px) scale(${c.s})`;
    poner(el.chip, valor(chip, t), 118, 29);

    const visto = t >= 4.65;
    el.codigo.classList.toggle("on", visto);
    cambiar(el.codigoTxt, visto ? "AHORROMAX" : "AHO••••••");
    el.giro.style.transform = `rotate(${t * 420}deg)`;

    const agregado = t >= 13.6;
    el.carrito.classList.toggle("on", agregado);
    cambiar(el.carrito, agregado ? "Agregado al carrito" : "Agregar al carrito");

    const pegado = t >= 16.45;
    el.campo.classList.toggle("on", pegado);
    cambiar(el.campoTxt, pegado ? "AHORROMAX" : "Ingresa el código");
    el.aplicar.classList.toggle("on", t >= 17.6);

    const p = Math.min(1, Math.max(0, (t - 18.0) / 1.0));
    cambiar(el.total, pesos(PRECIO - DESCUENTO * suave(p)));

    el.progreso.style.transform = `scaleX(${t / DURACION})`;
  }

  // ---------- reproducción ----------

  const boton = fig.querySelector(".mg-control");
  const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t = 0;
  let reproduciendo = false;
  let pausadoPorPersona = sinMovimiento;
  let visible = false;
  let anterior = 0;
  let cuadro = 0;

  function paso(ahora) {
    const dt = Math.min(0.1, (ahora - anterior) / 1000);
    anterior = ahora;
    t = (t + dt) % DURACION;
    pintar(t);
    cuadro = requestAnimationFrame(paso);
  }

  function actualizar() {
    const debe = visible && !pausadoPorPersona && !document.hidden;
    if (debe === reproduciendo) return;
    reproduciendo = debe;
    if (debe) {
      anterior = performance.now();
      cuadro = requestAnimationFrame(paso);
    } else {
      cancelAnimationFrame(cuadro);
    }
  }

  function pintarBoton() {
    const pausado = pausadoPorPersona;
    boton.dataset.estado = pausado ? "pausa" : "play";
    boton.setAttribute("aria-label", pausado ? "Reproducir la animación" : "Pausar la animación");
  }

  boton.addEventListener("click", () => {
    pausadoPorPersona = !pausadoPorPersona;
    pintarBoton();
    actualizar();
  });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    actualizar();
  }, { threshold: 0.35 }).observe(fig);
  document.addEventListener("visibilitychange", actualizar);

  // Con "reducir movimiento" no arranca sola: muestra el resultado final y espera al botón.
  // Para revisar un cuadro concreto desde la consola: document.getElementById("mg").verEn(12)
  fig.verEn = (segundo) => {
    pausadoPorPersona = true;
    pintarBoton();
    actualizar();
    t = segundo;
    pintar(t);
  };

  if (sinMovimiento) t = 23;
  pintar(t);
  pintarBoton();
})();
