# tasks.md — Plan de Implementación de FinanzApp

> **Spec-Driven Coding.** Plan de desarrollo incremental y verificable, ordenado por fases,
> generado con IA a partir de los insumos armonizados y revisado por el estudiante (Head Chef) antes de programar.
>
> **Insumos (fuentes de verdad):** [`docs/requirements.md`](docs/requirements.md) (85 REQ vigentes, EARS v5) ·
> [`docs/design.md`](docs/design.md) (componentes, módulos, `dispatch`, mapeo REQ → función) ·
> [`docs/data-contract.json`](docs/data-contract.json) (schemaVersion 3) ·
> [`docs/wireframe.md`](docs/wireframe.md) + [`docs/wireframe.png`](docs/wireframe.png) ·
> reglas en [`CLAUDE.md`](CLAUDE.md) y [`.cursorrules`](.cursorrules).

**Estado:** ✅ Fases 0–11 completadas (T-00..T-42; Fase 9 = v2, Fase 10 = v3, Fase 11 = v4 y v5) · Leyenda: `[ ]` pendiente · `[x]` hecha

---

## Cómo usar este plan (protocolo Head Chef)

### Reglas para el agente de IA

1. **Una tarea por vez**, en orden. No adelantar trabajo de tareas futuras.
2. Antes de cada tarea, leer `CLAUDE.md` y las secciones de `design.md` que la tarea cita.
3. Tocar **solo** los archivos listados en la tarea.
4. Usar exactamente los nombres de `design.md` §5.3 (funciones) y §4 (componentes), y los campos de `data-contract.json`.
5. **Unchanged Behavior:** ninguna tarea puede cambiar el comportamiento de una tarea ya marcada `[x]`.
6. Prohibido: frameworks, librerías, CDN, `fetch`/XHR, ES Modules, `innerHTML` con datos del usuario.

### Ciclo por tarea

1. **Pedir** la tarea con el *Prompt de ejecución*.
2. **Revisar el diff**: ¿toca solo los archivos permitidos? ¿usa los nombres del diseño? ¿hay lógica de negocio fuera de `calculations.js` / `validations.js`?
3. **Verificar** el *Criterio de aceptación* (consola, `tests/pruebas.html` y/o pantalla).
4. **Correr las pruebas de regresión** R1–R6 que ya apliquen.
5. **Commit** con el formato `feat(T-XX): <resumen>` (o `fix(T-XX): …`) y marcar la tarea `[x]`.

### Prompt de ejecución (plantilla)

```text
Lee CLAUDE.md y tasks.md. Ejecuta SOLO la tarea T-XX.
Archivos permitidos: <lista de la tarea>.
Sigue los nombres de docs/design.md (§4 componentes, §5.3 API) y los campos de docs/data-contract.json.
Requerimientos que cubre: <REQ de la tarea>.
Al terminar, muestra el diff y explica cómo verificar el criterio de aceptación.
No modifiques nada fuera de esos archivos.
```

### Prompt de corrección con Unchanged Behavior (plantilla)

```text
Corrige/ajusta: <descripción exacta del problema o del cambio>.
UNCHANGED BEHAVIOR — debe seguir funcionando EXACTAMENTE igual:
- Cálculos de calculations.js (saldos, patrimonio, resumen mensual, presupuestos, neto del día).
- Validaciones de validations.js (montos, fechas, textos, fondos, duplicados).
- Persistencia en localStorage en cada mutación (clave 'finanzapp.state').
- Tareas ya completadas en tasks.md: <lista T-XX>.
Toca solo: <archivos>. Muestra el diff y confirma que tests/pruebas.html y R1–R6 siguen pasando.
```

### Definición de Hecho (para cada tarea)

- [ ] El criterio de aceptación se verificó.
- [ ] La consola no muestra errores y la pestaña Network está vacía.
- [ ] `tests/pruebas.html` muestra todas las pruebas en verde.
- [ ] Se usaron los nombres del diseño y del contrato, sin inventar campos.
- [ ] Commit hecho y tarea marcada `[x]`.

---

