# Especificación de Requerimientos: FinanzApp

> **Metodología:** Sintaxis EARS (Easy Approach to Requirements Syntax).
> Patrón general: `WHEN <disparador>, IF <condición>, THEN the system SHALL <respuesta>`.
> El comportamiento esperado se expresa con `SHALL` (obligatorio) y el comportamiento que **no debe cambiar** se expresa con `SHALL NOT`.
>
> **Versión 6.** Los identificadores REQ son estables: si un requerimiento se elimina conserva su número marcado como *Eliminado*, y los nuevos se agregan al final. Vigentes: 89 (REQ-001..REQ-095, sin REQ-073..REQ-078). La v2 agregó el registro rápido, cuentas de ahorros, cuentas archivadas, fechas de tarjeta, detalle de cuenta, la pestaña Presupuestos y el presupuesto total mensual (§8–§10). La v3 permitió movimientos con fecha futura (§11, reemplazada). La v4 introduce **programaciones** (una vez, mensual o quincenal) con **auto-débito** o confirmación manual y su proyección en cada mes (§12). La v5 permite programaciones que **empezaron antes** de usar la app (REQ-079 modificado, REQ-091). Ajuste v5.1: los **ingresos** programados no piden modo; se registran solos en su fecha (REQ-079). Ajuste v5.2: una programación repetitiva **se repite sin fin por defecto**; la fecha final solo se pide si el usuario elige «Hasta una fecha» (REQ-079). La v6 hace que el dinero **apartado a ahorros** consuma el presupuesto total (REQ-070 modificado, REQ-092) y agrega **metas de ahorro** con razón en las cuentas de ahorros (§13, REQ-093..REQ-095).
> **Contrato de datos:** [`data-contract.json`](./data-contract.json) (schemaVersion 2). **Reglas de negocio:** RN-01..RN-11 en [`design.md`](./design.md).

**Definiciones usadas en esta especificación**

- **Cuenta líquida:** cuenta de tipo `efectivo`, `debito` o `ahorros`. Su saldo nunca puede ser negativo.
- **Cuenta de ahorros:** cuenta líquida de tipo `ahorros`; su dinero se muestra aparte del disponible para gastar (REQ-058, REQ-059).
- **Cuenta activa / archivada:** una cuenta archivada (`archived = true`) conserva su historial pero no se usa en movimientos nuevos (REQ-063..REQ-065).
- **Cuenta de crédito:** cuenta de tipo `credito`. Tiene un `creditLimit`; su saldo es ≤ 0 y representa la deuda.
- **Movimiento:** registro de dinero de tipo `ingreso`, `gasto` o `transferencia`.
- **Saldo de una cuenta:** `saldoInicial + Σ ingresos + Σ transferencias entrantes − Σ gastos − Σ transferencias salientes` (RN-01). En crédito el saldo inicial es 0.
- **Mes seleccionado:** texto `YYYY-MM` que filtra el resumen y la lista de movimientos.
- **Movimiento programado:** movimiento cuya fecha es posterior a la fecha local de hoy (REQ-073). No es un campo guardado: se deriva de la fecha.
- **Saldo actual / después de programados:** saldo con los movimientos de fecha ≤ hoy / con todos los movimientos (REQ-074).
- **Normalizar un texto:** quitar espacios al inicio y al final y comparar sin distinguir mayúsculas.
- **Redondeo:** ver REQ-045.

---

## 1. Cuentas

* **REQ-001**: WHEN el usuario crea una cuenta, THEN the system SHALL solicitar un nombre, un tipo (`efectivo`, `debito`, `ahorros` o `credito`) y, según el tipo, un **saldo inicial** (efectivo, débito y ahorros) o un **límite de crédito**, un **día de corte** y un **día de pago** (crédito, REQ-060).

* **REQ-002**: WHEN el usuario crea o edita una cuenta, IF el nombre está vacío o contiene solo espacios, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-003**: WHEN el usuario crea o edita una cuenta, IF ya existe otra cuenta con el mismo nombre normalizado, THEN the system SHALL rechazar la operación e indicar que el nombre está duplicado.

* **REQ-004**: WHEN el usuario crea o edita una cuenta líquida, IF el saldo inicial está vacío, no es numérico, es negativo o tiene más de 2 decimales, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo. Un saldo inicial de 0 es válido.

