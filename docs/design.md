# Diseño técnico y arquitectura — FinanzApp

> Traduce la especificación ([`requirements.md`](./requirements.md)), el contrato de datos
> ([`data-contract.json`](./data-contract.json)) y el wireframe ([`wireframe.md`](./wireframe.md) · [`wireframe.png`](./wireframe.png))
> en componentes, módulos, manejo de estado y flujos de datos. Las decisiones técnicas que no están en los requerimientos
> están en [`decisiones.md`](./decisiones.md).

---

## 1. Visión general y stack

| Aspecto | Decisión |
|---|---|
| Tipo de app | SPA estática de una sola página (`src/index.html`) |
| Stack | HTML + CSS puro escrito a mano + JavaScript vanilla (sin frameworks, librerías, build ni CDN) |
| Estado | **Un objeto de estado en memoria** (`state`) dentro de `app.js` + estado de interfaz (`ui`) no persistido |
| Persistencia | `localStorage`, clave `finanzapp.state`, estado completo en cada mutación (REQ-051) |
| Red | Ninguna. Se bloquea por diseño con Content-Security-Policy (REQ-047) |
| Ejecución | Abrir `src/index.html` con doble clic (`file://`) o publicarla en GitHub Pages (§9) |
| Moneda | Colones (₡), una sola moneda |

**Entidades y relaciones:**

```mermaid
erDiagram
  ACCOUNT ||--o{ TRANSACTION : "accountId"
  ACCOUNT ||--o{ TRANSACTION : "toAccountId (transferencia)"
  CATEGORY ||--o{ TRANSACTION : "categoryId (ingreso y gasto)"
  ACCOUNT ||--o{ SCHEDULE : "accountId / toAccountId"
  CATEGORY ||--o{ SCHEDULE : "categoryId"
  SCHEDULE ||--o{ TRANSACTION : "scheduleId + occurrenceDate"
  ACCOUNT { string id PK "acc-..." string name string type "efectivo|debito|ahorros|credito" number initialBalance "líquidas" number creditLimit "crédito" int cutoffDay "crédito" int paymentDay "crédito" number goalAmount "ahorros, opcional" bool archived }
  CATEGORY { string id PK "cat-..." string name string kind "gasto|ingreso" number monthlyBudget "opcional, solo gasto" bool system }
  TRANSACTION { string id PK "mov-..." string type "ingreso|gasto|transferencia" number amount string date string description }
  SCHEDULE { string id PK "prg-..." string frequency "once|monthly|biweekly" string startDate string endDate "opcional" string mode "auto|manual" }
```

## 2. Memoria semántica: del lenguaje ubicuo al código

| Entidad (lenguaje ubicuo) | En el contrato | En el código | ¿Persistida? |
|---|---|---|---|
| **Account** | `accounts[]` | `state.accounts` | Sí |
| **Category** | `categories[]` | `state.categories` | Sí |
| **Transaction** | `transactions[]` | `state.transactions` | Sí |
| **Schedule** | `schedules[]` | `state.schedules` | Sí |
| **Settings** | `settings` | `state.settings` | Sí |
| **AccountBalance** / **AvailableFunds** | — | `calc.accountBalance`, `calc.availableFunds` | No |
| **NetWorth** / **BalanceSummary** | — | `calc.netWorth`, `calc.balanceSummary` | No |
| **MonthSummary** / **DayNet** | — | `calc.monthSummary`, `calc.dayNet`, `calc.groupByDate` | No |
| **BudgetStatus** / **TotalBudgetStatus** | — | `calc.budgetStatus`, `calc.totalBudgetStatus` | No |
| **CreditCycle** | — | `calc.creditCycle` | No |
| **Occurrence** | — | `calc.openOccurrences` | No |
| **GoalProgress** | — | `calc.goalProgress` | No |

El glosario está en [`../CLAUDE.md`](../CLAUDE.md) §2.

**Invariantes del dominio que el diseño hace cumplir** (detalle en CLAUDE.md §3):

1. **Saldo protegido (RN-03):** `validations.js` rechaza cualquier alta, edición o borrado que deje una cuenta fuera de la regla, y `storage.validateState` lo vuelve a comprobar antes de guardar.
2. **Persistencia obligatoria:** `dispatch` siempre termina en `storage.saveState(state)`.
3. **Validación estricta:** ninguna acción muta el estado si `validations.*` devuelve errores.

## 3. Reglas de negocio y función responsable

