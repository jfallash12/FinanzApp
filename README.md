# FinanzApp

App de **finanzas personales**: registra ingresos, gastos y transferencias entre cuentas (efectivo, débito, ahorros y tarjeta de crédito) —con un **registro rápido** desde cualquier pantalla—, programa **pagos e ingresos fijos** (una vez, mensual o quincenal) con **auto-débito** o confirmación manual y los proyecta en cada mes, calcula saldos que **nunca** quedan en negativo en ninguna fecha, avisa cuándo vence el pago de la tarjeta, muestra el **resumen mensual** (ingresos, gastos, balance neto y tasa de ahorro) y controla **presupuestos mensuales** (total y por categoría) con alertas Verde / Ámbar / Rojo —el dinero que se aparta a ahorros también baja el presupuesto total— y sigue **metas de ahorro** con su razón y la fecha estimada para alcanzarlas. **100 % offline**: los datos viven en el `localStorage` del navegador, sin servidores ni conexión a internet.

Proyecto Final del curso **Programación Intencional con IA Generativa** (Greenfield Intentional App) — José Fallas (jfallash@ucenfotec.ac.cr).

## Estructura del proyecto

```text
/
├── .cursorrules             # Reglas de contexto para la IA (remite a CLAUDE.md)
├── CLAUDE.md                # Rol de la IA, lenguaje ubicuo, invariantes y reglas de código
├── docs/
│   ├── requirements.md      # Requerimientos EARS (REQ-001..REQ-096)
│   ├── data-contract.json   # Contrato de datos: JSON Schema (PersonalFinanceState)
│   ├── design.md            # Arquitectura, reglas de negocio, componentes y mapeo REQ → código
│   ├── decisiones.md        # Decisiones técnicas D1–D33
│   ├── wireframe.md         # Interfaz por componentes
│   ├── wireframe.excalidraw # Wireframe editable (excalidraw.com)
│   ├── wireframe.png        # Wireframe exportado
│   └── retrospectiva.md     # Lo que aprendí
├── tasks.md                 # Plan de implementación (T-00..T-47) y pruebas de regresión
├── src/                     # Código fuente
│   ├── index.html           # Punto de entrada (abrir con doble clic)
│   ├── css/styles.css       # CSS puro
│   └── js/                  # calculations, validations, storage, ui, app (scripts clásicos)
├── tests/
│   ├── pruebas.html         # Pruebas de regresión (abrir con doble clic)
│   ├── pruebas.js
│   └── datos-ejemplo.json   # Datos de prueba
├── REFLECTION.md            # Autoevaluación de alineación
└── README.md                # Este archivo
```

## Documentación (flujo Spec-Driven Development)

| Orden | Documento | Para qué sirve |
|---|---|---|
| 1 | [`docs/wireframe.md`](docs/wireframe.md) + [`wireframe.png`](docs/wireframe.png) | Qué ve el usuario |
| 2 | [`docs/requirements.md`](docs/requirements.md) | Qué debe hacer el sistema (EARS) |
| 3 | [`docs/data-contract.json`](docs/data-contract.json) | Estructura de los datos |
| 4 | [`.cursorrules`](.cursorrules) + [`CLAUDE.md`](CLAUDE.md) | Reglas de contexto para la IA |
| 5 | [`docs/design.md`](docs/design.md) + [`docs/decisiones.md`](docs/decisiones.md) | Cómo se construye |
| 6 | [`tasks.md`](tasks.md) | Plan paso a paso y pruebas de regresión |
| 7 | [`src/`](src/) + [`tests/`](tests/) | La aplicación y sus pruebas |
| 8 | [`docs/retrospectiva.md`](docs/retrospectiva.md) + [`REFLECTION.md`](REFLECTION.md) | Aprendizajes y autoevaluación |

El proceso (cada cambio, tarea por tarea) queda en el historial de commits.

## Cómo ejecutarla

