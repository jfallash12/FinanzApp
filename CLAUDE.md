# CLAUDE.md — Reglas de contexto de FinanzApp

**FinanzApp** es una app de finanzas personales 100 % offline, en colones (₡): cuentas, ingresos, gastos y transferencias,
presupuestos mensuales, pagos programados y metas de ahorro. HTML + CSS + JavaScript vanilla; datos en `localStorage`
(clave `finanzapp.state`). Se abre con doble clic en `src/index.html`.

## 1. Rol de la IA y cómo debe responder

- **Yo soy el Head Chef:** decido el alcance, apruebo cada cambio y audito el resultado.
- **Tú eres el Sous Chef:** ejecutas lo que está especificado. No decides alcance ni agregas nada por tu cuenta.
- Antes de cambiar código, lee [`docs/requirements.md`](docs/requirements.md) (EARS, fuente de verdad) y [`docs/design.md`](docs/design.md).
- Si algo falta, es ambiguo o contradice otro documento: **detente y pregunta**. No inventes.
- Trabaja **una tarea de [`tasks.md`](tasks.md) a la vez** y toca solo los archivos que la tarea necesita.
- Cada respuesta con cambios incluye: qué archivos cambiaste, el diff, qué comportamiento **no** cambió (Unchanged Behavior)
  y cómo verificarlo (`tests/pruebas.html` en verde y el criterio de aceptación).
- Responde en español, breve y directo. Los textos de la interfaz también van en español.

## 2. Lenguaje ubicuo

Usa estos nombres tal cual en el código, los documentos y las respuestas.

| Término | Significado | En el código |
|---|---|---|
| **Cuenta** | Efectivo, débito, ahorros o crédito | `state.accounts[]` |
| **Cuenta líquida** | Efectivo, débito o ahorros. Su saldo nunca es negativo | `calc.isLiquid` |
| **Cuenta de ahorros** | Recibe ingresos y transferencias, no gastos. Puede tener una **meta** con razón | `type: 'ahorros'`, `goalAmount`, `goalReason` |
| **Cuenta de crédito** | Tarjeta con límite, día de corte y día de pago. Saldo ≤ 0; deuda = −saldo | `type: 'credito'` |
| **Cuenta archivada** | Conserva su historial pero no se usa en movimientos nuevos | `archived: true` |
| **Categoría** | De gasto o de ingreso; las de gasto pueden tener presupuesto mensual. "Otros gastos" y "Otros ingresos" son del sistema | `state.categories[]` |
| **Movimiento** | Ingreso, gasto o transferencia entre cuentas | `state.transactions[]` |
| **Pago de tarjeta** | Transferencia hacia una cuenta de crédito | — |
| **Saldo** | Siempre derivado: saldo inicial + entradas − salidas | `calc.accountBalance` |
| **Patrimonio** | Disponible para gastar + Ahorros − Deudas | `calc.netWorth`, `calc.balanceSummary` |
| **Resumen del mes** | Ingresos, gastos, balance neto y tasa de ahorro; las transferencias no cuentan | `calc.monthSummary` |
| **Presupuesto** | Por categoría o total del mes. Verde ≤ 80 %, Ámbar ≤ 100 %, Rojo > 100 %. Solo alerta | `calc.budgetStatus`, `calc.totalBudgetStatus` |
| **Apartado a ahorros** | Transferencias del mes hacia ahorros − retiros de ahorros (mínimo 0). Consume el presupuesto total, pero no es gasto | `calc.savingsSetAside` |
| **Programación** | Pago o ingreso fijo: una vez, cada mes o quincenal (días 15 y último). Modo auto-débito o confirmar | `state.schedules[]` |
| **Ocurrencia** | Cada fecha de una programación: programada, pendiente, aplicada u omitida | `calc.openOccurrences` |
| **Auto-débito** | La ocurrencia se registra sola al abrir la app en su fecha o después, si hay fondos | `processSchedules` |
| **Duplicado** | Mismo tipo, cuenta, monto, fecha y descripción → pedir confirmación | `calc.findDuplicate` |
| **Mes seleccionado** | Mes que se está viendo (`YYYY-MM`); no se guarda | `ui.month` |