* **REQ-005**: WHEN el usuario crea o edita una cuenta de crédito, IF el límite de crédito está vacío, no es numérico, es menor o igual a 0 o tiene más de 2 decimales, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-006**: WHEN se registra, edita o elimina un movimiento, o se edita una cuenta, THEN the system SHALL recalcular el saldo de cada cuenta (RN-01). Para una cuenta de crédito SHALL mostrar además la **deuda** (`−saldo`) y el **crédito disponible** (`creditLimit + saldo`).

* **REQ-007**: the system SHALL mostrar el **Patrimonio** como la suma de los saldos de todas las cuentas (las deudas de crédito restan).

* **REQ-008**: WHEN el usuario edita una cuenta, IF la cuenta tiene al menos un movimiento, THEN the system SHALL NOT permitir cambiar su tipo (el campo se muestra deshabilitado con una explicación).

* **REQ-009**: WHEN el usuario edita el saldo inicial o el límite de crédito de una cuenta, IF con el nuevo valor la cuenta líquida quedaría con saldo negativo o la deuda de la cuenta de crédito superaría el nuevo límite, THEN the system SHALL rechazar la operación e indicar el valor mínimo permitido.

* **REQ-010**: WHEN el usuario solicita eliminar una cuenta, IF la cuenta tiene movimientos (como cuenta de origen o de destino), THEN the system SHALL rechazar la eliminación, indicar cuántos movimientos tiene, sugerir archivarla (REQ-063) y SHALL NOT eliminar ningún movimiento.

* **REQ-011**: WHEN el usuario solicita eliminar una cuenta sin movimientos, THEN the system SHALL pedir confirmación explícita y, solo tras confirmar, eliminarla.

---

## 2. Categorías y presupuestos

* **REQ-012**: the system SHALL mantener categorías de tipo `gasto` o `ingreso`. WHEN la aplicación inicia sin datos, THEN the system SHALL crear las categorías predeterminadas: Alimentación, Transporte, Vivienda, Servicios, Entretenimiento, Salud y **Otros gastos** (gasto); Salario y **Otros ingresos** (ingreso). "Otros gastos" y "Otros ingresos" son categorías del sistema.

* **REQ-013**: WHEN el usuario crea una categoría, THEN the system SHALL solicitar un nombre, un tipo y, solo si el tipo es `gasto`, un **presupuesto mensual** opcional.

* **REQ-014**: WHEN el usuario crea o edita una categoría, IF el nombre está vacío o ya existe otra categoría con el mismo nombre normalizado, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-015**: WHEN el usuario crea o edita una categoría de gasto, IF el presupuesto mensual tiene un valor no numérico, menor o igual a 0 o con más de 2 decimales, THEN the system SHALL rechazar la operación. Un presupuesto vacío significa "sin presupuesto". Las categorías de ingreso SHALL NOT tener presupuesto (el campo no se muestra).

* **REQ-016**: the system SHALL NOT permitir eliminar ni cambiar el tipo de las categorías del sistema (`cat-otros-gastos`, `cat-otros-ingresos`). Sí se pueden renombrar y, en el caso de "Otros gastos", asignarles presupuesto.

* **REQ-017**: WHEN el usuario solicita eliminar una categoría con movimientos, THEN the system SHALL mostrar cuántos movimientos tiene y SHALL exigir que elija una categoría **del mismo tipo** a la cual reasignarlos; solo tras confirmar SHALL reasignar los movimientos (y, desde la v4, las programaciones que la usan) y eliminar la categoría.

* **REQ-018**: WHEN el usuario solicita eliminar una categoría sin movimientos, THEN the system SHALL pedir confirmación explícita y, solo tras confirmar, eliminarla.

* **REQ-019**: WHEN el usuario edita una categoría, IF la categoría tiene al menos un movimiento o una programación (v4), THEN the system SHALL NOT permitir cambiar su tipo.

---

## 3. Movimientos

* **REQ-020**: WHEN el usuario registra un movimiento, THEN the system SHALL solicitar tipo (`ingreso`, `gasto` o `transferencia`), fecha, monto, descripción y cuenta; además la **categoría** (ingreso y gasto) o la **cuenta destino** (transferencia).

* **REQ-021**: WHEN el usuario abre el registro de movimientos, IF no existe ninguna cuenta **activa**, THEN the system SHALL deshabilitar el formulario, mostrar el mensaje "Primero cree una cuenta" y un acceso a la pestaña Cuentas.