Sin dependencias, sin build, sin servidor y sin internet:

1. Clonar o descargar el repositorio.
2. Abrir `src/index.html` con doble clic en Chrome, Edge o Firefox.

Los datos se guardan en el `localStorage` del navegador (clave `finanzapp.state`).

**Cargar datos de prueba (opcional):** abra la consola (F12), pegue la línea siguiente sustituyendo `<ejemplo>` por el contenido de [`tests/datos-ejemplo.json`](tests/datos-ejemplo.json) y recargue con F5:

```js
localStorage.setItem('finanzapp.state', JSON.stringify(<ejemplo>));
```

Para empezar de cero: `localStorage.removeItem('finanzapp.state')` y F5.

**Pruebas:** abra `tests/pruebas.html` con doble clic → 133 pruebas en verde.

## Demostración (auditoría del cliente)

Con los datos de prueba (mes Octubre 2026):

1. **Registro rápido y persistencia:** toque **+ Registrar** (abajo a la derecha, en cualquier pestaña), registre un gasto y presione **F5** → los datos y los saldos siguen ahí.
2. **Restricción semántica:** escriba **−5** en Monto → error en rojo al instante, Guardar deshabilitado, nada se guarda.
3. **Regla de fondos (bloquea, en el tiempo):** gasto de **₡50,000** desde *Efectivo* → "Saldo insuficiente: disponible ₡31,300.00". Con fecha 2026-10-14 y ₡30,000 también se rechaza, porque el saldo bajaría de cero el 15 de octubre. Un gasto desde *Ahorros BN* se rechaza: primero hay que transferir.
4. **Regla de presupuesto (no bloquea):** gasto de **₡5,000** en *Entretenimiento* con *Tarjeta Visa* → se registra, la pestaña **Presupuestos** pasa de 92 % Ámbar a **108 % Rojo** y aparece el aviso "Superó el presupuesto de Entretenimiento".
5. **Duplicado:** registre otra vez *Bus*, ₡4,500, 2026-10-15, Efectivo → pide confirmación.
6. **Tarjeta:** el Resumen avisa "El pago de Tarjeta Visa vence en 2 días: ₡36,000.00" (corte 15, pago 28; con la fecha de hoy los días cambian).
7. **Cuentas:** abra *Efectivo* → ve el saldo después de cada movimiento. Intente archivarla → se rechaza porque tiene saldo; *Tarjeta vieja* ya está archivada y no aparece al registrar.
8. **Pagos fijos:** en *Gastos e ingresos* marque **🗓 Programar**: *Hipoteca* ₡450,000 cada mes desde el 31 con auto-débito, y *Gasolina* ₡40,000 quincenal con confirmación ("≈ ₡80,000 al mes"). Pase a **noviembre** con ▶: ya aparecen y cuentan en el resumen y en los presupuestos. El día que vencen, la hipoteca se registra sola al abrir la app y la gasolina queda en *Pendientes de confirmar* (✓ Confirmar · ✎ Ajustar · ⏭ Omitir).

## Cumplimiento del Proyecto Final

