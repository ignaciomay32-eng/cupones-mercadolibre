// Bloqueo por región: corre antes de cada página y archivo del sitio.
// Cloudflare ubica al visitante por su IP y nos da el país y el estado en request.cf.

const BLOQUEADOS = [
  { pais: "MX", codigo: "OAX", nombre: "oaxaca" },
];

const PAGINA_BLOQUEO = `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>No disponible</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background: #f7f7f5; color: #16181d; text-align: center; }
  h1 { font-size: 1.4rem; margin: 0 0 8px; }
  p { margin: 0; color: #6b7079; }
</style>
</head>
<body>
  <main>
    <h1>Sitio no disponible</h1>
    <p>Este sitio no está disponible en tu región.</p>
  </main>
</body>
</html>`;

function estaBloqueado(cf) {
  if (!cf) return false;
  const pais = (cf.country || "").toUpperCase();
  const codigo = (cf.regionCode || "").toUpperCase();
  const nombre = (cf.region || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return BLOQUEADOS.some((b) => pais === b.pais && (codigo === b.codigo || nombre === b.nombre));
}

export async function onRequest({ request, next }) {
  if (estaBloqueado(request.cf)) {
    return new Response(PAGINA_BLOQUEO, {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return next();
}