* **REQ-022**: WHEN el usuario registra o edita un movimiento, IF el monto es menor o igual a 0, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-023**: WHEN el usuario registra o edita un movimiento, IF el monto está vacío o no es numérico, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-024**: WHEN el usuario registra o edita un movimiento, IF el monto tiene más de 2 decimales, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-025**: WHEN el usuario registra o edita un movimiento, IF la descripción está vacía, contiene solo espacios o supera 80 caracteres, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-026**: WHEN el usuario registra o edita un movimiento, IF la fecha está vacía o no es una fecha de calendario válida en formato `YYYY-MM-DD` (por ejemplo `2026-02-30`), THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-027** *(modificado en v4)*: WHEN el usuario registra o edita un movimiento, IF la fecha es posterior a la fecha local de hoy, THEN the system SHALL rechazarlo e indicar que use la opción **🗓 Programar** (REQ-079). *(v1–v2: se rechazaba toda fecha futura; v3: se aceptaba hasta un año como movimiento programado.)*

* **REQ-028**: WHEN el usuario registra o edita un ingreso o un gasto, IF no eligió categoría o la categoría no es del mismo tipo que el movimiento, THEN the system SHALL rechazar la operación. El selector SHALL mostrar solo las categorías del tipo del movimiento.

* **REQ-029**: WHEN el usuario registra o edita una transferencia, IF no eligió cuenta destino o la cuenta destino es la misma que la de origen, THEN the system SHALL rechazar la operación. Una transferencia SHALL NOT tener categoría.

* **REQ-030**: WHEN el usuario registra o edita un gasto o una transferencia cuya cuenta de origen es líquida, IF el monto supera el saldo disponible de esa cuenta, THEN the system SHALL rechazar la operación y mostrar "Saldo insuficiente: disponible ₡X".

* **REQ-031**: WHEN el usuario registra o edita un gasto o una transferencia cuya cuenta de origen es de crédito, IF el monto supera el crédito disponible, THEN the system SHALL rechazar la operación y mostrar "Excede el límite de crédito: disponible ₡X".

* **REQ-032**: WHEN el usuario registra o edita una transferencia hacia una cuenta de crédito (pago de tarjeta), IF el monto supera la deuda actual de esa tarjeta, THEN the system SHALL rechazar la operación y mostrar "El pago excede la deuda: ₡X". WHEN el usuario registra un **ingreso** en una cuenta de crédito, THEN the system SHALL rechazarlo e indicar que los pagos de tarjeta se registran como transferencia.

* **REQ-033**: WHEN el usuario registra un movimiento, IF ya existe otro movimiento con el mismo tipo, cuenta, monto, fecha y descripción normalizada, THEN the system SHALL advertir del posible duplicado y pedir confirmación; SHALL NOT guardarlo hasta que el usuario confirme, y si cancela el formulario SHALL conservar los datos ingresados.

* **REQ-034**: WHEN el usuario edita un movimiento, THEN the system SHALL aplicar las mismas validaciones del registro, evaluando los saldos **como si el movimiento original no existiera**, y SHALL recalcular las cuentas, categorías y meses afectados (los anteriores y los nuevos).

* **REQ-035**: WHEN el usuario solicita eliminar un movimiento, THEN the system SHALL pedir confirmación explícita. IF eliminarlo dejaría una cuenta líquida con saldo negativo (por ejemplo, borrar un ingreso que ya se gastó) o una cuenta de crédito por encima de su límite (por ejemplo, borrar un pago), THEN the system SHALL rechazar la eliminación y explicar el motivo.

* **REQ-036**: the system SHALL listar los movimientos del mes seleccionado agrupados por fecha, mostrando en cada grupo el **Neto del Día** (`Σ ingresos − Σ gastos` de esa fecha; las transferencias no cuentan). El usuario SHALL poder filtrar por cuenta y por categoría; los filtros SHALL NOT modificar datos.

* **REQ-037**: the system SHALL ordenar los movimientos por fecha descendente y, dentro de la misma fecha, por fecha de creación descendente.

---

## 4. Resumen mensual y presupuestos

* **REQ-038**: WHEN la aplicación se abre, THEN the system SHALL seleccionar el mes actual (fecha local). El usuario SHALL poder cambiar al mes anterior o siguiente.

