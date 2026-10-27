# Retrospectiva — FinanzApp

> Análisis y reflexiones sobre el proceso de especificación intencional y las correcciones aplicadas.
> Complementa a [`docs/requirements.md`](docs/requirements.md) y [`docs/design.md`](docs/design.md).

## 1. Historial de correcciones y decisiones

| # | Corrección / decisión | Motivo |
|---|---|---|
| 1 | Se eligió una app de **finanzas personales** con 3 entidades: `Account`, `Category`, `Transaction` | Cumple "mínimo 2 entidades vinculadas" con relaciones reales (`accountId`, `toAccountId`, `categoryId`) |
| 2 | El repositorio reutiliza la **estructura documental** del proyecto anterior (Mochila): requirements, contrato, wireframe, design, tasks, CLAUDE.md, REFLECTION y retrospectiva | Mantener el flujo Spec-Driven Development del curso; el contenido es 100 % de la nueva app |
| 3 | Se agregó [`.cursorrules`](.cursorrules) además de `CLAUDE.md` | La guía del Proyecto Final pide explícitamente `.cursorrules`, `.clinerules` o `system_prompt.md` en la raíz |
| 4 | El **saldo** no se guarda: se deriva de saldo inicial + movimientos (REQ-049) | Guardarlo permitiría que se desincronice con los movimientos |
| 5 | Dos reglas contrastadas: **fondos** (bloquea, RN-03) y **presupuesto** (solo alerta, RN-06) | Hace visible en la defensa la diferencia entre una restricción dura y una alerta |
| 6 | Ingresos solo en cuentas líquidas; el pago de tarjeta es una transferencia que no puede superar la deuda (REQ-032) | Sin esta regla una tarjeta podría quedar con "saldo a favor" y el patrimonio sería ambiguo |
| 7 | Eliminar o editar un movimiento también respeta la regla de fondos (REQ-034, REQ-035) | Caso de borde: borrar un ingreso que ya se gastó dejaría la cuenta en negativo |
| 8 | Duplicados: advertir y confirmar en vez de rechazar (REQ-033) | Dos pasajes de bus iguales el mismo día pueden ser reales |
| 9 | Fechas futuras prohibidas (REQ-027) | Sin movimientos programados (REQ-050), una fecha futura solo puede ser un error de digitación |
| 10 | Categorías del sistema "Otros gastos" / "Otros ingresos" (REQ-016) | Garantizan un destino válido al reasignar movimientos (REQ-017) |
| 11 | Validación de fondos sobre el saldo total, no cronológica (D9) | Simplicidad. **Limitación** que se corrigió en la v2 (ver #15) |
| 12 | `tests/pruebas.html`: pruebas de regresión sin dependencias | Hace verificable el Unchanged Behavior sin instalar Node ni librerías |
| 13 | Nombre de la app: **FinanzApp** (antes "Alcancía") en interfaz, código (`window.FinanzApp`, clave `finanzapp.state`), logo 💰 y documentos | Decisión del estudiante; las 148 verificaciones se repitieron sin cambios en el comportamiento (Unchanged Behavior) |
| 14 | **Versión 2** pedida por el estudiante: registro rápido, pestaña "Gastos e ingresos", cuentas de ahorros, archivar cuentas, fechas de corte y pago de tarjeta, tarjetas visuales con detalle, pestaña Presupuestos y presupuesto total mensual (REQ-058..REQ-072) | El registro de gastos era lento y las cuentas y presupuestos estaban mezclados; se especificó primero y se implementó después (CLAUDE.md §10) |
| 15 | **Hallazgo:** el detalle de cuenta (saldo después de cada movimiento) mostró que el dataset dejaba Efectivo en **−₡3,700 el 15 de octubre**. La regla de fondos de la v1 solo revisaba el saldo final (D9) | Se corrigió la **especificación** (RN-03 cronológica, D9 revisada) y luego el código (`calc.timeline`, `availableFunds(…, date)`, `paymentRoom`). En el dataset, "Venta de libros" pasó del 22 al 14 de octubre para que el historial sea válido; los saldos finales no cambian |
| 16 | Contrato `schemaVersion 2` con migración automática desde la v1 (REQ-072) | Los datos que el usuario ya tenía guardados no se pierden ni se marcan como dañados |
| 17 | El mensaje de REQ-009 ahora dice "La deuda llegó a ₡96,000.00 el 2026-10-12" en vez de "La deuda actual" | Con la regla cronológica, el límite debe cubrir la deuda máxima histórica, no solo la actual |
| 18 | **Error reportado por el estudiante:** en el detalle de una cuenta, el botón "✎ Editar" no hacía nada visible | La acción `EDIT_ACCOUNT` cargaba la cuenta en el formulario, pero la vista seguía mostrando el detalle (el formulario está en la lista). Se corrigió en la función responsable (`UI_ACTIONS.EDIT_ACCOUNT` sale del detalle), bajo Unchanged Behavior: 87/87 y 117/117 siguen pasando |
| 19 | **Versión 3 — movimientos programados.** El estudiante preguntó por qué no podía registrar la renta del último día del mes. REQ-027 lo prohibía a propósito: la v1 no definía qué pasaba con el saldo, el presupuesto ni el pago de la tarjeta ante un gasto futuro | Se especificó la respuesta antes de programar (REQ-073..REQ-078, RN-12): el programado aparta el dinero (RN-03 cronológica), cuenta en el mes y no en el saldo actual. No hizo falta cambiar el contrato porque el estado se deriva de la fecha (D20) |
| 20 | **Versión 4 — programaciones.** El estudiante pidió elegir si un pago es programado, que sea fijo (una vez, mensual o quincenal), verlo al pasar de mes y que algunos se debiten solos de una cuenta elegida | La v3 solo permitía un movimiento con fecha futura. Se creó la entidad `schedules` (contrato v3) y se especificaron las reglas antes de programar (REQ-079..REQ-090). REQ-050, que prohibía movimientos automáticos, se modificó **explícitamente** para permitir solo el auto-débito configurado por el usuario |
| 21 | **Ambigüedad resuelta:** ¿qué es "quincenal"? | Se definió como días 15 y último de cada mes (D23) y el monto es por quincena; la interfaz muestra el equivalente mensual (₡40,000 → ≈ ₡80,000 al mes) |
| 22 | **Caso de borde descubierto al especificar:** si el usuario borra un pago creado por auto-débito, la app lo volvería a crear al abrirse | REQ-086: borrar el movimiento marca la ocurrencia como omitida |
| 23 | **Error encontrado por las pruebas:** "Ajustar" una ocurrencia pendiente guardaba el movimiento sin enlazarlo, así que la ocurrencia seguía pendiente | Se corrigió en el reducer de `ADD_TRANSACTION` (el resultado de `linkTx` no se asignaba). Ejemplo de por qué las pruebas de punta a punta son parte del entregable |
| 24 | Eliminar una categoría también reasigna las programaciones que la usan (REQ-017 ampliado) | Sin esto, el contrato rechazaba el cambio porque la programación quedaba con una categoría inexistente |
| 25 | **Versión 5 — el cliente empieza a usar la app a mitad de mes.** El estudiante no podía programar los servicios desde el 6 porque REQ-079 exigía una primera fecha ≥ hoy, y lo intentó poniendo el 6 en "Hasta" | REQ-079 asumía un usuario que arranca con la app desde cero. Se modificó (hasta un año atrás) y se agregó REQ-091: los pagos ya vencidos se **registran** con su fecha o se marcan como **ya registrados**, decisión explícita del usuario para no duplicar ni perder pagos (D27) |
| 26 | **Ajuste v5.1:** al programar un salario, la app preguntaba "Al llegar la fecha: Auto-débito o Confirmar" | REQ-079 trataba igual ingresos y gastos. Para un ingreso, "débito" no tiene sentido: se corrigió la especificación (los ingresos programados siempre se registran solos, D28) y luego la interfaz |

## 2. Reflexión sobre la especificación intencional

✏️ *Completa con tu experiencia: ¿qué tan diferente fue pedirle a la IA que redacte y ajuste las reglas del juego antes de escribir el código? ¿Sientes más control sobre lo que la IA va a programar?*

## 3. Reflexión sobre el diseño técnico y la memoria semántica

✏️ *¿Qué aportaron `CLAUDE.md`, `.cursorrules` y `design.md` cuando le pediste código a la IA? ¿Hubo algún momento en que la IA intentó salirse del stack o agregar algo fuera de la especificación?*

## 4. Reflexión sobre la implementación guiada por `tasks.md`

✏️ *¿Te sirvió ejecutar una tarea a la vez? ¿Qué pruebas de regresión (R1–R6) detectaron problemas?*