## Datos de prueba oficiales

Se usa el **segundo ejemplo** de `docs/data-contract.json` (`examples[1]`): 5 cuentas (una de ahorros y una tarjeta archivada), 9 categorías, 13 movimientos (1 en septiembre y 12 en octubre de 2026) y presupuesto total de ₡450,000. **Hoy de referencia: 2026-10-26.**

**Cargar el dataset** (consola del navegador con la app abierta; luego F5):

```js
localStorage.setItem('finanzapp.state', JSON.stringify(/* pegar aquí examples[1] de data-contract.json */));
```

**Limpiar:** `localStorage.removeItem('finanzapp.state')` y F5.

| Valor esperado (mes Octubre 2026) | Resultado |
|---|---|
| Saldo Efectivo | ₡31,300.00 (cronológico: 25,000 − 15,000 + 40,000 − 18,000 + 35,000 − 31,200 − 4,500; nunca negativo) |
| Saldo Cuenta BAC | ₡361,100.00 (150,000 + 650,000 − 250,000 − 50,000 − 40,000 − 38,900 − 60,000) |
| Ahorros BN | ₡250,000.00 (200,000 + 50,000) |
| Tarjeta Visa | Deuda ₡36,000.00 (68,500 + 27,500 − 60,000) · disponible ₡264,000.00 |
| Ciclo Visa (corte 15, pago 28) | Deuda al corte ₡96,000 − pago ₡60,000 = **pago del periodo ₡36,000**, vence en 2 días |
| Disponible / Ahorros / Deudas / Patrimonio | ₡392,400 / ₡250,000 / ₡36,000 / **₡606,400** |
| Presupuesto total | ₡438,600 de ₡450,000 → 97 %, Ámbar; suma por categoría ₡495,000 → advertencia |
| Ingresos / Gastos / Balance neto | ₡685,000.00 / ₡438,600.00 / +₡246,400.00 (transferencias excluidas) |
| Tasa de ahorro | 36 % (246,400 / 685,000 = 35.97 %) |
| Alimentación | ₡99,700 de ₡120,000 → **83 %, Ámbar** |
| Transporte | ₡22,500 de ₡40,000 → 56 %, Verde |
| Vivienda | ₡250,000 de ₡250,000 → **100 %, Ámbar** (límite exacto) |
| Servicios | ₡38,900 de ₡55,000 → 71 %, Verde |
| Entretenimiento | ₡27,500 de ₡30,000 → 92 %, Ámbar |
| Salud / Otros gastos | Sin presupuesto |
| Neto del día 2026-10-15 | −₡35,700.00 |
| Septiembre 2026 | Gastos ₡15,000 · Ingresos ₡0 · Tasa de ahorro "—" |

---

## Fase 0 — Auditoría y armonización de artefactos

- [x] **T-00.1 Contrato vs. negocio.** Los campos usan el lenguaje del negocio (`accounts`, `categories`, `transactions`, `initialBalance`, `creditLimit`, `monthlyBudget`, `toAccountId`). Los derivados (saldo, patrimonio, resumen, % de presupuesto) **no** se persisten.
  *Evidencia:* contrato estricto (`additionalProperties: false`, `if/then/else` por tipo de cuenta y de movimiento); los 2 ejemplos validan con un validador JSON Schema 2020-12.
- [x] **T-00.2 Reglas críticas claras en `requirements.md`.** Fondos: REQ-030..REQ-035. Montos: REQ-022..REQ-024. Presupuesto que no bloquea: REQ-042. Persistencia: REQ-051..REQ-054.
- [x] **T-00.3 `design.md` mapea cada requerimiento.** Tabla §7: 57/57 (72/72 en la v2).
- [x] **T-00.4 Wireframe en armonía con el contrato.** El formulario usa los campos de `transaction`; las categorías del wireframe son las de `emptyState`; los estados del presupuesto coinciden con RN-06.
- [x] **T-00.5 Decisiones de la auditoría.**
  - *¿El saldo se valida por fecha o en total?* **Decisión:** en total (D9). Un gasto con fecha pasada no se revalida contra el saldo de ese día.
  - *¿Un ingreso puede ir a la tarjeta?* **Decisión:** no; el pago de tarjeta es una transferencia (REQ-032).
  - *¿La alerta de presupuesto bloquea?* **Decisión:** no (REQ-042); lo que bloquea es la falta de fondos (RN-03).

