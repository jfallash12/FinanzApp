# tasks.md — Plan de Implementación de FinanzApp

> Plan de desarrollo incremental y verificable, ordenado por fases. Cada tarea cita los requerimientos que cubre.
>
> **Insumos:** [`docs/requirements.md`](docs/requirements.md) · [`docs/design.md`](docs/design.md) ·
> [`docs/decisiones.md`](docs/decisiones.md) · [`docs/data-contract.json`](docs/data-contract.json) ·
> [`docs/wireframe.md`](docs/wireframe.md) · reglas en [`CLAUDE.md`](CLAUDE.md) y [`.cursorrules`](.cursorrules).

**Estado:** Fases 0–11 completadas; Fase 12 en curso · Leyenda: `[ ]` pendiente · `[x]` hecha.
Los números de tarea se conservan porque los commits los citan.

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

Archivo [`tests/datos-ejemplo.json`](tests/datos-ejemplo.json): 5 cuentas (una de ahorros y una tarjeta archivada), 9 categorías, 13 movimientos (1 en septiembre y 12 en octubre de 2026) y presupuesto total de ₡450,000. **Hoy de referencia: 2026-10-26.**

**Cargar los datos de prueba** (consola del navegador con la app abierta; luego F5):

```js
localStorage.setItem('finanzapp.state', JSON.stringify(/* pegar aquí el contenido de tests/datos-ejemplo.json */));
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
  *Evidencia:* `tests/datos-ejemplo.json` valida contra el contrato con un validador JSON Schema 2020-12; las reglas entre campos están en `design.md` §6.
- [x] **T-00.2 Reglas críticas claras en `requirements.md`.** Fondos: REQ-030..REQ-035. Montos: REQ-022..REQ-024. Presupuesto que no bloquea: REQ-042. Persistencia: REQ-051..REQ-054.
- [x] **T-00.3 `design.md` mapea cada requerimiento.** Tabla §7: 90/90.
- [x] **T-00.4 Wireframe en armonía con el contrato.** El formulario usa los campos de `transaction`; las categorías del wireframe son las de `emptyState`; los estados del presupuesto coinciden con RN-06.
- [x] **T-00.5 Decisiones de la auditoría.**
  - *¿El saldo se valida por fecha o en total?* **Decisión:** por fecha, en orden cronológico (D9).
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
  *Aceptación:* con los datos de prueba, Efectivo ₡31,300; Visa deuda ₡36,000 / disponible ₡264,000; Patrimonio ₡606,400.
- [x] **T-06 Resumen, presupuestos y lista (RN-05..RN-08).** `monthSummary`, `budgetStatus`, `statusFromPercent`, `groupByDate`, `dayNet`, `filterTransactions`, `sortTransactions`, `findDuplicate`. REQ-036..REQ-041, REQ-043.
  *Aceptación:* tabla de los datos de prueba.

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

- [x] **T-23 `tests/pruebas.html`.** 133 pruebas de la lógica pura (fechas, dinero, saldos, resumen, presupuestos, programaciones, metas, validaciones y contrato) con los datos de prueba. Se abre con doble clic.

## Fase 8 — Verificación contra el negocio

- [x] **T-24 Recorrido completo en el navegador.** 161 verificaciones de punta a punta (una o más por REQ), incluidas persistencia con F5, datos dañados, fallo al guardar, red vacía y vista móvil de 375 px sin scroll horizontal. Resultado: 161/161.

---

## Fase 9 — Cuentas, registro rápido y presupuestos

- [x] **T-25 Especificación y contrato.** REQ-058..REQ-072; tipo `ahorros`, `archived`, `cutoffDay`, `paymentDay` y `settings`; RN-09..RN-11; D9 y D16–D19.
- [x] **T-26 Migración desde la versión 1 del contrato.** `storage.migrate`, `loadState().migrated`, guardado en `init`. REQ-072.
  *Aceptación:* un estado con `schemaVersion 1` se carga sin aviso y queda guardado en la versión actual.
- [x] **T-27 Regla de fondos cronológica.** `calc.timeline`, `availableFunds(…, date)`, `paymentRoom`, `accountViolations`. RN-03, REQ-030..REQ-035.
  *Aceptación:* gasto de ₡30,000 en Efectivo con fecha 2026-10-14 → "Saldo insuficiente" (el saldo bajaría de 0 el 15 de octubre).
- [x] **T-28 Ahorros y desglose.** `isSavings`, `balanceSummary`, `BalanceBreakdown`. REQ-058, REQ-059.
- [x] **T-29 Tarjetas: fechas, ciclo y avisos.** `parseDay`, `creditCycle`, `paymentAlerts`, `PaymentAlerts`. REQ-060..REQ-062.
- [x] **T-30 Archivar y reactivar.** `validateArchive`, `ARCHIVE_ACCOUNT`, `UNARCHIVE_ACCOUNT`, selectores solo con cuentas activas. REQ-063..REQ-065.
- [x] **T-31 Tarjetas visuales y detalle de cuenta.** `AccountCard`, `AccountCards`, `AccountDetail`, `runningBalances`; ✎ Editar desde el detalle abre el formulario. REQ-066.
- [x] **T-32 Registro rápido.** `QuickAddButton`, `QuickAdd`, `TransactionFields`, `lastUsedAccountId`, `OPEN_QUICK`/`CLOSE_QUICK`; pestaña "Gastos e ingresos". REQ-067, REQ-068.
- [x] **T-33 Pestaña Presupuestos y presupuesto total.** `BudgetsView`, `TotalBudgetCard`, `SettingsForm`, `PerDay`, `totalBudgetStatus`, `remainingDays`, `SAVE_SETTINGS`. REQ-069..REQ-071.

## Fase 10 — Programaciones: pagos e ingresos fijos

- [x] **T-37 Especificación y contrato.** Entidad `schedules[]`, `scheduleId` + `occurrenceDate` en movimientos, migración desde la versión 2 del contrato (REQ-090); RN-12; D21–D27.
- [x] **T-38 Motor de ocurrencias y proyección.** `scheduleOccurrences`, `openOccurrences`, `dueOccurrences`, `upcomingOccurrences`, `nextOccurrence`, `monthlyEquivalent`, `monthItems`, `projectedState`, `projectedBalance`, `projectionAlerts`. REQ-080, REQ-081, REQ-087, REQ-088.
  *Aceptación:* hipoteca mensual desde el 31 → 31 oct, 30 nov, 31 dic; gasolina quincenal → 15 y último de cada mes; noviembre muestra ambos en la lista y en el resumen.
- [x] **T-39 Validaciones y acciones.** `validateSchedule`, `validateSkip`, `ADD/UPDATE/DELETE_SCHEDULE`, `CONFIRM_OCCURRENCE`, `SKIP_OCCURRENCE`, `ADJUST_OCCURRENCE`, `PROCESS_SCHEDULES` (al abrir y al volver a la app). REQ-027, REQ-050, REQ-079, REQ-082..REQ-086, REQ-089.
  *Aceptación:* al adelantar el reloj al 31 de octubre, el salario y la hipoteca (auto) se registran solos una sola vez; la gasolina (manual) queda pendiente; un auto-débito sin fondos no se aplica; "Ajustar" deja el movimiento enlazado a su ocurrencia.
- [x] **T-40 Interfaz.** Casilla "🗓 Programar" con frecuencia, hasta, modo y vista previa; etiquetas Programado / Pendiente; "Pendientes de confirmar"; "Pagos e ingresos programados"; "Proyectado a fin de mes"; aviso de proyección. REQ-079..REQ-089.
- [x] **T-41 Programaciones que empezaron antes de hoy.** REQ-079 y REQ-091: `validate.pastOccurrences`, `resolvePast`, `PastOccurrences` (✅ Registrarlos ahora · ↪ Ya los registré), fondos revisados al registrar.
  *Aceptación:* editar "Internet, Luz, Agua y Gas" (mensual, ₡70,000) y cambiar la primera fecha al 6 de octubre → se registra el pago del 6 de octubre con su fecha y la próxima ocurrencia es el 6 de noviembre.
- [x] **T-42 Ingresos programados automáticos.** REQ-079, D28: `draftToSchedule` fija `mode = 'auto'` en ingresos, `occurrenceToTx` trata los ingresos como automáticos, `ScheduleFields` muestra "💰 Los ingresos programados se registran solos en su fecha" y las listas dicen "Automático".
- [x] **T-43 «¿Hasta cuándo?» con Sin fin por defecto.** REQ-079, D29: borrador con `ends: 'never' | 'date'`, `draftToSchedule` ignora `endDate` con «Sin fin», error si se elige «Hasta una fecha» sin fecha, rótulo «Primer pago (desde)» y aviso cuando solo habrá 1 pago.
- [x] **T-47 Próximos programados según el mes.** REQ-096, D33: `calc.upcomingStart`, `ui.upcomingFrom` (se reinicia al cambiar de mes), acción `SET_UPCOMING` y botones ◀ 7 días antes · 7 días después ▶ en `UpcomingScheduled`.
  *Aceptación:* en noviembre la tarjeta dice "Programados del 1 nov al 7 nov" y no muestra el 31 de octubre; 7 días después → 8 al 14 nov; volver a octubre → "Próximos programados (7 días)" con ◀ deshabilitado.

## Fase 11 — Ahorro en el presupuesto y metas de ahorro

- [x] **T-44 Apartado a ahorros en el presupuesto total.** REQ-070, REQ-092, RN-13, D30: `calc.savingsSetAside` y `totalBudgetStatus` = gastos + apartado; `TotalBudgetCard` con barra de dos tramos y leyenda; `budgetToast` avisa también con transferencias.
  *Aceptación:* octubre muestra "Gastos ₡438,600 · Apartado a ahorros ₡50,000" y 109 % Excedido; el Resumen sigue mostrando gastos ₡438,600 y la tasa de ahorro no cambia.
- [x] **T-45 Metas de ahorro.** REQ-093..REQ-095, D31: campos opcionales `goalAmount` y `goalReason` (solo ahorros) en el contrato, `storage.checkAccount`, `validateAccount`/`draftToAccount` y `AccountForm`; `calc.goalProgress`; `GoalProgress` en la tarjeta y el detalle de la cuenta; sección **Metas de ahorro** en Presupuestos; aviso "🎉 ¡Alcanzó su meta!".
  *Aceptación:* "Ahorros BN" muestra "🎯 Fondo de emergencia · ₡250,000 de ₡1,000,000 · 25 % · Le faltan ₡750,000"; con una transferencia mensual programada de ₡100,000 indica "la alcanza en 8 meses (junio 2027)"; una razón sin monto se rechaza.
- [x] **T-46 Detalle de aportes de la meta.** REQ-094, D32: `goalProgress` devuelve `sources` y `duplicates`; `GoalProgress` lista cada transferencia programada con su frecuencia y advierte repetidas.
  *Aceptación:* una transferencia mensual de ₡100,000 muestra "• <descripción>: ₡100,000 cada mes"; una quincenal muestra "cada quincena (15 y último) = ₡200,000 al mes"; dos iguales muestran el aviso de repetidas.

## Fase 12 — Respaldo de datos y ayudas del Resumen

- [x] **T-48 Especificación.** REQ-097..REQ-102 y REQ-048 ampliado; D34–D39; componentes y API en `design.md`.
- [x] **T-49 Exportar e importar datos.** REQ-097, REQ-098, D34–D36: `storage.parseBackup`, `storage.backupFileName`, `exportData` y `DOMAIN.IMPORT_STATE` en `app.js`, `BackupCard` en Cuentas.
  *Aceptación:* Exportar descarga `finanzapp-AAAA-MM-DD.json`; importarlo en una app vacía y confirmar → mismos saldos (Patrimonio ₡606,400); un archivo con texto cualquiera o con una cuenta en negativo → "El archivo no es un respaldo válido de FinanzApp" y nada cambia; Cancelar no cambia nada.
- [x] **T-50 Buscar por descripción.** REQ-099, D37: `filters.text` en `calc.filterTransactions`; campo de búsqueda en `Filters`.
  *Aceptación:* en octubre, buscar "bus" muestra solo «Bus» (₡4,500); "PAN" encuentra «Panadería» en septiembre; combinado con la cuenta Visa y "cine" muestra «Cine y cena».
- [x] **T-51 Comparación con el mes anterior.** REQ-100, D38: `calc.monthComparison`; texto bajo «Gastos del mes».
  *Aceptación:* octubre (₡438,600) frente a septiembre (₡15,000) → "▲ 2824 % más que septiembre 2026"; septiembre → "Sin gastos en agosto 2026".
- [ ] **T-52 Categorías con más gasto.** REQ-101, D38: `calc.topCategories`, `TopCategories`.
  *Aceptación:* octubre → Vivienda ₡250,000 (57 %), Alimentación ₡99,700 (23 %), Servicios ₡38,900 (9 %); noviembre sin gastos → "Aún no hay gastos en noviembre 2026".
- [ ] **T-53 Primeros pasos.** REQ-102, D39: `calc.firstSteps`, `FirstSteps` en lugar del mensaje "Bienvenido…" del Resumen.
  *Aceptación:* app vacía → 3 pasos pendientes y botón «Ir a Cuentas»; con una cuenta → paso 1 ✓ y botón a «Gastos e ingresos»; con los datos de prueba la tarjeta no aparece.

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
| 008 | T-08, T-20 | 027 | T-03, T-10, T-39 | 046 | T-18, T-19 |
| 009 | T-08, T-20 | 028 | T-10, T-19 | 047 | T-01 |
| 010 | T-08, T-13 | 029 | T-10, T-19 | 048 | T-14, T-49 |
| 011 | T-13, T-22 | 030 | T-05, T-10 | 049 | T-05, T-20 |
| 012 | T-11, T-21 | 031 | T-05, T-10 | 050 | T-39 |
| 013 | T-14, T-21 | 032 | T-10 | 051 | T-11, T-12 |
| 014 | T-09, T-21 | 033 | T-06, T-15, T-22 | 052 | T-11, T-16 |
| 015 | T-07, T-09 | 034 | T-10, T-15 | 053 | T-11, T-17 |
| 016 | T-09, T-21 | 035 | T-10, T-15, T-22 | 054 | T-11, T-12 |
| 017 | T-09, T-14, T-22 | 036 | T-06, T-19 | 055 | T-12, T-19 |
| 018 | T-14, T-22 | 037 | T-06, T-19 | 056 | T-17 |
| 019 | T-09, T-21 | 038 | T-03, T-16, T-18 | 057 | T-18 |
| 058 | T-28 | 071 | T-33 | 084 | T-39 |
| 059 | T-28 | 072 | T-26 | 085 | T-39, T-40 |
| 060 | T-29 | 079 | T-39, T-40, T-41, T-42, T-43 | 086 | T-39 |
| 061 | T-29 | 080 | T-38, T-40 | 087 | T-38, T-40 |
| 062 | T-29 | 081 | T-38, T-40 | 088 | T-38, T-40 |
| 063 | T-30 | 082 | T-39 | 089 | T-39, T-40 |
| 064 | T-30 | 083 | T-39, T-40 | 090 | T-37 |
| 065 | T-30 | 091 | T-41 | 092 | T-44 |
| 066 | T-31 | 093 | T-45 | 094 | T-45, T-46 |
| 067 | T-32 | 095 | T-45 | 096 | T-47 |
| 068 | T-32 | 069 | T-33 | 070 | T-33, T-44 |
| 097 | T-49 | 098 | T-49 | 099 | T-50 |
| 100 | T-51 | 101 | T-52 | 102 | T-53 |

**Resultado final:** `tests/pruebas.html` 133/133 y recorrido de punta a punta 161/161, consola limpia y 0 peticiones de red.