* **REQ-039**: WHEN cambia el mes seleccionado o se registra, edita o elimina un movimiento, THEN the system SHALL calcular para el mes: **Ingresos del mes** (`Σ ingresos`), **Gastos del mes** (`Σ gastos`) y **Balance neto** (`ingresos − gastos`). Las transferencias SHALL NOT contarse como ingreso ni como gasto.

* **REQ-040**: the system SHALL calcular la **Tasa de ahorro** del mes como `balance neto / ingresos del mes × 100`. IF los ingresos del mes son 0, THEN the system SHALL mostrar "—" en lugar de un porcentaje.

* **REQ-041**: WHEN una categoría de gasto tiene presupuesto mensual, THEN the system SHALL mostrar `gastado del mes / presupuesto`, el porcentaje consumido y un estado: **Verde** (≤ 80 %), **Ámbar** (> 80 % y ≤ 100 %) o **Rojo** (> 100 %).

* **REQ-042**: WHEN un gasto hace que una categoría supere su presupuesto mensual, THEN the system SHALL registrar el gasto de todos modos y SHALL NOT bloquearlo; el exceso solo se alerta.

* **REQ-043**: WHEN una categoría de gasto no tiene presupuesto, THEN the system SHALL mostrar "Sin presupuesto" junto con lo gastado en el mes y SHALL NOT asignarle estado de color.

* **REQ-044**: WHEN se guarda un gasto que hace pasar a su categoría al estado Rojo en el mes del gasto, THEN the system SHALL mostrar un aviso "Superó el presupuesto de <categoría>" después de guardar.

* **REQ-045**: the system SHALL mostrar los montos con el símbolo ₡, separador de miles y 2 decimales, y los porcentajes como entero redondeado. Los estados de color SHALL evaluarse con el valor sin redondear.

* **REQ-046**: WHEN el balance neto del mes o el Neto del Día es negativo, THEN the system SHALL mostrarlo con signo menos y en estilo de alerta.

---

## 5. Restricciones del cliente (comportamiento que no cambia)

* **REQ-047**: the system SHALL NOT enviar datos a servidores externos ni requerir conexión a internet.

* **REQ-048**: the system SHALL NOT eliminar cuentas, categorías ni movimientos como efecto secundario de otra operación. La única modificación colateral permitida es la reasignación de categoría confirmada por el usuario (REQ-017).

* **REQ-049**: the system SHALL NOT permitir editar el saldo de una cuenta directamente: el saldo es siempre un valor derivado de su saldo inicial y sus movimientos.

* **REQ-050** *(modificado en v4)*: the system SHALL NOT crear movimientos automáticamente (intereses, ajustes, sugerencias), **salvo** las ocurrencias de una programación en modo auto-débito que el usuario configuró, en su fecha o después (REQ-082). Todo otro movimiento lo ingresa el usuario.

---

## 6. Persistencia local

* **REQ-051**: WHEN ocurre cualquier creación, edición o eliminación, THEN the system SHALL guardar el estado completo en `localStorage` (clave `finanzapp.state`).

* **REQ-052**: WHEN la aplicación inicia, IF existe un estado guardado válido, THEN the system SHALL restaurarlo completo.

* **REQ-053**: WHEN la aplicación inicia, IF el estado guardado no es JSON válido o no cumple el contrato de datos, THEN the system SHALL iniciar con el estado vacío (con las categorías predeterminadas), mostrar un aviso de datos dañados y SHALL NOT bloquear el uso de la aplicación.

* **REQ-054**: WHEN falla el guardado en `localStorage` (cuota llena o navegación privada), THEN the system SHALL mantener los cambios en memoria, mostrar un aviso y reintentar el guardado en la siguiente modificación.

---

## 7. Interfaz y retroalimentación

* **REQ-055**: WHEN un formulario tiene errores, THEN the system SHALL mostrar cada mensaje junto a su campo mientras el usuario escribe y SHALL deshabilitar el botón Guardar. WHEN una operación es rechazada, THEN el estado guardado SHALL NOT cambiar y el formulario SHALL conservar lo escrito.

* **REQ-056**: WHEN un texto ingresado por el usuario contiene caracteres como `<` o `>`, THEN the system SHALL mostrarlo literalmente y SHALL NOT interpretarlo como HTML.

* **REQ-057**: the system SHALL acompañar todo estado de color (Verde, Ámbar, Rojo, saldos negativos) con un texto que lo describa, para no depender solo del color.