## Fase 1 — Esqueleto del proyecto

- [x] **T-01 `index.html` con CSP y carga de scripts.** Archivos: `src/index.html`. REQ-047.
  *Aceptación:* abre con doble clic; consola limpia; Network vacío.
- [x] **T-02 `styles.css` base.** Archivos: `src/css/styles.css`. Variables de color, tema oscuro, estados `is-ok/warning/exceeded`, responsive.

## Fase 2 — `calculations.js` (funciones puras)

- [x] **T-03 Fechas y meses.** `parseISODate`, `isValidISODate`, `todayISO`, `monthOf`, `currentMonth`, `addMonths`, `monthLabel`. REQ-026, REQ-027, REQ-038.
  *Aceptación:* `isValidISODate('2026-02-30') === false`; `addMonths('2026-01', -1) === '2025-12'`.
- [x] **T-04 Dinero.** `toCents`, `sumAmounts`, `hasMax2Decimals`, `formatMoney`, `formatPercent`. REQ-024, REQ-045.
  *Aceptación:* `sumAmounts([{amount:0.1},{amount:0.2}]) === 0.3`; `formatMoney(-246400) === '−₡246,400.00'`.
- [x] **T-05 Saldos (RN-01..RN-03).** `accountBalance`, `creditDebt`, `availableFunds`, `netWorth`, `accountViolations`. REQ-006, REQ-007.
  *Aceptación:* con el dataset, Efectivo ₡31,300; Visa deuda ₡36,000 / disponible ₡264,000; Patrimonio ₡406,400 en la v1 (₡606,400 con el dataset v2, que agrega la cuenta de ahorros).
- [x] **T-06 Resumen, presupuestos y lista (RN-05..RN-08).** `monthSummary`, `budgetStatus`, `statusFromPercent`, `groupByDate`, `dayNet`, `filterTransactions`, `sortTransactions`, `findDuplicate`. REQ-036..REQ-041, REQ-043.
  *Aceptación:* tabla del dataset oficial.

## Fase 3 — `validations.js`

- [x] **T-07 `parseAmount`.** REQ-004, REQ-005, REQ-015, REQ-022..REQ-024. *Aceptación:* `-5`, `0`, `'abc'`, `''`, `6.505` rechazados.
- [x] **T-08 Cuentas.** `validateAccount`, `validateAccountDelete`, `draftToAccount`. REQ-002..REQ-005, REQ-008..REQ-010.
- [x] **T-09 Categorías.** `validateCategory`, `validateCategoryDelete`, `validateReassign`. REQ-014..REQ-019.
- [x] **T-10 Movimientos.** `validateTransaction`, `validateTransactionDelete`, `draftToTransaction`. REQ-021, REQ-025..REQ-035.
  *Aceptación:* `₡50,000` desde Efectivo → "Saldo insuficiente: disponible ₡31,300.00."; pago de ₡40,000 a Visa → "El pago excede la deuda: ₡36,000.00."

## Fase 4 — `storage.js`

- [x] **T-11 Persistencia y validador del contrato.** `emptyState`, `validateState`, `loadState`, `saveState`. REQ-012, REQ-051..REQ-054.
  *Aceptación:* `localStorage.setItem('finanzapp.state','{roto')` + F5 → aviso y estado vacío con 9 categorías.

## Fase 5 — `app.js`

