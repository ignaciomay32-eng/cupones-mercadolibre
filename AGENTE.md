# Instrucciones para el agente de cupones

Tu única tarea: mantener actualizado `cupones.json`. El sitio se publica solo con cada cambio.

## Cómo agregar un cupón

Agregá un objeto al array de `cupones.json` con este formato:

```json
{
  "id": "2026-10-21-tecno-15",
  "titulo": "15% OFF en Tecnología",
  "descripcion": "Condiciones breves: tope, monto mínimo, productos válidos.",
  "codigo": "TECNO15",
  "descuento": "15% OFF",
  "categoria": "Tecnología",
  "link": "https://www.mercadolibre.com.ar/...",
  "vence": "2026-11-30",
  "publicado": "2026-10-21"
}
```

| Campo | Regla |
|---|---|
| `id` | Único. Formato `AAAA-MM-DD-palabra-clave`. |
| `codigo` | El código exacto, o `null` si la oferta no requiere código. |
| `descuento` | Corto: `15% OFF`, `$3.000 OFF`, `Envío gratis`. |
| `categoria` | Usar una existente si encaja: Tecnología, Hogar, Moda, Supermercado, Envíos, Belleza, Deportes, Juguetes, Otros. |
| `vence` | `AAAA-MM-DD`. Si no se conoce, poner 7 días desde hoy. |
| `publicado` | Fecha de hoy, `AAAA-MM-DD`. |

## Reglas

1. **Solo cupones reales y verificables**, de fuentes públicas (sitio oficial, redes oficiales, comunicados). Nunca inventar códigos.
2. **No duplicar**: si el `codigo` ya existe y está vigente, no lo agregues de nuevo.
3. **Limpieza**: borrá los cupones con `vence` anterior a hoy hace más de 30 días.
4. El archivo debe seguir siendo **JSON válido** (array). Verificalo antes de guardar.
5. Commit con mensaje: `cupones: +N nuevos, -M vencidos (AAAA-MM-DD)`.