---

## 8. Cuentas: ahorros, tarjetas y archivo (v2)

* **REQ-058**: WHEN el usuario registra o edita un **gasto**, IF la cuenta es de tipo `ahorros`, THEN the system SHALL rechazarlo e indicar que primero transfiera el dinero a una cuenta de efectivo o débito. Las cuentas de ahorros SHALL aceptar ingresos y transferencias.

* **REQ-059**: the system SHALL mostrar en el Resumen, además del Patrimonio, el **Disponible para gastar** (`Σ saldos de efectivo y débito`), los **Ahorros** (`Σ saldos de ahorros`) y las **Deudas** (`Σ deudas de crédito`), de modo que `Patrimonio = Disponible + Ahorros − Deudas`.

* **REQ-060**: WHEN el usuario crea o edita una cuenta de crédito, IF el día de corte o el día de pago está vacío, no es un número entero o está fuera del rango 1–28, THEN the system SHALL rechazar la operación y mostrar un mensaje de error en vivo.

* **REQ-061**: WHEN una cuenta de crédito tiene día de corte y día de pago, THEN the system SHALL mostrar: el **último corte** (la fecha más reciente con ese día estrictamente anterior a hoy), la **fecha de pago** (la primera fecha con el día de pago posterior al último corte) y el **pago del periodo** = `deuda a la fecha del último corte − pagos (transferencias hacia la tarjeta) con fecha posterior al corte y no posterior a hoy`, con mínimo 0. *(v3: los pagos programados no cuentan como pagados.)*

* **REQ-062**: WHEN el pago del periodo de una tarjeta es mayor que 0, IF faltan 7 días o menos para la fecha de pago, THEN the system SHALL mostrar en el Resumen el aviso "El pago de <tarjeta> vence en N días: ₡X"; IF la fecha de pago ya pasó, THEN SHALL mostrar "Pago vencido de <tarjeta>: ₡X".

* **REQ-063**: WHEN el usuario solicita archivar una cuenta, IF su saldo no es 0 (líquida) o su deuda no es 0 (crédito), o tiene movimientos programados (v3), THEN the system SHALL rechazar la operación e indicar que primero transfiera o pague el saldo; en caso contrario SHALL pedir confirmación y marcarla como archivada.

* **REQ-064**: WHILE una cuenta está archivada, the system SHALL ocultarla de los selectores de cuenta y de la lista principal de cuentas (se muestra en la sección "Archivadas"), SHALL conservar y mostrar sus movimientos y SHALL rechazar movimientos nuevos o editados que la usen, salvo que el movimiento editado ya la tuviera.

* **REQ-065**: WHEN el usuario solicita reactivar una cuenta archivada, THEN the system SHALL marcarla como activa de nuevo sin modificar sus movimientos.

* **REQ-066**: the system SHALL mostrar cada cuenta como una tarjeta visual con su nombre, tipo y saldo. WHEN el usuario abre una cuenta, THEN the system SHALL mostrar su detalle: todos sus movimientos (fecha descendente) con el **saldo de la cuenta después de cada movimiento**, calculado en orden cronológico (fecha y luego fecha de creación).

---

## 9. Registro rápido (v2)

* **REQ-067**: WHILE exista al menos una cuenta activa, the system SHALL mostrar en todas las pestañas un botón "+ Registrar" que abre el **registro rápido** de gastos e ingresos con Monto, Categoría y Descripción, y con Fecha = hoy y Cuenta = la cuenta activa usada en el movimiento creado más recientemente (o la primera activa), ambas editables. El registro rápido SHALL aplicar las mismas validaciones y confirmaciones que el formulario completo (REQ-022..REQ-033, REQ-058) y, al guardar, SHALL cerrarse y mostrar la confirmación.

* **REQ-068**: WHEN el usuario cancela el registro rápido (botón Cancelar o tecla Escape), THEN the system SHALL cerrarlo sin guardar y SHALL NOT modificar el estado.

---

## 10. Presupuestos (v2)

* **REQ-069**: the system SHALL mostrar los presupuestos en una pestaña propia "Presupuestos", separada de la configuración de categorías. Para cada categoría con presupuesto y saldo restante positivo SHALL mostrar "Le quedan ₡X para N días (₡Y por día)", donde N = días restantes del mes incluyendo hoy (mes actual) o todos los días del mes (mes futuro); en un mes pasado SHALL mostrar "Mes cerrado".

