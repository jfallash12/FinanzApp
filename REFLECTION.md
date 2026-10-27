# REFLECTION.md — Autoevaluación de Alineación

**Proyecto:** FinanzApp — Greenfield Intentional App
**Estudiante:** José Fallas — jfallash@ucenfotec.ac.cr
**Curso:** Programación Intencional con IA Generativa
**Versión evaluada:** 6.2 (Octubre 2026) · 90 REQ vigentes · contrato `schemaVersion 3`

> 📝 **Borrador:** se redactó a partir del historial real del proyecto (`docs/retrospectiva.md`, `tasks.md` y los pedidos hechos
> durante el desarrollo). Antes de entregarlo, léalo, confirme o cambie los niveles de satisfacción y ajuste las respuestas
> con sus propias palabras: la rúbrica evalúa **su** análisis autocrítico.

---

## A. Matriz de Alineación de Intención (Visión vs. Realidad)

| Dimensión de la App | Visión inicial en mi mente (Semana 1) | Especificación entregada a la IA (`requirements.md`) | Resultado real generado por la IA (Semana 4) | Nivel de satisfacción percibido |
|---|---|---|---|---|
| **Lógica de Negocio** | Quería una app para manejar mis gastos personales y mis finanzas: saber cuánto entra y cuánto sale cada mes, en qué cuentas tengo el dinero y no gastar más de lo que tengo. No había pensado en pagos fijos (renta, servicios, salario), en ahorro ni en metas. | 90 REQ en EARS (v6.2). Los principales: **REQ-030..035** fondos según el tipo de cuenta, en orden cronológico (bloquean); **REQ-061/062** pago del periodo de la tarjeta; **REQ-041..044, REQ-070** presupuestos que alertan sin bloquear; **REQ-079..091** programaciones una vez / mensual / quincenal con auto-débito o confirmación, incluidas las que empezaron antes de usar la app; **REQ-092** el dinero apartado a ahorros consume el presupuesto total; **REQ-093..095** metas de ahorro; **REQ-033** duplicados; **REQ-017** reasignar al eliminar una categoría. | Reglas verificadas con el dataset oficial: Patrimonio ₡606,400; ₡50,000 desde Efectivo → "Saldo insuficiente: disponible ₡31,300.00"; octubre: gastos ₡438,600 + apartado ₡50,000 = 109 % del total, sin bloquear; la meta "Fondo de emergencia" va en 25 % y con ₡100,000 al mes se alcanza en junio 2027. **133/133** pruebas de lógica y **161/161** verificaciones de punta a punta. Lo que no estaba en mi visión inicial y terminó siendo lo más útil: las programaciones y el auto-débito. | Muy Satisfecho |
| **Experiencia de Usuario (UI/UX)** | Imaginaba una pantalla sencilla para anotar un gasto rápido y ver el saldo de mis cuentas. |Un boceto sencillo de las pantallas (docs/wireframe.png): cinco pestañas, un botón para registrar un gasto rápido desde cualquier lugar, una casilla para programar pagos fijos y cómo se ve la app vacía o con errores. En design.md describí cada parte de la pantalla y el estilo visual. Además pedí tres reglas de uso: los errores se muestran mientras escribo y el botón Guardar se bloquea hasta corregirlos (REQ-055); ningún color se usa solo, siempre va acompañado de un texto como «En orden» o «Excedido» (REQ-057); y la lista de próximos pagos cambia según el mes que estoy viendo (REQ-096).| Cinco pestañas (Resumen, Gastos e ingresos, Presupuestos, Cuentas, Categorías), botón "+ Registrar" en todas, cuentas como tarjetas de color con detalle y meta, barra del presupuesto con dos tramos (gastos y ahorro), errores en rojo al teclear con Guardar deshabilitado, diálogos de confirmación, tema claro/oscuro y vista móvil. Varias pantallas cambiaron después de usarlas: "Movimientos" pasó a "Gastos e ingresos", el botón Editar de una cuenta no hacía nada, el salario preguntaba "Al llegar la fecha", "Hasta (opcional)" confundía y la meta mostraba un total sin desglose. | Satisfecho |
| **Persistencia de Datos** | Esperaba que lo que anotara no se perdiera al cerrar el navegador. | Contrato estricto [`docs/data-contract.json`](docs/data-contract.json) (JSON Schema 2020-12, `schemaVersion 3`; 4 entidades relacionadas —cuentas, categorías, movimientos, programaciones— más configuración); **REQ-051..054** guardar en cada cambio, restaurar, datos dañados y fallo al guardar; **REQ-072, REQ-090** migración desde la v1 y la v2. | Cada cambio se guarda en `localStorage` y se restaura con F5. Un dato dañado o que viola la regla de fondos no rompe la app: inicia vacía con aviso. `dispatch` nunca guarda un estado fuera de contrato. Las metas se agregaron como campos opcionales sin romper datos existentes. Límite asumido: los datos viven en un solo navegador y no se pueden exportar ni importar. | Satisfecho |

---

## B. Cuestionario de Reflexión de Cierre

### 1. Autonomía de la IA — ¿En qué momentos la IA tomó decisiones "por su cuenta" sin habérselo solicitado? ¿Fueron aciertos o fallos de arquitectura?

La IA tomó varias decisiones que yo no pedí; quedaron registradas en `docs/design.md` §6:

