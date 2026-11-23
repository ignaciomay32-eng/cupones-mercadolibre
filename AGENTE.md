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
- Horario: si en cupondeldia.com se le pone "Se activa" / "Se desactiva" a un cupón, aquí sale "Próximamente" (sin código) hasta esa hora y desaparece al desactivarse; también aplica al mismo código que llega del origen principal.
- `MOSTRAR_CUPONES`: interruptor de los cupones de cuponesmercadolibre.mx. Hoy `false`: esos no salen. Los cupones y promociones de cupondeldia.com salen siempre (se prenden o apagan desde el panel de cupondeldia.com).
- `functions/_lib/promos.js` (`PROMOS_TIENDAS`): promociones de tiendas sin código que pasa el dueño, cada una con SU enlace de afiliado (se usa igual aquí y en AhorraMX). Se quedan hasta que el dueño pida quitarlas.
- `OCULTAR_CODIGOS`: códigos que nunca se muestran aquí ni en AhorraMX (hoy: `DIRECT-2AA80C7A`).
- `SINCRONIZAR_CADA_MS`: cada cuánto se vuelve a leer el origen (5 minutos).

## Si deja de mostrar cupones
`https://cupones-mercadolibre.com/api/cupones` muestra el error. Lo más probable es que la página de origen haya cambiado su diseño, y entonces hay que ajustar `extraerCupones`.