* **REQ-070** *(modificado en v6)*: the system SHALL permitir definir un **presupuesto total mensual** opcional. WHEN se guarda, IF el valor no es numérico, es menor o igual a 0 o tiene más de 2 decimales, THEN the system SHALL rechazarlo; un valor vacío lo elimina. WHEN existe, THEN the system SHALL comparar con ese total lo **consumido del mes = gastos del mes + apartado a ahorros del mes** (REQ-092), usando los mismos estados de REQ-041; SHALL NOT bloquear ningún gasto ni transferencia y SHALL mostrar el aviso de REQ-044 cuando un gasto o una transferencia a ahorros lo lleve a Rojo. *(v2–v5: solo contaban los gastos.)*

* **REQ-071**: WHEN existe presupuesto total mensual, IF la suma de los presupuestos por categoría es mayor que el total, THEN the system SHALL mostrar una advertencia informativa con ambos montos, sin bloquear nada.

* **REQ-072**: WHEN la aplicación inicia, IF el estado guardado cumple el contrato `schemaVersion 1`, THEN the system SHALL migrarlo a `schemaVersion 2` sin perder datos (cuentas activas, sin fechas de tarjeta y sin presupuesto total) y SHALL guardarlo migrado.

---

## 11. Movimientos programados con fecha futura (v3 — reemplazada en v4)

* **REQ-073** a **REQ-078**: *Eliminados en v4.* En la v3 un movimiento con fecha futura quedaba "programado" y apartaba dinero. La v4 los reemplaza por **programaciones** (§12): el usuario marca "🗓 Programar", elige frecuencia y modo, y las ocurrencias se proyectan en cada mes. Los movimientos con fecha futura guardados con la v3 se convierten en programaciones (REQ-090).

---

## 12. Programaciones: pagos e ingresos fijos (v4)

* **REQ-079** *(modificado en v5)*: WHEN el usuario marca **🗓 Programar** en el formulario de movimiento o en el registro rápido, THEN the system SHALL pedir, además de los datos del movimiento (tipo, monto, descripción, cuenta, categoría o cuenta destino), la **frecuencia** (`Una vez`, `Cada mes` o `Quincenal`), la **primera fecha**, **¿hasta cuándo?** (no aplica a "Una vez"): `🔁 Sin fin` por defecto —se repite hasta que el usuario la elimine— o `📅 Hasta una fecha`, que entonces pide la fecha del último pago (v5.2) y, solo para **gastos y transferencias**, el **modo** (`Auto-débito` o `Confirmar manualmente`). Un **ingreso** programado SHALL NOT pedir modo: se registra automáticamente en su fecha (v5.1), como un depósito de salario. SHALL aplicar las mismas validaciones de campos que a un movimiento (REQ-022..REQ-026, REQ-028, REQ-029, REQ-032 2.ª parte, REQ-058, REQ-064), y además: IF la primera fecha está más de 365 días antes o después de hoy, o eligió «Hasta una fecha» sin indicarla, o la fecha hasta es anterior a la primera fecha, THEN SHALL rechazar la operación con un error en vivo. *(v4: la primera fecha no podía ser anterior a hoy.)* La regla de fondos (RN-03) no se evalúa al programar, sino al aplicar cada ocurrencia (REQ-082, REQ-083).

* **REQ-080**: the system SHALL calcular las **ocurrencias** de cada programación: *Una vez* → la primera fecha; *Cada mes* → el mismo día de cada mes desde la primera fecha (si el mes no tiene ese día, el último día del mes); *Quincenal* → los días **15 y último de cada mes** a partir de la primera fecha. IF hay fecha hasta, THEN SHALL NOT generar ocurrencias posteriores. El formulario SHALL mostrar las próximas 3 fechas y, en quincenal, el equivalente mensual ("≈ ₡80,000 al mes" para ₡40,000 por quincena).

* **REQ-081**: WHEN el usuario consulta cualquier mes, THEN the system SHALL mostrar en la lista de ese mes las ocurrencias no aplicadas ni omitidas, con la etiqueta "🗓 Programado · Auto-débito/Manual · en N días" (futuras) o "⏳ Pendiente de confirmar" (fecha ≤ hoy), y SHALL incluirlas en los Ingresos, Gastos, Balance neto y Tasa de ahorro del mes y en los presupuestos, indicando "Incluye ₡X programados". Así, al pasar de octubre a noviembre se ven los gastos e ingresos fijos de noviembre.