| Regla | Fórmula | Función |
|---|---|---|
| RN-01 | `saldo = initialBalance + ingresos + transf. entrantes − gastos − transf. salientes` | `calc.accountBalance`, `calc.creditDebt`, `calc.availableFunds` |
| RN-02 | `Patrimonio = Σ saldos` | `calc.netWorth` |
| RN-03 | **En todo momento** (orden cronológico): líquida ≥ 0 · crédito: `0 ≥ saldo ≥ −creditLimit` | `calc.timeline`, `calc.availableFunds(…, date)`, `calc.paymentRoom`, `calc.accountViolations`; usado por `validate.validateTransaction/TransactionDelete/Account` y `storage.validateState` |
| RN-04 | Validaciones de borde | `validate.parseAmount`, `validate.validateTransaction/Account/Category` |
| RN-05 | `neto = ingresos − gastos`; `ahorro = neto / ingresos × 100` | `calc.monthSummary` |
| RN-06 | `% = gastado / presupuesto × 100` → `ok` ≤ 80 · `warning` ≤ 100 · `exceeded` > 100 | `calc.budgetStatus`, `calc.statusFromPercent` |
| RN-07 | `Neto del día = Σ ingresos − Σ gastos` | `calc.dayNet`, `calc.groupByDate` |
| RN-08 | Duplicado: tipo, cuenta, monto, fecha, descripción normalizada | `calc.findDuplicate` |
| RN-09 | `Disponible = Σ efectivo + débito`; `Ahorros = Σ ahorros`; `Deudas = Σ deudas`; `Patrimonio = Disponible + Ahorros − Deudas` | `calc.balanceSummary` |
| RN-10 | Último corte = fecha más reciente con `cutoffDay` < hoy; pago = primera fecha con `paymentDay` posterior; `pago del periodo = deuda al corte − pagos posteriores` (≥ 0) | `calc.creditCycle`, `calc.paymentAlerts` |
| RN-11 | `% total = (gastos del mes + apartado a ahorros, RN-13) / settings.monthlyBudget × 100` (mismos umbrales que RN-06); por día: `restante / días restantes del mes` | `calc.totalBudgetStatus`, `calc.remainingDays`, `calc.categoryBudgetsSum` |
| RN-12 | Programación → ocurrencias por frecuencia (una vez · mismo día cada mes o último · días 15 y último). Ocurrencia **abierta** = ni aplicada (movimiento con `scheduleId` + `occurrenceDate`) ni omitida; **programada** si fecha > hoy, **pendiente** si fecha ≤ hoy. Resumen y presupuestos del mes incluyen las abiertas; saldo actual, patrimonio y deudas solo movimientos reales; proyección a fin de mes = reales + abiertas | `calc.scheduleOccurrences`, `openOccurrences`, `dueOccurrences`, `upcomingOccurrences`, `monthItems`, `projectedState`, `projectedBalance`, `projectionAlerts` |
| RN-13 | **Apartado a ahorros** del mes = Σ transferencias del mes hacia cuentas `ahorros` − Σ transferencias del mes desde `ahorros` hacia cuentas de otro tipo, mínimo 0, incluyendo ocurrencias abiertas. **Consumido del presupuesto total** = gastos del mes + apartado. Una transferencia entre dos cuentas de ahorros no cuenta. **Meta**: progreso = saldo actual / meta; aporte mensual = Σ equivalente mensual de programaciones activas que transfieren a la cuenta; meses estimados = ⌈falta / aporte⌉ | `calc.savingsSetAside`, `calc.totalBudgetStatus`, `calc.goalProgress` |

**Ejemplo verificable** (datos de [`../tests/datos-ejemplo.json`](../tests/datos-ejemplo.json), octubre 2026, hoy = 26 oct): Efectivo en orden cronológico `25,000 − 15,000 + 40,000 − 18,000 + 35,000 − 31,200 − 4,500 = ₡31,300` (nunca negativo); Visa `−68,500 − 27,500 + 60,000 = −₡36,000` → disponible `₡264,000`; corte 15 oct: deuda `₡96,000` − pago `₡60,000` = **pago del periodo `₡36,000`** el 28 oct (2 días); Disponible `₡392,400` + Ahorros `₡250,000` − Deudas `₡36,000` = Patrimonio `₡606,400`; Alimentación `99,700 / 120,000 = 83.08 %` → "83 %", Ámbar; total `438,600 / 450,000 = 97.47 %` → Ámbar.

## 4. Arquitectura de componentes de la interfaz (según el wireframe)

Cada componente es una función de `ui.js` que lee `(state, ui)` y devuelve nodos DOM. Los componentes no mutan nada: emiten acciones con atributos `data-action`, `data-submit` o `data-form` + `data-field`, que `app.js` captura por delegación de eventos.

```mermaid
graph TD
  App[AppShell] --> H[AppHeader · Patrimonio]
  App --> T[NavTabs]
  App --> N[StorageNotice]
  App --> TO[Toast]
  App --> DLG[Dialog: confirmación / duplicado / reasignación / archivo]
  App --> FAB[QuickAddButton] --> QA[QuickAdd: registro rápido]
  QA --> TFS[TransactionFields]
  T --> V1[SummaryView]
  T --> V2[TransactionsView · Gastos e ingresos]
  T --> V5[BudgetsView · Presupuestos]
  T --> V3[AccountsView]
  T --> V4[CategoriesView]
  V1 --> MS[MonthSelector]
  V1 --> PA[PaymentAlerts]
  V1 --> SC[SummaryCards]
  V1 --> AO[AccountsOverview]
  AO --> BB[BalanceBreakdown]
  AO --> AB[AccountBalance]
  V1 --> TB[TotalBudgetCard]
  V5 --> MS
  V5 --> TB
  TB --> SF[SettingsForm]
  V5 --> BL[BudgetList]
  BL --> BR[BudgetRow + PerDay]
  V2 --> MS
  V2 --> TF[TransactionForm]
  TF --> TFS
  V2 --> TL[TransactionList]
  TL --> FI[Filters]
  TL --> TR[TransactionRow agrupado por día]
  V3 --> AF[AccountForm]
  V3 --> AC[AccountCards: activas + Archivadas]
  AC --> CARD[AccountCard]
  V3 -.al abrir una cuenta.-> AD[AccountDetail: saldo después de cada movimiento]
  V4 --> CF[CategoryForm]
  V4 --> CT[CategoryTable x2]
  V1 -.sin cuentas.-> NA[NoAccounts]
  V2 -.sin cuentas.-> NA
```

