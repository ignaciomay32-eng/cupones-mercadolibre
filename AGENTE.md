# Agente de cupones

El agente vive en `functions/api/cupones.js` y corre dentro de Cloudflare Pages (gratis). No necesita servidor, base de datos ni la compu prendida.

## Qué hace
1. Lee https://www.cuponesmercadolibre.mx/ como mucho **una vez cada 5 minutos** (caché de Cloudflare).
2. Extrae los cupones de los datos de la página: código, descuento, compra mínima, tope y vencimiento.
3. Detecta el estado de cada uno:
   - `activo`: se puede usar
   - `pocas`: quedan pocos usos
   - `agotado`: se muestra en gris, al final
   - `proximamente`: todavía no empieza
   - Los vencidos o desactivados se ocultan.
4. Cambia el link de cada cupón por el link de afiliado propio.
5. El sitio lo pide en `/api/cupones` y, si la página queda abierta, se refresca solo cada 5 minutos.

## Configuración
Arriba de `functions/_lib/comun.js`:
- `AFILIADO`: enlace del botón de **todos** los cupones (del día, bancarios, flash y activables). Hoy: `https://meli.la/1tucCjM`.
- `ORIGEN`: página de donde salen los cupones.
- `SINCRONIZAR_CADA_MS`: cada cuánto se vuelve a leer el origen (5 minutos).

## Si deja de mostrar cupones
`https://cupones-mercadolibre.com/api/cupones` muestra el error. Lo más probable es que la página de origen haya cambiado su diseño, y entonces hay que ajustar `extraerCupones`.
