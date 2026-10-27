/*
 * app.js — FinanzApp.app
 * Único módulo que muta el estado. Todo cambio pasa por dispatch(action):
 *   validar → (confirmar) → reducer sobre una copia → validar contrato → guardar → render.
 * Ver docs/design.md §5.4.
 */
(function (global) {
  'use strict';

  var A = global.FinanzApp = global.FinanzApp || {};
  var calc = A.calc, validate = A.validate, storage = A.storage, view = A.ui;
  var doc = global.document;

  var state = null;     // dominio (data-contract.json)
  var ui = null;        // interfaz (no se persiste)
  var saveFailed = false;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** D7: prefijo + tiempo en base 36 + aleatorio (cumple los pattern del contrato). */
  function newId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1679616).toString(36);
  }

  function nowISO() { return new Date().toISOString(); }
  function str(v) { return v === undefined || v === null ? '' : String(v); }

  /* ------------------------------------------------------------------ */
  /* Estado de interfaz y formularios                                    */
  /* ------------------------------------------------------------------ */

  var FORMS = ['transaction', 'quick', 'account', 'category', 'settings'];

  function isActiveAccount(id) { var a = calc.getAccount(state, id); return !!a && !a.archived; }

  function defaultDraft(name) {
    if (name === 'transaction') {
      var keep = ui && ui.forms.transaction && ui.forms.transaction.draft; // conserva tipo y cuenta entre registros
      return {
        type: keep ? keep.type : 'gasto',
        date: calc.todayISO(),
        amount: '',
        description: '',
        accountId: keep && isActiveAccount(keep.accountId) ? keep.accountId : calc.lastUsedAccountId(state),
        categoryId: '',
        toAccountId: '',
        scheduled: false, frequency: 'monthly', ends: 'never', endDate: '', mode: 'auto', pastAction: 'register' // REQ-079, REQ-091
      };
    }
    if (name === 'quick') { // REQ-067: hoy y última cuenta usada
      return { type: 'gasto', date: calc.todayISO(), amount: '', description: '', accountId: calc.lastUsedAccountId(state), categoryId: '', toAccountId: '',
        scheduled: false, frequency: 'monthly', ends: 'never', endDate: '', mode: 'auto', pastAction: 'register' };
    }
    if (name === 'account') { return { name: '', type: 'efectivo', initialBalance: '', creditLimit: '', cutoffDay: '', paymentDay: '', goalAmount: '', goalReason: '' }; }
    if (name === 'settings') { return { monthlyBudget: state.settings.monthlyBudget ? String(state.settings.monthlyBudget) : '' }; }
    return { name: '', kind: 'gasto', monthlyBudget: '' };
  }

  function emptyForm(name) { return { draft: defaultDraft(name), touched: {}, editingId: null, editingScheduleId: null, link: null }; }

  function initialUi() {
    var u = {
      activeTab: 'resumen',
      month: calc.currentMonth(), // REQ-038
      filters: { accountId: '', categoryId: '' },
      forms: {},
      errors: { transaction: {}, quick: {}, account: {}, category: {}, settings: {}, reassign: {} },
      quickOpen: false,          // REQ-067
      selectedAccountId: null,   // REQ-066: detalle de cuenta
      dialog: null,
      notice: null,
      toast: null
    };
    return u;
  }

  function resetForm(name) {
    ui.forms[name] = emptyForm(name);
    ui.errors[name] = {};
  }

  function draftFromTransaction(t) {
    return {
      type: t.type, date: t.date, amount: String(t.amount), description: t.description,
      accountId: t.accountId, categoryId: t.categoryId || '', toAccountId: t.toAccountId || '',
      scheduled: false, frequency: 'monthly', ends: 'never', endDate: '', mode: 'auto', pastAction: 'register'
    };
  }

  function draftFromSchedule(sch) {
    return {
      type: sch.type, date: sch.startDate, amount: String(sch.amount), description: sch.description,
      accountId: sch.accountId, categoryId: sch.categoryId || '', toAccountId: sch.toAccountId || '',
      scheduled: true, frequency: sch.frequency, ends: sch.endDate ? 'date' : 'never', endDate: sch.endDate || '', mode: sch.mode, pastAction: 'register'
    };
  }

  function draftFromAccount(a) {
    return {
      name: a.name, type: a.type,
      initialBalance: a.type === 'credito' ? '' : String(a.initialBalance),
      creditLimit: a.type === 'credito' ? String(a.creditLimit) : '',
      cutoffDay: a.cutoffDay ? String(a.cutoffDay) : '',
      paymentDay: a.paymentDay ? String(a.paymentDay) : '',
      goalAmount: a.goalAmount ? String(a.goalAmount) : '', goalReason: a.goalReason || '' // REQ-093
    };
  }

  function draftFromCategory(c) {
    return { name: c.name, kind: c.kind, monthlyBudget: c.monthlyBudget ? String(c.monthlyBudget) : '' };
  }

  /** Valida un formulario completo con la función de validations.js correspondiente. */
  function validateForm(name) {
    var f = ui.forms[name];
    if ((name === 'transaction' || name === 'quick') && f.draft.scheduled) { // REQ-079
      return validate.validateSchedule(f.draft, state, f.editingScheduleId);
    }
    if (name === 'transaction') { return validate.validateTransaction(f.draft, state, f.editingId); }
    if (name === 'quick') { return validate.validateTransaction(f.draft, state, null); }
    if (name === 'settings') { return validate.validateSettings(f.draft); }
    if (name === 'account') { return validate.validateAccount(f.draft, state, f.editingId); }
    return validate.validateCategory(f.draft, state, f.editingId);
  }

  function touchAll(name) {
    Object.keys(ui.forms[name].draft).forEach(function (k) { ui.forms[name].touched[k] = true; });
  }

  function toast(type, text) { ui.toast = { type: type, text: text, at: Date.now() }; }

  /* ------------------------------------------------------------------ */
  /* Construcción de entidades                                          */
  /* ------------------------------------------------------------------ */

  function buildCategory(d, base) {
    var c = { id: base.id, name: str(d.name).trim(), kind: d.kind, system: base.system };
    if (d.kind === 'gasto' && str(d.monthlyBudget).trim() !== '') { c.monthlyBudget = Number(str(d.monthlyBudget).trim()); }
    return c;
  }

  function findIndex(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return i; } }
    return -1;
  }

  /* ------------------------------------------------------------------ */
  /* Acciones de dominio                                                 */
  /* form: formulario que recibe los errores · validate · confirm · reduce · after */
  /* ------------------------------------------------------------------ */

  var DOMAIN = {
    ADD_ACCOUNT: {
      form: 'account',
      validate: function (a) { return validate.validateAccount(a.draft, state, null); },
      reduce: function (s, a) { s.accounts.push(validate.draftToAccount(a.draft, { id: newId('acc'), createdAt: nowISO() })); },
      after: function () {
        resetForm('account');
        if (!calc.getAccount(state, ui.forms.transaction.draft.accountId)) { resetForm('transaction'); }
        toast('ok', 'Cuenta creada.');
      }
    },
    UPDATE_ACCOUNT: {
      form: 'account',
      validate: function (a) { return validate.validateAccount(a.draft, state, a.id); },
      reduce: function (s, a) {
        var i = findIndex(s.accounts, a.id);
        s.accounts[i] = validate.draftToAccount(a.draft, s.accounts[i]);
      },
      after: function () { resetForm('account'); toast('ok', 'Cuenta actualizada.'); }
    },
    DELETE_ACCOUNT: {
      form: null,
      validate: function (a) { return validate.validateAccountDelete(a.id, state); }, // REQ-010
      confirm: function (a) { // REQ-011
        var acc = calc.getAccount(state, a.id);
        return { title: 'Eliminar cuenta', text: '¿Eliminar la cuenta «' + acc.name + '»? Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true };
      },
      reduce: function (s, a) { s.accounts = s.accounts.filter(function (x) { return x.id !== a.id; }); },
      after: function (a) {
        if (ui.forms.account.editingId === a.id) { resetForm('account'); }
        if (ui.forms.transaction.draft.accountId === a.id) { resetForm('transaction'); }
        if (ui.filters.accountId === a.id) { ui.filters.accountId = ''; }
        ui.selectedAccountId = null;
        toast('ok', 'Cuenta eliminada.');
      }
    },

    ARCHIVE_ACCOUNT: { // REQ-063
      form: null,
      validate: function (a) { return validate.validateArchive(a.id, state); },
      confirm: function (a) {
        var acc = calc.getAccount(state, a.id);
        return { title: 'Archivar cuenta', text: '¿Archivar «' + acc.name + '»? Dejará de aparecer al registrar movimientos, pero su historial se conserva y puede reactivarla cuando quiera.', confirmLabel: 'Archivar' };
      },
      reduce: function (s, a) { s.accounts[findIndex(s.accounts, a.id)].archived = true; },
      after: function (a) {
        if (ui.forms.account.editingId === a.id) { resetForm('account'); }
        if (ui.forms.transaction.draft.accountId === a.id && !ui.forms.transaction.editingId) { resetForm('transaction'); }
        ui.selectedAccountId = null;
        toast('ok', 'Cuenta archivada.');
      }
    },
    UNARCHIVE_ACCOUNT: { // REQ-065
      form: null,
      validate: function (a) { var acc = calc.getAccount(state, a.id); return acc && acc.archived ? {} : { _form: 'La cuenta no está archivada.' }; },
      reduce: function (s, a) { s.accounts[findIndex(s.accounts, a.id)].archived = false; },
      after: function () { toast('ok', 'Cuenta reactivada.'); }
    },
    SAVE_SETTINGS: { // REQ-070
      form: 'settings',
      validate: function (a) { return validate.validateSettings(a.draft); },
      reduce: function (s, a) {
        var v = str(a.draft.monthlyBudget).trim();
        s.settings = v === '' ? {} : { monthlyBudget: Number(v) };
      },
      after: function () { resetForm('settings'); toast('ok', 'Presupuesto total actualizado.'); }
    },

    ADD_CATEGORY: {
      form: 'category',
      validate: function (a) { return validate.validateCategory(a.draft, state, null); },
      reduce: function (s, a) { s.categories.push(buildCategory(a.draft, { id: newId('cat'), system: false })); },
      after: function () { resetForm('category'); toast('ok', 'Categoría creada.'); }
    },
    UPDATE_CATEGORY: {
      form: 'category',
      validate: function (a) { return validate.validateCategory(a.draft, state, a.id); },
      reduce: function (s, a) {
        var i = findIndex(s.categories, a.id);
        s.categories[i] = buildCategory(a.draft, s.categories[i]);
      },
      after: function () { resetForm('category'); toast('ok', 'Categoría actualizada.'); }
    },
    DELETE_CATEGORY: {
      form: 'reassign',
      validate: function (a) {
        return a.confirmed ? validate.validateReassign(a.draft || {}, a.id, state) : validate.validateCategoryDelete(a.id, state);
      },
      confirm: function (a) {
        var cat = calc.getCategory(state, a.id);
        var n = calc.categoryMovementCount(state, a.id);
        var np = calc.categoryScheduleCount(state, a.id);
        if (n + np === 0) { // REQ-018
          return { title: 'Eliminar categoría', text: '¿Eliminar la categoría «' + cat.name + '»?', confirmLabel: 'Eliminar', danger: true };
        }
        ui.errors.reassign = {};
        return { // REQ-017
          kind: 'reassign', title: 'Eliminar categoría con movimientos',
          text: 'La categoría «' + cat.name + '» tiene ' + n + (n === 1 ? ' movimiento' : ' movimientos') +
            (np ? ' y ' + np + (np === 1 ? ' programación' : ' programaciones') : '') +
            '. Elija a qué categoría de ' + cat.kind + ' se reasignarán antes de eliminarla.',
          confirmLabel: 'Reasignar y eliminar', danger: true, categoryId: a.id,
          draft: { targetId: cat.kind === 'gasto' ? calc.CAT_OTHER_EXPENSE : calc.CAT_OTHER_INCOME }
        };
      },
      reduce: function (s, a) {
        var target = a.draft && a.draft.targetId;
        s.transactions.forEach(function (t) { if (t.categoryId === a.id) { t.categoryId = target; } });
        s.schedules.forEach(function (p) { if (p.categoryId === a.id) { p.categoryId = target; } }); // REQ-017 (v4)
        s.categories = s.categories.filter(function (c) { return c.id !== a.id; });
      },
      after: function (a) {
        if (ui.forms.category.editingId === a.id) { resetForm('category'); }
        if (ui.forms.transaction.draft.categoryId === a.id) { ui.forms.transaction.draft.categoryId = ''; }
        if (ui.filters.categoryId === a.id) { ui.filters.categoryId = ''; }
        toast('ok', 'Categoría eliminada.');
      }
    },

    ADD_TRANSACTION: {
      form: 'transaction',
      formOf: function (a) { return a.source === 'quick' ? 'quick' : 'transaction'; },
      validate: function (a) { return validate.validateTransaction(a.draft, state, null); },
      confirm: function (a) { // REQ-033 (no aplica a la confirmación de una ocurrencia programada)
        if (a.link) { return null; }
        var candidate = validate.draftToTransaction(a.draft, { id: 'mov-candidato', createdAt: '' });
        var dup = calc.findDuplicate(state, candidate, null);
        if (!dup) { return null; }
        return {
          title: 'Posible movimiento duplicado',
          text: 'Ya existe un movimiento igual (mismo tipo, cuenta, monto, fecha y descripción):',
          items: [dup.date + ' · ' + dup.description + ' · ' + calc.formatMoney(dup.amount)],
          confirmLabel: 'Registrar de todos modos'
        };
      },
      reduce: function (s, a) {
        var tx = validate.draftToTransaction(a.draft, { id: newId('mov'), createdAt: nowISO() });
        if (a.link) { tx = linkTx(tx, a.link); } // REQ-083 "Ajustar": queda enlazado a su ocurrencia
        s.transactions.push(tx);
      },
      after: function (a, prev) {
        var d = a.draft;
        if (a.source === 'quick') { ui.quickOpen = false; resetForm('quick'); }
        else { resetForm('transaction'); ui.forms.transaction.draft.date = d.date; }
        budgetToast(prev, d, 'Movimiento registrado.');
      }
    },
    UPDATE_TRANSACTION: {
      form: 'transaction',
      validate: function (a) { return validate.validateTransaction(a.draft, state, a.id); },
      reduce: function (s, a) {
        var i = findIndex(s.transactions, a.id);
        s.transactions[i] = validate.draftToTransaction(a.draft, s.transactions[i]);
      },
      after: function (a, prev) { resetForm('transaction'); budgetToast(prev, a.draft, 'Movimiento actualizado.'); }
    },
    DELETE_TRANSACTION: {
      form: null,
      validate: function (a) { return validate.validateTransactionDelete(a.id, state); }, // REQ-035
      confirm: function (a) {
        var t = calc.sortTransactions(state.transactions).filter(function (x) { return x.id === a.id; })[0];
        return {
          title: 'Eliminar movimiento', text: '¿Eliminar este movimiento? Los saldos se recalcularán.',
          items: [t.date + ' · ' + t.description + ' · ' + calc.formatMoney(t.amount)],
          confirmLabel: 'Eliminar', danger: true
        };
      },
      reduce: function (s, a) {
        var t = findById(s.transactions, a.id);
        var sch = t && t.scheduleId ? findById(s.schedules, t.scheduleId) : null;
        if (sch && sch.skippedDates.indexOf(t.occurrenceDate) === -1) { sch.skippedDates.push(t.occurrenceDate); } // REQ-086
        s.transactions = s.transactions.filter(function (x) { return x.id !== a.id; });
      },
      after: function (a) {
        if (ui.forms.transaction.editingId === a.id) { resetForm('transaction'); }
        toast('ok', 'Movimiento eliminado.');
      }
    },

    /* ---------------- Programaciones (REQ-079..REQ-090) ---------------- */
    ADD_SCHEDULE: {
      form: 'transaction',
      formOf: function (a) { return a.source === 'quick' ? 'quick' : 'transaction'; },
      validate: function (a) { return validate.validateSchedule(a.draft, state, null); },
      reduce: function (s, a) {
        var sch = validate.draftToSchedule(a.draft, { id: newId('prg'), createdAt: nowISO(), skippedDates: [] });
        s.schedules.push(sch);
        a.past = resolvePast(s, sch, a.draft.pastAction); // REQ-091
      },
      after: function (a) {
        if (a.source === 'quick') { ui.quickOpen = false; resetForm('quick'); } else { resetForm('transaction'); }
        toast('ok', 'Programado: ' + scheduleText(a.draft) + '.' + pastText(a));
        processSchedules(); // si la primera fecha es hoy y es auto-débito, se aplica ya (REQ-082)
      }
    },
    UPDATE_SCHEDULE: {
      form: 'transaction',
      validate: function (a) { return validate.validateSchedule(a.draft, state, a.id); },
      reduce: function (s, a) { // REQ-085: solo cambian las ocurrencias no aplicadas (los movimientos creados no se tocan)
        var i = findIndex(s.schedules, a.id);
        s.schedules[i] = validate.draftToSchedule(a.draft, s.schedules[i]);
        a.past = resolvePast(s, s.schedules[i], a.draft.pastAction); // REQ-091
      },
      after: function (a) { resetForm('transaction'); toast('ok', 'Programación actualizada.' + pastText(a)); processSchedules(); }
    },
    DELETE_SCHEDULE: {
      form: null,
      validate: function (a) { return calc.getSchedule(state, a.id) ? {} : { _form: 'La programación no existe.' }; },
      confirm: function (a) {
        var sch = calc.getSchedule(state, a.id);
        var n = state.transactions.filter(function (t) { return t.scheduleId === a.id; }).length;
        return { title: 'Eliminar programación', danger: true, confirmLabel: 'Eliminar',
          text: '¿Eliminar «' + sch.description + '»? Dejará de proyectarse.' + (n ? ' Los ' + n + ' movimientos ya registrados se conservan.' : '') };
      },
      reduce: function (s, a) { // REQ-085: conserva los movimientos creados, desenlazados
        s.schedules = s.schedules.filter(function (x) { return x.id !== a.id; });
        s.transactions.forEach(function (t) { if (t.scheduleId === a.id) { delete t.scheduleId; delete t.occurrenceDate; } });
      },
      after: function (a) {
        if (ui.forms.transaction.editingScheduleId === a.id) { resetForm('transaction'); }
        toast('ok', 'Programación eliminada.');
      }
    },
    CONFIRM_OCCURRENCE: { // REQ-083
      form: null,
      validate: function (a) {
        var sch = calc.getSchedule(state, a.scheduleId);
        if (!sch || calc.isOccurrenceDone(state, sch, a.date)) { return { _form: 'Esa ocurrencia ya fue aplicada u omitida.' }; }
        var e = validate.validateTransaction(occurrenceDraft(sch, a.date), state, null);
        if (validate.hasErrors(e)) { return { _form: 'No se pudo confirmar «' + sch.description + '»: ' + firstError(e) }; }
        return {};
      },
      reduce: function (s, a) {
        var sch = findById(s.schedules, a.scheduleId);
        var tx = validate.draftToTransaction(occurrenceDraft(sch, a.date), { id: newId('mov'), createdAt: nowISO() });
        s.transactions.push(linkTx(tx, { scheduleId: sch.id, date: a.date }));
      },
      after: function (a, prev) {
        var sch = calc.getSchedule(state, a.scheduleId);
        budgetToast(prev, occurrenceDraft(sch, a.date), 'Registrado: ' + sch.description + '.');
      }
    },
    SKIP_OCCURRENCE: { // REQ-084
      form: null,
      validate: function (a) { return validate.validateSkip(a.scheduleId, a.date, state); },
      confirm: function (a) {
        var sch = calc.getSchedule(state, a.scheduleId);
        return { title: 'Omitir esta vez', confirmLabel: 'Omitir',
          text: '¿Omitir «' + sch.description + '» del ' + a.date + '? No se registrará ese movimiento; las demás fechas siguen igual.' };
      },
      reduce: function (s, a) { findById(s.schedules, a.scheduleId).skippedDates.push(a.date); },
      after: function () { toast('ok', 'Ocurrencia omitida.'); }
    },
    PROCESS_SCHEDULES: { // REQ-082: auto-débito de ocurrencias con fecha ≤ hoy
      form: null,
      validate: function () { return {}; },
      reduce: function (s, a) {
        var today = calc.todayISO();
        a.applied = []; a.failed = [];
        calc.dueOccurrences(s, today).filter(function (o) { return o.mode === 'auto'; }).forEach(function (o) {
          var sch = findById(s.schedules, o.scheduleId);
          var draft = occurrenceDraft(sch, o.date);
          var e = validate.validateTransaction(draft, s, null, today);
          if (validate.hasErrors(e)) { failedOnce[o.id] = true; a.failed.push(sch.description + ': ' + firstError(e)); return; }
          var tx = validate.draftToTransaction(draft, { id: newId('mov'), createdAt: nowISO() });
          s.transactions.push(linkTx(tx, { scheduleId: sch.id, date: o.date }));
          a.applied.push(sch.description);
        });
      },
      after: function (a) {
        if (a.failed.length) { toast('error', 'No se pudo aplicar el auto-débito de ' + a.failed.join(' · ') + ' Quedó en «Pendientes de confirmar».'); }
        else if (a.applied.length) { toast('ok', 'Se aplicaron ' + a.applied.length + (a.applied.length === 1 ? ' pago automático' : ' pagos automáticos') + ': ' + a.applied.join(', ') + '.'); }
      }
    }
  };

  var FREQ_TEXT = { once: 'una vez', monthly: 'cada mes', biweekly: 'cada quincena (15 y fin de mes)' };
  function scheduleText(d) {
    return d.description + ' · ' + calc.formatMoney(Number(d.amount)) + ' ' + FREQ_TEXT[d.frequency] + ' desde ' + d.date;
  }

  /** Borrador de movimiento a partir de una ocurrencia de programación. */
  function occurrenceDraft(sch, date) {
    return { type: sch.type, date: date, amount: String(sch.amount), description: sch.description,
      accountId: sch.accountId, categoryId: sch.categoryId || '', toAccountId: sch.toAccountId || '' };
  }

  /**
   * REQ-091: registra (con su fecha, enlazados) u omite las ocurrencias anteriores a hoy.
   * Devuelve { action, count }.
   */
  function resolvePast(s, sch, action) {
    var dates = validate.pastOccurrences(s, sch, calc.todayISO());
    dates.forEach(function (date) {
      if (action === 'register') {
        var tx = validate.draftToTransaction(occurrenceDraft(sch, date), { id: newId('mov'), createdAt: nowISO() });
        s.transactions.push(linkTx(tx, { scheduleId: sch.id, date: date }));
      } else if (sch.skippedDates.indexOf(date) === -1) {
        sch.skippedDates.push(date);
      }
    });
    return { action: action, count: dates.length };
  }

  function pastText(a) {
    if (!a.past || !a.past.count) { return ''; }
    var n = a.past.count;
    return a.past.action === 'register'
      ? ' Se registr' + (n === 1 ? 'ó 1 pago anterior' : 'aron ' + n + ' pagos anteriores') + ' con su fecha.'
      : ' ' + n + (n === 1 ? ' pago anterior quedó marcado' : ' pagos anteriores quedaron marcados') + ' como ya registrado' + (n === 1 ? '' : 's') + '.';
  }

  function linkTx(tx, link) {
    var out = {};
    Object.keys(tx).forEach(function (k) { if (k !== 'createdAt') { out[k] = tx[k]; } });
    out.scheduleId = link.scheduleId; out.occurrenceDate = link.date; out.createdAt = tx.createdAt;
    return out;
  }

  function findById(list, id) { var i = findIndex(list || [], id); return i === -1 ? null : list[i]; }

  function firstError(e) { var k = Object.keys(e)[0]; return k ? e[k] : ''; }

  /** REQ-082: aplica los auto-débitos vencidos (si hay). Se llama al abrir, al volver a la app y al programar. */
  var processing = false;
  var failedOnce = {}; // ocurrencias cuyo auto-débito ya falló en esta sesión: no se reintenta en cada foco
  function processSchedules() {
    if (processing) { return; }
    var due = calc.dueOccurrences(state, calc.todayISO()).filter(function (o) { return o.mode === 'auto' && !failedOnce[o.id]; });
    if (!due.length) { return; }
    processing = true;
    try { dispatch({ type: 'PROCESS_SCHEDULES' }); } finally { processing = false; }
  }

  /** REQ-044 / REQ-070: aviso si el gasto llevó a su categoría o al presupuesto total al estado Rojo. */
  function budgetToast(prev, d, okText) {
    var msgs = [], good = [];
    var ym = calc.monthOf(d.date);
    if (d.type === 'gasto') {
      var before = calc.budgetStatus(prev, d.categoryId, ym);
      var after = calc.budgetStatus(state, d.categoryId, ym);
      if (after.status === 'exceeded' && before.status !== 'exceeded') {
        msgs.push('Superó el presupuesto de ' + calc.getCategory(state, d.categoryId).name + ' (' + calc.formatPercent(after.percent) + ').');
      }
    }
    if (d.type === 'gasto' || d.type === 'transferencia') { // REQ-070 (v6): el apartado a ahorros también consume el total
      var tb = calc.totalBudgetStatus(prev, ym), ta = calc.totalBudgetStatus(state, ym);
      if (ta.status === 'exceeded' && tb.status !== 'exceeded') {
        msgs.push('Superó el presupuesto total del mes (' + calc.formatPercent(ta.percent) + ').');
      }
    }
    if (d.type === 'transferencia') { // REQ-095
      var g0 = calc.goalProgress(prev, d.toAccountId), g1 = calc.goalProgress(state, d.toAccountId);
      if (g1 && g1.reached && !(g0 && g0.reached)) { good.push('🎉 ¡Alcanzó su meta «' + (g1.reason || 'Meta de ahorro') + '»!'); }
    }
    toast(msgs.length ? 'warning' : 'ok', [okText].concat(good, msgs).join(' '));
  }

  /* ------------------------------------------------------------------ */
  /* Acciones de interfaz                                                */
  /* ------------------------------------------------------------------ */

  var UI_ACTIONS = {
    SET_TAB: function (a) { ui.activeTab = a.tab; ui.selectedAccountId = null; },
    PREV_MONTH: function () { ui.month = calc.addMonths(ui.month, -1); },
    NEXT_MONTH: function () { ui.month = calc.addMonths(ui.month, 1); },
    SET_FILTER: function (a) { ui.filters[a.field] = a.value; }, // REQ-036: no toca el estado
    INPUT: function (a) {
      var f = ui.forms[a.form];
      f.draft[a.field] = a.value;
      f.touched[a.field] = true;
      if ((a.form === 'transaction' || a.form === 'quick') && a.field === 'type') { // REQ-028/029: limpia campos que no aplican
        var cat = calc.getCategory(state, f.draft.categoryId);
        if (!cat || cat.kind !== a.value) { f.draft.categoryId = ''; }
        if (a.value !== 'transferencia') { f.draft.toAccountId = ''; }
        delete f.touched.categoryId; delete f.touched.toAccountId;
      }
      ui.errors[a.form] = validateForm(a.form);
    },
    REASSIGN_INPUT: function (a) { ui.dialog.draft.targetId = a.value; ui.errors.reassign = {}; },
    EDIT_TRANSACTION: function (a) {
      var t = state.transactions[findIndex(state.transactions, a.id)];
      ui.forms.transaction = { draft: draftFromTransaction(t), touched: {}, editingId: t.id };
      ui.errors.transaction = validateForm('transaction');
      ui.activeTab = 'movimientos';
      ui.selectedAccountId = null;
      ui.scrollToForm = true;
    },
    EDIT_SCHEDULE: function (a) { // REQ-085
      var sch = calc.getSchedule(state, a.id);
      ui.forms.transaction = { draft: draftFromSchedule(sch), touched: {}, editingId: null, editingScheduleId: sch.id, link: null };
      ui.errors.transaction = validateForm('transaction');
      ui.activeTab = 'movimientos'; ui.selectedAccountId = null; ui.scrollToForm = true;
    },
    ADJUST_OCCURRENCE: function (a) { // REQ-083 "Ajustar": formulario precargado y enlazado a la ocurrencia
      var sch = calc.getSchedule(state, a.scheduleId);
      var d = occurrenceDraft(sch, a.date);
      d.scheduled = false; d.frequency = 'monthly'; d.ends = 'never'; d.endDate = ''; d.mode = 'auto';
      ui.forms.transaction = { draft: d, touched: {}, editingId: null, editingScheduleId: null, link: { scheduleId: sch.id, date: a.date } };
      ui.errors.transaction = validateForm('transaction');
      ui.activeTab = 'movimientos'; ui.selectedAccountId = null; ui.scrollToForm = true;
    },
    EDIT_ACCOUNT: function (a) {
      ui.forms.account = { draft: draftFromAccount(calc.getAccount(state, a.id)), touched: {}, editingId: a.id };
      ui.errors.account = validateForm('account');
      ui.activeTab = 'cuentas';
      ui.selectedAccountId = null; // el formulario vive en la lista de cuentas: salir del detalle para mostrarlo
      ui.scrollToForm = true;
    },
    EDIT_CATEGORY: function (a) {
      ui.forms.category = { draft: draftFromCategory(calc.getCategory(state, a.id)), touched: {}, editingId: a.id };
      ui.errors.category = validateForm('category');
      ui.scrollToForm = true;
    },
    CANCEL_EDIT: function (a) { resetForm(a.form); },
    OPEN_QUICK: function () { resetForm('quick'); ui.quickOpen = true; },   // REQ-067
    CLOSE_QUICK: function () { ui.quickOpen = false; resetForm('quick'); }, // REQ-068: no toca el estado
    OPEN_ACCOUNT: function (a) { ui.selectedAccountId = a.id; ui.activeTab = 'cuentas'; }, // REQ-066
    CLOSE_ACCOUNT: function () { ui.selectedAccountId = null; },
    CANCEL: function () { ui.dialog = null; ui.errors.reassign = {}; }, // REQ-033: el formulario conserva los datos
    DISMISS_NOTICE: function () { ui.notice = null; },
    DISMISS_TOAST: function () { ui.toast = null; }
  };

  /* ------------------------------------------------------------------ */
  /* dispatch                                                            */
  /* ------------------------------------------------------------------ */

  function dispatch(action) {
    if (UI_ACTIONS[action.type]) {
      UI_ACTIONS[action.type](action);
      if (action.type === 'INPUT' && !action.rerender) { view.updateForm(action.form, ui); return; }
      return render();
    }
    if (action.type === 'SUBMIT') { return submit(action.form); }
    if (action.type === 'CONFIRM') { return confirmDialog(); }

    var def = DOMAIN[action.type];
    if (!def) { return; }

    // 1. Validar (REQ-055: con errores el estado no cambia)
    var errors = def.validate(action);
    var formName = def.formOf ? def.formOf(action) : def.form;
    if (validate.hasErrors(errors)) {
      if (formName) { ui.errors[formName] = errors; if (ui.forms[formName]) { touchAll(formName); } }
      if (errors._form && (!formName || formName === 'reassign' && !ui.dialog)) { toast('error', errors._form); }
      return render();
    }

    // 2. Confirmar (REQ-011, REQ-017, REQ-018, REQ-033, REQ-035)
    if (def.confirm && !action.confirmed) {
      var dlg = def.confirm(action);
      if (dlg) { dlg.pending = action; ui.dialog = dlg; return render(); }
    }

    // 3. Reducer sobre una copia + red de seguridad del contrato (D13)
    var prev = state;
    var next = clone(state);
    def.reduce(next, action);
    var check = storage.validateState(next);
    if (!check.valid) {
      if (global.console) { global.console.error('Cambio rechazado: rompería el contrato', check.errors); }
      toast('error', 'La operación no se aplicó porque dejaría datos inválidos.');
      ui.dialog = null;
      return render();
    }
    state = next;
    ui.dialog = null;

    // 4. Persistir (REQ-051, REQ-054)
    persist();

    // 5. Efectos de interfaz y render
    def.after(action, prev);
    render();
  }

  function persist() {
    var res = storage.saveState(state);
    if (res === true) {
      if (saveFailed) { saveFailed = false; ui.notice = null; }
    } else {
      saveFailed = true;
      ui.notice = { type: 'error', text: 'No se pudieron guardar los cambios en este navegador. Siguen disponibles mientras no cierre la página; se reintentará en el próximo cambio.' };
    }
  }

  function submit(name) {
    var f = ui.forms[name];
    touchAll(name);
    if (name === 'settings') { return dispatch({ type: 'SAVE_SETTINGS', draft: clone(f.draft) }); }
    if ((name === 'quick' || name === 'transaction') && f.draft.scheduled) { // REQ-079
      return dispatch({ type: f.editingScheduleId ? 'UPDATE_SCHEDULE' : 'ADD_SCHEDULE', id: f.editingScheduleId, source: name, draft: clone(f.draft) });
    }
    if (name === 'quick') { return dispatch({ type: 'ADD_TRANSACTION', source: 'quick', draft: clone(f.draft) }); }
    if (name === 'transaction' && f.link) { return dispatch({ type: 'ADD_TRANSACTION', draft: clone(f.draft), link: clone(f.link) }); }
    var type = { transaction: 'TRANSACTION', account: 'ACCOUNT', category: 'CATEGORY' }[name];
    dispatch({ type: (f.editingId ? 'UPDATE_' : 'ADD_') + type, id: f.editingId, draft: clone(f.draft) });
  }

  function confirmDialog() {
    var d = ui.dialog;
    if (!d) { return; }
    var action = clone(d.pending);
    action.confirmed = true;
    if (d.kind === 'reassign') { action.draft = clone(d.draft); }
    dispatch(action);
  }

  /* ------------------------------------------------------------------ */
  /* Render y eventos                                                    */
  /* ------------------------------------------------------------------ */

  function render() {
    FORMS.forEach(function (n) { ui.errors[n] = validateForm(n); }); // REQ-055: Guardar refleja siempre el estado actual
    view.render(state, ui);
    ui.scrollToForm = false;
  }

  function actionFromElement(node) {
    var ds = node.dataset;
    var a = { type: ds.action };
    if (ds.id) { a.id = ds.id; }
    if (ds.tab) { a.tab = ds.tab; }
    if (ds.form) { a.form = ds.form; }
    if (ds.schedule) { a.scheduleId = ds.schedule; }
    if (ds.date) { a.date = ds.date; }
    return a;
  }

  function bindEvents(root) {
    root.addEventListener('click', function (ev) {
      var node = ev.target.closest('[data-action]');
      if (!node || node.disabled || !root.contains(node)) { return; }
      ev.preventDefault();
      dispatch(actionFromElement(node));
    });

    root.addEventListener('submit', function (ev) {
      var form = ev.target.closest('form[data-submit]');
      if (!form) { return; }
      ev.preventDefault();
      dispatch({ type: 'SUBMIT', form: form.dataset.submit });
    });

    function onField(ev) {
      var t = ev.target;
      if (t.dataset.reassign !== undefined) { return dispatch({ type: 'REASSIGN_INPUT', value: t.value }); }
      if (t.dataset.filter) { return dispatch({ type: 'SET_FILTER', field: t.dataset.filter, value: t.value }); }
      if (!t.dataset.form || !t.dataset.field) { return; }
      // Selects con data-rerender cambian la estructura del formulario: re-render completo (D16)
      if (ev.type === 'input' && (t.tagName === 'SELECT' || t.type === 'radio' || t.type === 'checkbox')) { return; }
      dispatch({ type: 'INPUT', form: t.dataset.form, field: t.dataset.field, value: t.type === 'checkbox' ? t.checked : t.value,
        rerender: t.dataset.rerender !== undefined });
    }
    root.addEventListener('input', onField);
    root.addEventListener('change', function (ev) {
      if (ev.target.tagName === 'SELECT' || ev.target.type === 'radio' || ev.target.type === 'checkbox') { onField(ev); }
    });

    doc.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') { return; }
      if (ui.dialog) { dispatch({ type: 'CANCEL' }); }
      else if (ui.quickOpen) { dispatch({ type: 'CLOSE_QUICK' }); } // REQ-068
    });
  }

  function init() {
    var loaded = storage.loadState(); // REQ-052, REQ-053
    state = loaded.state;
    ui = initialUi();
    FORMS.forEach(function (n) { ui.forms[n] = emptyForm(n); });
    ui.notice = loaded.notice;
    if (loaded.migrated) { persist(); } // REQ-072, REQ-090: se guarda migrado
    var root = doc.getElementById('app');
    view.mount(root);
    bindEvents(root);
    render();
    processSchedules(); // REQ-082: al abrir
    var lastDay = calc.todayISO();
    function onReturn() { // REQ-082: al volver a la app (p. ej. al día siguiente)
      if (doc.visibilityState === 'hidden') { return; }
      if (calc.todayISO() !== lastDay) { lastDay = calc.todayISO(); render(); }
      processSchedules();
    }
    doc.addEventListener('visibilitychange', onReturn);
    global.addEventListener('focus', onReturn);
  }

  A.app = {
    dispatch: dispatch,
    get state() { return clone(state); },
    get ui() { return ui; }
  };

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
})(window);