| Componente | Responsabilidad | Lee | Emite | REQ |
|---|---|---|---|---|
| `AppHeader` | Marca y Patrimonio | `calc.netWorth` | — | 007 |
| `NavTabs` | Resumen, Gastos e ingresos, Presupuestos, Cuentas, Categorías | `ui.activeTab` | `SET_TAB` | — |
| `StorageNotice` | Datos dañados o fallo al guardar | `ui.notice` | `DISMISS_NOTICE` | 053, 054 |
| `Toast` | Confirmaciones y alerta de presupuesto superado | `ui.toast` | `DISMISS_TOAST` | 044 |
| `MonthSelector` | Mes anterior / siguiente | `ui.month` | `PREV_MONTH`, `NEXT_MONTH` | 038 |
| `SummaryCards` | Ingresos, gastos, balance neto, tasa de ahorro | `calc.monthSummary` | — | 039, 040, 046 |
| `AccountsOverview` / `AccountBalance` | Saldo; deuda y crédito disponible | `calc.accountBalance/creditDebt/availableFunds` | — | 006, 007 |
| `BudgetList` / `BudgetRow` | Pestaña Presupuestos: gastado / presupuesto, barra, % y estado con texto | `calc.budgetStatus` | — | 041, 043, 045, 057 |
| `NoAccounts` | Mensaje "Primero cree una cuenta" | `state.accounts` | `SET_TAB` | 021 |
| `TransactionForm` | Tipo, fecha, monto, descripción, cuenta, categoría o cuenta destino; fondos disponibles; errores en vivo | `ui.forms.transaction`, `ui.errors` | `INPUT`, `SUBMIT`, `CANCEL_EDIT` | 020, 022–034, 055 |
| `Filters` | Filtrar por cuenta y categoría | `ui.filters` | `SET_FILTER` | 036 |
| `TransactionList` / `TransactionRow` | Agrupado por fecha con Neto del Día; ✎ y 🗑 | `calc.filterTransactions`, `calc.groupByDate` | `EDIT_TRANSACTION`, `DELETE_TRANSACTION` | 035–037, 046, 056 |
| `AccountForm` | Alta y edición (4 tipos; límite, día de corte y de pago en crédito); tipo bloqueado con movimientos | `ui.forms.account` | `SUBMIT`, `EDIT_ACCOUNT`, `DELETE_ACCOUNT` | 001–011 |
| `CategoryForm` / `CategoryTable` | Alta y edición; presupuesto solo en gasto; sistema sin 🗑 | `ui.forms.category` | `SUBMIT`, `EDIT_CATEGORY`, `DELETE_CATEGORY` | 012–019 |
| `Dialog` | Confirmaciones, duplicado, reasignación y archivo | `ui.dialog` | `CONFIRM`, `CANCEL`, `REASSIGN_INPUT` | 011, 017, 018, 033, 035, 063 |
| `QuickAddButton` / `QuickAdd` | Botón "+ Registrar" en todas las pestañas y ventana de registro rápido (monto, categoría, descripción; fecha y cuenta precargadas) | `ui.quickOpen`, `ui.forms.quick`, `calc.lastUsedAccountId` | `OPEN_QUICK`, `CLOSE_QUICK`, `SUBMIT` | 067, 068 |
| `UpcomingScheduled` / `PendingOccurrences` / `ProjectionAlerts` | Próximos 7 días según el mes, corribles de 7 en 7 (REQ-096); pendientes con ✓ Confirmar · ✎ Ajustar · ⏭ Omitir; aviso de proyección negativa | `calc.upcomingOccurrences`, `calc.dueOccurrences`, `calc.projectionAlerts` | `CONFIRM_OCCURRENCE`, `ADJUST_OCCURRENCE`, `SKIP_OCCURRENCE`, `EDIT_SCHEDULE` | 083, 084, 087, 096 |
| `ScheduleFields` / `schedulePreview` / `scheduledBadge` / `occurrenceRow` / `SchedulesList` | Casilla "🗓 Programar" con frecuencia, hasta y modo; vista previa de fechas y equivalente mensual; etiquetas "Programado" / "Pendiente"; lista de programaciones | `ui.forms[form].draft.scheduled`, `calc.scheduleOccurrences`, `calc.nextOccurrence`, `calc.monthlyEquivalent` | `INPUT`, `SUBMIT`, `EDIT_SCHEDULE`, `DELETE_SCHEDULE` | 079–081, 085, 089 |
| `TransactionFields` | Campos compartidos por el formulario completo y el registro rápido; solo cuentas activas | `ui.forms[form]` | `INPUT` | 020–033, 058, 064 |
| `PaymentAlerts` | "El pago de <tarjeta> vence en N días" / "Pago vencido" | `calc.paymentAlerts` | `OPEN_ACCOUNT` | 062 |
| `BalanceBreakdown` | Disponible para gastar, Ahorros, Deudas y Patrimonio | `calc.balanceSummary` | — | 059 |
| `TotalBudgetCard` / `SettingsForm` | Presupuesto total del mes, estado, por día y advertencia de suma de categorías; formulario del total | `calc.totalBudgetStatus`, `calc.categoryBudgetsSum` | `SUBMIT` (settings) | 070, 071 |
| `BudgetsView` / `PerDay` | Pestaña Presupuestos; "Le quedan ₡X para N días" o "Mes cerrado" | `calc.remainingDays` | — | 069 |
| `AccountCards` / `AccountCard` | Tarjetas visuales por tipo; activas y sección Archivadas; ciclo de la tarjeta | `calc.creditCycle` | `EDIT_ACCOUNT`, `ARCHIVE_ACCOUNT`, `UNARCHIVE_ACCOUNT`, `DELETE_ACCOUNT`, `OPEN_ACCOUNT` | 061, 063–066 |
| `AccountDetail` | Movimientos de una cuenta con el saldo después de cada uno | `calc.runningBalances` | `CLOSE_ACCOUNT`, `EDIT_TRANSACTION`, `DELETE_TRANSACTION` | 066 |
| `BackupCard` | Exportar datos (descarga un `.json`) e Importar datos (elige un archivo) en la pestaña Cuentas | `state` | `EXPORT_DATA`, `IMPORT_FILE` → `IMPORT_STATE` | 097, 098 |
| `Filters` (búsqueda) | Campo «Buscar en la descripción» junto a los filtros de cuenta y categoría | `ui.filters.text` | `SET_FILTER` | 099 |
| `SummaryCards` (comparación) | Debajo de «Gastos del mes»: ▲/▼ N % frente al mes anterior | `calc.monthComparison` | — | 100 |
| `TopCategories` | «¿En qué se va la plata?»: hasta 3 categorías con su monto, % y barra | `calc.topCategories` | — | 101 |
| `FirstSteps` | «Primeros pasos» con ✓ / pendiente y botón al siguiente paso | `calc.firstSteps` | `SET_TAB` | 102 |