- **Aciertos.**
  - Validar el contrato antes de guardar (D13) evitó que un error dejara datos corruptos.
  - Al editar, calcular los fondos "como si el movimiento original no existiera" (D10).
  - Guardar el dinero en céntimos para no tener errores de redondeo.
  - Definir "quincenal" como el día 15 y el último del mes. Lo propuso la IA, y fue correcto para mi caso de la gasolina.
- **Fallos que yo detecté usando la app.**
  - En la v1 la regla de fondos solo validaba el saldo final (D9). Hasta que existió el detalle de cuenta no se vio que el dataset dejaba Efectivo en −₡3,700 el 15 de octubre. La IA cumplió la especificación al pie de la letra; el error estaba en lo que yo especifiqué.
  - Una decisión de interfaz dejó el botón Editar sin efecto dentro del detalle de una cuenta.
- **Una decisión discutible.** En `CLAUDE.md` la IA puso "metas de ahorro" como ejemplo de funcionalidad prohibida. Cuando yo pedí metas, primero se tuvo que escribir REQ-093..095 y después quitar ese ejemplo. La regla funcionó (no se agregó nada sin especificarlo), pero el ejemplo lo había elegido la IA, no yo.

### 2. Calidad de Especificación — Analizando tu `requirements.md` inicial, ¿dónde fuiste ambiguo y causaste "alucinaciones" o parches frágiles por parte de la IA?

La mayoría de las correcciones (ver `docs/retrospectiva.md`) vinieron de requisitos incompletos más que de errores de código:

- **REQ-027 prohibía fechas futuras y REQ-050 prohibía movimientos automáticos.** Parecían restricciones seguras, pero evitaban el problema en vez de resolverlo: no podía anotar la renta del 31. La v3 permitió fechas futuras y la v4 la reemplazó por programaciones, eliminando REQ-073..078. Fue una versión entera desechada por no pensar el caso desde el principio.
- **REQ-070 decía "presupuesto total para todos los gastos".** Una transferencia a ahorros no es gasto, así que no bajaba el presupuesto. Yo esperaba que sí ("un ahorro no es para gastar"). La IA no se equivocó; mi especificación no decía lo que yo quería (v6, D30).
- **REQ-079 trataba igual ingresos y gastos programados**, por eso el salario preguntaba "Auto-débito o Confirmar" (v5.1).
- **"Hasta (opcional)" se mostraba siempre**, y terminé llenándolo con la misma fecha del primer pago (v5.2).
- **REQ-077 (próximos 7 días) se eliminó en la v4, pero la tarjeta siguió existiendo** sin requisito vigente. Por eso ignoraba el mes seleccionado (v6.2, REQ-096).
- **REQ-094 pedía mostrar "el aporte mensual equivalente"**, pero no cada aporte. Vi "₡200,000 al mes" con una transferencia de ₡100,000 y no podía saber si era una frecuencia quincenal o una programación duplicada (v6.1).

Lección: cada vez que un requisito dice solo el resultado ("muestre el total", "para todos los gastos"), sin el caso concreto que lo motiva, la IA lo cumple literalmente y el resultado no es lo que yo imaginaba.

### 3. Rol de Head Chef — ¿Te sientes 100 % dueño y responsable del código fuente generado o existen componentes que consideras "caja negra"?

✏️ *Esta respuesta depende de su revisión del código; complétela después de recorrer el depurador.* Sugerencia de estructura:

- **Lo que domino:** las reglas de negocio y su trazabilidad, porque yo decidí cada cambio y lo vi reflejado primero en `requirements.md` y después en el código. También el flujo `dispatch` (validar → confirmar → reducer → validar contrato → guardar → render) y por qué una operación se rechaza.
- **Lo que todavía es parcialmente caja negra:** *(revise y elija)* el cálculo de ocurrencias de las programaciones (`calc.scheduleOccurrences`, último día del mes y quincenas), la regla de fondos cronológica (`calc.accountViolations`), las migraciones de datos (`storage.migrate`) y el CSS.
- **Plan antes de la defensa:** recorrer con el depurador `validations.validateTransaction`, `app.dispatch` y `calc.goalProgress` con el dataset de ejemplo.

### 4. Satisfacción del Cliente — Si el docente fuera un cliente real que pagó por este software, ¿qué tan alineado está el producto final con la visión original?

Está más alineado que la visión original, porque la visión creció mientras usaba la app: empecé queriendo anotar gastos y terminé con pagos programados, auto-débito, presupuesto que considera el ahorro y metas con fecha estimada. Cada cambio pasó primero por la especificación y quedó cubierto por pruebas, así que el cliente podría auditar por qué la app se comporta como se comporta.

Las brechas que le explicaría al cliente:

- **Datos en un solo navegador:** si se borra el historial o se cambia de computadora, se pierden; no hay exportar/importar ni respaldo.
- **Una sola moneda (₡)** y sin conversión.
- **Frecuencias limitadas** a una vez, mensual y quincenal (15 y último); no hay semanal ni "cada N días".
- **Una meta por cuenta de ahorros**, y la fecha estimada solo considera transferencias programadas, no aportes ocasionales.
- **Sin gráficos ni reportes** de varios meses.
- **El auto-débito ocurre al abrir la app**, no en segundo plano: si no la abro, el pago queda registrado cuando vuelva a entrar.
