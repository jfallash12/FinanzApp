/*
 * storage.js — FinanzApp.storage
 * Persistencia en LocalStorage (REQ-051, REQ-052, REQ-053, REQ-054) y migración v1 → v2 (REQ-072).
 * validateState() replica a mano docs/data-contract.json (D8: sin librerías de JSON Schema)
 * y agrega las reglas de su $comment que JSON Schema no puede expresar.
 */
(function (global) {
  'use strict';

  var A = global.FinanzApp = global.FinanzApp || {};
  var calc = A.calc;

  var STORAGE_KEY = 'finanzapp.state';
  var SCHEMA_VERSION = 3;

  var RE = {
    accId: /^acc-[a-z0-9-]+$/,
    prgId: /^prg-[a-z0-9-]+$/,
    catId: /^cat-[a-z0-9-]+$/,
    movId: /^mov-[a-z0-9-]+$/,
    notBlank: /\S/
  };
  var SYSTEM_IDS = [calc.CAT_OTHER_EXPENSE, calc.CAT_OTHER_INCOME];

  /** Estado vacío: sin cuentas ni movimientos y con las categorías predeterminadas (REQ-012, REQ-053). */
  function emptyState() {
    function c(id, name, kind, system) { return { id: id, name: name, kind: kind, system: system }; }
    return {
      schemaVersion: SCHEMA_VERSION,
      accounts: [],
      categories: [
        c('cat-alimentacion', 'Alimentación', 'gasto', false),
        c('cat-transporte', 'Transporte', 'gasto', false),
        c('cat-vivienda', 'Vivienda', 'gasto', false),
        c('cat-servicios', 'Servicios', 'gasto', false),
        c('cat-entretenimiento', 'Entretenimiento', 'gasto', false),
        c('cat-salud', 'Salud', 'gasto', false),
        c(calc.CAT_OTHER_EXPENSE, 'Otros gastos', 'gasto', true),
        c('cat-salario', 'Salario', 'ingreso', false),
        c(calc.CAT_OTHER_INCOME, 'Otros ingresos', 'ingreso', true)
      ],
      transactions: [],
      schedules: [],
      settings: {}
    };
  }

  /* ---------- Validador del contrato (schemaVersion 2) ---------- */

  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function isStr(s) { return typeof s === 'string'; }
  function isMoney(n) { return isNum(n) && calc.hasMax2Decimals(n); }
  function isText(s, max) { return isStr(s) && RE.notBlank.test(s) && s.length <= max; }
  function isDateTime(s) { return isStr(s) && !isNaN(Date.parse(s)); }

  function checkKeys(errors, path, o, required, allowed) {
    required.forEach(function (k) { if (!(k in o)) { errors.push(path + ': falta "' + k + '"'); } });
    Object.keys(o).forEach(function (k) {
      if (allowed.indexOf(k) === -1) { errors.push(path + ': campo no permitido "' + k + '"'); }
    });
  }

  function isDay(n) { return typeof n === 'number' && n % 1 === 0 && n >= 1 && n <= 28; }

  function checkAccount(errors, a, i) {
    var p = 'accounts[' + i + ']';
    if (!isObj(a)) { errors.push(p + ': debe ser objeto'); return; }
    var credit = a.type === 'credito';
    var base = ['id', 'name', 'type', 'archived', 'createdAt'];
    checkKeys(errors, p, a, base.concat([credit ? 'creditLimit' : 'initialBalance']),
      base.concat(credit ? ['creditLimit', 'cutoffDay', 'paymentDay'] : ['initialBalance']));
    if (typeof a.archived !== 'boolean') { errors.push(p + '.archived debe ser booleano'); }
    if (credit && (('cutoffDay' in a) !== ('paymentDay' in a))) { errors.push(p + ': cutoffDay y paymentDay van juntos'); }
    if ('cutoffDay' in a && !isDay(a.cutoffDay)) { errors.push(p + '.cutoffDay debe ser entero 1–28'); }
    if ('paymentDay' in a && !isDay(a.paymentDay)) { errors.push(p + '.paymentDay debe ser entero 1–28'); }
    if (!isStr(a.id) || !RE.accId.test(a.id)) { errors.push(p + '.id inválido'); }
    if (!isText(a.name, 40)) { errors.push(p + '.name inválido'); }
    if (['efectivo', 'debito', 'ahorros', 'credito'].indexOf(a.type) === -1) { errors.push(p + '.type inválido'); }
    if (credit && !(isMoney(a.creditLimit) && a.creditLimit > 0)) { errors.push(p + '.creditLimit debe ser > 0'); }
    if (!credit && !(isMoney(a.initialBalance) && a.initialBalance >= 0)) { errors.push(p + '.initialBalance debe ser ≥ 0'); }
    if (!isDateTime(a.createdAt)) { errors.push(p + '.createdAt inválido'); }
  }

  function checkCategory(errors, c, i) {
    var p = 'categories[' + i + ']';
    if (!isObj(c)) { errors.push(p + ': debe ser objeto'); return; }
    checkKeys(errors, p, c, ['id', 'name', 'kind', 'system'],
      c.kind === 'ingreso' ? ['id', 'name', 'kind', 'system'] : ['id', 'name', 'kind', 'monthlyBudget', 'system']);
    if (!isStr(c.id) || !RE.catId.test(c.id)) { errors.push(p + '.id inválido'); }
    if (!isText(c.name, 40)) { errors.push(p + '.name inválido'); }
    if (['gasto', 'ingreso'].indexOf(c.kind) === -1) { errors.push(p + '.kind inválido'); }
    if ('monthlyBudget' in c && !(isMoney(c.monthlyBudget) && c.monthlyBudget > 0)) { errors.push(p + '.monthlyBudget debe ser > 0'); }
    if (typeof c.system !== 'boolean') { errors.push(p + '.system debe ser booleano'); }
    var isSystem = SYSTEM_IDS.indexOf(c.id) !== -1;
    if (isSystem !== (c.system === true)) { errors.push(p + ': system solo para las categorías del sistema'); }
    if (c.id === calc.CAT_OTHER_EXPENSE && c.kind !== 'gasto') { errors.push(p + ': Otros gastos debe ser de gasto'); }
    if (c.id === calc.CAT_OTHER_INCOME && c.kind !== 'ingreso') { errors.push(p + ': Otros ingresos debe ser de ingreso'); }
  }

  function checkTransaction(errors, t, i) {
    var p = 'transactions[' + i + ']';
    if (!isObj(t)) { errors.push(p + ': debe ser objeto'); return; }
    var transfer = t.type === 'transferencia';
    var base = ['id', 'type', 'accountId', 'amount', 'date', 'description', 'createdAt'];
    var extra = transfer ? 'toAccountId' : 'categoryId';
    checkKeys(errors, p, t, base.concat([extra]), base.concat([extra, 'scheduleId', 'occurrenceDate']));
    if (('scheduleId' in t) !== ('occurrenceDate' in t)) { errors.push(p + ': scheduleId y occurrenceDate van juntos'); }
    if ('scheduleId' in t && (!isStr(t.scheduleId) || !RE.prgId.test(t.scheduleId))) { errors.push(p + '.scheduleId inválido'); }
    if ('occurrenceDate' in t && !calc.isValidISODate(t.occurrenceDate)) { errors.push(p + '.occurrenceDate inválida'); }
    if (!isStr(t.id) || !RE.movId.test(t.id)) { errors.push(p + '.id inválido'); }
    if (['ingreso', 'gasto', 'transferencia'].indexOf(t.type) === -1) { errors.push(p + '.type inválido'); }
    if (!isStr(t.accountId) || !RE.accId.test(t.accountId)) { errors.push(p + '.accountId inválido'); }
    if (transfer && (!isStr(t.toAccountId) || !RE.accId.test(t.toAccountId))) { errors.push(p + '.toAccountId inválido'); }
    if (!transfer && (!isStr(t.categoryId) || !RE.catId.test(t.categoryId))) { errors.push(p + '.categoryId inválido'); }
    if (!(isMoney(t.amount) && t.amount > 0)) { errors.push(p + '.amount debe ser > 0 con máximo 2 decimales'); }
    if (!calc.isValidISODate(t.date)) { errors.push(p + '.date inválida'); }
    if (!isText(t.description, 80)) { errors.push(p + '.description inválida'); }
    if (!isDateTime(t.createdAt)) { errors.push(p + '.createdAt inválido'); }
  }

  function checkSchedule(errors, c, i) {
    var p = 'schedules[' + i + ']';
    if (!isObj(c)) { errors.push(p + ': debe ser objeto'); return; }
    var transfer = c.type === 'transferencia';
    var base = ['id', 'type', 'accountId', 'amount', 'description', 'frequency', 'startDate', 'mode', 'skippedDates', 'createdAt'];
    checkKeys(errors, p, c, base.concat([transfer ? 'toAccountId' : 'categoryId']),
      base.concat([transfer ? 'toAccountId' : 'categoryId', 'endDate']));
    if (!isStr(c.id) || !RE.prgId.test(c.id)) { errors.push(p + '.id inválido'); }
    if (['ingreso', 'gasto', 'transferencia'].indexOf(c.type) === -1) { errors.push(p + '.type inválido'); }
    if (!isStr(c.accountId) || !RE.accId.test(c.accountId)) { errors.push(p + '.accountId inválido'); }
    if (!(isMoney(c.amount) && c.amount > 0)) { errors.push(p + '.amount debe ser > 0'); }
    if (!isText(c.description, 80)) { errors.push(p + '.description inválida'); }
    if (['once', 'monthly', 'biweekly'].indexOf(c.frequency) === -1) { errors.push(p + '.frequency inválida'); }
    if (['auto', 'manual'].indexOf(c.mode) === -1) { errors.push(p + '.mode inválido'); }
    if (!calc.isValidISODate(c.startDate)) { errors.push(p + '.startDate inválida'); }
    if ('endDate' in c && (!calc.isValidISODate(c.endDate) || c.frequency === 'once' || c.endDate < c.startDate)) { errors.push(p + '.endDate inválida'); }
    if (!Array.isArray(c.skippedDates) || c.skippedDates.some(function (d) { return !calc.isValidISODate(d); })) { errors.push(p + '.skippedDates inválido'); }
    if (!isDateTime(c.createdAt)) { errors.push(p + '.createdAt inválido'); }
  }

  function checkUnique(errors, list, path) {
    var ids = {}, names = {};
    list.forEach(function (x) {
      if (!isObj(x)) { return; }
      if (ids[x.id]) { errors.push(path + ': id repetido ' + x.id); }
      ids[x.id] = true;
      var n = calc.normalize(x.name);
      if (names[n]) { errors.push(path + ': nombre repetido "' + x.name + '"'); }
      names[n] = true;
    });
  }

  /** Integridad referencial y reglas de negocio del $comment del contrato. */
  function checkRelations(errors, s) {
    var txIds = {};
    s.transactions.forEach(function (t, i) {
      var p = 'transactions[' + i + ']';
      if (txIds[t.id]) { errors.push(p + ': id repetido'); }
      txIds[t.id] = true;
      var acc = calc.getAccount(s, t.accountId);
      if (!acc) { errors.push(p + ': accountId no existe'); }
      if (t.type === 'transferencia') {
        if (!calc.getAccount(s, t.toAccountId)) { errors.push(p + ': toAccountId no existe'); }
        if (t.toAccountId === t.accountId) { errors.push(p + ': transferencia a la misma cuenta'); }
      } else {
        var cat = calc.getCategory(s, t.categoryId);
        if (!cat) { errors.push(p + ': categoryId no existe'); }
        else if (cat.kind !== t.type) { errors.push(p + ': la categoría no coincide con el tipo'); }
      }
      if (acc && t.type === 'ingreso' && !calc.isLiquid(acc)) { errors.push(p + ': ingreso en cuenta de crédito'); }
      if (acc && t.type === 'gasto' && calc.isSavings(acc)) { errors.push(p + ': gasto desde cuenta de ahorros'); }
    });
    var occ = {};
    s.transactions.forEach(function (t, i) { // REQ-082/086: una ocurrencia → un solo movimiento y programación existente
      if (!t.scheduleId) { return; }
      if (!calc.getSchedule(s, t.scheduleId)) { errors.push('transactions[' + i + ']: scheduleId no existe'); }
      var k = t.scheduleId + '|' + t.occurrenceDate;
      if (occ[k]) { errors.push('transactions[' + i + ']: ocurrencia aplicada dos veces'); }
      occ[k] = true;
    });
    var prgIds = {};
    s.schedules.forEach(function (c, i) {
      var p = 'schedules[' + i + ']';
      if (prgIds[c.id]) { errors.push(p + ': id repetido'); }
      prgIds[c.id] = true;
      var acc = calc.getAccount(s, c.accountId);
      if (!acc) { errors.push(p + ': accountId no existe'); }
      if (c.type === 'transferencia') {
        if (!calc.getAccount(s, c.toAccountId) || c.toAccountId === c.accountId) { errors.push(p + ': toAccountId inválido'); }
      } else {
        var cat = calc.getCategory(s, c.categoryId);
        if (!cat || cat.kind !== c.type) { errors.push(p + ': categoryId inválido'); }
      }
      if (acc && c.type === 'ingreso' && !calc.isLiquid(acc)) { errors.push(p + ': ingreso en cuenta de crédito'); }
      if (acc && c.type === 'gasto' && calc.isSavings(acc)) { errors.push(p + ': gasto desde cuenta de ahorros'); }
    });
    calc.accountViolations(s).forEach(function (v) {
      errors.push('accounts: ' + v.account.id + ' viola la regla de fondos (' + v.reason + ')');
    });
  }

  /** Devuelve { valid, errors[] }. */
  function validateState(s) {
    var errors = [];
    if (!isObj(s)) { return { valid: false, errors: ['el estado debe ser un objeto'] }; }
    checkKeys(errors, 'estado', s, ['schemaVersion', 'accounts', 'categories', 'transactions', 'schedules', 'settings'],
      ['schemaVersion', 'accounts', 'categories', 'transactions', 'schedules', 'settings']);
    if (!isObj(s.settings)) { errors.push('settings debe ser objeto'); }
    else {
      checkKeys(errors, 'settings', s.settings, [], ['monthlyBudget']);
      if ('monthlyBudget' in s.settings && !(isMoney(s.settings.monthlyBudget) && s.settings.monthlyBudget > 0)) {
        errors.push('settings.monthlyBudget debe ser > 0');
      }
    }
    if (s.schemaVersion !== SCHEMA_VERSION) { errors.push('schemaVersion debe ser ' + SCHEMA_VERSION); }
    if (!Array.isArray(s.accounts) || !Array.isArray(s.categories) || !Array.isArray(s.transactions) || !Array.isArray(s.schedules)) {
      errors.push('accounts, categories, transactions y schedules deben ser arreglos');
      return { valid: false, errors: errors };
    }
    s.accounts.forEach(function (a, i) { checkAccount(errors, a, i); });
    s.categories.forEach(function (c, i) { checkCategory(errors, c, i); });
    s.transactions.forEach(function (t, i) { checkTransaction(errors, t, i); });
    s.schedules.forEach(function (c, i) { checkSchedule(errors, c, i); });
    SYSTEM_IDS.forEach(function (id) {
      if (!s.categories.some(function (c) { return isObj(c) && c.id === id; })) { errors.push('falta la categoría del sistema ' + id); }
    });
    if (errors.length === 0) {
      checkUnique(errors, s.accounts, 'accounts');
      checkUnique(errors, s.categories, 'categories');
      checkRelations(errors, s);
    }
    return { valid: errors.length === 0, errors: errors };
  }

  /**
   * REQ-072: un estado schemaVersion 1 se convierte a 2 (y luego a 3, REQ-090) sin perder datos:
   * cuentas activas, tarjetas sin fechas y sin presupuesto total. Si no es v1 ni v2, se devuelve igual.
   */
  function migrate(obj, today) {
    if (!isObj(obj)) { return obj; }
    if (obj.schemaVersion === 2) { return migrateV2(obj, today); }
    if (obj.schemaVersion !== 1 || !Array.isArray(obj.accounts)) { return obj; }
    var out = JSON.parse(JSON.stringify(obj));
    out.schemaVersion = 2;
    out.accounts = out.accounts.map(function (a) {
      if (!isObj(a)) { return a; }
      var b = {};
      Object.keys(a).forEach(function (k) { if (k !== 'createdAt') { b[k] = a[k]; } });
      b.archived = false;
      b.createdAt = a.createdAt;
      return b;
    });
    out.settings = {};
    return migrateV2(out, today);
  }

  /**
   * REQ-090: v2 → v3. Cada movimiento con fecha posterior a hoy (programado de la v3)
   * se convierte en una programación "Una vez" con auto-débito y los mismos datos.
   */
  function migrateV2(obj, today) {
    if (!Array.isArray(obj.transactions)) { return obj; }
    today = today || calc.todayISO();
    var out = JSON.parse(JSON.stringify(obj));
    out.schemaVersion = 3;
    out.schedules = [];
    out.transactions = out.transactions.filter(function (t) {
      if (!isObj(t) || !(isStr(t.date) && t.date > today)) { return true; }
      var sch = { id: 'prg-' + String(t.id).replace(/^mov-/, ''), type: t.type, accountId: t.accountId };
      if (t.type === 'transferencia') { sch.toAccountId = t.toAccountId; } else { sch.categoryId = t.categoryId; }
      sch.amount = t.amount; sch.description = t.description; sch.frequency = 'once'; sch.startDate = t.date;
      sch.mode = 'auto'; sch.skippedDates = []; sch.createdAt = t.createdAt;
      out.schedules.push(sch);
      return false;
    });
    var settings = out.settings; delete out.settings; out.settings = settings;
    return out;
  }

  /** REQ-052 / REQ-053 / REQ-072: devuelve { state, notice, migrated }. Nunca lanza. */
  function loadState() {
    var raw;
    try { raw = global.localStorage.getItem(STORAGE_KEY); }
    catch (e) { return { state: emptyState(), notice: { type: 'error', text: 'No se pudo leer el almacenamiento del navegador. Se inició sin datos.' } }; }
    if (raw === null) { return { state: emptyState(), notice: null }; }
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return { state: emptyState(), notice: corruptNotice() }; }
    var migrated = !!parsed && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2);
    var candidate = migrate(parsed);
    var result = validateState(candidate);
    if (!result.valid) {
      if (global.console) { global.console.warn('Estado guardado fuera de contrato:', result.errors); }
      return { state: emptyState(), notice: corruptNotice() };
    }
    return { state: candidate, notice: null, migrated: migrated };
  }

  function corruptNotice() {
    return { type: 'error', text: 'Los datos guardados estaban dañados y no se pudieron cargar. La aplicación inició sin datos.' };
  }

  /** REQ-051 / REQ-054: true si guardó; si falla devuelve el error (los datos siguen en memoria). */
  function saveState(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return e || new Error('No se pudo guardar');
    }
  }

  A.storage = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    emptyState: emptyState,
    migrate: migrate,
    validateState: validateState,
    loadState: loadState,
    saveState: saveState
  };
})(typeof window !== 'undefined' ? window : globalThis);