## 5. Estructura de módulos y manejo de estado

### 5.1. Archivos y orden de carga

```text
src/
├── index.html          ← punto de entrada; CSP; carga los scripts en este orden ↓
├── css/styles.css      ← CSS puro (tema claro/oscuro, estados ok/warning/exceeded)
└── js/
    ├── calculations.js ← FinanzApp.calc      (puro: fechas, dinero, RN-01..RN-08)
    ├── validations.js  ← FinanzApp.validate  (puro: errores por campo)
    ├── storage.js      ← FinanzApp.storage   (emptyState, validateState, loadState, saveState)
    ├── ui.js           ← FinanzApp.ui        (componentes + helper el() + updateForm)
    └── app.js          ← FinanzApp.app       (state, ui, dispatch, DOMAIN, UI_ACTIONS, eventos, init)
```

```mermaid
graph LR
  app[app.js] --> validate[validations.js]
  app --> calc[calculations.js]
  app --> storage[storage.js]
  app --> ui[ui.js]
  ui --> calc
  ui --> validate
  validate --> calc
  storage --> calc
```

Regla de dependencias: `calculations.js` no depende de nada, y solo `app.js` toca `state`.

### 5.2. Estado global en memoria vs. LocalStorage

| | `state` (dominio) | `ui` (interfaz) | `localStorage['finanzapp.state']` |
|---|---|---|---|
| Contenido | `schemaVersion, accounts, categories, transactions, schedules, settings` | `activeTab, month, filters, forms, errors, dialog, notice, toast, quickOpen, selectedAccountId, upcomingFrom` | Copia JSON exacta de `state` |
| Forma | `data-contract.json` | Libre (no se persiste) | `data-contract.json` |
| Quién lo cambia | Solo los reducers de `app.js` vía `dispatch` | `app.js` (acciones de interfaz) | Solo `storage.saveState` |
| Valores derivados | **Nunca** se guardan | — | Nunca |
| Ciclo de vida | Se carga al iniciar (REQ-052) | `month` = mes actual al abrir (REQ-038) | Se sobrescribe en cada mutación (REQ-051) |

### 5.3. API de cada módulo

**`calculations.js` (puro, sin DOM):**
`parseISODate(s)`, `isValidISODate(s)`, `todayISO(now?)`, `monthOf(iso)`, `currentMonth(now?)`, `isValidMonth(ym)`, `addMonths(ym, n)`, `monthLabel(ym)`, `toCents(n)`, `fromCents(c)`, `sumAmounts(list)`, `hasMax2Decimals(n)`, `roundMoney(n)`, `formatMoney(n, {sign})`, `formatPercent(p)`, `getAccount(state, id)`, `getCategory(state, id)`, `daysInMonth(ym)`, `daysBetween(a, b)`, `remainingDays(ym, today)`, `isLiquid(account)`, `isSavings(account)`, `isCredit(account)`, `activeAccounts(state)`, `normalize(s)`, `accountBalance(state, id, excludeTxId?)`, `creditDebt(state, id, excludeTxId?)`, `timeline(state, id, excludeTxId?)` (interna), `availableFunds(state, id, excludeTxId?, date?)`, `paymentRoom(state, id, excludeTxId?, date?)`, `balanceSummary(state)`, `creditCycle(state, id, today)`, `paymentAlerts(state, today)`, `runningBalances(state, id)`, `lastUsedAccountId(state)`, `totalBudgetStatus(state, ym)`, `categoryBudgetsSum(state)`, `getSchedule`, `scheduleOccurrences(sch, from, to)`, `isOccurrenceApplied`, `isOccurrenceDone`, `occurrenceToTx`, `openOccurrences(state, from, to, today)`, `dueOccurrences(state, today)`, `upcomingOccurrences(state, today, days)`, `nextOccurrence(state, sch, today)`, `monthlyEquivalent(sch)`, `endOfMonth(iso)`, `projectedState`, `projectedBalance`, `hasOpenThisMonth`, `schedulesUsingAccount`, `projectionAlerts`, `monthItems(state, ym, today)`, `categoryScheduleCount`, `netWorth(state)`, `accountViolations(state)`, `accountMovementCount(state, id)`, `categoryMovementCount(state, id)`, `sortTransactions(list)`, `monthTransactions(state, ym)`, `monthSummary(state, ym)`, `categorySpent(state, catId, ym)`, `statusFromPercent(p)`, `budgetStatus(state, catId, ym)`, `dayNet(list)`, `groupByDate(list)`, `filterTransactions(state, ym, filters, today)` (filtros `accountId`, `categoryId`, `text`), `findDuplicate(state, tx, excludeTxId?)`, `monthComparison(state, ym, today)`, `topCategories(state, ym, n, today)`, `firstSteps(state)`.

