/*
 * validations.js — FinanzApp.validate
 * Funciones PURAS: reciben un borrador (valores tal como vienen del formulario) y el estado,
 * y devuelven { campo: 'mensaje' }. Objeto vacío = válido. No tocan el DOM ni mutan nada.
 */
(function (global) {
  'use strict';

  var A = global.FinanzApp = global.FinanzApp || {};
  var calc = A.calc;

  var TX_TYPES = ['ingreso', 'gasto', 'transferencia'];
  var ACCOUNT_TYPES = ['efectivo', 'debito', 'ahorros', 'credito'];
  var INT_RE = /^\d+$/;
  var CATEGORY_KINDS = ['gasto', 'ingreso'];
  var MAX_NAME = 40;
  var MAX_DESCRIPTION = 80;
  var MAX_SCHEDULE_DAYS = 365; // REQ-027 (v3)
  var NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

  function isBlank(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function hasErrors(errors) { return Object.keys(errors || {}).length > 0; }
  function str(v) { return v === undefined || v === null ? '' : String(v); }

  /**
   * Convierte el texto de un campo de monto en número.
   * opts: { label, allowZero, optional }. Devuelve { value, error }.
   * REQ-022 (≤ 0), REQ-023 (vacío / no numérico), REQ-024 (> 2 decimales), REQ-004, REQ-005, REQ-015.
   */
  function parseAmount(raw, opts) {
    opts = opts || {};
    var label = opts.label || 'El monto';
    var s = str(raw).trim();
    if (s === '') {
      return opts.optional ? { value: null, error: null } : { value: null, error: label + ' es obligatorio.' };
    }
    if (!NUMBER_RE.test(s)) { return { value: null, error: label + ' debe ser un número (use punto para decimales).' }; }
    var n = Number(s);
    if (!isFinite(n)) { return { value: null, error: label + ' debe ser un número.' }; }
    if (opts.allowZero ? n < 0 : n <= 0) {
      return { value: null, error: label + (opts.allowZero ? ' no puede ser negativo.' : ' debe ser mayor a 0.') };
    }
    if (!calc.hasMax2Decimals(n)) { return { value: null, error: label + ' admite como máximo 2 decimales.' }; }
    return { value: n, error: null };
  }

  /** REQ-060: día de corte o de pago, entero entre 1 y 28. Devuelve { value, error }. */
  function parseDay(raw, label) {
    var s = str(raw).trim();
    if (s === '') { return { value: null, error: label + ' es obligatorio.' }; }
    if (!INT_RE.test(s) || +s < 1 || +s > 28) { return { value: null, error: label + ' debe ser un número entero entre 1 y 28.' }; }
    return { value: +s, error: null };
  }

  function nameTaken(list, name, originalId) {
    var n = calc.normalize(name);
    return list.some(function (x) { return x.id !== originalId && calc.normalize(x.name) === n; });
  }

  function validateName(errors, name, list, originalId, what) {
    if (isBlank(name)) { errors.name = 'El nombre es obligatorio.'; }
    else if (str(name).trim().length > MAX_NAME) { errors.name = 'El nombre admite como máximo ' + MAX_NAME + ' caracteres.'; }
    else if (nameTaken(list, name, originalId)) { errors.name = 'Ya existe ' + what + ' con ese nombre.'; }
  }

  /* ------------------------------------------------------------------ */
  /* Cuentas — REQ-001..REQ-011                                          */
  /* ------------------------------------------------------------------ */

  /** Borrador → objeto cuenta (sin validar). Se usa también en app.js para construir la entidad. */
  function draftToAccount(d, base) {
    var acc = { id: base.id, name: str(d.name).trim(), type: d.type };
    if (d.type === 'credito') {
      acc.creditLimit = Number(str(d.creditLimit).trim());
      acc.cutoffDay = Number(str(d.cutoffDay).trim());
      acc.paymentDay = Number(str(d.paymentDay).trim());
    } else { acc.initialBalance = Number(str(d.initialBalance).trim()); }
    acc.archived = !!base.archived;
    acc.createdAt = base.createdAt;
    return acc;
  }

  function validateAccount(d, state, originalId) {
    var errors = {};
    var original = originalId ? calc.getAccount(state, originalId) : null;
    validateName(errors, d.name, state.accounts, originalId, 'una cuenta');

    if (ACCOUNT_TYPES.indexOf(d.type) === -1) { errors.type = 'Elija el tipo de cuenta.'; }
    else if (original && original.type !== d.type && calc.accountMovementCount(state, originalId) > 0) {
      errors.type = 'No se puede cambiar el tipo de una cuenta con movimientos.'; // REQ-008
    }

    if (d.type === 'credito') {
      var lim = parseAmount(d.creditLimit, { label: 'El límite de crédito' }); // REQ-005
      if (lim.error) { errors.creditLimit = lim.error; }
      var cut = parseDay(d.cutoffDay, 'El día de corte'); // REQ-060
      if (cut.error) { errors.cutoffDay = cut.error; }
      var pay = parseDay(d.paymentDay, 'El día de pago');
      if (pay.error) { errors.paymentDay = pay.error; }
    } else if (ACCOUNT_TYPES.indexOf(d.type) !== -1) {
      var ini = parseAmount(d.initialBalance, { label: 'El saldo inicial', allowZero: true }); // REQ-004
      if (ini.error) { errors.initialBalance = ini.error; }
    }

    // REQ-009: el nuevo saldo inicial / límite no puede violar el invariante de fondos.
    if (original && !hasErrors(errors)) {
      var candidate = draftToAccount(d, original);
      var next = {
        accounts: state.accounts.map(function (a) { return a.id === originalId ? candidate : a; }),
        categories: state.categories,
        transactions: state.transactions
      };
      var bad = calc.accountViolations(next).filter(function (v) { return v.account.id === originalId; })[0];
      if (bad && bad.reason === 'negative') {
        var minInitial = calc.roundMoney(candidate.initialBalance - bad.balance);
        errors.initialBalance = 'Con ese saldo inicial la cuenta quedaría en ' + calc.formatMoney(bad.balance) + (bad.date ? ' el ' + bad.date : '') +
          '. Mínimo permitido: ' + calc.formatMoney(minInitial) + '.';
      } else if (bad && bad.reason === 'overlimit') {
        errors.creditLimit = 'La deuda llegó a ' + calc.formatMoney(-bad.balance) + (bad.date ? ' el ' + bad.date : '') +
          '. El límite no puede ser menor.';
      }
    }
    return errors;
  }

  /** REQ-010: no se elimina una cuenta con movimientos. */
  function validateAccountDelete(accountId, state) {
    if (!calc.getAccount(state, accountId)) { return { _form: 'La cuenta no existe.' }; }
    var used = (state.schedules || []).filter(function (s) { return s.accountId === accountId || s.toAccountId === accountId; }); // REQ-089
    if (used.length) { return { _form: 'No se puede eliminar: la usa la programación «' + used[0].description + '».' }; }
    var n = calc.accountMovementCount(state, accountId);
    if (n > 0) {
      return { _form: 'No se puede eliminar: la cuenta tiene ' + n + (n === 1 ? ' movimiento' : ' movimientos') +
        '. Si ya no la usa, archívela.' };
    }
    return {};
  }

  /** REQ-063: solo se archiva una cuenta activa con saldo 0 (líquida) o deuda 0 (crédito). */
  function validateArchive(accountId, state) {
    var acc = calc.getAccount(state, accountId);
    if (!acc) { return { _form: 'La cuenta no existe.' }; }
    if (acc.archived) { return { _form: 'La cuenta ya está archivada.' }; }
    var used = calc.schedulesUsingAccount(state, accountId); // REQ-089
    if (used.length) {
      return { _form: 'No se puede archivar: «' + acc.name + '» la usa la programación «' + used[0].description + '». Edítela o elimínela primero.' };
    }
    var bal = calc.accountBalance(state, accountId);
    if (calc.toCents(bal) !== 0) {
      return { _form: calc.isLiquid(acc)
        ? 'No se puede archivar: «' + acc.name + '» tiene saldo ' + calc.formatMoney(bal) + '. Transfiéralo a otra cuenta primero.'
        : 'No se puede archivar: «' + acc.name + '» tiene una deuda de ' + calc.formatMoney(-bal) + '. Páguela primero.' };
    }
    return {};
  }

  /** REQ-070: presupuesto total mensual opcional. */
  function validateSettings(d) {
    var b = parseAmount(d.monthlyBudget, { label: 'El presupuesto total', optional: true });
    return b.error ? { monthlyBudget: b.error } : {};
  }

  /* ------------------------------------------------------------------ */
  /* Categorías — REQ-012..REQ-019                                       */
  /* ------------------------------------------------------------------ */

  function validateCategory(d, state, originalId) {
    var errors = {};
    var original = originalId ? calc.getCategory(state, originalId) : null;
    validateName(errors, d.name, state.categories, originalId, 'una categoría'); // REQ-014

    if (CATEGORY_KINDS.indexOf(d.kind) === -1) { errors.kind = 'Elija el tipo de categoría.'; }
    else if (original && original.kind !== d.kind) {
      if (original.system) { errors.kind = 'No se puede cambiar el tipo de una categoría del sistema.'; } // REQ-016
      else if (calc.categoryMovementCount(state, originalId) + calc.categoryScheduleCount(state, originalId) > 0) {
        errors.kind = 'No se puede cambiar el tipo de una categoría con movimientos.'; // REQ-019
      }
    }

    if (d.kind === 'gasto') { // REQ-015
      var b = parseAmount(d.monthlyBudget, { label: 'El presupuesto mensual', optional: true });
      if (b.error) { errors.monthlyBudget = b.error; }
    }
    return errors;
  }

  /** REQ-016: las categorías del sistema no se eliminan. */
  function validateCategoryDelete(categoryId, state) {
    var cat = calc.getCategory(state, categoryId);
    if (!cat) { return { _form: 'La categoría no existe.' }; }
    if (cat.system) { return { _form: 'Las categorías del sistema no se pueden eliminar.' }; }
    return {};
  }

  /** REQ-017: destino de la reasignación obligatorio, distinto y del mismo tipo. */
  function validateReassign(d, categoryId, state) {
    var errors = validateCategoryDelete(categoryId, state);
    if (hasErrors(errors)) { return errors; }
    if (calc.categoryMovementCount(state, categoryId) + calc.categoryScheduleCount(state, categoryId) === 0) { return {}; }
    var cat = calc.getCategory(state, categoryId);
    var target = calc.getCategory(state, d.targetId);
    if (!target || target.id === categoryId) { return { targetId: 'Elija la categoría que recibirá los movimientos.' }; }
    if (target.kind !== cat.kind) { return { targetId: 'La categoría destino debe ser del mismo tipo.' }; }
    return {};
  }

  /* ------------------------------------------------------------------ */
  /* Movimientos — REQ-020..REQ-035                                      */
  /* ------------------------------------------------------------------ */

  /** Borrador → objeto movimiento (sin validar). Lo usa app.js para construir la entidad. */
  function draftToTransaction(d, base) {
    var tx = {
      id: base.id, type: d.type, accountId: d.accountId,
      amount: Number(str(d.amount).trim()), date: str(d.date).trim(),
      description: str(d.description).trim(), createdAt: base.createdAt
    };
    if (d.type === 'transferencia') { tx.toAccountId = d.toAccountId; }
    else { tx.categoryId = d.categoryId; }
    return tx;
  }

  function violationMessage(v) {
    var when = v.date ? ' el ' + v.date : '';
    if (v.reason === 'negative') {
      return 'La operación dejaría «' + v.account.name + '» con saldo ' + calc.formatMoney(v.balance) + when + '.';
    }
    if (v.reason === 'overpaid') {
      return 'La operación dejaría «' + v.account.name + '» con saldo a favor; una tarjeta no puede quedar con saldo positivo.';
    }
    return 'La operación dejaría «' + v.account.name + '» con una deuda de ' + calc.formatMoney(-v.balance) +
      ', mayor a su límite de ' + calc.formatMoney(v.account.creditLimit) + '.';
  }

  /**
   * Valida un movimiento nuevo (originalId = null) o editado (REQ-034).
   * today: 'YYYY-MM-DD' local (inyectable para pruebas).
   */
  /**
   * Validaciones de campos compartidas por movimientos y programaciones (sin fecha ni fondos).
   * original: movimiento o programación que se edita (permite conservar una cuenta archivada, REQ-064).
   */
  function validateMovementFields(d, state, original) {
    var errors = {};
    if (calc.activeAccounts(state).length === 0) { errors._form = 'Primero cree una cuenta.'; return errors; } // REQ-021
    var originalTx = original;
    if (TX_TYPES.indexOf(d.type) === -1) { errors.type = 'Elija el tipo de movimiento.'; return errors; }

    // REQ-022, REQ-023, REQ-024
    var amount = parseAmount(d.amount, { label: 'El monto' });
    if (amount.error) { errors.amount = amount.error; }

    // REQ-025
    if (isBlank(d.description)) { errors.description = 'La descripción es obligatoria.'; }
    else if (str(d.description).trim().length > MAX_DESCRIPTION) {
      errors.description = 'La descripción admite como máximo ' + MAX_DESCRIPTION + ' caracteres.';
    }

    var account = calc.getAccount(state, d.accountId);
    if (!account) { errors.accountId = 'Elija la cuenta.'; }
    else if (account.archived && !(originalTx && originalTx.accountId === d.accountId)) { // REQ-064
      errors.accountId = 'La cuenta «' + account.name + '» está archivada.';
    }

    if (d.type === 'transferencia') { // REQ-029
      var to = calc.getAccount(state, d.toAccountId);
      if (!to) { errors.toAccountId = 'Elija la cuenta destino.'; }
      else if (d.toAccountId === d.accountId) { errors.toAccountId = 'La cuenta destino debe ser distinta de la de origen.'; }
      else if (to.archived && !(originalTx && originalTx.toAccountId === d.toAccountId)) { // REQ-064
        errors.toAccountId = 'La cuenta «' + to.name + '» está archivada.';
      }
    } else { // REQ-028
      var cat = calc.getCategory(state, d.categoryId);
      if (!cat) { errors.categoryId = 'Elija la categoría.'; }
      else if (cat.kind !== d.type) { errors.categoryId = 'La categoría no corresponde al tipo de movimiento.'; }
    }

    // REQ-032 (2.ª parte): ingresos solo en cuentas líquidas
    if (account && d.type === 'ingreso' && !calc.isLiquid(account)) {
      errors.accountId = 'Los ingresos se registran en efectivo o débito. Para pagar la tarjeta use una transferencia.';
    }

    // REQ-058: los ahorros no se gastan directamente
    if (account && !errors.accountId && d.type === 'gasto' && calc.isSavings(account)) {
      errors.accountId = 'No se puede gastar desde una cuenta de ahorros. Transfiera primero el dinero a efectivo o débito.';
    }
    return errors;
  }

  function validateTransaction(d, state, originalId, today) {
    today = today || calc.todayISO();
    var originalTx = originalId ? findTx(state, originalId) : null;
    var errors = validateMovementFields(d, state, originalTx);
    if (errors._form || errors.type) { return errors; }

    // REQ-026, REQ-027 (v4): sin "Programar" la fecha no puede ser futura
    var date = str(d.date).trim();
    if (date === '') { errors.date = 'La fecha es obligatoria.'; }
    else if (!calc.isValidISODate(date)) { errors.date = 'La fecha no es válida (formato AAAA-MM-DD).'; }
    else if (date > today) { errors.date = 'No se registran movimientos con fecha futura. Marque «🗓 Programar» para programarlo.'; }

    if (hasErrors(errors)) { return errors; }
    var amount = parseAmount(d.amount, { label: 'El monto' });
    var account = calc.getAccount(state, d.accountId);

    // REQ-030, REQ-031: fondos de la cuenta de origen ("como si" el original no existiera, REQ-034)
    if (d.type === 'gasto' || d.type === 'transferencia') {
      var available = calc.availableFunds(state, d.accountId, originalId, date); // RN-03 cronológica
      if (calc.toCents(amount.value) > calc.toCents(available)) {
        errors.amount = calc.isLiquid(account)
          ? 'Saldo insuficiente: disponible ' + calc.formatMoney(available) + '.'
          : 'Excede el límite de crédito: disponible ' + calc.formatMoney(available) + '.';
        return errors;
      }
    }

    // REQ-032 (1.ª parte): un pago de tarjeta no puede superar la deuda
    if (d.type === 'transferencia') {
      var toAcc = calc.getAccount(state, d.toAccountId);
      if (!calc.isLiquid(toAcc)) {
        var debt = calc.paymentRoom(state, d.toAccountId, originalId, date);
        if (calc.toCents(amount.value) > calc.toCents(debt)) {
          errors.amount = 'El pago excede la deuda: ' + calc.formatMoney(debt) + '.';
          return errors;
        }
      }
    }

    // RN-03: red de seguridad sobre el estado resultante (cubre ediciones, p. ej. bajar un ingreso ya gastado).
    // Un movimiento nuevo queda al final de su día (createdAt máximo).
    var candidate = draftToTransaction(d, { id: originalId || 'mov-candidato', createdAt: originalTx ? originalTx.createdAt : '9999-12-31T23:59:59.999Z' });
    var nextTx = originalId
      ? state.transactions.map(function (t) { return t.id === originalId ? candidate : t; })
      : state.transactions.concat([candidate]);
    var bad = calc.accountViolations({ accounts: state.accounts, transactions: nextTx })[0];
    if (bad) { errors._form = violationMessage(bad); }
    return errors;
  }

  function findTx(state, id) {
    for (var i = 0; i < state.transactions.length; i++) { if (state.transactions[i].id === id) { return state.transactions[i]; } }
    return null;
  }

  /** REQ-035: eliminar no puede dejar una cuenta en saldo negativo ni sobre el límite. */
  function validateTransactionDelete(txId, state) {
    if (!findTx(state, txId)) { return { _form: 'El movimiento no existe.' }; }
    var next = { accounts: state.accounts, transactions: state.transactions.filter(function (t) { return t.id !== txId; }) };
    var bad = calc.accountViolations(next)[0];
    if (bad) { return { _form: 'No se puede eliminar. ' + violationMessage(bad) }; }
    return {};
  }

  /* ------------------------------------------------------------------ */
  /* Programaciones — REQ-079..REQ-086 (v4)                              */
  /* ------------------------------------------------------------------ */

  var FREQUENCIES = ['once', 'monthly', 'biweekly'];
  var MODES = ['auto', 'manual'];

  /** Borrador → programación (sin validar). */
  function draftToSchedule(d, base) {
    var sch = {
      id: base.id, type: d.type, accountId: d.accountId,
      amount: Number(str(d.amount).trim()), description: str(d.description).trim(),
      frequency: d.frequency, startDate: str(d.date).trim(), mode: d.type === 'ingreso' ? 'auto' : d.mode, // D28: ingresos siempre automáticos
      skippedDates: base.skippedDates || [], createdAt: base.createdAt
    };
    if (d.type === 'transferencia') { sch.toAccountId = d.toAccountId; } else { sch.categoryId = d.categoryId; }
    if (d.frequency !== 'once' && d.ends !== 'never' && str(d.endDate).trim() !== '') { sch.endDate // D29: «Sin fin» ignora la fecha
       = str(d.endDate).trim(); }
    var out = {};
    ['id', 'type', 'accountId', 'toAccountId', 'categoryId', 'amount', 'description', 'frequency', 'startDate', 'endDate', 'mode', 'skippedDates', 'createdAt']
      .forEach(function (k) { if (sch[k] !== undefined) { out[k] = sch[k]; } });
    return out;
  }

  /** REQ-079: valida una programación nueva (originalId = null) o editada. */
  function validateSchedule(d, state, originalId, today) {
    today = today || calc.todayISO();
    var original = originalId ? calc.getSchedule(state, originalId) : null;
    var errors = validateMovementFields(d, state, original);
    if (errors._form || errors.type) { return errors; }
    if (FREQUENCIES.indexOf(d.frequency) === -1) { errors.frequency = 'Elija la frecuencia.'; }
    if (d.type !== 'ingreso' && MODES.indexOf(d.mode) === -1) { errors.mode = 'Elija si se debita automáticamente o se confirma.'; }
    var start = str(d.date).trim();
    var keepStart = original && original.startDate === start; // editar sin mover la primera fecha
    if (start === '') { errors.date = 'La primera fecha es obligatoria.'; }
    else if (!calc.isValidISODate(start)) { errors.date = 'La fecha no es válida (formato AAAA-MM-DD).'; }
    else if (calc.daysBetween(start, today) > MAX_SCHEDULE_DAYS && !keepStart) { // REQ-079 (v5)
      errors.date = 'La primera fecha puede ser como máximo un año atrás (' + calc.addDays(today, -MAX_SCHEDULE_DAYS) + ').';
    }
    else if (calc.daysBetween(today, start) > MAX_SCHEDULE_DAYS) {
      errors.date = 'Solo se programa hasta un año adelante (' + calc.addDays(today, MAX_SCHEDULE_DAYS) + ').';
    }
    var end = d.ends === 'never' ? '' : str(d.endDate).trim(); // D29
    if (d.frequency !== 'once' && d.ends === 'date' && end === '') { errors.endDate = 'Elija hasta qué fecha, o marque «🔁 Sin fin».'; }
    if (d.frequency !== 'once' && end !== '') {
      if (!calc.isValidISODate(end)) { errors.endDate = 'La fecha "hasta" no es válida.'; }
      else if (calc.isValidISODate(start) && end < start) { errors.endDate = 'La fecha "hasta" no puede ser anterior a la primera fecha.'; }
    }
    if (hasErrors(errors)) { return errors; }

    // REQ-091 (v5): ocurrencias anteriores a hoy
    var candidate = draftToSchedule(d, { id: originalId || 'prg-candidato', createdAt: original ? original.createdAt : '', skippedDates: original ? original.skippedDates : [] });
    var past = pastOccurrences(state, candidate, today);
    if (past.length && d.pastAction !== 'register' && d.pastAction !== 'skip') {
      errors.pastAction = 'Indique si registra ahora los pagos anteriores a hoy o si ya los registró.';
    } else if (past.length && d.pastAction === 'register') {
      var txs = past.map(function (date, i) {
        var t = draftToTransaction({ type: d.type, accountId: d.accountId, toAccountId: d.toAccountId, categoryId: d.categoryId,
          amount: d.amount, date: date, description: d.description }, { id: 'mov-pasado-' + i, createdAt: '9999-12-31T23:59:59.999Z' });
        return t;
      });
      var bad = calc.accountViolations({ accounts: state.accounts, transactions: state.transactions.concat(txs) })[0];
      if (bad) {
        errors._form = 'No se pueden registrar los pagos anteriores: ' + violationMessage(bad).replace(/^La operación/, 'el registro') +
          ' Elija «Ya los registré» o revise el saldo inicial.';
      }
    }
    return errors;
  }

  /** REQ-091: fechas de ocurrencias anteriores a hoy que no están aplicadas ni omitidas. */
  function pastOccurrences(state, sch, today) {
    today = today || calc.todayISO();
    var yesterday = calc.addDays(today, -1);
    if (sch.startDate > yesterday) { return []; }
    var st = { transactions: state.transactions, schedules: (state.schedules || []).filter(function (x) { return x.id !== sch.id; }).concat([sch]) };
    return calc.scheduleOccurrences(sch, sch.startDate, yesterday).filter(function (date) { return !calc.isOccurrenceDone(st, sch, date); });
  }

  /** REQ-084: omitir una ocurrencia abierta. */
  function validateSkip(scheduleId, date, state) {
    var sch = calc.getSchedule(state, scheduleId);
    if (!sch) { return { _form: 'La programación no existe.' }; }
    if (calc.scheduleOccurrences(sch, date, date).length === 0 || calc.isOccurrenceDone(state, sch, date)) {
      return { _form: 'Esa ocurrencia ya fue aplicada u omitida.' };
    }
    return {};
  }

  A.validate = {
    MAX_DESCRIPTION: MAX_DESCRIPTION,
    MAX_SCHEDULE_DAYS: MAX_SCHEDULE_DAYS,
    validateMovementFields: validateMovementFields,
    draftToSchedule: draftToSchedule,
    validateSchedule: validateSchedule,
    validateSkip: validateSkip,
    pastOccurrences: pastOccurrences,
    isBlank: isBlank,
    hasErrors: hasErrors,
    parseAmount: parseAmount,
    draftToAccount: draftToAccount,
    draftToTransaction: draftToTransaction,
    validateAccount: validateAccount,
    validateAccountDelete: validateAccountDelete,
    validateArchive: validateArchive,
    validateSettings: validateSettings,
    parseDay: parseDay,
    validateCategory: validateCategory,
    validateCategoryDelete: validateCategoryDelete,
    validateReassign: validateReassign,
    validateTransaction: validateTransaction,
    validateTransactionDelete: validateTransactionDelete
  };
})(typeof window !== 'undefined' ? window : globalThis);
