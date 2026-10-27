# Decisiones técnicas — FinanzApp

Decisiones de diseño que no están escritas en [`requirements.md`](./requirements.md) pero que el código respeta.
El código y las pruebas las citan por su número (D1, D2…), por eso los números se conservan.

## Plataforma y datos

| # | Decisión | Motivo |
|---|---|---|
| D1 | Scripts clásicos con el espacio de nombres `window.FinanzApp`, no ES Modules | Los módulos ES no cargan desde `file://` |
| D2 | Fechas como texto ISO `YYYY-MM-DD`; cálculos con `Date.UTC`; nunca `new Date('YYYY-MM-DD')` | En Costa Rica (UTC−6) ese parseo corre la fecha un día |
| D3 | "Hoy" y "mes actual" = fecha **local** del dispositivo | REQ-027, REQ-038 |
| D4 | Sumas en céntimos enteros; se redondea solo al mostrar | Evita errores como `0.1 + 0.2` (REQ-045) |
| D5 | DOM con `el()` y `textContent`; nunca `innerHTML` con datos del usuario | REQ-056 |
| D6 | `Content-Security-Policy` con `connect-src 'none'` | Hace verificable REQ-047 |
| D7 | IDs = prefijo + `Date.now()` en base 36 + parte aleatoria | Cumple los patrones del contrato sin librerías |
| D8 | El contrato se valida a mano en `storage.validateState` | No se permiten librerías de JSON Schema |
| D13 | `dispatch` valida el estado resultante con `storage.validateState` antes de aceptarlo | Nunca se guarda un estado inválido |
| D19 | La "última cuenta usada" se deriva del movimiento con `createdAt` más reciente | Evita un campo extra en el contrato |

## Regla de fondos

| # | Decisión | Motivo |
|---|---|---|
| D9 | La regla de fondos es **cronológica**: el saldo se recorre en orden de fecha y `createdAt` y no puede violar RN-03 en ningún punto. Lo que puede salir en una fecha es el saldo mínimo desde esa fecha en adelante | Revisar solo el saldo final permitiría historiales con saldo negativo en una fecha intermedia |
| D10 | Al editar o borrar, los fondos se calculan como si el movimiento original no existiera (`excludeTxId`) y luego se simula el estado resultante con `accountViolations` | REQ-034, REQ-035 |
| D16 | Un movimiento nuevo se ubica al final de su día (`createdAt` máximo) al simular la regla de fondos | Coincide con el orden en que quedará guardado |

## Interfaz

| # | Decisión | Motivo |
|---|---|---|
| D11 | El formulario de movimiento conserva tipo, cuenta y fecha tras guardar | Agiliza registrar varios gastos seguidos |
| D12 | Re-render completo tras cada acción, salvo al teclear: `updateForm` actualiza errores y botón sin perder el foco | Simple de depurar y sin perder el cursor |
| D14 | Guardar se deshabilita mientras haya errores; los mensajes solo aparecen en campos ya tocados, con la pista "Complete los campos obligatorios (*)" | Cumple REQ-055 sin llenar de errores un formulario vacío |
| D15 | Formato de dinero `₡12,500.00` (coma de miles, punto decimal) | Es el mismo formato en que el usuario escribe los montos |
| D17 | Día de corte y de pago de la tarjeta entre 1 y 28 | Todos los meses tienen esos días |
| D18 | El registro rápido no ofrece transferencias | Son menos frecuentes y están en el formulario completo |

## Programaciones