- [x] **T-12 Estado, `dispatch` y red de seguridad.** `initialUi`, `dispatch`, `persist`, validación del contrato antes de aceptar (D13). REQ-051, REQ-055.
- [x] **T-13 Reducers de cuentas.** `ADD/UPDATE/DELETE_ACCOUNT`. REQ-001, REQ-010, REQ-011.
- [x] **T-14 Reducers de categorías con reasignación.** `ADD/UPDATE/DELETE_CATEGORY`. REQ-013, REQ-017, REQ-018, REQ-048.
- [x] **T-15 Reducers de movimientos, duplicados y aviso de presupuesto.** `ADD/UPDATE/DELETE_TRANSACTION`, `budgetToast`. REQ-020, REQ-033..REQ-035, REQ-042, REQ-044.
- [x] **T-16 Eventos y arranque.** `bindEvents`, `init`. REQ-038, REQ-052.

## Fase 6 — Interfaz

- [x] **T-17 Shell.** `AppHeader`, `NavTabs`, `StorageNotice`, `Toast`, helper `el()`. REQ-007, REQ-053, REQ-054, REQ-056.
- [x] **T-18 Resumen.** `MonthSelector`, `SummaryCards`, `AccountsOverview`, `BudgetList`. REQ-038..REQ-041, REQ-043, REQ-045, REQ-046, REQ-057.
- [x] **T-19 Movimientos.** `TransactionForm`, `Filters`, `TransactionList`, `updateForm`. REQ-020..REQ-037, REQ-055.
- [x] **T-20 Cuentas.** `AccountForm`, `AccountList`. REQ-001..REQ-011, REQ-049.
- [x] **T-21 Categorías.** `CategoryForm`, `CategoryTable`. REQ-012..REQ-019.
- [x] **T-22 Diálogos.** `Dialog` (confirmación, duplicado, reasignación). REQ-011, REQ-017, REQ-018, REQ-033, REQ-035.

## Fase 7 — Pruebas de regresión

- [x] **T-23 `tests/pruebas.html`.** 61 pruebas (87 desde la v2) de la lógica pura (fechas, dinero, saldos, resumen, presupuestos, validaciones y contrato) con el dataset oficial. Se abre con doble clic.

## Fase 8 — Verificación contra el negocio

- [x] **T-24 Recorrido completo en el navegador.** 87 verificaciones de punta a punta (una o más por REQ), incluidas persistencia con F5, datos dañados, fallo al guardar, red vacía y vista móvil de 375 px sin scroll horizontal. Resultado: 87/87.

---

## Fase 9 — Versión 2 (solicitud del cliente: registrar gastos, cuentas y presupuestos)

> Cambios pedidos por el estudiante después de usar la v1. Se hicieron en el orden de CLAUDE.md §10:
> `requirements.md` (REQ-058..REQ-072) → contrato v2 + `design.md` → este plan → código → pruebas, bajo Unchanged Behavior.

- [x] **T-25 Especificación y contrato v2.** REQ-058..REQ-072; `schemaVersion 2` (`ahorros`, `archived`, `cutoffDay`, `paymentDay`, `settings`); RN-09..RN-11; D9 revisada y D16–D19.
- [x] **T-26 Migración v1 → v2.** `storage.migrate`, `loadState().migrated`, guardado en `init`. REQ-072.
  *Aceptación:* un estado v1 guardado se carga sin aviso y queda guardado como v2.
- [x] **T-27 Regla de fondos cronológica.** `calc.timeline`, `availableFunds(…, date)`, `paymentRoom`, `accountViolations` cronológica. RN-03, REQ-030..REQ-035.
  *Aceptación:* gasto de ₡30,000 en Efectivo con fecha 2026-10-14 → "Saldo insuficiente" (el saldo bajaría de 0 el 15 de octubre).