**`validations.js` (puro; devuelve `{ campo: 'mensaje' }`, vacío = válido; `_form` = error general):**
`isBlank(v)`, `hasErrors(e)`, `parseAmount(raw, {label, allowZero, optional})`, `draftToAccount(d, base)`, `draftToTransaction(d, base)`, `parseDay(raw, label)`, `validateMovementFields(d, state, original)`, `draftToSchedule(d, base)`, `validateSchedule(d, state, originalId, today)`, `validateSkip(scheduleId, date, state)`, `pastOccurrences(state, sch, today)`, `validateAccount(d, state, originalId)`, `validateAccountDelete(id, state)`, `validateArchive(id, state)`, `validateSettings(d)`, `validateCategory(d, state, originalId)`, `validateCategoryDelete(id, state)`, `validateReassign(d, id, state)`, `validateTransaction(d, state, originalId, today?)`, `validateTransactionDelete(id, state)`.

**`storage.js`:**
`STORAGE_KEY = 'finanzapp.state'`, `SCHEMA_VERSION = 3`, `emptyState()`, `migrate(obj, today)` (v1 → v2 → v3, REQ-072, REQ-090), `validateState(obj)` → `{ valid, errors[] }` (contrato + reglas de §6), `loadState()` → `{ state, notice, migrated }`, `saveState(state)` → `true | error`, `parseBackup(text)` → `{ state }` o `{ error }` (migra y valida un respaldo, REQ-098), `backupFileName(today)`.

**`ui.js`:** `el(tag, props, ...children)`, `mount(root)`, `render(state, ui)`, `updateForm(form, ui)`.

**`app.js`:** `state`, `ui`, `dispatch(action)`, tabla `DOMAIN` (por acción: `form`, `validate`, `confirm?`, `reduce`, `after`), tabla `UI_ACTIONS`, `validateForm(name)`, `submit(name)`, `confirmDialog()`, `persist()`, `bindEvents(root)`, `init()`. Expone `FinanzApp.app.state` (copia de solo lectura) para verificar desde la consola.

### 5.4. Ciclo `dispatch` (el único camino para mutar)

```mermaid
flowchart TD
  E[Evento del usuario] --> D{"dispatch(action)"}
  D -->|acción de UI<br/>SET_TAB, PREV_MONTH, INPUT…| U[Actualiza ui<br/>+ validación en vivo]
  D -->|acción de dominio| V["validations.*(draft, state)"]
  V -->|errores| ER[ui.errors = errores<br/>estado SIN cambios · REQ-055]
  V -->|válido| C{¿Requiere confirmación?<br/>REQ-011/017/018/033/035}
  C -->|sí, sin confirmar| DLG[ui.dialog]
  C -->|no o confirmado| R[reducer sobre una COPIA]
  R --> K{"storage.validateState(copia)"}
  K -->|inválido| X[Se descarta + aviso]
  K -->|válido| S["state = copia<br/>storage.saveState · REQ-051/054"]
  S --> RN["ui.render · calc.* recalcula"]
  U --> RN
  ER --> RN
  DLG --> RN
  X --> RN
```

**Acciones de dominio:** `ADD_SCHEDULE`, `UPDATE_SCHEDULE`, `DELETE_SCHEDULE`, `CONFIRM_OCCURRENCE`, `SKIP_OCCURRENCE`, `PROCESS_SCHEDULES`, `IMPORT_STATE`, `ADD_ACCOUNT`, `UPDATE_ACCOUNT`, `DELETE_ACCOUNT`, `ARCHIVE_ACCOUNT`, `UNARCHIVE_ACCOUNT`, `SAVE_SETTINGS`, `ADD_CATEGORY`, `UPDATE_CATEGORY`, `DELETE_CATEGORY`, `ADD_TRANSACTION`, `UPDATE_TRANSACTION`, `DELETE_TRANSACTION`.

### 5.5. Secuencias clave

**Registrar un gasto (fondos y presupuesto):**

```mermaid
sequenceDiagram
  actor U as Usuario
  participant F as TransactionForm (ui.js)
  participant A as app.js
  participant V as validations.js
  participant C as calculations.js
  participant S as storage.js
  U->>F: Efectivo, Monto = 50000
  F->>A: dispatch(INPUT)
  A->>V: validateTransaction(draft, state)
  V->>C: availableFunds(state, 'acc-efectivo') = 31300
  V-->>A: {amount: 'Saldo insuficiente: disponible ₡31,300.00.'}
  A->>F: updateForm: error en rojo, Guardar deshabilitado
  U->>F: Visa · Entretenimiento · 5000 → Guardar
  F->>A: dispatch(SUBMIT) → ADD_TRANSACTION
  A->>V: validateTransaction → {} (crédito disponible 264000)
  A->>C: findDuplicate → null (sin confirmación)
  A->>A: reducer sobre copia + validateState
  A->>S: saveState(state)
  A->>C: budgetStatus(Entretenimiento, 2026-10) → 108 %, exceeded
  A->>F: render + Toast "Superó el presupuesto de Entretenimiento (108 %)"
```

**Eliminar una categoría con movimientos (reasignación):**

