# CLAUDE.md — Memoria Semántica del Proyecto

> Este archivo es la memoria permanente y el **archivo de reglas de contexto** del proyecto
> para cualquier IA o desarrollador. [`.cursorrules`](.cursorrules) remite aquí.
> Contiene las reglas del negocio, el lenguaje ubicuo, los invariantes que **nunca** deben romperse
> y las reglas de gobierno de la IA (§10). Antes de escribir o modificar código, léelo completo.

## 1. ¿Qué es este proyecto?

**FinanzApp** es una app de finanzas personales 100 % offline que registra **ingresos, gastos y transferencias**
entre cuentas (efectivo, débito, ahorros y tarjeta de crédito), calcula **saldos derivados** que nunca pueden quedar en negativo
en ningún momento, muestra un **resumen mensual** (ingresos, gastos, balance neto, tasa de ahorro y avisos de pago de tarjeta),
controla **presupuestos mensuales** (total y por categoría) con alertas Verde / Ámbar / Rojo que nunca bloquean, ofrece
un **registro rápido** de gastos e ingresos desde cualquier pestaña y **programaciones** (una vez, mensual o quincenal) con
auto-débito o confirmación manual, proyectadas en cada mes.

- **Curso:** Programación Intencional con IA Generativa — Proyecto Final (Greenfield Intentional App).
- **Stack:** HTML + CSS puro (escrito a mano, **sin frameworks, librerías ni CDN**) + JavaScript vanilla en scripts clásicos (`window.FinanzApp`).
- **Persistencia:** `localStorage` del navegador (clave `finanzapp.state`). **Sin servidor, sin internet** (REQ-047).
- **Moneda:** colones costarricenses (₡), una sola moneda.
- **Metodología:** especificación EARS (`WHEN …, IF …, THEN the system SHALL …`) en [`docs/requirements.md`](docs/requirements.md).

## 2. Fuentes de verdad (orden de precedencia)

| Documento | Contenido |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Especificación EARS v4: 84 requerimientos vigentes (REQ-001..REQ-090, sin REQ-073..REQ-078) — fuente de verdad del comportamiento |
| [`docs/design.md`](docs/design.md) | Reglas de negocio RN-01..RN-12, decisiones D1–D26, entrevista Q1–Q11, arquitectura |
| [`docs/data-contract.json`](docs/data-contract.json) | JSON Schema 2020-12 del estado `PersonalFinanceState` (schemaVersion 3, con migración desde 1 y 2) — contrato estricto |
| [`docs/wireframe.md`](docs/wireframe.md) | Diseño de interfaz por componentes (+ `wireframe.excalidraw` editable y `wireframe.png`) |
| [`tasks.md`](tasks.md) | Plan de implementación por fases (T-00..T-40) con criterios de aceptación y pruebas de regresión |
| [`retrospective.md`](retrospective.md) | Historial de correcciones y reflexiones |

Si algún artefacto contradice otro, mandan los requerimientos (REQ) y luego las reglas (RN).

## 3. Lenguaje ubicuo (glosario)

**Entidades y su nombre en el código** (úsalos tal cual en funciones, variables y componentes):

| Entidad | Código | Tipo |
|---|---|---|
| **Account** (cuenta) | `state.accounts[]` | Persistida |
| **Category** (categoría) | `state.categories[]` | Persistida |
| **Transaction** (movimiento) | `state.transactions[]` → `accountId`, `toAccountId?`, `categoryId?` | Persistida |
| **AccountBalance** | `calc.accountBalance(state, accountId)` | Derivada |
| **NetWorth** (patrimonio) | `calc.netWorth(state)` | Derivada |
| **MonthSummary** | `calc.monthSummary(state, 'YYYY-MM')` → `{ income, expense, net, savingsRate }` | Derivada |
| **BudgetStatus** | `calc.budgetStatus(state, categoryId, 'YYYY-MM')` → `{ spent, budget, percent, status, remaining }` | Derivada |
| **DayNet** (neto del día) | `calc.dayNet(list)` / `calc.groupByDate(list)[i].net` | Derivada |
| **Settings** (configuración) | `state.settings` → `{ monthlyBudget? }` | Persistida |
| **BalanceSummary** | `calc.balanceSummary(state)` → `{ available, savings, debts, netWorth }` | Derivada |
| **CreditCycle** | `calc.creditCycle(state, accountId, today)` → `{ lastCutoff, dueDate, amountDue, daysUntil }` | Derivada |
| **TotalBudgetStatus** | `calc.totalBudgetStatus(state, 'YYYY-MM')` | Derivada |
| **Schedule** (programación) | `state.schedules[]` → `frequency`, `startDate`, `endDate?`, `mode`, `skippedDates[]` | Persistida |
| **Occurrence** (ocurrencia) | `calc.openOccurrences(state, from, to, today)` → movimientos virtuales `{ virtual, status, mode }` | Derivada |