- [x] **T-28 Ahorros y desglose.** `isSavings`, `balanceSummary`, `BalanceBreakdown`. REQ-058, REQ-059.
- [x] **T-29 Tarjetas: fechas, ciclo y avisos.** `parseDay`, `creditCycle`, `paymentAlerts`, `PaymentAlerts`. REQ-060..REQ-062.
- [x] **T-30 Archivar y reactivar.** `validateArchive`, `ARCHIVE_ACCOUNT`, `UNARCHIVE_ACCOUNT`, selectores solo con cuentas activas. REQ-063..REQ-065.
- [x] **T-31 Tarjetas visuales y detalle de cuenta.** `AccountCard`, `AccountCards`, `AccountDetail`, `runningBalances`. REQ-066.
- [x] **T-32 Registro rápido.** `QuickAddButton`, `QuickAdd`, `TransactionFields`, `lastUsedAccountId`, `OPEN_QUICK`/`CLOSE_QUICK`. REQ-067, REQ-068. La pestaña "Movimientos" pasa a llamarse "Gastos e ingresos".
- [x] **T-33 Pestaña Presupuestos y presupuesto total.** `BudgetsView`, `TotalBudgetCard`, `SettingsForm`, `PerDay`, `totalBudgetStatus`, `remainingDays`, `SAVE_SETTINGS`. REQ-069..REQ-071.

## Fase 10 — Versión 3: movimientos programados (pregunta del estudiante: "¿por qué no puedo poner la renta del último día del mes?")

> REQ-027 prohibía fechas futuras. El estudiante eligió **gastos programados**. Orden: `requirements.md` (REQ-027 modificado, REQ-073..REQ-078) → `design.md` (RN-12, D20–D22) → este plan → código → pruebas. El contrato no cambia (`schemaVersion 2`): "programado" se deriva de la fecha.

- [x] **T-34 Especificación v3.** REQ-027 modificado (hasta 365 días); REQ-073..REQ-078; RN-12; D20–D22; `$comment` del contrato.
- [x] **T-35 Lógica.** `addDays`, `currentBalance`, `isScheduled`, `hasScheduled`, `upcomingScheduled`, `monthSummary(…, today)`, `balanceSummary(state, today)`; ciclo de tarjeta sin pagos programados; archivar sin programados; `MAX_SCHEDULE_DAYS`. REQ-027, REQ-061, REQ-063, REQ-073..REQ-076.
  *Aceptación:* con la renta de ₡250,000 programada al 31 de octubre en BAC: saldo actual ₡361,100, después de programados ₡111,100; un gasto de ₡200,000 hoy → "Saldo insuficiente: disponible ₡111,100.00".
- [x] **T-36 Interfaz.** `scheduledBadge`, `UpcomingScheduled`, "Saldo actual / Después de programados", "Incluye ₡X programados", "se apartan ₡X", `max` de la fecha a un año. REQ-073..REQ-077.
  *Aceptación:* al adelantar el reloj al 31 de octubre, la renta deja de ser programada y el Patrimonio baja a ₡356,400.

## Fase 11 — Versión 4: programaciones (pedido del estudiante: "elegir si un pago es programado, auto-débito de la cuenta que escoja, mensual, una vez o quincenal, y verlos al pasar de mes")

> Orden: `requirements.md` (REQ-027 y REQ-050 modificados, REQ-073..078 eliminados, REQ-079..REQ-090) → contrato `schemaVersion 3` + `design.md` (RN-12 nueva, D20–D26) → este plan → código → pruebas.

- [x] **T-37 Especificación y contrato v4.** Entidad `schedules[]`, `scheduleId` + `occurrenceDate` en movimientos, migración v2 → v3 (REQ-090).
- [x] **T-38 Motor de ocurrencias y proyección.** `scheduleOccurrences`, `openOccurrences`, `dueOccurrences`, `upcomingOccurrences`, `nextOccurrence`, `monthlyEquivalent`, `monthItems`, `projectedState`, `projectedBalance`, `projectionAlerts`. REQ-080, REQ-081, REQ-087, REQ-088.
  *Aceptación:* hipoteca mensual desde el 31 → 31 oct, 30 nov, 31 dic; gasolina quincenal → 15 y último de cada mes; noviembre muestra ambos en la lista y en el resumen.
- [x] **T-39 Validaciones y acciones.** `validateSchedule`, `validateSkip`, `ADD/UPDATE/DELETE_SCHEDULE`, `CONFIRM_OCCURRENCE`, `SKIP_OCCURRENCE`, `ADJUST_OCCURRENCE`, `PROCESS_SCHEDULES` (al abrir y al volver a la app). REQ-027, REQ-079, REQ-082..REQ-086, REQ-089.
  *Aceptación:* al adelantar el reloj al 31 de octubre, el salario y la hipoteca (auto) se registran solos una sola vez; la gasolina (manual) queda pendiente; un auto-débito sin fondos no se aplica.