Las fórmulas completas (RN-01..RN-13) están en [`docs/design.md`](docs/design.md) §3.

## 3. Invariantes (nunca se rompen)

1. **Regla de fondos (RN-03):** en ninguna fecha una cuenta líquida queda con saldo negativo ni una tarjeta supera su límite. **Bloquea** cualquier alta, edición o borrado que la viole.
2. **El presupuesto nunca bloquea:** solo alerta.
3. **El saldo nunca se edita ni se guarda:** se deriva de los movimientos.
4. **Montos válidos:** mayores que 0, numéricos y con máximo 2 decimales. Los textos obligatorios no pueden estar vacíos.
5. **Persistencia:** el estado completo se guarda en `localStorage` en cada cambio y se restaura al abrir. Un estado dañado no bloquea la app: inicia vacía con aviso.
6. **Sin red:** nada sale del navegador; no se usa `fetch`, XHR ni CDN.
7. **Sin borrados colaterales:** ninguna operación elimina cuentas, categorías o movimientos de forma indirecta; importar un respaldo o borrar todos los datos reemplaza todo, y solo tras confirmar. Una cuenta con movimientos no se elimina; se archiva, y solo con saldo 0.
8. **Sin movimientos automáticos**, salvo el auto-débito de una programación que el usuario configuró. Una ocurrencia nunca se aplica dos veces ni se recrea si el usuario borró su movimiento.
9. **Fechas futuras** solo con "🗓 Programar".
10. **Duplicados** solo se guardan con confirmación.
11. No se gasta directamente desde una cuenta de ahorros.
12. Los textos del usuario nunca se interpretan como HTML.

## 4. Reglas de código

- **Stack permitido:** HTML5, CSS3 escrito a mano y JavaScript vanilla en scripts clásicos bajo `window.FinanzApp`. **Prohibido:** frameworks, librerías, CDN, npm, build, ES Modules, backend, IndexedDB y cualquier acceso a red.
- **Solo `app.js` cambia el estado**, siempre con `dispatch(action)`: validar → confirmar → reducer sobre una copia → `storage.validateState` → `storage.saveState` → `ui.render`.
- `calculations.js` y `validations.js` son funciones puras, sin DOM.
- DOM con el helper `el()` y `textContent`; nunca `innerHTML` con datos del usuario.
- Fechas ISO `YYYY-MM-DD` con `Date.UTC`; dinero en céntimos enteros; se redondea solo al mostrar.
- Nombres de funciones y componentes como en `docs/design.md` §4 y §5.3; campos como en [`docs/data-contract.json`](docs/data-contract.json); IDs con prefijo `acc-`, `cat-`, `mov-`, `prg-`.
- **Orden para cualquier cambio de comportamiento:** `requirements.md` → `data-contract.json` / `design.md` → `tasks.md` → código → `tests/pruebas.js`.
- No ocultes errores con `try/catch` ni con `if` para un caso puntual: corrige la función responsable (`docs/design.md` §7).

## 5. Dónde está cada cosa

| Archivo | Contenido |
|---|---|
| `docs/requirements.md` | Requerimientos EARS (REQ-001..REQ-103) |
| `docs/data-contract.json` | Estructura de los datos (JSON Schema) |
| `docs/design.md` | Arquitectura, reglas de negocio, componentes y mapeo REQ → código |
| `docs/decisiones.md` | Decisiones técnicas D1–D43 |
| `docs/wireframe.md` / `.png` | Interfaz |
| `docs/retrospectiva.md` | Lo que aprendí en el proyecto |
| `tasks.md` | Plan de tareas y pruebas de regresión |
| `tests/pruebas.html` | Pruebas (doble clic); datos de prueba en `tests/datos-ejemplo.json` |