| Término | Significado en este proyecto |
|---|---|
| **Cuenta líquida** | Tipo `efectivo`, `debito` o `ahorros`. Tiene `initialBalance ≥ 0`. Su saldo **nunca** es negativo, en ninguna fecha |
| **Cuenta de ahorros** | Líquida de tipo `ahorros`. Recibe ingresos y transferencias, pero **no** gastos (REQ-058). Se muestra aparte del "Disponible para gastar" |
| **Cuenta archivada** | `archived = true`: conserva su historial, no aparece al registrar y solo se archiva con saldo 0 (REQ-063..REQ-065) |
| **Ciclo de la tarjeta** | `cutoffDay` y `paymentDay` (1–28). Pago del periodo = deuda al último corte − pagos posteriores (RN-10) |
| **Registro rápido** | Ventana "+ Registrar" en todas las pestañas: monto, categoría, descripción; fecha hoy y última cuenta usada (REQ-067) |
| **Presupuesto total** | `settings.monthlyBudget` opcional: tope para todos los gastos del mes (REQ-070) |
| **Cuenta de crédito** | Tipo `credito`. Tiene `creditLimit > 0` y día de corte / pago. Su saldo es ≤ 0: `deuda = −saldo`; `crédito disponible = creditLimit + saldo` |
| **Movimiento** | `ingreso` (entra a una cuenta líquida), `gasto` (sale de cualquier cuenta) o `transferencia` (sale de `accountId` y entra a `toAccountId`) |
| **Pago de tarjeta** | Transferencia hacia una cuenta de crédito. No puede superar la deuda (REQ-032) |
| **Saldo** | Siempre **derivado** (RN-01). No existe un campo "saldo actual" (REQ-049) |
| **Fondos disponibles** | Lo que puede salir de una cuenta: saldo (líquida) o crédito disponible (crédito) |
| **Categoría** | `{ id, name, kind: gasto|ingreso, monthlyBudget?, system }`. "Otros gastos" y "Otros ingresos" son del sistema |
| **Presupuesto mensual** | Monto opcional de una categoría de **gasto**. Se compara con lo gastado en el mes seleccionado |
| **Estado de presupuesto** | Verde ≤ 80 % / Ámbar (80, 100] / Rojo > 100 % (RN-06). **Alerta, nunca bloquea** |
| **Mes seleccionado** | `'YYYY-MM'` de la interfaz (no se persiste). Al abrir = mes actual |
| **Neto del día** | `Σ ingresos − Σ gastos` de una fecha. Las transferencias no cuentan (RN-07) |
| **Duplicado** | Mismo tipo, cuenta, monto, fecha y descripción normalizada → pedir confirmación (RN-08) |
| **Programación** | Pago o ingreso fijo marcado con "🗓 Programar": frecuencia `once` / `monthly` / `biweekly` (15 y último), modo `auto` (auto-débito) o `manual` (confirmar) (REQ-079) |
| **Ocurrencia** | Cada fecha de una programación. **Programada** (fecha > hoy), **pendiente** (fecha ≤ hoy sin aplicar), **aplicada** (hay movimiento con `scheduleId` + `occurrenceDate`) u **omitida** (`skippedDates`) |
| **Auto-débito** | La ocurrencia se registra sola al abrir la app en su fecha o después, si cumple RN-03; si no, queda pendiente (REQ-082) |
| **Proyectado a fin de mes** | Saldo real + ocurrencias abiertas hasta el último día del mes actual (REQ-088) |
| **Validación en vivo** | Mensaje de error visible mientras el usuario escribe, antes de confirmar |