- [x] **T-40 Interfaz.** Casilla "🗓 Programar" con frecuencia, hasta, modo y vista previa; etiquetas Programado / Pendiente; "Pendientes de confirmar"; "Pagos e ingresos programados"; "Proyectado a fin de mes"; aviso de proyección. REQ-079..REQ-089.

- [x] **T-41 (v5) Programaciones que empezaron antes de usar la app.** Pedido del estudiante: "pagué los servicios el 6 pero los registro hoy". REQ-079 modificado (primera fecha hasta un año atrás) y REQ-091: `validate.pastOccurrences`, `resolvePast`, `PastOccurrences` (✅ Registrarlos ahora · ↪ Ya los registré), fondos revisados al registrar.
  *Aceptación:* editar "Internet, Luz, Agua y Gas" (mensual, ₡70,000) y cambiar la primera fecha al 6 de octubre → se registra el pago del 6 de octubre con su fecha y la próxima ocurrencia es el 6 de noviembre.

- [x] **T-42 (v5.1) Ingresos programados sin "Al llegar la fecha".** Pedido del estudiante: un salario no se confirma ni se "debita". REQ-079 ajustado, D28: `draftToSchedule` fija `mode = 'auto'` en ingresos, `occurrenceToTx` trata ingresos guardados como automáticos, `ScheduleFields` reemplaza el selector por "💰 Los ingresos programados se registran solos en su fecha" y las listas dicen "Automático".

## Pruebas de regresión (correr después de cada tarea, cuando ya apliquen)

| # | Prueba | Desde |
|---|---|---|
| R1 | **Persistencia:** crear/editar datos → F5 → todo sigue igual | T-12 |
| R2 | **Montos inválidos:** `-5`, `0`, `'abc'`, `''`, `6.505` se rechazan y el estado no cambia | T-07 / T-19 |
| R3 | **Fondos:** ₡50,000 desde Efectivo → "Saldo insuficiente: disponible ₡31,300.00" y no se guarda | T-10 / T-19 |
| R4 | **Presupuesto que no bloquea:** +₡5,000 en Entretenimiento con Visa → se guarda, 108 % Rojo y aviso | T-15 / T-18 |
| R5 | **Contrato:** `FinanzApp.storage.validateState(FinanzApp.app.state).valid === true` tras cualquier acción | T-12 |
| R6 | **Consola limpia, Network vacío** y `tests/pruebas.html` en verde | T-01 / T-23 |
| R7 | **Registro rápido:** "+ Registrar" en todas las pestañas; Escape no guarda nada; guardar cierra y registra | T-32 |
| R8 | **Fondos cronológicos:** ₡30,000 desde Efectivo el 2026-10-14 → rechazado; el detalle de Efectivo nunca muestra saldo negativo | T-27 / T-31 |
| R9 | **Programaciones:** hipoteca mensual auto + gasolina quincenal manual → visibles en noviembre; al llegar la fecha la auto se aplica una sola vez y la manual queda pendiente; fecha futura sin "Programar" → rechazada | T-38 / T-39 |

## Matriz de cobertura REQ → tarea