* **REQ-082**: WHEN la aplicación se abre o vuelve a mostrarse, IF una ocurrencia en modo **auto-débito** tiene fecha ≤ hoy y no fue aplicada ni omitida, THEN the system SHALL crear el movimiento con la fecha de la ocurrencia, enlazado a su programación, y SHALL avisar "Se aplicaron N pagos automáticos". IF crearlo violaría la regla de fondos (RN-03) o usa una cuenta archivada, THEN SHALL NOT crearlo, SHALL dejarlo como pendiente y SHALL avisar "No se pudo aplicar el auto-débito de <descripción>: <motivo>".

* **REQ-083**: WHILE existan ocurrencias pendientes (modo manual con fecha ≤ hoy, o auto-débito que no se pudo aplicar), the system SHALL mostrarlas en el Resumen en "Pendientes de confirmar" con las acciones **Confirmar** (crea el movimiento tal cual, con todas las validaciones de un movimiento), **Ajustar** (abre el formulario precargado; al guardar queda enlazado a la ocurrencia) y **Omitir** (no crea movimiento).

* **REQ-084**: WHEN el usuario elige **Omitir esta vez** en una ocurrencia futura o pendiente, THEN the system SHALL marcarla como omitida, SHALL NOT crear movimiento por ella y SHALL dejar de proyectarla, sin cambiar las demás ocurrencias.

* **REQ-085**: WHEN el usuario edita una programación, THEN the system SHALL aplicar los cambios solo a las ocurrencias no aplicadas; los movimientos ya creados SHALL NOT cambiar. WHEN el usuario elimina una programación, THEN the system SHALL pedir confirmación, SHALL dejar de proyectar sus ocurrencias y SHALL conservar los movimientos ya creados (desenlazados).

* **REQ-086**: WHEN el usuario elimina un movimiento creado por una programación, THEN the system SHALL marcar esa ocurrencia como omitida, de modo que el auto-débito no la vuelva a crear.

* **REQ-087**: WHEN, sumando a los saldos actuales las ocurrencias pendientes y programadas hasta el último día del mes actual, una cuenta líquida quedaría con saldo negativo o una tarjeta superaría su límite en alguna fecha, THEN the system SHALL mostrar en el Resumen el aviso "Con los programados, <cuenta> quedaría en ₡X el <fecha>". El aviso SHALL NOT bloquear nada.

* **REQ-088**: the system SHALL mostrar en cada cuenta, IF tiene ocurrencias pendientes o programadas en el mes actual, el saldo **proyectado a fin de mes**, y en el desglose del Resumen el disponible para gastar proyectado a fin de mes. El Patrimonio, las deudas y el saldo actual SHALL usar solo movimientos reales.

* **REQ-089**: the system SHALL mostrar la lista de **Pagos programados** con descripción, monto, frecuencia, modo, cuenta, próxima fecha y equivalente mensual, con acciones editar y eliminar. WHEN el usuario intenta eliminar o archivar una cuenta usada por una programación con ocurrencias futuras o pendientes, THEN the system SHALL rechazarlo e indicar qué programación la usa.

* **REQ-090**: WHEN la aplicación inicia con un estado `schemaVersion 2`, THEN the system SHALL migrarlo a `schemaVersion 3` sin perder datos: cada movimiento con fecha posterior a hoy SHALL convertirse en una programación "Una vez" en modo auto-débito con los mismos datos.

* **REQ-091** *(v5)*: WHEN el usuario crea o edita una programación cuya primera fecha es anterior a hoy, THEN the system SHALL listar las ocurrencias con fecha anterior a hoy que no estén aplicadas ni omitidas y SHALL pedir qué hacer con ellas: **Registrarlas ahora** (crea un movimiento por cada una, con su fecha y enlazado a la programación) o **Ya las registré** (las marca como omitidas). IF registrarlas violaría la regla de fondos (RN-03) en alguna fecha, THEN the system SHALL rechazar la operación indicando la fecha y la cuenta, y SHALL NOT guardar nada. La ocurrencia de hoy y las futuras siguen el modo elegido (REQ-082, REQ-083).

---