## 4. Reglas de negocio (resumen ejecutable)

- **RN-01:** `saldo = initialBalance + Σ ingresos + Σ transf. entrantes − Σ gastos − Σ transf. salientes` (crédito: `initialBalance = 0`).
- **RN-02:** `Patrimonio = Σ saldos de todas las cuentas` (las deudas restan).
- **RN-03 (invariante de fondos, cronológica):** recorriendo los movimientos en orden de fecha y `createdAt`, ninguna cuenta líquida tiene saldo < 0 y ninguna tarjeta tiene deuda > límite ni saldo > 0 **en ningún momento**. Lo que puede salir en una fecha = saldo mínimo desde esa fecha en adelante. Se verifica **antes** de aceptar cualquier alta, edición o borrado. **Sí bloquea.**
- **RN-04:** Validaciones de borde: monto > 0, numérico, máx. 2 decimales; fecha ISO real y no futura (para el futuro: "Programar", primera fecha hoy..hoy+365); descripción 1–80; categoría del mismo tipo; transferencia entre cuentas distintas.
- **RN-05:** `Balance neto = ingresos del mes − gastos del mes`; `Tasa de ahorro = neto / ingresos × 100` ("—" si ingresos = 0). Transferencias excluidas.
- **RN-06:** `% presupuesto = gastado del mes / monthlyBudget × 100` → ok ≤ 80 · warning ≤ 100 · exceeded > 100. Se evalúa sin redondear. **Nunca bloquea.**
- **RN-07:** `Neto del día = Σ ingresos − Σ gastos` de la fecha.
- **RN-08:** Duplicado = mismo `type`, `accountId`, `amount`, `date` y `description` normalizada → confirmar.
- **RN-09:** `Disponible para gastar = Σ efectivo + débito`; `Ahorros = Σ ahorros`; `Deudas = Σ deudas`; `Patrimonio = Disponible + Ahorros − Deudas`.
- **RN-10:** Último corte = fecha más reciente con `cutoffDay` **estrictamente anterior** a hoy; fecha de pago = primera con `paymentDay` posterior al corte; `pago del periodo = máx(0, deuda al corte − pagos posteriores)`. Aviso si faltan ≤ 7 días o ya venció.
- **RN-11:** Presupuesto total: `% = gastos del mes / settings.monthlyBudget × 100` con los umbrales de RN-06; por día = `restante / días restantes del mes (incluye hoy)`. **Nunca bloquea.**
- **RN-12 (v4):** Ocurrencias: una vez = primera fecha; mensual = mismo día (o último) cada mes; quincenal = 15 y último. Abierta = ni aplicada ni omitida. Resumen y presupuestos del mes incluyen las abiertas; saldo actual, patrimonio y deudas solo movimientos reales; RN-03 se evalúa al **aplicar** cada ocurrencia.

Detalle y trazabilidad a REQ en [`docs/design.md`](docs/design.md) §3.

## 5. Invariantes (comportamiento que NUNCA debe cambiar)

**Invariantes del negocio (no negociables):**

- **Saldo derivado y protegido:** el saldo de una cuenta solo cambia mediante movimientos o su saldo inicial / límite, y ninguna operación puede dejarlo fuera de RN-03 (REQ-030..REQ-035, REQ-049).
- **Persistencia obligatoria en LocalStorage:** el estado completo se guarda en cada mutación y se restaura al iniciar (REQ-051, REQ-052).
- **Prohibición de montos inválidos:** se rechazan montos ≤ 0, vacíos, no numéricos o con más de 2 decimales, y textos obligatorios vacíos (REQ-022..REQ-025).

Estos son los `SHALL NOT` del sistema — no los toques sin cambiar primero `docs/requirements.md`:

1. **Nunca** se envían datos a servidores externos ni se requiere internet (REQ-047). Sin `fetch`/XHR/CDN.
2. **Nunca** se eliminan cuentas, categorías o movimientos como efecto secundario (REQ-048). Única excepción: reasignar la categoría de los movimientos al eliminar una categoría, con confirmación (REQ-017).
3. **Nunca** se elimina una cuenta con movimientos (REQ-010).
4. **Nunca** se eliminan ni cambian de tipo las categorías del sistema (REQ-016).
5. **Nunca** se edita el saldo directamente (REQ-049) ni se crean movimientos automáticos, salvo el auto-débito de una programación que el usuario configuró (REQ-050, REQ-082).
6. **Nunca** se bloquea un gasto por exceder el **presupuesto** (REQ-042); solo se alerta. (Lo que sí bloquea es la falta de **fondos**, RN-03.)
7. **Nunca** se registra un posible duplicado sin confirmación (REQ-033).
8. **Nunca** se registra un movimiento con fecha futura sin "Programar" (REQ-027). **Nunca** se aplica dos veces la misma ocurrencia, ni se recrea una ocurrencia cuyo movimiento el usuario eliminó (REQ-086), ni se aplica un auto-débito que viole RN-03 (REQ-082).
9. El estado persistido corrupto o fuera de contrato **nunca** bloquea el arranque: se inicia vacío con aviso (REQ-053). Si no se puede guardar, los datos se mantienen en memoria con aviso (REQ-054).
10. **Nunca** se interpreta como HTML un texto del usuario (REQ-056).
11. **Nunca** se gasta directamente desde una cuenta de ahorros (REQ-058) ni se usa una cuenta archivada en un movimiento nuevo (REQ-064).
12. **Nunca** se archiva una cuenta con saldo o deuda distinta de 0 (REQ-063), y archivar **nunca** borra movimientos.

## 6. Convenciones de código

> La arquitectura completa (componentes, API de cada módulo, `dispatch`, diagramas y mapeo REQ → función) está en [`docs/design.md`](docs/design.md). Respeta esos nombres.

- JS en `src/js/`, cargado como **scripts clásicos** (no ES Modules, que no funcionan en `file://`) en este orden: `calculations.js` → `validations.js` → `storage.js` → `ui.js` → `app.js`. Cada archivo es una IIFE que registra su API en `window.FinanzApp` (`FinanzApp.calc`, `FinanzApp.validate`, `FinanzApp.storage`, `FinanzApp.ui`, `FinanzApp.app`).
- **Solo `app.js` muta el estado**, y siempre mediante `dispatch(action)`: validar → (confirmar) → reducer sobre una copia → `storage.validateState` → `storage.saveState` → `ui.render`. `calculations.js` y `validations.js` son funciones puras sin DOM.
- Prohibido: frameworks, Redux u otro store, backend, IndexedDB, Service Workers, `fetch`/XHR, CDNs, `innerHTML` con datos del usuario (usar `textContent` con el helper `el()`).
- Fechas: texto ISO `YYYY-MM-DD`; cálculos con `Date.UTC`; nunca `new Date('YYYY-MM-DD')`; "HOY" = fecha local del dispositivo.
- Dinero: sumar en céntimos enteros (`calc.toCents`); redondear solo al mostrar (`calc.formatMoney`: ₡, miles con coma, 2 decimales; porcentajes enteros).
- CSS puro a mano en `src/css/styles.css`. Prohibido Tailwind, Bootstrap, CDNs o cualquier dependencia.
- Los valores derivados (saldos, deuda, patrimonio, disponible/ahorros/deudas, ciclo de tarjeta, resumen, % de presupuesto, neto del día) **nunca** se persisten.
- Nombres de campos del código = nombres del schema (`camelCase`). IDs con prefijo: `acc-`, `cat-`, `mov-`, `prg-`.
- Textos de la interfaz en español.

## 7. Estructura del repositorio