| REQ | Tareas | REQ | Tareas | REQ | Tareas |
|---|---|---|---|---|---|
| 001 | T-08, T-13, T-20 | 020 | T-10, T-15, T-19 | 039 | T-06, T-18 |
| 002 | T-08, T-20 | 021 | T-10, T-19 | 040 | T-06, T-18 |
| 003 | T-08, T-20 | 022 | T-07, T-19 | 041 | T-06, T-18 |
| 004 | T-07, T-08 | 023 | T-07, T-19 | 042 | T-15 |
| 005 | T-07, T-08 | 024 | T-04, T-07 | 043 | T-06, T-18 |
| 006 | T-05, T-18 | 025 | T-10, T-19 | 044 | T-15, T-17 |
| 007 | T-05, T-17 | 026 | T-03, T-10 | 045 | T-04, T-18 |
| 008 | T-08, T-20 | 027 | T-03, T-10 | 046 | T-18, T-19 |
| 009 | T-08, T-20 | 028 | T-10, T-19 | 047 | T-01 |
| 010 | T-08, T-13 | 029 | T-10, T-19 | 048 | T-14 |
| 011 | T-13, T-22 | 030 | T-05, T-10 | 049 | T-05, T-20 |
| 012 | T-11, T-21 | 031 | T-05, T-10 | 050 | (ninguna función generadora) |
| 013 | T-14, T-21 | 032 | T-10 | 051 | T-11, T-12 |
| 014 | T-09, T-21 | 033 | T-06, T-15, T-22 | 052 | T-11, T-16 |
| 015 | T-07, T-09 | 034 | T-10, T-15 | 053 | T-11, T-17 |
| 016 | T-09, T-21 | 035 | T-10, T-15, T-22 | 054 | T-11, T-12 |
| 017 | T-09, T-14, T-22 | 036 | T-06, T-19 | 055 | T-12, T-19 |
| 018 | T-14, T-22 | 037 | T-06, T-19 | 056 | T-17 |
| 019 | T-09, T-21 | 038 | T-03, T-16, T-18 | 057 | T-18 |
| 058 | T-28 | 063 | T-30 | 068 | T-32 |
| 059 | T-28 | 064 | T-30 | 069 | T-33 |
| 060 | T-29 | 065 | T-30 | 070 | T-33 |
| 061 | T-29 | 066 | T-31 | 071 | T-33 |
| 062 | T-29 | 067 | T-32 | 072 | T-26 |
| 073 | T-35, T-36 | 075 | T-35, T-36 | 077 | T-35, T-36 |
| 074 | T-35, T-36 | 076 | T-35, T-36 | 078 | (ninguna función generadora) |
| 027 *(v3)* | T-35 | | | | |
| 073–078 | *Eliminados en v4* | 079 | T-39, T-40 | 080 | T-38, T-40 |
| 081 | T-38, T-40 | 082 | T-39 | 083 | T-39, T-40 |
| 084 | T-39 | 085 | T-39, T-40 | 086 | T-39 |
| 087 | T-38, T-40 | 088 | T-38, T-40 | 089 | T-39, T-40 |
| 090 | T-37 | 027 *(v4)* | T-39 | 050 *(v4)* | T-39 |

## Registro de ejecución

| Fecha | Tareas | Evidencia |
|---|---|---|
| 2026-10-26 | T-00 | Contrato y especificación armonizados; ejemplos del contrato válidos |
| 2026-10-26 | T-01..T-22 | Implementación en `src/` (ver `git log`) |
| 2026-10-26 | T-23 | `tests/pruebas.html`: 61/61 |
| 2026-10-26 | T-24 | Recorrido de punta a punta: 87/87; consola limpia; 0 peticiones de red |
| 2026-10-26 | T-25..T-33 | Versión 2: `tests/pruebas.html` 87/87 y recorrido de punta a punta 117/117 (incluye todas las pruebas de la v1, ajustadas al nuevo dataset) |
| 2026-10-26 | fix(T-31) | "Editar" desde el detalle de cuenta ahora abre el formulario (reportado por el estudiante); pruebas 87/87 y 117/117
| 2026-10-26 | T-34..T-36 | Versión 3 (programados): `tests/pruebas.html` 102/102 y recorrido de punta a punta 127/127
| 2026-10-26 | T-37..T-40 | Versión 4 (programaciones): `tests/pruebas.html` 112/112 y recorrido de punta a punta 145/145. El recorrido detectó un error real (el ajuste de una ocurrencia no quedaba enlazado) que se corrigió antes de entregar
| 2026-10-26 | T-41 | Versión 5: `tests/pruebas.html` 116/116 y recorrido de punta a punta 149/149
| 2026-10-26 | T-42 | v5.1: `tests/pruebas.html` 118/118 y recorrido de punta a punta 151/151