```mermaid
sequenceDiagram
  actor U as Usuario
  participant A as app.js
  participant V as validations.js
  U->>A: DELETE_CATEGORY(cat-transporte)
  A->>V: validateCategoryDelete → {} (no es del sistema)
  A->>U: Dialog reasignación (solo categorías de gasto)
  U->>A: CONFIRM con targetId = cat-otros-gastos
  A->>V: validateReassign → {}
  A->>A: reducer: movimientos → cat-otros-gastos, elimina la categoría
  A->>A: validateState + saveState + render
```

**Arranque y estado corrupto (REQ-052/053):**

```mermaid
sequenceDiagram
  participant A as app.init()
  participant S as storage.js
  A->>S: loadState()
  alt no hay datos
    S-->>A: emptyState() (categorías predeterminadas)
  else JSON inválido o fuera de contrato / regla de fondos
    S-->>A: emptyState() + notice "datos dañados"
  else válido
    S-->>A: state restaurado
  end
  A->>A: ui.month = calc.currentMonth()
  A->>A: render
```

## 6. Reglas del estado que valida el código

El contrato define la **forma** de cada entidad. Estas reglas entre campos no se expresan en el JSON Schema y las valida
`storage.validateState` al iniciar y antes de guardar (además de `validations.js` en cada formulario):

| Regla | REQ |
|---|---|
| Cuenta de crédito: `creditLimit` (y `cutoffDay` con `paymentDay`, juntos), sin `initialBalance`. Cuenta líquida: `initialBalance`, sin campos de crédito | 001, 060 |
| `goalAmount` y `goalReason` solo en cuentas de ahorros; `goalReason` requiere `goalAmount` | 093 |
| `monthlyBudget` solo en categorías de gasto | 015 |
| Existen las categorías del sistema `cat-otros-gastos` (gasto) y `cat-otros-ingresos` (ingreso), y solo ellas tienen `system = true` | 012, 016 |
| Transferencia: `toAccountId` distinto de `accountId` y sin `categoryId`. Ingreso y gasto: `categoryId` del mismo tipo y sin `toAccountId` (igual en programaciones) | 028, 029 |
| `accountId`, `toAccountId`, `categoryId` y `scheduleId` existen; los `id` y los nombres (normalizados) de cuentas y categorías no se repiten | 003, 014 |
| `scheduleId` y `occurrenceDate` van juntos, y cada par aparece en un solo movimiento | 082, 086 |
| Una programación `once` no tiene `endDate`; si hay `endDate`, no es anterior a `startDate` | 079 |
| Ninguna cuenta líquida con saldo negativo ni tarjeta con deuda mayor a su límite o saldo positivo, en ninguna fecha | RN-03 |
| Ningún ingreso en una cuenta de crédito ni gasto desde una cuenta de ahorros | 032, 058 |
| Fechas de calendario válidas (`calc.isValidISODate`) | 026 |

## 7. Mapeo explícito de requerimientos → diseño

