/*
 * calculations.js — FinanzApp.calc
 * Funciones PURAS (sin DOM, sin estado global): fechas, dinero y valores derivados RN-01..RN-11.
 * Ningún valor calculado aquí se persiste (docs/data-contract.json $comment).
 */
(function (global) {
  'use strict';

  var A = global.FinanzApp = global.FinanzApp || {};

  var CAT_OTHER_EXPENSE = 'cat-otros-gastos';
  var CAT_OTHER_INCOME = 'cat-otros-ingresos';
  var LIQUID_TYPES = ['efectivo', 'debito', 'ahorros'];
  var DAY_MS = 86400000;

  /* ---------------------------------------------------------------- */
  /* Fechas (D2: texto ISO y Date.UTC; nunca new Date('YYYY-MM-DD'))   */
  /* ---------------------------------------------------------------- */

  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var MONTH_RE = /^(\d{4})-(\d{2})$/;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** 'YYYY-MM-DD' → milisegundos UTC, o null si no es una fecha de calendario real. */
  function parseISODate(s) {
    if (typeof s !== 'string') { return null; }
    var m = ISO_RE.exec(s);
    if (!m) { return null; }
    var y = +m[1], mo = +m[2], d = +m[3];
    var t = Date.UTC(y, mo - 1, d);
    var dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) { return null; }
    return t;
  }

  function isValidISODate(s) { return parseISODate(s) !== null; }

  /** Fecha LOCAL del dispositivo como 'YYYY-MM-DD' (D3). */
  function todayISO(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 'YYYY-MM-DD' → 'YYYY-MM'. */
  function monthOf(iso) { return String(iso).slice(0, 7); }

  function currentMonth(now) { return monthOf(todayISO(now)); }

  function isValidMonth(ym) {
    var m = MONTH_RE.exec(ym || '');
    return !!m && +m[2] >= 1 && +m[2] <= 12;
  }

  /** Suma n meses a 'YYYY-MM' (n puede ser negativo). */
  function addMonths(ym, n) {
    var m = MONTH_RE.exec(ym);
    var idx = (+m[1]) * 12 + (+m[2] - 1) + n;
    return Math.floor(idx / 12) + '-' + pad2((idx % 12) + 1);
  }

  var MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /** Días del mes 'YYYY-MM'. */
  function daysInMonth(ym) {
    var m = MONTH_RE.exec(ym);
    return new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate();
  }

  /** Construye 'YYYY-MM-DD' a partir de 'YYYY-MM' y un día. */
  function isoFromMonthDay(ym, day) { return ym + '-' + pad2(day); }

  /** Suma n días a una fecha ISO. */
  function addDays(iso, n) {
    var d = new Date(parseISODate(iso) + n * DAY_MS);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  /** Diferencia en días entre dos fechas ISO (b − a). */
  function daysBetween(a, b) { return Math.round((parseISODate(b) - parseISODate(a)) / DAY_MS); }

  /**
   * REQ-069: días restantes del mes incluyendo hoy (mes actual), todos los días (mes futuro)
   * o null (mes pasado = "Mes cerrado").
   */
  function remainingDays(ym, today) {
    var cur = monthOf(today);
    if (ym < cur) { return null; }
    if (ym > cur) { return daysInMonth(ym); }
    return daysInMonth(ym) - (+today.slice(8, 10)) + 1;
  }

  /** '2026-10' → 'Octubre 2026'. */
  function monthLabel(ym) {
    var m = MONTH_RE.exec(ym);
    var name = MONTH_NAMES[+m[2] - 1];
    return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + m[1];
  }

  /* ---------------------------------------------------------------- */
  /* Dinero (D4: sumas en céntimos enteros; redondeo solo al mostrar)  */
  /* ---------------------------------------------------------------- */

  function toCents(n) { return Math.round(Number(n) * 100); }
  function fromCents(c) { return c / 100; }

  function sumAmounts(list) {
    return fromCents(list.reduce(function (acc, x) { return acc + toCents(x.amount); }, 0));
  }

  /** true si el número tiene como máximo 2 decimales (REQ-024). */
  function hasMax2Decimals(n) {
    return Math.abs(Number(n) * 100 - Math.round(Number(n) * 100)) < 1e-6;
  }

  function roundMoney(n) { return fromCents(toCents(n)); }

  /** ₡12,500.00 — con signo opcional (REQ-045, REQ-046). */
  function formatMoney(n, opts) {
    opts = opts || {};
    var cents = toCents(n);
    var neg = cents < 0;
    cents = Math.abs(cents);
    var ent = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var dec = pad2(cents % 100);
    var sign = neg ? '−' : (opts.sign && cents > 0 ? '+' : '');
    return sign + '₡' + ent + '.' + dec;
  }

  /** Porcentaje como entero redondeado (REQ-045). */
  function formatPercent(p) { return Math.round(p) + ' %'; }

  /* ---------------------------------------------------------------- */
  /* Búsquedas                                                         */
  /* ---------------------------------------------------------------- */

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }
  function getAccount(state, id) { return findById(state.accounts, id); }
  function getCategory(state, id) { return findById(state.categories, id); }
  function isLiquid(account) { return !!account && LIQUID_TYPES.indexOf(account.type) !== -1; }
  function isSavings(account) { return !!account && account.type === 'ahorros'; }
  function isCredit(account) { return !!account && account.type === 'credito'; }
  function activeAccounts(state) { return state.accounts.filter(function (a) { return !a.archived; }); }

  /** Texto normalizado para comparar nombres y descripciones. */
  function normalize(s) { return String(s === undefined || s === null ? '' : s).trim().toLowerCase(); }

  /* ---------------------------------------------------------------- */
  /* RN-01 / RN-02: saldos de cuentas y patrimonio                      */
  /* ---------------------------------------------------------------- */

  /**
   * Efecto (en céntimos) de un movimiento sobre una cuenta.
   * ingreso: +monto en accountId · gasto: −monto en accountId
   * transferencia: −monto en accountId y +monto en toAccountId.
   */
  function effectOn(tx, accountId) {
    var c = toCents(tx.amount);
    var e = 0;
    if (tx.type === 'ingreso' && tx.accountId === accountId) { e += c; }
    if (tx.type === 'gasto' && tx.accountId === accountId) { e -= c; }
    if (tx.type === 'transferencia') {
      if (tx.accountId === accountId) { e -= c; }
      if (tx.toAccountId === accountId) { e += c; }
    }
    return e;
  }

  /**
   * RN-01: saldo = saldoInicial + ingresos + transf. entrantes − gastos − transf. salientes.
   * excludeTxId: calcula "como si ese movimiento no existiera" (REQ-034).
   */
  function accountBalance(state, accountId, excludeTxId, asOf) {
    var acc = getAccount(state, accountId);
    if (!acc) { return 0; }
    var cents = isLiquid(acc) ? toCents(acc.initialBalance || 0) : 0;
    state.transactions.forEach(function (tx) {
      if (tx.id !== excludeTxId && (!asOf || tx.date <= asOf)) { cents += effectOn(tx, accountId); }
    });
    return fromCents(cents);
  }

  /** REQ-074: saldo actual = solo movimientos con fecha ≤ hoy (sin programados). */
  function currentBalance(state, accountId, today) {
    return accountBalance(state, accountId, null, today || todayISO());
  }

  /** Deuda de una tarjeta de crédito (≥ 0). asOf opcional: deuda a esa fecha. */
  function creditDebt(state, accountId, excludeTxId, asOf) {
    return Math.max(0, -accountBalance(state, accountId, excludeTxId, asOf));
  }

  /* ---------------------------------------------------------------- */
  /* v4: programaciones (REQ-079..REQ-090)                              */
  /* ---------------------------------------------------------------- */

  function getSchedule(state, id) { return findById(state.schedules || [], id); }

  /**
   * REQ-080: fechas de las ocurrencias de una programación dentro de [from, to].
   * once → startDate · monthly → mismo día cada mes (o el último) · biweekly → días 15 y último de cada mes.
   */
  function scheduleOccurrences(sch, from, to) {
    var out = [];
    var lo = from > sch.startDate ? from : sch.startDate;
    var hi = sch.endDate && sch.endDate < to ? sch.endDate : to;
    if (lo > hi) { return out; }
    if (sch.frequency === 'once') {
      if (sch.startDate >= lo && sch.startDate <= hi) { out.push(sch.startDate); }
      return out;
    }
    var day = +sch.startDate.slice(8, 10);
    var ym = monthOf(lo), last = monthOf(hi);
    while (ym <= last) {
      var dim = daysInMonth(ym);
      var days = sch.frequency === 'monthly' ? [Math.min(day, dim)] : [15, dim];
      days.forEach(function (d) {
        var iso = isoFromMonthDay(ym, d);
        if (iso >= lo && iso <= hi) { out.push(iso); }
      });
      ym = addMonths(ym, 1);
    }
    return out;
  }

  function isOccurrenceApplied(state, scheduleId, date) {
    return state.transactions.some(function (t) { return t.scheduleId === scheduleId && t.occurrenceDate === date; });
  }

  function isOccurrenceDone(state, sch, date) {
    return sch.skippedDates.indexOf(date) !== -1 || isOccurrenceApplied(state, sch.id, date);
  }

  /** Movimiento virtual (no guardado) que representa una ocurrencia. */
  function occurrenceToTx(sch, date) {
    var t = { id: 'occ-' + sch.id + '-' + date, type: sch.type, accountId: sch.accountId, amount: sch.amount, date: date,
      description: sch.description, createdAt: sch.createdAt, scheduleId: sch.id, occurrenceDate: date, virtual: true, mode: sch.type === 'ingreso' ? 'auto' : sch.mode };
    if (sch.type === 'transferencia') { t.toAccountId = sch.toAccountId; } else { t.categoryId = sch.categoryId; }
    return t;
  }

  /**
   * REQ-081: ocurrencias abiertas (ni aplicadas ni omitidas) con fecha en [from, to], como movimientos virtuales.
   * status = 'scheduled' (fecha > hoy) o 'pending' (fecha ≤ hoy).
   */
  function openOccurrences(state, from, to, today) {
    today = today || todayISO();
    var out = [];
    (state.schedules || []).forEach(function (sch) {
      scheduleOccurrences(sch, from, to).forEach(function (date) {
        if (!isOccurrenceDone(state, sch, date)) {
          var t = occurrenceToTx(sch, date);
          t.status = date > today ? 'scheduled' : 'pending';
          out.push(t);
        }
      });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt < b.createdAt ? -1 : 1); });
  }

  var EPOCH = '1900-01-01';

  /** REQ-082 / REQ-083: ocurrencias con fecha ≤ hoy sin aplicar ni omitir. */
  function dueOccurrences(state, today) { return openOccurrences(state, EPOCH, today || todayISO(), today); }

  /** REQ-077 (v4): ocurrencias abiertas entre mañana y hoy + days. */
  function upcomingOccurrences(state, today, days) {
    today = today || todayISO();
    return openOccurrences(state, addDays(today, 1), addDays(today, days || 7), today);
  }

  /** REQ-089: próxima ocurrencia abierta (pendiente o futura) de una programación, o null. */
  function nextOccurrence(state, sch, today) {
    today = today || todayISO();
    var list = scheduleOccurrences(sch, sch.startDate, addDays(today, 400)).filter(function (d) { return !isOccurrenceDone(state, sch, d); });
    return list.length ? list[0] : null;
  }

  /** REQ-080: equivalente mensual (quincenal = 2 ocurrencias por mes). */
  function monthlyEquivalent(sch) {
    return sch.frequency === 'biweekly' ? roundMoney(sch.amount * 2) : sch.amount;
  }

  /** Último día del mes de 'today'. */
  function endOfMonth(iso) { var ym = monthOf(iso); return isoFromMonthDay(ym, daysInMonth(ym)); }

  /** Estado con las ocurrencias abiertas hasta 'until' agregadas como movimientos (para proyectar). */
  function projectedState(state, until, today) {
    var extra = openOccurrences(state, EPOCH, until, today);
    return { accounts: state.accounts, categories: state.categories, schedules: state.schedules, settings: state.settings,
      transactions: state.transactions.concat(extra) };
  }

  /** REQ-088: saldo proyectado de una cuenta al fin del mes actual. */
  function projectedBalance(state, accountId, today) {
    today = today || todayISO();
    return accountBalance(projectedState(state, endOfMonth(today), today), accountId);
  }

  /** REQ-088: ¿tiene la cuenta ocurrencias abiertas hasta fin del mes actual? */
  function hasOpenThisMonth(state, accountId, today) {
    today = today || todayISO();
    return openOccurrences(state, EPOCH, endOfMonth(today), today).some(function (t) {
      return t.accountId === accountId || t.toAccountId === accountId;
    });
  }

  /** REQ-089: programaciones con ocurrencias abiertas (pendientes o futuras) que usan la cuenta. */
  function schedulesUsingAccount(state, accountId, today) {
    return (state.schedules || []).filter(function (sch) {
      return (sch.accountId === accountId || sch.toAccountId === accountId) && nextOccurrence(state, sch, today) !== null;
    });
  }

  /** REQ-087: cuentas que, con los programados hasta fin de mes, violarían RN-03. */
  function projectionAlerts(state, today) {
    today = today || todayISO();
    return accountViolations(projectedState(state, endOfMonth(today), today));
  }

  /**
   * Línea de tiempo de una cuenta en orden cronológico (fecha, createdAt):
   * [{ tx, date, cents }] con el saldo (en céntimos) DESPUÉS de cada movimiento.
   * Devuelve también el saldo inicial en céntimos.
   */
  function timeline(state, accountId, excludeTxId) {
    var acc = getAccount(state, accountId);
    var cents = isLiquid(acc) ? toCents(acc.initialBalance || 0) : 0;
    var start = cents;
    var list = state.transactions.filter(function (t) {
      return t.id !== excludeTxId && (t.accountId === accountId || t.toAccountId === accountId);
    }).sort(function (a, b) {
      if (a.date !== b.date) { return a.date < b.date ? -1 : 1; }
      if (a.createdAt !== b.createdAt) { return a.createdAt < b.createdAt ? -1 : 1; }
      return 0;
    });
    var points = list.map(function (t) { cents += effectOn(t, accountId); return { tx: t, date: t.date, cents: cents }; });
    return { start: start, points: points };
  }

  /**
   * Saldo mínimo (céntimos) desde el final del día 'date' en adelante: el saldo al cierre de ese día
   * y el de cada movimiento posterior. Es lo máximo que puede salir de la cuenta en esa fecha sin que
   * el saldo quede negativo en ningún momento (RN-03 cronológica).
   */
  function minBalanceFrom(tl, date) {
    var atDate = tl.start, minAfter = Infinity;
    tl.points.forEach(function (p) {
      if (p.date <= date) { atDate = p.cents; } else { minAfter = Math.min(minAfter, p.cents); }
    });
    return Math.min(atDate, minAfter);
  }

  function maxBalanceFrom(tl, date) {
    var atDate = tl.start, maxAfter = -Infinity;
    tl.points.forEach(function (p) {
      if (p.date <= date) { atDate = p.cents; } else { maxAfter = Math.max(maxAfter, p.cents); }
    });
    return Math.max(atDate, maxAfter);
  }

  /**
   * Dinero que puede salir de la cuenta en la fecha 'date' (REQ-030, REQ-031):
   * líquida → saldo mínimo desde esa fecha; crédito → creditLimit + ese saldo (crédito disponible).
   * Sin fecha = hoy en adelante (equivale al saldo actual si no hay movimientos futuros).
   */
  function availableFunds(state, accountId, excludeTxId, date) {
    var acc = getAccount(state, accountId);
    if (!acc) { return 0; }
    var min = fromCents(minBalanceFrom(timeline(state, accountId, excludeTxId), date || '9999-12-31'));
    return isLiquid(acc) ? min : roundMoney(acc.creditLimit + min);
  }

  /**
   * Máximo que se puede abonar a una tarjeta en 'date' sin dejarla con saldo a favor en ningún momento (REQ-032):
   * la menor deuda desde esa fecha en adelante.
   */
  function paymentRoom(state, accountId, excludeTxId, date) {
    return Math.max(0, fromCents(-maxBalanceFrom(timeline(state, accountId, excludeTxId), date || '9999-12-31')));
  }

  /** RN-02: patrimonio = Σ saldos (las deudas restan). */
  /** RN-02 / REQ-074: patrimonio con el saldo actual (sin programados). */
  function netWorth(state, today) {
    return fromCents(state.accounts.reduce(function (acc, a) {
      return acc + toCents(currentBalance(state, a.id, today));
    }, 0));
  }

  /**
   * RN-09 (REQ-059): disponible para gastar (efectivo + débito), ahorros, deudas y patrimonio.
   * Patrimonio = disponible + ahorros − deudas.
   */
  function balanceSummary(state, today) {
    today = today || todayISO();
    var avail = 0, savings = 0, debts = 0, availAfter = 0;
    var proj = projectedState(state, endOfMonth(today), today);
    state.accounts.forEach(function (a) {
      var c = toCents(currentBalance(state, a.id, today));
      if (isSavings(a)) { savings += c; }
      else if (isLiquid(a)) { avail += c; availAfter += toCents(accountBalance(proj, a.id)); } // REQ-088
      else { debts += Math.max(0, -c); }
    });
    return { available: fromCents(avail), savings: fromCents(savings), debts: fromCents(debts),
      netWorth: fromCents(avail + savings - debts), availableAfterScheduled: fromCents(availAfter) };
  }

  /**
   * RN-10 (REQ-061): ciclo de una tarjeta de crédito respecto de 'today'.
   * Último corte = fecha más reciente con cutoffDay estrictamente anterior a hoy.
   * Fecha de pago = primera fecha con paymentDay posterior al último corte.
   * Pago del periodo = deuda al corte − pagos posteriores al corte (mínimo 0).
   * Devuelve null si la cuenta no es de crédito o no tiene fechas.
   */
  function creditCycle(state, accountId, today) {
    var acc = getAccount(state, accountId);
    if (!isCredit(acc) || !acc.cutoffDay || !acc.paymentDay) { return null; }
    today = today || todayISO();
    var ym = monthOf(today);
    var cutMonth = (+today.slice(8, 10)) > acc.cutoffDay ? ym : addMonths(ym, -1);
    var lastCutoff = isoFromMonthDay(cutMonth, acc.cutoffDay);
    var dueDate = isoFromMonthDay(acc.paymentDay > acc.cutoffDay ? cutMonth : addMonths(cutMonth, 1), acc.paymentDay);
    var atCut = 0, paidAfter = 0;
    state.transactions.forEach(function (t) {
      if (t.date <= lastCutoff) { atCut += effectOn(t, accountId); }
      else if (t.type === 'transferencia' && t.toAccountId === accountId && t.date <= today) { paidAfter += toCents(t.amount); } // v3: programados no cuentan
    });
    var statementDebt = Math.max(0, -atCut);
    return {
      lastCutoff: lastCutoff, dueDate: dueDate, statementDebt: fromCents(statementDebt),
      paymentsAfter: fromCents(paidAfter), amountDue: fromCents(Math.max(0, statementDebt - paidAfter)),
      daysUntil: daysBetween(today, dueDate)
    };
  }

  /** REQ-062: avisos de pago (≤ 7 días o vencido) de las tarjetas activas. */
  function paymentAlerts(state, today) {
    var out = [];
    activeAccounts(state).forEach(function (a) {
      var c = creditCycle(state, a.id, today);
      if (c && c.amountDue > 0 && c.daysUntil <= 7) {
        out.push({ account: a, amountDue: c.amountDue, dueDate: c.dueDate, daysUntil: c.daysUntil, overdue: c.daysUntil < 0 });
      }
    });
    return out;
  }

  /**
   * REQ-066: movimientos de una cuenta con el saldo después de cada uno.
   * Se calcula en orden cronológico (fecha, createdAt) y se devuelve en orden descendente.
   */
  function runningBalances(state, accountId) {
    return timeline(state, accountId).points.map(function (p) {
      return { tx: p.tx, effect: fromCents(effectOn(p.tx, accountId)), balanceAfter: fromCents(p.cents) };
    }).reverse();
  }

  /** REQ-067: cuenta activa usada en el movimiento creado más recientemente (o la primera activa). */
  function lastUsedAccountId(state) {
    var active = activeAccounts(state);
    if (!active.length) { return ''; }
    var ids = active.map(function (a) { return a.id; });
    var latest = null;
    state.transactions.forEach(function (t) {
      if (ids.indexOf(t.accountId) !== -1 && (!latest || t.createdAt > latest.createdAt)) { latest = t; }
    });
    return latest ? latest.accountId : active[0].id;
  }

  /**
   * RN-03 (invariante de fondos, CRONOLÓGICA): cuentas que en ALGÚN momento violan las reglas.
   * Líquida con saldo < 0 · crédito con saldo > 0 o deuda > límite.
   * Devuelve [{ account, balance, date, reason }] con el peor punto de cada cuenta.
   */
  function accountViolations(state) {
    var out = [];
    state.accounts.forEach(function (a) {
      var tl = timeline(state, a.id);
      var all = [{ date: null, cents: tl.start }].concat(tl.points);
      var lo = all[0], hi = all[0];
      all.forEach(function (p) { if (p.cents < lo.cents) { lo = p; } if (p.cents > hi.cents) { hi = p; } });
      if (isLiquid(a) && lo.cents < 0) { out.push({ account: a, balance: fromCents(lo.cents), date: lo.date, reason: 'negative' }); }
      if (!isLiquid(a) && hi.cents > 0) { out.push({ account: a, balance: fromCents(hi.cents), date: hi.date, reason: 'overpaid' }); }
      if (!isLiquid(a) && -lo.cents > toCents(a.creditLimit)) { out.push({ account: a, balance: fromCents(lo.cents), date: lo.date, reason: 'overlimit' }); }
    });
    return out;
  }

  function accountMovementCount(state, accountId) {
    return state.transactions.filter(function (t) {
      return t.accountId === accountId || t.toAccountId === accountId;
    }).length;
  }

  function categoryMovementCount(state, categoryId) {
    return state.transactions.filter(function (t) { return t.categoryId === categoryId; }).length;
  }

  /** REQ-017 / REQ-019 (v4): programaciones que usan la categoría. */
  function categoryScheduleCount(state, categoryId) {
    return (state.schedules || []).filter(function (s) { return s.categoryId === categoryId; }).length;
  }

  /* ---------------------------------------------------------------- */
  /* RN-05 / RN-06 / RN-07: resumen mensual, presupuestos y neto diario */
  /* ---------------------------------------------------------------- */

  /** Orden REQ-037: fecha desc y luego createdAt desc. */
  function sortTransactions(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) { return a.date < b.date ? 1 : -1; }
      if (a.createdAt !== b.createdAt) { return a.createdAt < b.createdAt ? 1 : -1; }
      return 0;
    });
  }

  function monthTransactions(state, ym) {
    return state.transactions.filter(function (t) { return monthOf(t.date) === ym; });
  }

  /** RN-05: { income, expense, net, savingsRate|null } — transferencias excluidas (REQ-039, REQ-040). */
  /** REQ-081: movimientos reales del mes + ocurrencias abiertas del mes (virtuales). */
  function monthItems(state, ym, today) {
    return monthTransactions(state, ym).concat(openOccurrences(state, ym + '-01', isoFromMonthDay(ym, daysInMonth(ym)), today));
  }

  /** RN-05 + REQ-081: incluye las ocurrencias programadas o pendientes del mes e informa cuánto corresponde a ellas. */
  function monthSummary(state, ym, today) {
    today = today || todayISO();
    var list = monthItems(state, ym, today);
    function sum(type, onlyScheduled) {
      return sumAmounts(list.filter(function (t) { return t.type === type && (!onlyScheduled || t.virtual); }));
    }
    var income = sum('ingreso'), expense = sum('gasto');
    var net = roundMoney(income - expense);
    return { income: income, expense: expense, net: net, savingsRate: income > 0 ? (net / income) * 100 : null,
      scheduledIncome: sum('ingreso', true), scheduledExpense: sum('gasto', true) };
  }

  function categorySpent(state, categoryId, ym) {
    return sumAmounts(monthItems(state, ym).filter(function (t) { // REQ-081: incluye programados
      return t.type === 'gasto' && t.categoryId === categoryId;
    }));
  }

  /** RN-06: ≤80 ok · (80,100] warning · >100 exceeded. Se evalúa sin redondear (REQ-045). */
  function statusFromPercent(p) {
    if (p > 100) { return 'exceeded'; }
    if (p > 80) { return 'warning'; }
    return 'ok';
  }

  /**
   * RN-06: estado del presupuesto de una categoría de gasto en un mes.
   * { spent, budget|null, percent|null, status|null, remaining|null } — sin presupuesto → null (REQ-043).
   */
  function budgetStatus(state, categoryId, ym) {
    var cat = getCategory(state, categoryId);
    var spent = categorySpent(state, categoryId, ym);
    if (!cat || !cat.monthlyBudget) {
      return { spent: spent, budget: null, percent: null, status: null, remaining: null };
    }
    var percent = (spent / cat.monthlyBudget) * 100;
    return {
      spent: spent, budget: cat.monthlyBudget, percent: percent,
      status: statusFromPercent(percent), remaining: roundMoney(cat.monthlyBudget - spent)
    };
  }

  /** RN-11 (REQ-070): gastos del mes vs. presupuesto total (settings.monthlyBudget). */
  /**
   * RN-13 / REQ-092: apartado a ahorros del mes = transferencias hacia cuentas de ahorros
   * − transferencias desde ahorros hacia cuentas de otro tipo (mínimo 0), con ocurrencias abiertas.
   */
  function savingsSetAside(state, ym, today) {
    function isSav(id) { var a = getAccount(state, id); return !!a && a.type === 'ahorros'; }
    var list = monthItems(state, ym, today).filter(function (t) { return t.type === 'transferencia'; });
    var inn = sumAmounts(list.filter(function (t) { return isSav(t.toAccountId) && !isSav(t.accountId); }));
    var out = sumAmounts(list.filter(function (t) { return isSav(t.accountId) && !isSav(t.toAccountId); }));
    return Math.max(0, roundMoney(inn - out));
  }

  /** REQ-070 (v6): consumido = gastos del mes + apartado a ahorros (D30). */
  function totalBudgetStatus(state, ym, today) {
    var expense = monthSummary(state, ym, today).expense;
    var savings = savingsSetAside(state, ym, today);
    var spent = roundMoney(expense + savings);
    var budget = state.settings && state.settings.monthlyBudget;
    var base = { spent: spent, expense: expense, savings: savings };
    if (!budget) { return Object.assign(base, { budget: null, percent: null, status: null, remaining: null }); }
    var percent = (spent / budget) * 100;
    return Object.assign(base, { budget: budget, percent: percent, status: statusFromPercent(percent), remaining: roundMoney(budget - spent),
      expensePercent: (expense / budget) * 100, savingsPercent: (savings / budget) * 100 });
  }

  /**
   * REQ-094 / REQ-095 (RN-13): progreso de la meta de una cuenta de ahorros.
   * null si la cuenta no tiene meta. monthly = aporte mensual de programaciones activas hacia la cuenta.
   */
  function goalProgress(state, accountId, today) {
    today = today || todayISO();
    var a = getAccount(state, accountId);
    if (!a || a.type !== 'ahorros' || !a.goalAmount) { return null; }
    var saved = currentBalance(state, accountId, today);
    var missing = Math.max(0, roundMoney(a.goalAmount - saved));
    var monthly = sumAmounts((state.schedules || []).filter(function (sch) {
      return sch.type === 'transferencia' && sch.toAccountId === accountId && sch.frequency !== 'once' &&
        (!sch.endDate || sch.endDate >= today);
    }).map(function (sch) { return { amount: monthlyEquivalent(sch) }; }));
    var months = missing > 0 && monthly > 0 ? Math.ceil(missing / monthly) : null;
    return {
      goal: a.goalAmount, reason: a.goalReason || null, saved: saved, missing: missing,
      percent: (saved / a.goalAmount) * 100, reached: saved >= a.goalAmount,
      monthly: monthly, months: months, etaMonth: months ? addMonths(monthOf(today), months) : null
    };
  }

  /** REQ-071: suma de los presupuestos por categoría. */
  function categoryBudgetsSum(state) {
    return sumAmounts(state.categories.filter(function (c) { return c.monthlyBudget; })
      .map(function (c) { return { amount: c.monthlyBudget }; }));
  }

  /** RN-07: neto del día = Σ ingresos − Σ gastos (transferencias excluidas). */
  function dayNet(list) {
    var inc = sumAmounts(list.filter(function (t) { return t.type === 'ingreso'; }));
    var exp = sumAmounts(list.filter(function (t) { return t.type === 'gasto'; }));
    return roundMoney(inc - exp);
  }

  /** Agrupa por fecha (desc). Devuelve [{ date, items, net }] (REQ-036). */
  function groupByDate(list) {
    var groups = [];
    var index = {};
    sortTransactions(list).forEach(function (t) {
      if (!(t.date in index)) { index[t.date] = groups.length; groups.push({ date: t.date, items: [] }); }
      groups[index[t.date]].items.push(t);
    });
    groups.forEach(function (g) { g.net = dayNet(g.items); });
    return groups;
  }

  /** Aplica los filtros de la lista (REQ-036). Nunca muta el estado. */
  function filterTransactions(state, ym, filters, today) {
    filters = filters || {};
    return monthItems(state, ym, today).filter(function (t) { // REQ-081: reales + ocurrencias abiertas
      if (filters.accountId && t.accountId !== filters.accountId && t.toAccountId !== filters.accountId) { return false; }
      if (filters.categoryId && t.categoryId !== filters.categoryId) { return false; }
      return true;
    });
  }

  /** RN-08: ¿existe otro movimiento igual? (tipo, cuenta, monto, fecha, descripción normalizada) (REQ-033). */
  function findDuplicate(state, tx, excludeTxId) {
    for (var i = 0; i < state.transactions.length; i++) {
      var t = state.transactions[i];
      if (t.id === excludeTxId) { continue; }
      if (t.type === tx.type && t.accountId === tx.accountId && toCents(t.amount) === toCents(tx.amount) &&
          t.date === tx.date && normalize(t.description) === normalize(tx.description)) { return t; }
    }
    return null;
  }

  A.calc = {
    CAT_OTHER_EXPENSE: CAT_OTHER_EXPENSE,
    CAT_OTHER_INCOME: CAT_OTHER_INCOME,
    parseISODate: parseISODate,
    isValidISODate: isValidISODate,
    todayISO: todayISO,
    monthOf: monthOf,
    currentMonth: currentMonth,
    isValidMonth: isValidMonth,
    addMonths: addMonths,
    daysInMonth: daysInMonth,
    daysBetween: daysBetween,
    addDays: addDays,
    currentBalance: currentBalance,
    getSchedule: getSchedule,
    scheduleOccurrences: scheduleOccurrences,
    isOccurrenceApplied: isOccurrenceApplied,
    isOccurrenceDone: isOccurrenceDone,
    occurrenceToTx: occurrenceToTx,
    openOccurrences: openOccurrences,
    dueOccurrences: dueOccurrences,
    upcomingOccurrences: upcomingOccurrences,
    nextOccurrence: nextOccurrence,
    monthlyEquivalent: monthlyEquivalent,
    endOfMonth: endOfMonth,
    projectedState: projectedState,
    projectedBalance: projectedBalance,
    hasOpenThisMonth: hasOpenThisMonth,
    schedulesUsingAccount: schedulesUsingAccount,
    projectionAlerts: projectionAlerts,
    monthItems: monthItems,
    remainingDays: remainingDays,
    monthLabel: monthLabel,
    toCents: toCents,
    fromCents: fromCents,
    sumAmounts: sumAmounts,
    hasMax2Decimals: hasMax2Decimals,
    roundMoney: roundMoney,
    formatMoney: formatMoney,
    formatPercent: formatPercent,
    getAccount: getAccount,
    getCategory: getCategory,
    isLiquid: isLiquid,
    isSavings: isSavings,
    isCredit: isCredit,
    activeAccounts: activeAccounts,
    balanceSummary: balanceSummary,
    creditCycle: creditCycle,
    paymentAlerts: paymentAlerts,
    runningBalances: runningBalances,
    lastUsedAccountId: lastUsedAccountId,
    totalBudgetStatus: totalBudgetStatus,
    savingsSetAside: savingsSetAside,
    goalProgress: goalProgress,
    categoryBudgetsSum: categoryBudgetsSum,
    normalize: normalize,
    accountBalance: accountBalance,
    creditDebt: creditDebt,
    availableFunds: availableFunds,
    paymentRoom: paymentRoom,
    netWorth: netWorth,
    accountViolations: accountViolations,
    accountMovementCount: accountMovementCount,
    categoryMovementCount: categoryMovementCount,
    categoryScheduleCount: categoryScheduleCount,
    sortTransactions: sortTransactions,
    monthTransactions: monthTransactions,
    monthSummary: monthSummary,
    categorySpent: categorySpent,
    statusFromPercent: statusFromPercent,
    budgetStatus: budgetStatus,
    dayNet: dayNet,
    groupByDate: groupByDate,
    filterTransactions: filterTransactions,
    findDuplicate: findDuplicate
  };
})(typeof window !== 'undefined' ? window : globalThis);