```text
/
├── .cursorrules                   ← reglas de contexto (remite a este archivo)
├── CLAUDE.md                      ← este archivo (memoria semántica + gobierno de la IA)
├── docs/
│   ├── requirements.md            ← especificación EARS v4 (fuente de verdad)
│   ├── data-contract.json         ← JSON Schema PersonalFinanceState (schemaVersion 3)
│   ├── wireframe.md               ← boceto de interfaz por componentes
│   ├── wireframe.excalidraw       ← versión editable (excalidraw.com)
│   ├── wireframe.png              ← exportación visible en GitHub
│   └── design.md                  ← diseño y arquitectura
├── tasks.md                       ← plan de implementación por fases
├── src/
│   ├── index.html                 ← punto de entrada + CSP
│   ├── css/styles.css             ← CSS puro
│   └── js/                        ← calculations.js, validations.js, storage.js, ui.js, app.js
├── tests/
│   ├── pruebas.html               ← pruebas de regresión de la lógica (abrir con doble clic)
│   └── pruebas.js
├── REFLECTION.md                  ← autoevaluación del Proyecto Final (la completa el estudiante)
├── retrospective.md               ← historial de correcciones y reflexión
└── README.md                      ← resumen y cómo ejecutar
```

## 8. Flujo de trabajo con la IA (tasks.md + Unchanged Behavior)

1. Ejecutar **una tarea de [`tasks.md`](tasks.md) a la vez**, en orden, tocando solo los archivos que la tarea lista.
2. Al terminar, mostrar el diff y cómo verificar su criterio de aceptación.
3. **Unchanged Behavior:** ningún cambio puede alterar el comportamiento de una tarea ya marcada `[x]`, ni los cálculos, validaciones o la persistencia. Si un ajuste lo requiere, detenerse y avisar.
4. Después de cada tarea deben seguir pasando `tests/pruebas.html` y las pruebas de regresión R1–R6 de `tasks.md`.
5. Si una tarea revela una contradicción en los documentos, no decidir: reportarla para actualizar primero `requirements.md` / `design.md`.

## 9. Notas de entorno (máquina del estudiante)

- Todo debe funcionar abriendo `src/index.html` directamente en el navegador (`file://`), sin Node ni Python — coherente con REQ-047.
- Si Git CLI no está en el PATH de PowerShell: usar `"C:\Program Files\Git\cmd\git.exe"`.

## 10. Reglas del proyecto para la IA (gobierno del Sous Chef)

El estudiante es el **Head Chef** (arquitecto y auditor); la IA es el **Sous Chef** (ejecuta). Estas reglas son obligatorias en toda sesión:

**Stack permitido (y nada más):**

- HTML5 + CSS3 escritos a mano + JavaScript vanilla (ES2015+) en scripts clásicos, persistencia en `localStorage`.
- **Prohibido** agregar: frameworks o librerías (React, Vue, jQuery, Bootstrap, Tailwind, Chart.js…), CDNs, `npm`/`package.json`, herramientas de build, TypeScript compilado, backend, bases de datos externas, IndexedDB, Service Workers, `fetch`/XHR/WebSocket o cualquier acceso a red (REQ-047).

**Convenciones obligatorias:** las de §6. Nombres de funciones y componentes exactamente como en `docs/design.md` §4 y §5.3; campos exactamente como en `docs/data-contract.json`.

**Prohibición de parches fuera de la especificación:**

1. No agregar funcionalidades, campos, pantallas ni comportamientos que no estén en `docs/requirements.md` (por ejemplo: gráficos, exportar a Excel, varias monedas, frecuencias distintas de una vez/mensual/quincenal, metas de ahorro). Si algo falta o es ambiguo, **detenerse y preguntar**; no inventar.
2. No "arreglar" síntomas con casos especiales (`if` para un dato puntual, `try/catch` que oculta errores, valores mágicos). La corrección se hace en la función responsable según `docs/design.md` §7.
3. Todo cambio de comportamiento se hace en este orden: `requirements.md` → `data-contract.json` / `design.md` → `tasks.md` → código → `tests/pruebas.js`.
4. Al corregir o ajustar, aplicar **Unchanged Behavior** (§8): declarar qué no puede cambiar, tocar solo los archivos necesarios y volver a pasar las pruebas.
5. Ningún cambio puede romper los invariantes de §5 ni dejar un estado que no cumpla el contrato (`dispatch` lo verifica con `storage.validateState`).
6. Entregar siempre el diff y cómo verificarlo; nunca "Accept All" sin revisión del Head Chef.