| Requisito | Dónde se cumple |
|---|---|
| 2 o más entidades relacionadas | `Account`, `Category`, `Transaction` y `Schedule` (→ `accountId`, `toAccountId`, `categoryId`, `scheduleId`) — [`docs/data-contract.json`](docs/data-contract.json) |
| Persistencia real | `localStorage` en cada cambio, restauración al iniciar y manejo de datos dañados — `src/js/storage.js` (REQ-051..REQ-054) |
| 3 o más reglas de negocio complejas en EARS | 90 REQ en [`docs/requirements.md`](docs/requirements.md); por ejemplo REQ-030..REQ-035 (fondos según tipo de cuenta, en orden cronológico), REQ-061/062 (pago del periodo de la tarjeta), REQ-063 (archivar solo con saldo 0), REQ-070/071 (presupuesto total vs. por categoría), REQ-041..REQ-044 (presupuesto que alerta sin bloquear), REQ-033 (duplicados), REQ-017 (reasignar al eliminar categoría) |
| Archivo de reglas de contexto | [`.cursorrules`](.cursorrules) y [`CLAUDE.md`](CLAUDE.md): definen el rol de la IA, restringen el stack, fijan convenciones y prohíben parches fuera de la especificación |
| Casos de borde con retroalimentación visual | Vacíos, negativos, no numéricos, más de 2 decimales, fechas inválidas o futuras, duplicados, nombres repetidos, fondos insuficientes — errores en vivo y avisos |
| Unchanged Behavior | Protocolo en [`tasks.md`](tasks.md), pruebas R1–R6 y [`tests/pruebas.html`](tests/pruebas.html) |
| Autoevaluación | [`REFLECTION.md`](REFLECTION.md) |

## Stack

- **HTML + CSS puro** (escrito a mano — sin frameworks, librerías ni CDN).
- **JavaScript vanilla** en scripts clásicos bajo el espacio de nombres `window.FinanzApp`.
- **Persistencia** en `localStorage` con restauración automática y manejo de estado corrupto.

## Requerimientos

| Categoría | Requerimientos |
|-----------|----------------|
| Cuentas | REQ-001 – REQ-011 |
| Categorías y presupuestos | REQ-012 – REQ-019 |
| Movimientos (pestaña "Gastos e ingresos") | REQ-020 – REQ-037 |
| Resumen mensual y presupuestos | REQ-038 – REQ-046 |
| Restricciones del cliente (comportamiento que no cambia) | REQ-047 – REQ-050 |
| Persistencia local | REQ-051 – REQ-054 |
| Interfaz y retroalimentación | REQ-055 – REQ-057 |
| Ahorros, tarjetas, archivo y detalle de cuenta | REQ-058 – REQ-066 |
| Registro rápido | REQ-067 – REQ-068 |
| Presupuestos (pestaña propia y total mensual) | REQ-069 – REQ-072 |
| Programaciones: pagos e ingresos fijos | REQ-079 – REQ-091 |
| Ahorro en el presupuesto, metas y próximos programados | REQ-092 – REQ-096 |

## Reglas de negocio clave

- `saldo = saldo inicial + ingresos + transferencias entrantes − gastos − transferencias salientes` (RN-01). El saldo nunca se edita a mano.
- Efectivo, débito y ahorros nunca quedan en negativo **en ninguna fecha**; la tarjeta nunca supera su límite. **Esta regla sí bloquea** (RN-03).
- Los ahorros no se gastan directamente; las cuentas solo se archivan con saldo 0; el pago del periodo de la tarjeta = deuda al corte − pagos posteriores (RN-10).
- `Balance neto = ingresos − gastos` del mes; `Tasa de ahorro = neto / ingresos` (RN-05). Las transferencias no cuentan.
- **Programaciones** (casilla "🗓 Programar"): una vez, cada mes (mismo día o último) o quincenal (15 y último). Con **auto-débito** se registran solas en su fecha si hay fondos; con **confirmar** quedan pendientes. Se ven y cuentan en el mes que corresponda, sin tocar el saldo real (RN-12). La primera fecha puede ser anterior a hoy (hasta un año): los pagos ya vencidos se **registran ahora** con su fecha o se marcan como **ya registrados**.
- Presupuesto mensual total y por categoría: Verde ≤ 80 %, Ámbar ≤ 100 %, Rojo > 100 %, con cuánto queda por día. El presupuesto total cuenta gastos + apartado a ahorros (RN-13). **Solo alerta, nunca bloquea** (RN-06, RN-11).
- Posible duplicado (mismo tipo, cuenta, monto, fecha y descripción) → pedir confirmación (RN-08).

Detalles y trazabilidad en [`docs/design.md`](docs/design.md).