## 13. Ahorro dentro del presupuesto y metas de ahorro (v6)

* **REQ-092** *(v6)*: the system SHALL calcular el **apartado a ahorros** de un mes como la suma de las transferencias del mes **hacia** cuentas de tipo ahorros menos las transferencias del mes **desde** cuentas de ahorros hacia cuentas de otro tipo, con un mínimo de ₡0, incluyendo las ocurrencias abiertas de programaciones (REQ-081). La tarjeta del presupuesto total SHALL mostrar por separado los **gastos** y el **apartado a ahorros**, con una barra de dos tramos de distinto color y texto. El apartado SHALL NOT contarse como gasto en el Resumen, la tasa de ahorro ni los presupuestos por categoría.

* **REQ-093** *(v6)*: WHEN el usuario crea o edita una cuenta de tipo **ahorros**, THEN the system SHALL permitir indicar una **meta de ahorro** opcional (monto) y una **razón** opcional (texto de hasta 60 caracteres, por ejemplo "Fondo de emergencia"). IF la meta no es numérica, es menor o igual a 0 o tiene más de 2 decimales, THEN the system SHALL rechazarla con un error en vivo. IF se escribe una razón sin meta, THEN the system SHALL pedir el monto de la meta. Las cuentas de otro tipo SHALL NOT tener meta; al cambiar una cuenta a otro tipo, la meta SHALL eliminarse.

* **REQ-094** *(v6)*: WHILE una cuenta de ahorros tiene meta, the system SHALL mostrar en su tarjeta, en su detalle y en la sección **Metas de ahorro** de la pestaña Presupuestos: la razón (o "Meta de ahorro"), el saldo actual frente a la meta con porcentaje y barra, y lo que falta. IF existen programaciones activas que transfieren a esa cuenta, THEN the system SHALL mostrar el aporte mensual equivalente y el mes estimado en que se alcanza la meta ("con ₡X al mes la alcanza en N meses: <mes año>").

* **REQ-095** *(v6)*: WHEN el saldo de una cuenta de ahorros con meta es mayor o igual a la meta, THEN the system SHALL mostrar "✓ ¡Meta alcanzada!" con la barra completa en verde, sin ocultar la cuenta ni la meta. WHEN una transferencia hace que se alcance la meta, THEN the system SHALL mostrarlo en el mensaje de confirmación.

---

## Trazabilidad rápida: reglas de negocio complejas (requisito del Proyecto Final)

| Regla compleja | REQ | Por qué es compleja |
|---|---|---|
| Fondos suficientes según el tipo de cuenta | REQ-030, REQ-031, REQ-032, REQ-034, REQ-035 | Depende del tipo de cuenta, del saldo derivado y, al editar o borrar, de un estado hipotético |
| Presupuesto mensual con estados y alerta sin bloqueo | REQ-041, REQ-042, REQ-043, REQ-044 | Filtra por mes y categoría, usa umbrales y contrasta con la regla de fondos (que sí bloquea) |
| Detección de duplicados con confirmación | REQ-033 | Compara cinco campos normalizados y exige confirmación sin perder el formulario |
| Eliminación de categoría con reasignación | REQ-017, REQ-016, REQ-048 | Modifica movimientos relacionados solo tras confirmación y respeta el tipo |
| Pago del periodo de la tarjeta | REQ-061, REQ-062 | Combina día de corte, día de pago, fecha de hoy y movimientos antes y después del corte |
| Archivar cuentas | REQ-063, REQ-064, REQ-065 | Exige saldo cero y cambia qué cuentas se pueden usar sin borrar historial |
| Programaciones con auto-débito | REQ-079..REQ-083, REQ-086 | Calcula ocurrencias por frecuencia, crea movimientos solo si cumplen la regla de fondos y evita duplicar o recrear ocurrencias |
| Proyección del mes | REQ-081, REQ-087, REQ-088 | Combina movimientos reales y ocurrencias futuras en resumen, presupuestos y alertas sin tocar el saldo real |
| Presupuesto total vs. por categoría | REQ-069, REQ-070, REQ-071 | Dos niveles de presupuesto con días restantes del mes y advertencia de inconsistencia |
| Ahorro en el presupuesto y metas | REQ-070, REQ-092..REQ-095 | Distingue transferencias según el tipo de las dos cuentas, neto y con mínimo 0; la meta combina saldo real y programaciones para estimar la fecha |
