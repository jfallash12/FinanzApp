# REFLECTION.md — Autoevaluación de Alineación

**Proyecto:** FinanzApp — Greenfield Intentional App
**Estudiante:** José Fallas — jfallash@ucenfotec.ac.cr
**Curso:** Programación Intencional con IA Generativa

> ✏️ **Plantilla para completar en la Semana 4.** Las columnas de especificación y resultado ya tienen los datos
> verificables del proyecto. La **visión inicial**, el **nivel de satisfacción** y las **respuestas del cuestionario**
> son tuyas: la rúbrica evalúa un análisis autocrítico propio, así que reemplaza cada bloque marcado con ✏️.

---

## A. Matriz de Alineación de Intención (Visión vs. Realidad)

| Dimensión de la App | Visión inicial en mi mente (Semana 1) | Especificación entregada a la IA (`requirements.md`) | Resultado real generado por la IA (Semana 4) | Nivel de satisfacción percibido |
|---|---|---|---|---|
| **Lógica de Negocio** | ✏️ *Describe con tus palabras qué querías al inicio (p. ej. "saber cuánto gasto al mes y no gastar más de lo que tengo").* | 72 REQ en EARS (v2). Los principales: **REQ-030..035** fondos según el tipo de cuenta, en orden cronológico (bloquean); **REQ-061/062** pago del periodo de la tarjeta; **REQ-063..065** archivar cuentas; **REQ-041..044** presupuesto mensual con Verde/Ámbar/Rojo que **no** bloquea; **REQ-033** duplicados con confirmación; **REQ-017** reasignar movimientos al eliminar una categoría; **REQ-039/040** balance neto y tasa de ahorro. | Las reglas se verificaron con el dataset oficial: Patrimonio ₡606,400; ₡50,000 desde Efectivo → "Saldo insuficiente: disponible ₡31,300.00"; +₡5,000 en Entretenimiento → 92 % Ámbar a 108 % Rojo sin bloquear. Pago de Visa: ₡36,000 que vence en 2 días. 87/87 pruebas de lógica y 117/117 verificaciones de punta a punta. ✏️ *Agrega lo que quedó fuera de tu visión inicial, si algo quedó.* | ✏️ [ Muy Insatisfecho \| Insatisfecho \| Satisfecho \| Muy Satisfecho ] |
| **Experiencia de Usuario (UI/UX)** | ✏️ *¿Qué pantalla imaginabas?* | Wireframe low-fi ([`docs/wireframe.png`](docs/wireframe.png)) con 5 pestañas, registro rápido y estados especiales; componentes y estilos en `design.md` §4 y §8; validación **en vivo** (REQ-055); color siempre con texto (REQ-057). | Cinco pestañas (Resumen, Gastos e ingresos, Presupuestos, Cuentas, Categorías), botón "+ Registrar" en todas, cuentas como tarjetas visuales con detalle, errores en rojo al teclear con Guardar deshabilitado, saldo disponible visible bajo la cuenta, diálogos de confirmación, tema claro/oscuro y vista móvil sin scroll horizontal. ✏️ *¿Qué cambiarías?* | ✏️ [ … ] |
| **Persistencia de Datos** | ✏️ *¿Qué esperabas sobre guardar los datos?* | Contrato estricto [`docs/data-contract.json`](docs/data-contract.json) (JSON Schema 2020-12, `schemaVersion 2`, 3 entidades relacionadas + configuración); **REQ-051..054** guardar en cada cambio, restaurar, datos dañados y fallo al guardar; **REQ-072** migración de la v1. | Cada cambio se guarda en `localStorage` y se restaura con F5. Un dato dañado o que viola la regla de fondos no rompe la app: inicia vacía con aviso. `dispatch` nunca acepta un estado fuera de contrato. Límite asumido: los datos viven en un solo navegador (sin exportar/importar). | ✏️ [ … ] |

---

## B. Cuestionario de Reflexión de Cierre

### 1. Autonomía de la IA — ¿En qué momentos la IA tomó decisiones "por su cuenta" sin habérselo solicitado? ¿Fueron aciertos o fallos de arquitectura?

✏️ *Puntos de partida para tu análisis (decisiones registradas en `docs/design.md` §6 y `retrospective.md`):*

- *D9: en la v1 la regla de fondos validaba solo el saldo final; el detalle de cuenta de la v2 reveló que el dataset dejaba Efectivo en −₡3,700 el 15 de octubre y la regla pasó a ser cronológica. ¿Quién debió detectarlo antes, la especificación o la IA?*
- *D10: al editar se calcula "como si el movimiento original no existiera".*
- *D13: red de seguridad que valida el contrato antes de guardar.*
- *D11: el formulario conserva tipo, cuenta y fecha después de guardar.*
- *Formato de dinero `₡12,500.00` (D15) en vez del formato local `₡12 500,00`.*

### 2. Calidad de Especificación — Analizando tu `requirements.md` inicial, ¿dónde fuiste ambiguo y causaste "alucinaciones" o parches frágiles por parte de la IA?

✏️ *Revisa `retrospective.md` §1 y responde con ejemplos concretos (incluye la v3 y la v4: REQ-027 prohibía fechas futuras y REQ-050 prohibía movimientos automáticos; ¿fueron restricciones correctas o ambigüedades que la v1 evitó en vez de resolver? ¿Qué significaba "quincenal" antes de definirlo?) (por ejemplo: ¿qué pasaba con un ingreso en una tarjeta de crédito antes de REQ-032? ¿Y al borrar un ingreso que ya se gastó, antes de REQ-035?).*

### 3. Rol de Head Chef — ¿Te sientes 100 % dueño y responsable del código fuente generado o existen componentes que consideras "caja negra"?

✏️ *Recorre con el depurador `validations.validateTransaction` (regla de fondos) y `app.dispatch` antes de la defensa, y escribe qué partes dominas y cuáles no.*

### 4. Satisfacción del Cliente — Si el docente fuera un cliente real que pagó por este software, ¿qué tan alineado está el producto final con la visión original?

✏️ *Menciona las brechas que le explicarías al cliente (por ejemplo: una sola moneda, sin exportar/importar, sin movimientos recurrentes, validación de fondos no cronológica).*