| REQ | Resumen | UI | Lógica |
|---|---|---|---|
| 001 | Crear cuenta | `AccountForm` | `DOMAIN.ADD_ACCOUNT`, `validate.draftToAccount` |
| 002 | Nombre vacío | `AccountForm` | `validate.validateAccount` |
| 003 | Nombre duplicado | `AccountForm` | `validate.validateAccount` (`calc.normalize`) |
| 004 | Saldo inicial inválido | `AccountForm` | `validate.parseAmount({allowZero})` |
| 005 | Límite inválido | `AccountForm` | `validate.parseAmount` |
| 006 | Saldo, deuda y disponible | `AccountBalance` | `calc.accountBalance/creditDebt/availableFunds` |
| 007 | Patrimonio | `AppHeader`, `AccountsOverview` | `calc.netWorth` |
| 008 | Tipo bloqueado con movimientos | `AccountForm` (deshabilitado) | `validate.validateAccount` |
| 009 | Saldo inicial / límite mínimo | `AccountForm` | `validate.validateAccount` + `calc.accountViolations` |
| 010 | No eliminar cuenta con movimientos | `Toast` | `validate.validateAccountDelete` |
| 011 | Confirmar eliminar cuenta vacía | `Dialog` | `DOMAIN.DELETE_ACCOUNT.confirm` |
| 012 | Categorías predeterminadas | `CategoryTable` | `storage.emptyState` |
| 013 | Crear categoría | `CategoryForm` | `DOMAIN.ADD_CATEGORY` |
| 014 | Nombre vacío o duplicado | `CategoryForm` | `validate.validateCategory` |
| 015 | Presupuesto inválido / solo gasto | `CategoryForm` | `validate.validateCategory`, `buildCategory` |
| 016 | Categorías del sistema protegidas | `CategoryTable` (sin 🗑), `CategoryForm` | `validate.validateCategoryDelete`, `validateCategory` |
| 017 | Reasignar al eliminar | `Dialog` (reasignación) | `validate.validateReassign`, `DOMAIN.DELETE_CATEGORY.reduce` |
| 018 | Confirmar eliminar categoría vacía | `Dialog` | `DOMAIN.DELETE_CATEGORY.confirm` |
| 019 | Tipo bloqueado con movimientos | `CategoryForm` | `validate.validateCategory` |
| 020 | Registrar movimiento | `TransactionForm` | `DOMAIN.ADD_TRANSACTION`, `validate.draftToTransaction` |
| 021 | Sin cuentas | `NoAccounts` | `validateTransaction` (`_form`) |
| 022 | Monto ≤ 0 | `TransactionForm` | `validate.parseAmount` |
| 023 | Monto vacío / no numérico | `TransactionForm` | `validate.parseAmount` |
| 024 | Más de 2 decimales | `TransactionForm` | `calc.hasMax2Decimals` |
| 025 | Descripción vacía / > 80 | `TransactionForm` | `validate.validateTransaction` |
| 026 | Fecha inválida | `TransactionForm` | `calc.isValidISODate` |
| 027 | Fecha futura solo con "Programar" | `TransactionFields` (`max` = hoy sin programar) | `validate.validateTransaction` |
| 028 | Categoría obligatoria y del mismo tipo | `TransactionForm` (selector filtrado) | `validate.validateTransaction` |
| 029 | Transferencia: destino distinto, sin categoría | `TransactionForm` | `validate.validateTransaction`, `draftToTransaction` |
| 030 | Saldo insuficiente | `TransactionForm` (+ "Saldo disponible") | `calc.availableFunds` |
| 031 | Excede crédito | `TransactionForm` | `calc.availableFunds` |
| 032 | Pago > deuda; ingreso en crédito | `TransactionForm` | `calc.creditDebt`, `calc.isLiquid` |
| 033 | Duplicado con confirmación | `Dialog` | `calc.findDuplicate`, `DOMAIN.ADD_TRANSACTION.confirm` |
| 034 | Editar movimiento | `TransactionRow` ✎ → `TransactionForm` | `validateTransaction(…, originalId)`, `DOMAIN.UPDATE_TRANSACTION` |
| 035 | Eliminar movimiento | `TransactionRow` 🗑 → `Dialog` | `validate.validateTransactionDelete` |
| 036 | Lista por mes, neto del día, filtros | `TransactionList`, `Filters` | `calc.filterTransactions`, `calc.groupByDate` |
| 037 | Orden | `TransactionList` | `calc.sortTransactions` |
| 038 | Mes actual y navegación | `MonthSelector` | `calc.currentMonth`, `calc.addMonths` |
| 039 | Ingresos, gastos, neto | `SummaryCards` | `calc.monthSummary` |
| 040 | Tasa de ahorro / "—" | `SummaryCards` | `calc.monthSummary().savingsRate` |
| 041 | Estado de presupuesto | `BudgetRow` | `calc.budgetStatus` |
| 042 | No bloquear por presupuesto | — | `validateTransaction` **no** consulta presupuestos |
| 043 | Sin presupuesto | `BudgetRow` | `calc.budgetStatus` → `status: null` |
| 044 | Aviso al pasar a Rojo | `Toast` | `budgetToast` en `app.js` |
| 045 | Formato y redondeo | todos los montos | `calc.formatMoney`, `calc.formatPercent` |
| 046 | Negativos con signo y alerta | `SummaryCards`, `TransactionList` | clases `is-negative` |
| 047 | Sin red | `index.html` (CSP) | sin `fetch`/XHR (D6) |
| 048 | Sin borrados colaterales | — | reducers de alcance mínimo; solo `IMPORT_STATE` reemplaza todo, con confirmación |
| 049 | Saldo no editable | `AccountForm` (sin campo saldo) | saldo derivado (RN-01) |
| 050 | Sin movimientos automáticos salvo el auto-débito | — | solo `processSchedules` crea movimientos, desde programaciones |
| 051 | Guardar en cada cambio | — | `persist()` al final de `dispatch` |
| 052 | Restaurar al iniciar | — | `storage.loadState` en `init` |
| 053 | Estado corrupto | `StorageNotice` | `storage.validateState`, `storage.emptyState` |
| 054 | Fallo al guardar | `StorageNotice` | `storage.saveState` → error; reintento en `persist()` |
| 055 | Errores en vivo, Guardar deshabilitado, sin cambios al rechazar | todos los formularios | `ui.updateForm`, `validateForm` |
| 056 | Texto literal | todos | `el()` + `textContent` (D5) |
| 057 | Color + texto | `BudgetRow`, `SummaryCards`, `AppHeader` | `STATUS_TEXT` |
| 058 | Sin gastos desde ahorros | `TransactionFields` | `validate.validateTransaction` (`calc.isSavings`) |
| 059 | Disponible, ahorros y deudas | `BalanceBreakdown` | `calc.balanceSummary` |
| 060 | Día de corte y de pago 1–28 | `AccountForm` | `validate.parseDay` |
| 061 | Corte, fecha de pago, pago del periodo | `AccountCard` | `calc.creditCycle` |
| 062 | Aviso de pago próximo o vencido | `PaymentAlerts` | `calc.paymentAlerts` |
| 063 | Archivar solo con saldo 0 | `AccountCard` 🗄 → `Dialog` | `validate.validateArchive`, `DOMAIN.ARCHIVE_ACCOUNT` |
| 064 | Archivadas ocultas y no usables | `AccountCards` (sección), `accountOptions` | `validate.validateTransaction`, `calc.activeAccounts` |
| 065 | Reactivar | `AccountCard` ↺ | `DOMAIN.UNARCHIVE_ACCOUNT` |
| 066 | Tarjetas visuales y detalle con saldo después | `AccountCard`, `AccountDetail` | `calc.runningBalances` |
| 067 | Registro rápido | `QuickAddButton`, `QuickAdd` | `defaultDraft('quick')`, `calc.lastUsedAccountId`, `DOMAIN.ADD_TRANSACTION` (`source: 'quick'`) |
| 068 | Cancelar sin cambios | `QuickAdd` (Cancelar / Escape) | `UI_ACTIONS.CLOSE_QUICK` |
| 069 | Pestaña Presupuestos y por día | `BudgetsView`, `PerDay` | `calc.remainingDays` |
| 070 | Presupuesto total mensual | `TotalBudgetCard`, `SettingsForm` | `validate.validateSettings`, `calc.totalBudgetStatus`, `budgetToast` |
| 071 | Advertencia suma de categorías | `TotalBudgetCard` | `calc.categoryBudgetsSum` |
| 072 | Migración de la versión 1 | — | `storage.migrate`, `persist()` en `init` |
| 079 | Casilla Programar y validación | `ScheduleFields` | `validate.validateSchedule`, `validate.validateMovementFields`, `DOMAIN.ADD_SCHEDULE` |
| 080 | Ocurrencias y vista previa | `schedulePreview` | `calc.scheduleOccurrences`, `calc.monthlyEquivalent` |
| 081 | Proyección del mes | `TransactionList` (`occurrenceRow`), `SummaryCards`, `BudgetRow` | `calc.monthItems`, `calc.monthSummary`, `calc.categorySpent`, `calc.filterTransactions` |
| 082 | Auto-débito | `Toast` | `processSchedules`, `DOMAIN.PROCESS_SCHEDULES`, `calc.dueOccurrences` |
| 083 | Pendientes: confirmar, ajustar, omitir | `PendingOccurrences` | `DOMAIN.CONFIRM_OCCURRENCE`, `UI_ACTIONS.ADJUST_OCCURRENCE`, `ADD_TRANSACTION` con `link` |
| 084 | Omitir esta vez | `occurrenceActions` ⏭ | `validate.validateSkip`, `DOMAIN.SKIP_OCCURRENCE` |
| 085 | Editar / eliminar programación | `SchedulesList` ✎ 🗑 | `DOMAIN.UPDATE_SCHEDULE`, `DOMAIN.DELETE_SCHEDULE` |
| 086 | Borrar movimiento programado no lo recrea | — | `DOMAIN.DELETE_TRANSACTION` (agrega a `skippedDates`) |
| 087 | Aviso de proyección | `ProjectionAlerts` | `calc.projectionAlerts` |
| 088 | Proyectado a fin de mes | `AccountBalance`, `AccountCard`, `BalanceBreakdown` | `calc.projectedBalance`, `calc.hasOpenThisMonth`, `calc.balanceSummary` |
| 089 | Lista de programaciones; cuentas en uso | `SchedulesList` | `calc.schedulesUsingAccount`, `validate.validateArchive`, `validate.validateAccountDelete` |
| 090 | Migración de la versión 2 | — | `storage.migrate` (`migrateV2`) |
| 091 | Programación que empezó antes de hoy | `PastOccurrences` (Registrarlos ahora · Ya los registré) | `validate.pastOccurrences`, `validate.validateSchedule` (fondos al registrar), `resolvePast` en `ADD_SCHEDULE` / `UPDATE_SCHEDULE` |
| 092 | Apartado a ahorros en el presupuesto total | `TotalBudgetCard` (barra de dos tramos) | `calc.savingsSetAside`, `calc.totalBudgetStatus` |
| 093 | Meta y razón en cuentas de ahorros | `AccountForm` | `validate.validateAccount`, `validate.draftToAccount`, `storage.checkAccount` |
| 094 | Progreso, aportes y fecha estimada de la meta | `GoalProgress` en `AccountCard`, `AccountDetail` y `SavingsGoals` (Presupuestos) | `calc.goalProgress`, `calc.monthlyEquivalent` |
| 095 | Meta alcanzada | `GoalProgress`, `Toast` | `calc.goalProgress`, `goalToast` |
| 096 | Próximos programados por mes y semana | `UpcomingScheduled` (◀ 7 días antes · 7 días después ▶) | `calc.upcomingStart`, `calc.openOccurrences`, `UI_ACTIONS.SET_UPCOMING`, `PREV_MONTH`/`NEXT_MONTH` |