| # | Decisión | Motivo |
|---|---|---|
| D21 | La primera fecha de una programación está entre hoy − 365 y hoy + 365 días | Detecta errores de digitación sin limitar el uso normal |
| D22 | Patrimonio, deudas y saldo actual usan solo movimientos reales; el resumen y los presupuestos del mes incluyen lo programado; la regla de fondos se evalúa al **aplicar** cada ocurrencia | Lo ocurrido se reporta tal cual y lo comprometido se ve en su mes; un auto-débito sin fondos no se aplica, como en un banco |
| D23 | Quincenal = días 15 y último de cada mes; el monto es por quincena y se muestra el equivalente mensual | Es la quincena usual en Costa Rica |
| D24 | El auto-débito corre al abrir la app, al volver a ella y al programar; una ocurrencia que falló no se reintenta en la misma sesión | La app no tiene servidor que corra en segundo plano; evita avisos repetidos |
| D25 | Eliminar un movimiento creado por una programación marca su ocurrencia como omitida | Si no, el auto-débito la volvería a crear (REQ-086) |
| D26 | Eliminar una programación desenlaza sus movimientos, no los borra | REQ-048: sin borrados colaterales |
| D27 | Las ocurrencias anteriores a hoy se resuelven **al guardar** la programación (registrarlas con su fecha u omitirlas); nunca quedan pendientes ni las aplica el auto-débito | Quien empieza a usar la app a mitad de mes ya pagó algunos fijos; así no se duplican ni se pierden (REQ-091) |
| D28 | Los ingresos programados siempre son automáticos (`mode = 'auto'`), se rotulan "Automático" y no piden modo. Un ingreso guardado como `manual` se trata como automático al calcular | Un ingreso, como el salario, no se confirma ni se "debita" |
| D29 | «¿Hasta cuándo?» es `🔁 Sin fin` (por defecto) o `📅 Hasta una fecha`; la fecha final solo aparece con la segunda opción y la vista previa avisa "⚠ solo habrá 1 pago" si la limita a una ocurrencia | Un campo de fecha final siempre visible hace pensar que la programación no se repite |
| D33 | La ventana de 7 días de "Próximos programados" es estado de interfaz (`ui.upcomingFrom`, no se guarda); su inicio lo da `calc.upcomingStart(mes, hoy)` | Depende del mes seleccionado (REQ-096) |

## Ahorro y metas

| # | Decisión | Motivo |
|---|---|---|
| D30 | El apartado a ahorros consume el presupuesto **total**, pero no los presupuestos por categoría, y no cuenta como gasto en el Resumen ni en la tasa de ahorro | El dinero ahorrado no está disponible para gastar, pero sigue siendo del usuario: contarlo como gasto falsearía la tasa de ahorro |
| D31 | La meta vive en la cuenta de ahorros (`goalAmount`, `goalReason` opcionales) y el progreso usa el **saldo actual** de la cuenta | Una meta es "juntar ₡X para Y", sin fecha fija; los campos opcionales no cambian `schemaVersion` |
| D32 | La meta muestra cada transferencia programada que la alimenta (descripción, monto, frecuencia y equivalente mensual) y advierte si hay programaciones repetidas | Un total sin desglose no se puede verificar |

## Respaldo y ayudas del Resumen

| # | Decisión | Motivo |
|---|---|---|
| D34 | Exportar crea un `Blob` con el JSON del estado y lo descarga con un enlace `download`; importar lee el archivo con `FileReader` | Todo ocurre en el navegador, sin red (REQ-047) |
| D35 | Importar **reemplaza** todos los datos; no los fusiona | Fusionar mezclaría IDs y nombres repetidos y podría romper la regla de fondos; reemplazar con confirmación es predecible |
| D36 | Un respaldo pasa por la misma migración y el mismo `validateState` que los datos guardados | Un archivo externo no es confiable; así nunca entra un estado inválido |
| D37 | El texto de búsqueda es estado de interfaz (`ui.filters.text`), no se guarda, y al teclear se conserva la posición del cursor | Igual que los otros filtros (REQ-036) |
| D38 | La comparación y las categorías con más gasto usan la misma base que el Resumen: movimientos reales + ocurrencias abiertas del mes | Los números del Resumen cuadran entre sí |
| D39 | Los primeros pasos se derivan del estado (`calc.firstSteps`) y no hay opción de ocultarlos | Evita un campo nuevo en el contrato; la tarjeta desaparece sola al completar los pasos |

## Diseño visual

| # | Decisión | Motivo |
|---|---|---|
| D40 | Color de marca violeta (`#6D4AFF`); verde, ámbar y rojo quedan reservados para los estados de presupuesto, alertas y errores | Da identidad a la app sin quitarles significado a los colores de estado (REQ-057) |
| D41 | El color de una categoría se deriva de su posición entre las categorías de su mismo tipo (8 colores que se repiten); no se guarda | No cambia el contrato de datos. Las categorías predeterminadas quedan con colores distintos; si se elimina una, las siguientes pueden cambiar de color |
| D42 | La tarjeta de crédito usa un degradado grafito en lugar de morado | Evita confundirla con el color de marca |
