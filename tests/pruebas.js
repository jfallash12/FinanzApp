/*
 * pruebas.js — Pruebas de regresión de la lógica pura (calculations, validations, storage).
 * Sin librerías: abrir tests/pruebas.html con doble clic. Usa el dataset oficial (tests/datos-ejemplo.json).
 * Cada prueba indica el REQ / RN que protege (Unchanged Behavior).
 */
(function () {
  'use strict';

  var calc = FinanzApp.calc, v = FinanzApp.validate, storage = FinanzApp.storage;
  var TODAY = '2026-10-26';
  var results = [];

  function test(name, fn) {
    try { var ok = fn(); results.push({ name: name, ok: ok === true, detail: ok === true ? '' : String(ok) }); }
    catch (e) { results.push({ name: name, ok: false, detail: e.message }); }
  }
  function eq(a, b) { return a === b ? true : 'esperado ' + JSON.stringify(b) + ', obtenido ' + JSON.stringify(a); }
  function has(obj, key, text) {
    if (!obj[key]) { return 'sin error en "' + key + '": ' + JSON.stringify(obj); }
    return obj[key].indexOf(text) !== -1 ? true : 'mensaje: ' + obj[key];
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Dataset oficial = tests/datos-ejemplo.json (copiado aquí porque file:// no permite leer archivos). */
  var DATA = {
    schemaVersion: 3,
    accounts: [
      {"id": "acc-efectivo", "name": "Efectivo", "type": "efectivo", "initialBalance": 25000, "archived": false, "createdAt": "2026-09-01T08:00:00.000Z"},
      {"id": "acc-bac", "name": "Cuenta BAC", "type": "debito", "initialBalance": 150000, "archived": false, "createdAt": "2026-09-01T08:01:00.000Z"},
      {"id": "acc-ahorros", "name": "Ahorros BN", "type": "ahorros", "initialBalance": 200000, "archived": false, "createdAt": "2026-09-01T08:01:30.000Z", "goalAmount": 1000000, "goalReason": "Fondo de emergencia"},
      {"id": "acc-visa", "name": "Tarjeta Visa", "type": "credito", "creditLimit": 300000, "cutoffDay": 15, "paymentDay": 28, "archived": false, "createdAt": "2026-09-01T08:02:00.000Z"},
      {"id": "acc-tarjeta-vieja", "name": "Tarjeta vieja", "type": "credito", "creditLimit": 100000, "cutoffDay": 5, "paymentDay": 20, "archived": true, "createdAt": "2026-01-10T08:00:00.000Z"}
    ],
    categories: [
      {"id": "cat-alimentacion", "name": "Alimentación", "kind": "gasto", "monthlyBudget": 120000, "system": false},
      {"id": "cat-transporte", "name": "Transporte", "kind": "gasto", "monthlyBudget": 40000, "system": false},
      {"id": "cat-vivienda", "name": "Vivienda", "kind": "gasto", "monthlyBudget": 250000, "system": false},
      {"id": "cat-servicios", "name": "Servicios", "kind": "gasto", "monthlyBudget": 55000, "system": false},
      {"id": "cat-entretenimiento", "name": "Entretenimiento", "kind": "gasto", "monthlyBudget": 30000, "system": false},
      {"id": "cat-salud", "name": "Salud", "kind": "gasto", "system": false},
      {"id": "cat-otros-gastos", "name": "Otros gastos", "kind": "gasto", "system": true},
      {"id": "cat-salario", "name": "Salario", "kind": "ingreso", "system": false},
      {"id": "cat-otros-ingresos", "name": "Otros ingresos", "kind": "ingreso", "system": true}
    ],
    transactions: [
      {"id": "mov-001", "type": "gasto", "accountId": "acc-efectivo", "categoryId": "cat-alimentacion", "amount": 15000, "date": "2026-09-28", "description": "Panadería", "createdAt": "2026-09-28T15:00:00.000Z"},
      {"id": "mov-002", "type": "ingreso", "accountId": "acc-bac", "categoryId": "cat-salario", "amount": 650000, "date": "2026-10-01", "description": "Salario octubre", "createdAt": "2026-10-01T14:00:00.000Z"},
      {"id": "mov-003", "type": "gasto", "accountId": "acc-bac", "categoryId": "cat-vivienda", "amount": 250000, "date": "2026-10-02", "description": "Alquiler octubre", "createdAt": "2026-10-02T14:00:00.000Z"},
      {"id": "mov-013", "type": "transferencia", "accountId": "acc-bac", "toAccountId": "acc-ahorros", "amount": 50000, "date": "2026-10-02", "description": "Ahorro mensual", "createdAt": "2026-10-02T15:00:00.000Z"},
      {"id": "mov-004", "type": "transferencia", "accountId": "acc-bac", "toAccountId": "acc-efectivo", "amount": 40000, "date": "2026-10-03", "description": "Retiro en cajero", "createdAt": "2026-10-03T14:00:00.000Z"},
      {"id": "mov-005", "type": "gasto", "accountId": "acc-visa", "categoryId": "cat-alimentacion", "amount": 68500, "date": "2026-10-05", "description": "Supermercado", "createdAt": "2026-10-05T14:00:00.000Z"},
      {"id": "mov-006", "type": "gasto", "accountId": "acc-bac", "categoryId": "cat-servicios", "amount": 38900, "date": "2026-10-08", "description": "Electricidad y agua", "createdAt": "2026-10-08T14:00:00.000Z"},
      {"id": "mov-007", "type": "gasto", "accountId": "acc-efectivo", "categoryId": "cat-transporte", "amount": 18000, "date": "2026-10-10", "description": "Gasolina", "createdAt": "2026-10-10T14:00:00.000Z"},
      {"id": "mov-008", "type": "gasto", "accountId": "acc-visa", "categoryId": "cat-entretenimiento", "amount": 27500, "date": "2026-10-12", "description": "Cine y cena", "createdAt": "2026-10-12T14:00:00.000Z"},
      {"id": "mov-012", "type": "ingreso", "accountId": "acc-efectivo", "categoryId": "cat-otros-ingresos", "amount": 35000, "date": "2026-10-14", "description": "Venta de libros", "createdAt": "2026-10-14T14:00:00.000Z"},
      {"id": "mov-009", "type": "gasto", "accountId": "acc-efectivo", "categoryId": "cat-alimentacion", "amount": 31200, "date": "2026-10-15", "description": "Feria del agricultor", "createdAt": "2026-10-15T14:00:00.000Z"},
      {"id": "mov-010", "type": "gasto", "accountId": "acc-efectivo", "categoryId": "cat-transporte", "amount": 4500, "date": "2026-10-15", "description": "Bus", "createdAt": "2026-10-15T15:00:00.000Z"},
      {"id": "mov-011", "type": "transferencia", "accountId": "acc-bac", "toAccountId": "acc-visa", "amount": 60000, "date": "2026-10-20", "description": "Pago tarjeta", "createdAt": "2026-10-20T14:00:00.000Z"}
    ],
    schedules: [
      {"id": "prg-salario", "type": "ingreso", "accountId": "acc-bac", "categoryId": "cat-salario", "amount": 650000, "description": "Salario", "frequency": "monthly", "startDate": "2026-11-01", "mode": "auto", "skippedDates": [], "createdAt": "2026-10-20T10:00:00.000Z"},
      {"id": "prg-gasolina", "type": "gasto", "accountId": "acc-efectivo", "categoryId": "cat-transporte", "amount": 20000, "description": "Gasolina", "frequency": "biweekly", "startDate": "2026-11-01", "mode": "manual", "skippedDates": [], "createdAt": "2026-10-20T10:01:00.000Z"}
    ],
    settings: {"monthlyBudget": 450000}
  };

  function tx(o) {
    return Object.assign({ type: 'gasto', date: '2026-10-26', amount: '1000', description: 'Prueba', accountId: 'acc-bac', categoryId: 'cat-salud', toAccountId: '' }, o);
  }

  /* ---------- Fechas y dinero ---------- */
  test('isValidISODate rechaza 2026-02-30 (REQ-026)', function () { return eq(calc.isValidISODate('2026-02-30'), false); });
  test('isValidISODate acepta 2028-02-29', function () { return eq(calc.isValidISODate('2028-02-29'), true); });
  test('addMonths cruza el año', function () { return eq(calc.addMonths('2026-01', -1), '2025-12'); });
  test('monthLabel', function () { return eq(calc.monthLabel('2026-10'), 'Octubre 2026'); });
  test('sumAmounts sin error de coma flotante (D4)', function () { return eq(calc.sumAmounts([{ amount: 0.1 }, { amount: 0.2 }]), 0.3); });
  test('formatMoney con miles y signo (REQ-045)', function () { return eq(calc.formatMoney(-246400), '−₡246,400.00'); });
  test('hasMax2Decimals(6.505) = false (REQ-024)', function () { return eq(calc.hasMax2Decimals(6.505), false); });

  /* ---------- RN-01 / RN-02 saldos ---------- */
  test('RN-01 saldo Efectivo = ₡31,300', function () { return eq(calc.accountBalance(DATA, 'acc-efectivo'), 31300); });
  test('RN-01 saldo Cuenta BAC = ₡361,100', function () { return eq(calc.accountBalance(DATA, 'acc-bac'), 361100); });
  test('RN-01 deuda Visa = ₡36,000', function () { return eq(calc.creditDebt(DATA, 'acc-visa'), 36000); });
  test('RN-01 crédito disponible Visa = ₡264,000', function () { return eq(calc.availableFunds(DATA, 'acc-visa'), 264000); });
  test('RN-02 patrimonio = ₡606,400', function () { return eq(calc.netWorth(DATA), 606400); });
  test('RN-01 excluir movimiento (REQ-034)', function () { return eq(calc.accountBalance(DATA, 'acc-efectivo', 'mov-012'), -3700); });

  /* ---------- RN-05 / RN-06 / RN-07 ---------- */
  var oct = calc.monthSummary(DATA, '2026-10');
  test('RN-05 ingresos octubre ₡685,000', function () { return eq(oct.income, 685000); });
  test('RN-05 gastos octubre ₡438,600 (sin transferencias)', function () { return eq(oct.expense, 438600); });
  test('RN-05 balance neto ₡246,400', function () { return eq(oct.net, 246400); });
  test('RN-05 tasa de ahorro 36 %', function () { return eq(Math.round(oct.savingsRate), 36); });
  test('REQ-040 sin ingresos → null', function () { return eq(calc.monthSummary(DATA, '2026-09').savingsRate, null); });
  test('RN-06 Alimentación 83 % Ámbar', function () { var b = calc.budgetStatus(DATA, 'cat-alimentacion', '2026-10'); return eq(Math.round(b.percent) + b.status, '83warning'); });
  test('RN-06 Vivienda 100 % exacto = Ámbar (límite)', function () { return eq(calc.budgetStatus(DATA, 'cat-vivienda', '2026-10').status, 'warning'); });
  test('RN-06 80 % exacto = Verde', function () { return eq(calc.statusFromPercent(80), 'ok'); });
  test('RN-06 100.01 % = Rojo', function () { return eq(calc.statusFromPercent(100.01), 'exceeded'); });
  test('REQ-043 Salud sin presupuesto', function () { return eq(calc.budgetStatus(DATA, 'cat-salud', '2026-10').status, null); });
  test('RN-07 neto del 15 oct = −₡35,700', function () {
    var g = calc.groupByDate(calc.monthTransactions(DATA, '2026-10')).filter(function (x) { return x.date === '2026-10-15'; })[0];
    return eq(g.net, -35700);
  });
  test('REQ-037 orden: fecha y createdAt desc', function () {
    var g = calc.groupByDate(calc.monthTransactions(DATA, '2026-10')).filter(function (x) { return x.date === '2026-10-15'; })[0];
    return eq(g.items[0].description, 'Bus');
  });
  test('RN-08 duplicado normalizado', function () {
    return eq(!!calc.findDuplicate(DATA, { type: 'gasto', accountId: 'acc-efectivo', amount: 4500, date: '2026-10-15', description: '  BUS ' }), true);
  });

  /* ---------- Validaciones de movimientos ---------- */
  test('REQ-022 monto -5', function () { return has(v.validateTransaction(tx({ amount: '-5' }), DATA, null, TODAY), 'amount', 'mayor a 0'); });
  test('REQ-022 monto 0', function () { return has(v.validateTransaction(tx({ amount: '0' }), DATA, null, TODAY), 'amount', 'mayor a 0'); });
  test('REQ-023 monto "abc"', function () { return has(v.validateTransaction(tx({ amount: 'abc' }), DATA, null, TODAY), 'amount', 'número'); });
  test('REQ-024 monto 6.505', function () { return has(v.validateTransaction(tx({ amount: '6.505' }), DATA, null, TODAY), 'amount', '2 decimales'); });
  test('REQ-025 descripción en blanco', function () { return has(v.validateTransaction(tx({ description: '   ' }), DATA, null, TODAY), 'description', 'obligatoria'); });
  test('REQ-028 categoría de ingreso en un gasto', function () { return has(v.validateTransaction(tx({ categoryId: 'cat-salario' }), DATA, null, TODAY), 'categoryId', 'no corresponde'); });
  test('REQ-029 transferencia a la misma cuenta', function () { return has(v.validateTransaction(tx({ type: 'transferencia', toAccountId: 'acc-bac' }), DATA, null, TODAY), 'toAccountId', 'distinta'); });
  test('REQ-030 saldo insuficiente', function () { return has(v.validateTransaction(tx({ accountId: 'acc-efectivo', amount: '50000' }), DATA, null, TODAY), 'amount', '₡31,300.00'); });
  test('REQ-030 gastar exactamente el saldo es válido', function () { return eq(v.hasErrors(v.validateTransaction(tx({ accountId: 'acc-efectivo', amount: '31300' }), DATA, null, TODAY)), false); });
  test('REQ-031 excede crédito', function () { return has(v.validateTransaction(tx({ accountId: 'acc-visa', amount: '270000' }), DATA, null, TODAY), 'amount', '₡264,000.00'); });
  test('REQ-032 pago mayor que la deuda', function () { return has(v.validateTransaction(tx({ type: 'transferencia', toAccountId: 'acc-visa', amount: '40000' }), DATA, null, TODAY), 'amount', '₡36,000.00'); });
  test('REQ-032 ingreso en crédito', function () { return has(v.validateTransaction(tx({ type: 'ingreso', accountId: 'acc-visa', categoryId: 'cat-salario' }), DATA, null, TODAY), 'accountId', 'transferencia'); });
  test('REQ-034 editar salario a ₡100,000 deja BAC negativo', function () {
    return has(v.validateTransaction(tx({ type: 'ingreso', categoryId: 'cat-salario', amount: '100000', date: '2026-10-01' }), DATA, 'mov-002', TODAY), '_form', 'Cuenta BAC');
  });
  test('REQ-034 editar sin cambios es válido', function () {
    var t = DATA.transactions[8];
    return eq(v.hasErrors(v.validateTransaction(tx({ accountId: t.accountId, categoryId: t.categoryId, amount: String(t.amount), date: t.date, description: t.description }), DATA, t.id, TODAY)), false);
  });
  test('REQ-035 borrar ingreso ya gastado', function () { return has(v.validateTransactionDelete('mov-012', DATA), '_form', 'Efectivo'); });
  test('REQ-035 borrar pago de tarjeta es válido (deuda ≤ límite)', function () { return eq(v.hasErrors(v.validateTransactionDelete('mov-011', DATA)), false); });

  /* ---------- Cuentas y categorías ---------- */
  test('REQ-003 cuenta duplicada', function () { return has(v.validateAccount({ name: ' efectivo ', type: 'efectivo', initialBalance: '0' }, DATA, null), 'name', 'Ya existe'); });
  test('REQ-004 saldo inicial negativo', function () { return has(v.validateAccount({ name: 'X', type: 'debito', initialBalance: '-1' }, DATA, null), 'initialBalance', 'negativo'); });
  test('REQ-008 cambiar tipo con movimientos', function () { return has(v.validateAccount({ name: 'Efectivo', type: 'debito', initialBalance: '25000' }, DATA, 'acc-efectivo'), 'type', 'movimientos'); });
  test('REQ-009 límite menor a la deuda', function () { return has(v.validateAccount({ name: 'Tarjeta Visa', type: 'credito', creditLimit: '30000', cutoffDay: '15', paymentDay: '28' }, DATA, 'acc-visa'), 'creditLimit', '₡96,000.00'); });
  test('REQ-010 eliminar cuenta con movimientos', function () { return has(v.validateAccountDelete('acc-visa', DATA), '_form', '3 movimientos'); });
  test('REQ-014 categoría duplicada', function () { return has(v.validateCategory({ name: 'ALIMENTACIÓN', kind: 'gasto', monthlyBudget: '' }, DATA, null), 'name', 'Ya existe'); });
  test('REQ-015 presupuesto 0', function () { return has(v.validateCategory({ name: 'Mascotas', kind: 'gasto', monthlyBudget: '0' }, DATA, null), 'monthlyBudget', 'mayor a 0'); });
  test('REQ-016 eliminar categoría del sistema', function () { return has(v.validateCategoryDelete('cat-otros-gastos', DATA), '_form', 'sistema'); });
  test('REQ-017 reasignar a otro tipo', function () { return has(v.validateReassign({ targetId: 'cat-salario' }, 'cat-transporte', DATA), 'targetId', 'mismo tipo'); });
  test('REQ-019 cambiar tipo con movimientos', function () { return has(v.validateCategory({ name: 'Transporte', kind: 'ingreso' }, DATA, 'cat-transporte'), 'kind', 'movimientos'); });

  /* ---------- Contrato (storage.validateState) ---------- */
  test('Contrato: dataset oficial válido', function () { return eq(storage.validateState(DATA).valid, true); });
  test('Contrato: estado vacío válido', function () { return eq(storage.validateState(storage.emptyState()).valid, true); });
  test('Contrato: monto negativo inválido', function () { var s = clone(DATA); s.transactions[0].amount = -5; return eq(storage.validateState(s).valid, false); });
  test('Contrato: campo inventado inválido', function () { var s = clone(DATA); s.accounts[0].color = 'rojo'; return eq(storage.validateState(s).valid, false); });
  test('Contrato: categoría inexistente inválida', function () { var s = clone(DATA); s.transactions[0].categoryId = 'cat-nada'; return eq(storage.validateState(s).valid, false); });
  test('Contrato: sin categoría del sistema inválido', function () { var s = clone(DATA); s.categories = s.categories.slice(0, 6); return eq(storage.validateState(s).valid, false); });
  test('Contrato: cuenta líquida negativa inválida', function () { var s = clone(DATA); s.transactions = s.transactions.filter(function (t) { return t.id !== 'mov-012'; }); return eq(storage.validateState(s).valid, false); });
  test('Contrato: presupuesto en categoría de ingreso inválido', function () { var s = clone(DATA); s.categories[7].monthlyBudget = 10; return eq(storage.validateState(s).valid, false); });

  /* ---------- v2: regla de fondos cronológica (RN-03) ---------- */
  test('RN-03 saldo de Efectivo nunca negativo en el tiempo (dataset)', function () { return eq(calc.accountViolations(DATA).length, 0); });
  test('RN-03 disponible en una fecha pasada = mínimo desde esa fecha', function () { return eq(calc.availableFunds(DATA, 'acc-efectivo', null, '2026-10-03'), 31300); });
  test('RN-03 gasto con fecha pasada que deja saldo negativo después', function () {
    return has(v.validateTransaction(tx({ accountId: 'acc-efectivo', amount: '32000', date: '2026-10-14' }), DATA, null, TODAY), 'amount', '₡31,300.00');
  });
  test('REQ-032 pago anterior que dejaría saldo a favor más adelante', function () {
    return has(v.validateTransaction(tx({ type: 'transferencia', toAccountId: 'acc-visa', amount: '70000', date: '2026-10-06' }), DATA, null, TODAY), 'amount', '₡36,000.00');
  });
  test('REQ-066 saldos después de cada movimiento (Efectivo)', function () {
    return eq(calc.runningBalances(DATA, 'acc-efectivo').map(function (r) { return r.balanceAfter; }).join(','), '31300,35800,67000,32000,50000,10000');
  });

  /* ---------- v2: ahorros, archivo y tarjetas ---------- */
  test('REQ-058 gasto desde ahorros rechazado', function () { return has(v.validateTransaction(tx({ accountId: 'acc-ahorros' }), DATA, null, TODAY), 'accountId', 'ahorros'); });
  test('REQ-058 transferencia desde ahorros permitida', function () {
    return eq(v.hasErrors(v.validateTransaction(tx({ type: 'transferencia', accountId: 'acc-ahorros', toAccountId: 'acc-efectivo', amount: '10000' }), DATA, null, TODAY)), false);
  });
  test('REQ-059 disponible / ahorros / deudas', function () {
    var b = calc.balanceSummary(DATA); return eq([b.available, b.savings, b.debts, b.netWorth].join(','), '392400,250000,36000,606400');
  });
  test('REQ-060 día de corte 30 rechazado', function () {
    return has(v.validateAccount({ name: 'Nueva', type: 'credito', creditLimit: '1000', cutoffDay: '30', paymentDay: '10' }, DATA, null), 'cutoffDay', '1 y 28');
  });
  test('REQ-060 día de pago vacío rechazado', function () {
    return has(v.validateAccount({ name: 'Nueva', type: 'credito', creditLimit: '1000', cutoffDay: '5', paymentDay: '' }, DATA, null), 'paymentDay', 'obligatorio');
  });
  test('REQ-061 ciclo Visa al 26 oct: corte 15, pago 28, ₡36,000', function () {
    var c = calc.creditCycle(DATA, 'acc-visa', TODAY); return eq([c.lastCutoff, c.dueDate, c.amountDue, c.daysUntil].join(','), '2026-10-15,2026-10-28,36000,2');
  });
  test('REQ-061 el día del corte todavía no corta', function () { return eq(calc.creditCycle(DATA, 'acc-visa', '2026-10-15').lastCutoff, '2026-09-15'); });
  test('REQ-062 aviso de pago a 2 días', function () { var a = calc.paymentAlerts(DATA, TODAY); return eq(a.length + ':' + a[0].daysUntil, '1:2'); });
  test('REQ-062 pago vencido (1 nov)', function () { var a = calc.paymentAlerts(DATA, '2026-11-01'); return eq(a.length ? a[0].overdue + ':' + a[0].amountDue : 'sin aviso', 'true:36000'); });
  test('REQ-063 archivar con saldo rechazado', function () { return has(v.validateArchive('acc-ahorros', DATA), '_form', 'saldo'); });
  test('REQ-089 archivar cuenta usada por programación rechazado', function () { return has(v.validateArchive('acc-efectivo', DATA), '_form', 'Gasolina'); });
  test('REQ-063 archivar tarjeta con deuda rechazado', function () { return has(v.validateArchive('acc-visa', DATA), '_form', 'deuda'); });
  test('REQ-064 movimiento nuevo con cuenta archivada', function () {
    return has(v.validateTransaction(tx({ accountId: 'acc-tarjeta-vieja' }), DATA, null, TODAY), 'accountId', 'archivada');
  });
  test('REQ-067 última cuenta usada', function () { return eq(calc.lastUsedAccountId(DATA), 'acc-bac'); });

  /* ---------- v2: presupuestos ---------- */
  test('REQ-069 días restantes (26 oct → 6)', function () { return eq(calc.remainingDays('2026-10', TODAY), 6); });
  test('REQ-069 mes pasado = cerrado', function () { return eq(calc.remainingDays('2026-09', TODAY), null); });
  test('REQ-070 (v6) presupuesto total: gastos ₡438,600 + ahorro ₡50,000 = 109 % Rojo', function () {
    var t = calc.totalBudgetStatus(DATA, '2026-10'); return eq([t.expense, t.savings, t.spent, Math.round(t.percent) + t.status].join(','), '438600,50000,488600,109exceeded');
  });
  test('REQ-092 apartado: retiro de ahorros a otra cuenta resta (mínimo 0)', function () {
    var s = clone(DATA); s.transactions.push({ id: 'mov-r', type: 'transferencia', accountId: 'acc-ahorros', toAccountId: 'acc-bac', amount: 80000, date: '2026-10-21', description: 'Retiro', createdAt: '2026-10-21T00:00:00.000Z' });
    return eq(calc.savingsSetAside(s, '2026-10', TODAY), 0);
  });
  test('REQ-092 apartado: pago de tarjeta y retiro de cajero no cuentan', function () { return eq(calc.savingsSetAside(DATA, '2026-10', TODAY), 50000); });
  test('REQ-092 apartado incluye transferencias programadas del mes', function () {
    var s = clone(DATA); s.schedules.push({ id: 'prg-aho', type: 'transferencia', accountId: 'acc-bac', toAccountId: 'acc-ahorros', amount: 100000, description: 'Ahorro quincenal',
      frequency: 'biweekly', startDate: '2026-11-15', mode: 'auto', skippedDates: [], createdAt: '2026-10-26T00:00:00.000Z' });
    return eq(calc.savingsSetAside(s, '2026-11', TODAY) + ',' + calc.monthSummary(s, '2026-11', TODAY).expense, '200000,40000');
  });
  test('REQ-092 el apartado no cambia gastos ni tasa de ahorro', function () { return eq(calc.monthSummary(DATA, '2026-10', TODAY).expense, 438600); });
  test('REQ-093 meta inválida y razón sin meta rechazadas', function () {
    var base = { name: 'Viaje', type: 'ahorros', initialBalance: '0', creditLimit: '', cutoffDay: '', paymentDay: '' };
    var e1 = v.validateAccount(Object.assign({}, base, { goalAmount: '-5', goalReason: '' }), DATA, null);
    var e2 = v.validateAccount(Object.assign({}, base, { goalAmount: '', goalReason: 'Japón' }), DATA, null);
    return eq(!!e1.goalAmount + ',' + !!e2.goalAmount, 'true,true');
  });
  test('REQ-093 cambiar a otro tipo elimina la meta', function () {
    var acc = v.draftToAccount({ name: 'X', type: 'debito', initialBalance: '0', goalAmount: '5000', goalReason: 'Y' }, { id: 'acc-x', createdAt: '2026-10-26T00:00:00.000Z' });
    return eq('goalAmount' in acc, false);
  });
  test('REQ-093 contrato: meta en cuenta no-ahorros es inválida', function () {
    var s = clone(DATA); s.accounts[0].goalAmount = 1000; return eq(storage.validateState(s).valid, false);
  });
  test('REQ-094 progreso de la meta y fecha estimada', function () {
    var s = clone(DATA); s.schedules.push({ id: 'prg-aho', type: 'transferencia', accountId: 'acc-bac', toAccountId: 'acc-ahorros', amount: 100000, description: 'Ahorro quincenal',
      frequency: 'biweekly', startDate: '2026-11-15', mode: 'auto', skippedDates: [], createdAt: '2026-10-26T00:00:00.000Z' });
    var g = calc.goalProgress(s, 'acc-ahorros', TODAY);
    return eq([g.saved, g.missing, Math.round(g.percent), g.monthly, g.months, g.etaMonth].join(','), '250000,750000,25,200000,4,2027-02');
  });
  test('REQ-094 (v6.1) transferencia mensual de ₡100,000 aporta ₡100,000 al mes', function () {
    var s = clone(DATA); s.schedules.push({ id: 'prg-usa', type: 'transferencia', accountId: 'acc-bac', toAccountId: 'acc-ahorros', amount: 100000, description: 'Viaje USA',
      frequency: 'monthly', startDate: '2026-11-01', mode: 'auto', skippedDates: [], createdAt: '2026-10-26T00:00:00.000Z' });
    var g = calc.goalProgress(s, 'acc-ahorros', TODAY);
    return eq([g.monthly, g.sources.length, g.sources[0].frequency, g.duplicates, g.months].join(','), '100000,1,monthly,0,8');
  });
  test('REQ-094 (v6.1) dos programaciones iguales se detectan como repetidas', function () {
    var s = clone(DATA); [1, 2].forEach(function (n) { s.schedules.push({ id: 'prg-usa' + n, type: 'transferencia', accountId: 'acc-bac', toAccountId: 'acc-ahorros', amount: 100000, description: 'Viaje USA',
      frequency: 'monthly', startDate: '2026-11-01', mode: 'auto', skippedDates: [], createdAt: '2026-10-26T00:00:00.000Z' }); });
    var g = calc.goalProgress(s, 'acc-ahorros', TODAY); return eq(g.monthly + ',' + g.duplicates, '200000,1');
  });
  test('REQ-096 ventana de próximos según el mes seleccionado', function () {
    return eq([calc.upcomingStart('2026-10', TODAY), calc.upcomingStart('2026-11', TODAY), String(calc.upcomingStart('2026-09', TODAY))].join(','), '2026-10-27,2026-11-01,null');
  });
  test('REQ-096 noviembre 1–7 no incluye ocurrencias de octubre', function () {
    var l = calc.openOccurrences(DATA, '2026-11-01', '2026-11-07', TODAY);
    return eq(l.every(function (t) { return t.date >= '2026-11-01' && t.date <= '2026-11-07'; }) + ':' + l.length, 'true:1');
  });
  test('REQ-095 meta alcanzada', function () { var s = clone(DATA); s.accounts[2].goalAmount = 250000; return eq(calc.goalProgress(s, 'acc-ahorros', TODAY).reached, true); });
  test('REQ-070 total 0 rechazado', function () { return has(v.validateSettings({ monthlyBudget: '0' }), 'monthlyBudget', 'mayor a 0'); });
  test('REQ-071 suma por categoría ₡495,000', function () { return eq(calc.categoryBudgetsSum(DATA), 495000); });
  test('REQ-072 migración v1 → v3', function () {
    var v1 = { schemaVersion: 1, accounts: [{ id: 'acc-a', name: 'A', type: 'efectivo', initialBalance: 10, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'acc-t', name: 'T', type: 'credito', creditLimit: 100, createdAt: '2026-01-01T00:00:00.000Z' }],
      categories: storage.emptyState().categories, transactions: [] };
    var m = storage.migrate(v1);
    return eq(storage.validateState(m).valid + ',' + m.schemaVersion + ',' + m.accounts[0].archived, 'true,3,false');
  });
  test('Contrato: tarjeta con solo día de corte inválida', function () { var s = clone(DATA); delete s.accounts[3].paymentDay; return eq(storage.validateState(s).valid, false); });
  test('Contrato: gasto desde ahorros inválido', function () {
    var s = clone(DATA); s.transactions.push({ id: 'mov-x', type: 'gasto', accountId: 'acc-ahorros', categoryId: 'cat-salud', amount: 10, date: '2026-10-20', description: 'x', createdAt: '2026-10-20T00:00:00.000Z' });
    return eq(storage.validateState(s).valid, false);
  });

  /* ---------- v4: programaciones (REQ-079..REQ-090) ---------- */
  var SAL = DATA.schedules[0], GAS = DATA.schedules[1];
  function sch(o) {
    return Object.assign({ type: 'gasto', date: '2026-10-31', amount: '450000', description: 'Hipoteca', accountId: 'acc-bac', categoryId: 'cat-vivienda',
      toAccountId: '', frequency: 'monthly', endDate: '', mode: 'auto' }, o);
  }
  test('REQ-027 (v4) fecha futura sin Programar rechazada', function () { return has(v.validateTransaction(tx({ date: '2026-10-27' }), DATA, null, TODAY), 'date', 'Programar'); });
  test('REQ-079 programación válida (hipoteca el 31)', function () { return eq(v.hasErrors(v.validateSchedule(sch({}), DATA, null, TODAY)), false); });
  test('REQ-079 (v5) primera fecha en el pasado aceptada', function () { return eq(v.hasErrors(v.validateSchedule(sch({ date: '2026-10-06', categoryId: 'cat-servicios', amount: '70000', pastAction: 'register' }), DATA, null, TODAY)), false); });
  test('REQ-079 (v5) más de un año atrás rechazado', function () { return has(v.validateSchedule(sch({ date: '2025-10-25' }), DATA, null, TODAY), 'date', 'un año atrás'); });
  test('REQ-091 pagos anteriores a hoy', function () {
    return eq(v.pastOccurrences(DATA, { id: 'prg-x', frequency: 'biweekly', startDate: '2026-09-01', skippedDates: [] }, TODAY).join(','), '2026-09-15,2026-09-30,2026-10-15');
  });
  test('REQ-091 registrar pagos anteriores sin fondos rechazado', function () {
    return has(v.validateSchedule(sch({ date: '2026-10-06', accountId: 'acc-efectivo', categoryId: 'cat-servicios', amount: '60000', pastAction: 'register' }), DATA, null, TODAY), '_form', 'Ya los registré');
  });
  test('REQ-091 "Ya los registré" no revisa fondos', function () {
    return eq(v.hasErrors(v.validateSchedule(sch({ date: '2026-10-06', accountId: 'acc-efectivo', categoryId: 'cat-servicios', amount: '60000', pastAction: 'skip' }), DATA, null, TODAY)), false);
  });
  test('REQ-079 más de un año adelante rechazado', function () { return has(v.validateSchedule(sch({ date: '2027-10-27' }), DATA, null, TODAY), 'date', 'un año'); });
  test('REQ-079 "hasta" antes de la primera fecha', function () { return has(v.validateSchedule(sch({ endDate: '2026-10-01' }), DATA, null, TODAY), 'endDate', 'anterior'); });
  test('REQ-079 monto inválido también en programación', function () { return has(v.validateSchedule(sch({ amount: '-5' }), DATA, null, TODAY), 'amount', 'mayor a 0'); });
  test('REQ-079 gasto programado desde ahorros rechazado', function () { return has(v.validateSchedule(sch({ accountId: 'acc-ahorros' }), DATA, null, TODAY), 'accountId', 'ahorros'); });
  test('REQ-080 mensual el 31 → último día del mes', function () {
    return eq(calc.scheduleOccurrences({ frequency: 'monthly', startDate: '2026-10-31' }, '2026-10-01', '2027-02-28').join(','), '2026-10-31,2026-11-30,2026-12-31,2027-01-31,2027-02-28');
  });
  test('REQ-080 quincenal = 15 y último', function () { return eq(calc.scheduleOccurrences(GAS, '2026-11-01', '2026-12-31').join(','), '2026-11-15,2026-11-30,2026-12-15,2026-12-31'); });
  test('REQ-080 "hasta" corta las ocurrencias', function () {
    return eq(calc.scheduleOccurrences({ frequency: 'monthly', startDate: '2026-11-01', endDate: '2027-01-10' }, '2026-11-01', '2027-12-31').length, 3);
  });
  test('REQ-079 (v5.1) ingreso programado no pide modo y queda automático', function () {
    var d = sch({ type: 'ingreso', accountId: 'acc-bac', categoryId: 'cat-salario', amount: '1000000', description: 'Pago Planilla', date: '2026-10-30', mode: 'manual' });
    var e = v.validateSchedule(Object.assign({}, d, { mode: '' }), DATA, null, TODAY);
    return eq(v.hasErrors(e) + ',' + v.draftToSchedule(d, { id: 'prg-x', createdAt: '', skippedDates: [] }).mode, 'false,auto');
  });
  test('D28 ingreso guardado como manual se trata como automático', function () {
    var s = clone(DATA); s.schedules[0].mode = 'manual'; return eq(calc.dueOccurrences(s, '2026-11-01')[0].mode, 'auto');
  });
  test('D29 «Sin fin» ignora la fecha final (se repite todos los meses)', function () {
    var d = sch({ type: 'ingreso', accountId: 'acc-bac', categoryId: 'cat-salario', amount: '1000000', description: 'Pago Planilla', date: '2026-10-30', ends: 'never', endDate: '2026-10-30' });
    return eq(String(v.draftToSchedule(d, { id: 'prg-x', createdAt: '', skippedDates: [] }).endDate), 'undefined');
  });
  test('D29 «Hasta una fecha» sin fecha → error', function () {
    var d = sch({ type: 'ingreso', accountId: 'acc-bac', categoryId: 'cat-salario', amount: '1000000', description: 'Pago Planilla', date: '2026-10-30', ends: 'date', endDate: '' });
    return eq(!!v.validateSchedule(d, DATA, null, TODAY).endDate, true);
  });
  test('REQ-080 equivalente mensual quincenal', function () { return eq(calc.monthlyEquivalent(GAS), 40000); });
  test('REQ-081 noviembre incluye los programados', function () {
    var m = calc.monthSummary(DATA, '2026-11', TODAY); return eq([m.income, m.expense, m.scheduledIncome, m.scheduledExpense].join(','), '650000,40000,650000,40000');
  });
  test('REQ-081 octubre sin cambios (programaciones desde noviembre)', function () { return eq(calc.monthSummary(DATA, '2026-10', TODAY).expense, 438600); });
  test('REQ-081 presupuesto de Transporte en noviembre incluye la gasolina', function () { return eq(calc.budgetStatus(DATA, 'cat-transporte', '2026-11').spent, 40000); });
  test('REQ-082 ocurrencias vencidas al 1 nov: salario (auto)', function () {
    var d = calc.dueOccurrences(DATA, '2026-11-01'); return eq(d.length + ':' + d[0].mode + ':' + d[0].description, '1:auto:Salario');
  });
  test('REQ-082 una ocurrencia aplicada no vuelve a vencer', function () {
    var s = clone(DATA); s.transactions.push({ id: 'mov-sal', type: 'ingreso', accountId: 'acc-bac', categoryId: 'cat-salario', amount: 650000, date: '2026-11-01', description: 'Salario', scheduleId: 'prg-salario', occurrenceDate: '2026-11-01', createdAt: '2026-11-01T12:00:00.000Z' });
    return eq(calc.dueOccurrences(s, '2026-11-01').length + ',' + storage.validateState(s).valid, '0,true');
  });
  test('REQ-083 manual pendiente al 15 nov (gasolina)', function () {
    return eq(calc.dueOccurrences(DATA, '2026-11-15').filter(function (o) { return o.mode === 'manual'; }).length, 1);
  });
  test('REQ-084 omitida no se proyecta', function () {
    var s = clone(DATA); s.schedules[1].skippedDates = ['2026-11-15']; return eq(calc.openOccurrences(s, '2026-11-01', '2026-11-30', TODAY).length, 2);
  });
  test('REQ-087 aviso de proyección: gasolina deja Efectivo en negativo en noviembre', function () {
    return eq(calc.projectionAlerts(DATA, '2026-11-02').length + ':' + calc.projectionAlerts(DATA, '2026-11-02')[0].account.id, '1:acc-efectivo');
  });
  test('REQ-088 proyectado a fin de mes (Efectivo, 2 nov)', function () { return eq(calc.projectedBalance(DATA, 'acc-efectivo', '2026-11-02'), -8700); });
  test('REQ-089 cuenta usada por programación no se elimina', function () { return has(v.validateAccountDelete('acc-bac', DATA), '_form', 'Salario'); });
  test('REQ-089 próxima ocurrencia', function () { return eq(calc.nextOccurrence(DATA, SAL, TODAY), '2026-11-01'); });
  test('REQ-090 migración v2 → v3: futuro → programación una vez auto', function () {
    var v2 = clone(DATA); v2.schemaVersion = 2; delete v2.schedules;
    v2.transactions.push({ id: 'mov-hip', type: 'gasto', accountId: 'acc-bac', categoryId: 'cat-vivienda', amount: 450000, date: '2026-10-31', description: 'Hipoteca', createdAt: '2026-10-26T10:00:00.000Z' });
    var m = storage.migrate(v2, TODAY);
    return eq(m.schemaVersion + ',' + m.schedules.length + ',' + m.schedules[0].frequency + ',' + m.schedules[0].mode + ',' + storage.validateState(m).valid, '3,1,once,auto,true');
  });
  test('Contrato: ocurrencia aplicada dos veces inválida', function () {
    var s = clone(DATA); var t = { id: 'mov-a', type: 'gasto', accountId: 'acc-bac', categoryId: 'cat-salud', amount: 10, date: '2026-10-20', description: 'x', scheduleId: 'prg-salario', occurrenceDate: '2026-11-01', createdAt: '2026-10-20T00:00:00.000Z' };
    var t2 = clone(t); t2.id = 'mov-b'; s.transactions.push(t, t2); return eq(storage.validateState(s).valid, false);
  });
  test('Contrato: frecuencia inválida', function () { var s = clone(DATA); s.schedules[0].frequency = 'weekly'; return eq(storage.validateState(s).valid, false); });

  /* ---------- Respaldo (REQ-097, REQ-098) ---------- */
  test('REQ-097 nombre del respaldo', function () { return eq(storage.backupFileName('2026-10-26'), 'finanzapp-2026-10-26.json'); });
  test('REQ-098 respaldo válido se acepta igual', function () {
    var r = storage.parseBackup(JSON.stringify(DATA));
    return eq(!!r.state && JSON.stringify(r.state) === JSON.stringify(DATA), true);
  });
  test('REQ-098 texto que no es JSON se rechaza', function () { return eq(storage.parseBackup('hola').error, 'El archivo no es un respaldo válido de FinanzApp.'); });
  test('REQ-098 JSON fuera de contrato se rechaza', function () { return eq(!!storage.parseBackup('{"a":1}').error, true); });
  test('REQ-098 respaldo que viola la regla de fondos se rechaza', function () {
    var s = clone(DATA); s.accounts[0].initialBalance = 0; return eq(!!storage.parseBackup(JSON.stringify(s)).error, true);
  });
  test('REQ-098 respaldo de la versión 2 se migra', function () {
    var v2 = clone(DATA); v2.schemaVersion = 2; delete v2.schedules;
    var r = storage.parseBackup(JSON.stringify(v2)); return eq(!!r.state && r.state.schemaVersion, 3);
  });
  test('REQ-098 archivo de más de 5 MB se rechaza', function () {
    return eq(!!storage.parseBackup(new Array(storage.MAX_BACKUP_BYTES + 2).join(' ')).error, true);
  });

  /* ---------- Búsqueda (REQ-099) ---------- */
  function descs(list) { return list.map(function (t) { return t.description; }).join(','); }
  test('REQ-099 buscar "bus" en octubre', function () { return eq(descs(calc.filterTransactions(DATA, '2026-10', { text: 'bus' }, TODAY)), 'Bus'); });
  test('REQ-099 sin distinguir mayúsculas ni espacios', function () { return eq(descs(calc.filterTransactions(DATA, '2026-09', { text: '  PAN ' }, TODAY)), 'Panadería'); });
  test('REQ-099 combinada con filtro de cuenta', function () {
    return eq(descs(calc.filterTransactions(DATA, '2026-10', { accountId: 'acc-visa', text: 'cine' }, TODAY)), 'Cine y cena');
  });
  test('REQ-099 incluye programados', function () { return eq(descs(calc.filterTransactions(DATA, '2026-11', { text: 'salario' }, TODAY)), 'Salario'); });
  test('REQ-099 sin coincidencias → lista vacía', function () { return eq(calc.filterTransactions(DATA, '2026-10', { text: 'zzz' }, TODAY).length, 0); });

  /* ---------- Comparación con el mes anterior (REQ-100) ---------- */
  test('REQ-100 octubre frente a septiembre', function () {
    var c = calc.monthComparison(DATA, '2026-10', TODAY);
    return eq(c.direction + ',' + c.previousMonth + ',' + calc.formatPercent(c.percent), 'up,2026-09,2824 %');
  });
  test('REQ-100 mes anterior sin gastos → sin porcentaje', function () { return eq(calc.monthComparison(DATA, '2026-09', TODAY).percent, null); });
  test('REQ-100 menos gasto → down', function () {
    var s = clone(DATA); s.transactions.push({ id: 'mov-sep2', type: 'gasto', accountId: 'acc-bac', categoryId: 'cat-salud', amount: 500000, date: '2026-09-30', description: 'Cirugía', createdAt: '2026-09-30T10:00:00.000Z' });
    s.accounts[1].initialBalance = 650000;
    var c = calc.monthComparison(s, '2026-10', TODAY); return eq(c.direction + ',' + calc.formatPercent(Math.abs(c.percent)), 'down,15 %');
  });

  /* ---------- Categorías con más gasto (REQ-101) ---------- */
  test('REQ-101 top 3 de octubre', function () {
    return eq(calc.topCategories(DATA, '2026-10', 3, TODAY).map(function (x) { return x.category.name + ' ' + calc.formatPercent(x.percent); }).join(', '),
      'Vivienda 57 %, Alimentación 23 %, Servicios 9 %');
  });
  test('REQ-101 mes sin gastos → lista vacía', function () { return eq(calc.topCategories(DATA, '2026-08', 3, TODAY).length, 0); });
  test('REQ-101 empate se ordena por nombre', function () {
    var s = clone(DATA); s.transactions = s.transactions.filter(function (t) { return t.date < '2026-10-01'; });
    s.transactions.push({ id: 'mov-e1', type: 'gasto', accountId: 'acc-efectivo', categoryId: 'cat-salud', amount: 1000, date: '2026-09-29', description: 'a', createdAt: '2026-09-29T10:00:00.000Z' });
    s.transactions.push({ id: 'mov-e2', type: 'gasto', accountId: 'acc-efectivo', categoryId: 'cat-entretenimiento', amount: 1000, date: '2026-09-29', description: 'b', createdAt: '2026-09-29T10:01:00.000Z' });
    return eq(calc.topCategories(s, '2026-09', 3, TODAY).map(function (x) { return x.category.name; }).join(','), 'Alimentación,Entretenimiento,Salud');
  });

  /* ---------- Reporte ---------- */
  var passed = results.filter(function (r) { return r.ok; }).length;
  var out = document.getElementById('out');
  var h = document.createElement('h2');
  h.textContent = passed + ' de ' + results.length + ' pruebas pasaron';
  h.className = passed === results.length ? 'ok' : 'fail';
  out.appendChild(h);
  var ul = document.createElement('ul');
  results.forEach(function (r) {
    var li = document.createElement('li');
    li.className = r.ok ? 'ok' : 'fail';
    li.textContent = (r.ok ? '✔ ' : '✖ ') + r.name + (r.detail ? ' — ' + r.detail : '');
    ul.appendChild(li);
  });
  out.appendChild(ul);
  window.TEST_RESULTS = { passed: passed, total: results.length, results: results };
})();