| 097 | Exportar datos | `BackupCard` | `exportData` en `app.js`, `storage.backupFileName` |
| 098 | Importar datos | `BackupCard` → `Dialog` | `storage.parseBackup`, `DOMAIN.IMPORT_STATE` |
| 099 | Buscar por descripción | `Filters` | `calc.filterTransactions` (`filters.text`) |
| 100 | Comparación con el mes anterior | `SummaryCards` | `calc.monthComparison` |
| 101 | Categorías con más gasto | `TopCategories` | `calc.topCategories` |
| 102 | Primeros pasos | `FirstSteps` | `calc.firstSteps` |

**Cobertura:** 96 de 96 requerimientos vigentes tienen componente y/o función asignados.

## 8. Diseño visual (CSS)

- **Paleta en `:root`** con tema claro y oscuro automático (`prefers-color-scheme`): verde azulado como color de marca, ámbar dorado de acento (el logo 💰) y estados `--ok`, `--warning`, `--exceeded`.
- **Tarjetas** con borde suave y sombra ligera; cifras con `font-variant-numeric: tabular-nums` para que los montos se alineen.
- **Estados:** las clases `is-ok` / `is-warning` / `is-exceeded` colorean barras y etiquetas, y **siempre** van con texto ("En orden", "Precaución", "Excedido") (REQ-057).
- **Efectos discretos:** aparición de la vista, barras que se llenan, campo con error que tiembla, aviso que se desliza. Todos se desactivan con `prefers-reduced-motion`.
- **Layout:** formulario a la izquierda (fijo al hacer scroll) y lista a la derecha en escritorio; una columna en móvil (sin scroll horizontal a 375 px).

## 9. Puesta en producción ("app viva")

1. GitHub → *Settings → Pages* → *Deploy from a branch* → `main` / `(root)`.
2. La app queda en `https://<usuario>.github.io/<repositorio>/src/`.

GitHub Pages solo **sirve** los archivos estáticos. Los datos siguen en el `localStorage` de cada navegador y nunca salen del dispositivo, así que se mantiene REQ-047.
