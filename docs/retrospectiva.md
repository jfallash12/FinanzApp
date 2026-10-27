# Retrospectiva — FinanzApp

*Jose Fallas*

## De dónde salió la app

Quería algo para llevar mis finanzas: saber cuánto me entra, cuánto me sale y en qué cuenta tengo la plata, sin gastar
más de lo que tengo. Tomé la estructura de mi proyecto anterior (Mochila) porque ya conocía el flujo: primero los
requerimientos, después el contrato de datos, el diseño, las tareas y al final el código. Elegí cuentas, categorías y
movimientos porque las tres se relacionan de verdad: un movimiento siempre sale o entra a una cuenta y casi siempre tiene categoría.

Al inicio no tenía un cliente real, así que yo mismo hice de cliente: me hice preguntas como "¿qué pasa si quiero gastar
más de lo que tengo?" o "¿cómo registro el pago de la tarjeta?" y con esas respuestas escribí las primeras reglas.

## Lo que le quité a la IA (poda de sobreingeniería)

Cuando le pedí a la IA un diseño, lo primero que propuso fue más de lo que necesitaba. Esto fue lo que descarté y por qué:

- **React o Vue:** el curso pide HTML, CSS y JavaScript sin frameworks, y además ocupaban un proceso de build. Con funciones que arman el DOM me bastó.
- **Redux o un store:** es una app de un solo usuario con un solo estado. Un `state` y una función `dispatch` hacen lo mismo y se entienden mejor.
- **Backend, base de datos, IndexedDB:** los datos son míos y viven en mi navegador. `localStorage` alcanza para este volumen.
- **Guardar el saldo en la cuenta:** parece lo obvio, pero se descuadra con los movimientos. El saldo se calcula siempre.
- **Chart.js y un validador de JSON Schema (Ajv):** son dependencias externas. Las barras las hice en CSS y el validador del contrato lo escribió la IA a mano.
- **ES Modules:** no cargan abriendo el archivo con doble clic (`file://`), así que quedaron scripts clásicos.

Lo que aprendí aquí es que la IA no propone lo más simple, propone lo más "completo". Si no le pongo límites desde el
principio, el proyecto crece por lado.

## Lo que salió mal y lo que aprendí

**La regla de fondos solo revisaba el saldo final.** En la primera versión la app solo verificaba que el saldo al final no
quedara negativo. Cuando agregué el detalle de cuenta con el saldo después de cada movimiento, vi que mis propios datos de
prueba dejaban el efectivo en −₡3,700 el 15 de octubre. La IA había hecho exactamente lo que yo especifiqué; el error era
mío. Desde ahí la regla revisa el saldo en cada fecha.

**Prohibir algo no es resolverlo.** Al principio prohibí las fechas futuras para evitar errores de digitación. Después
quise anotar la renta del 31 y no pude. Hice una versión con movimientos de fecha futura que terminé desechando, porque lo
que yo quería eran pagos fijos que se repitieran. Ahí nacieron las programaciones: una vez, cada mes o quincenal, con
auto-débito o con confirmación. Perdí una versión entera por no pensar el caso completo desde el inicio.

**La IA cumple lo que uno escribe, no lo que uno piensa.** Esto me pasó varias veces:

- El salario programado me preguntaba si quería "auto-débito o confirmar". Para un ingreso eso no tiene sentido, pero mi requerimiento trataba igual ingresos y gastos.
- Un campo "Hasta (opcional)" siempre visible me hizo dudar si el salario se repetía todos los meses, y terminé poniendo la misma fecha del primer pago. Ahora la opción por defecto es "Sin fin".
- Pasaba ₡100,000 a ahorros y el presupuesto no bajaba, porque mi requerimiento decía "presupuesto para todos los gastos" y una transferencia no es un gasto. Yo sí quería que bajara: un ahorro no es para gastar.
- La meta decía "₡200,000 al mes" cuando yo había programado ₡100,000. El cálculo estaba bien, pero mostraba solo el total y no podía saber de dónde salía. Ahora muestra cada aporte.
- Al pasar a noviembre seguían saliendo los pagos del 31 de octubre en "Próximos programados". Esa tarjeta se había quedado sin requerimiento cuando cambié a programaciones.

En todos estos casos la lección fue la misma: cuando un requerimiento solo dice el resultado ("muestre el total"),
sin el caso concreto que lo motiva, la IA lo cumple al pie de la letra y no queda como uno lo imaginaba.

**Las pruebas sí sirven.** El recorrido de punta a punta encontró un error real: "Ajustar" una ocurrencia pendiente
guardaba el movimiento sin enlazarlo, y la ocurrencia seguía apareciendo como pendiente. Sin esas pruebas lo hubiera
entregado así.

## Cómo trabajé con la IA

Lo que mejor me funcionó fue el orden: primero cambiar `requirements.md`, después el contrato y el diseño, después las
tareas y hasta el final el código. Al principio me parecía lento, pero cada vez que me salté ese orden apareció un
problema después. También me ayudó que `CLAUDE.md` le prohibiera a la IA agregar cosas que no estuvieran especificadas:
cuando pedí las metas de ahorro, primero tuve que escribir los requerimientos y hasta ahí la IA las programó.

Ser el "Head Chef" no es solo pedir cosas. Me tocó revisar cada cambio, usar la app de verdad y darme cuenta de lo que
no me gustaba. Casi todas las mejoras salieron de usar la app, no de leer el código.

## Lo que haría diferente

- **Pensar los casos reales desde el inicio:** pagos fijos, ahorro y metas. Me hubiera ahorrado versiones enteras.
- **Commits pequeños y por tarea**, con mensajes que digan qué cambió. Al principio hice commits grandes por versión y ahí se pierde cómo avanzó el trabajo.
- **No mezclar el proceso con los entregables.** Mis documentos de diseño y el contrato terminaron llenos de historia ("en la v3…", "pedido del estudiante") y de datos de ejemplo. El profesor me lo señaló y tiene razón: el diseño debe mostrar solo la versión final, el contrato solo la estructura, y el proceso queda en los commits y en esta retrospectiva.
- **Mantener `CLAUDE.md` corto.** Lo fui llenando con todo y se volvió difícil de leer, incluso para la IA. Lo dejé con lo esencial: el rol de la IA, el lenguaje del negocio y las invariantes.
