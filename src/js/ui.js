/*
 * ui.js — FinanzApp.ui
 * Componentes de render (docs/design.md §4). Reciben (state, ui) y construyen nodos DOM.
 * No mutan el estado: emiten acciones con data-action / data-submit / data-form+data-field
 * que app.js captura por delegación de eventos.
 * Seguridad (D5, REQ-056): el DOM se construye con textContent; nunca innerHTML con datos del usuario.
 */
(function (global) {
  'use strict';

  var A = global.FinanzApp = global.FinanzApp || {};
  var calc = A.calc, validate = A.validate;
  var doc = global.document;

  var TABS = [
    { id: 'resumen', label: 'Resumen', icon: '📊' },
    { id: 'movimientos', label: 'Gastos e ingresos', icon: '🧾' },
    { id: 'presupuestos', label: 'Presupuestos', icon: '🎯' },
    { id: 'cuentas', label: 'Cuentas', icon: '🏦' },
    { id: 'categorias', label: 'Categorías', icon: '🏷️' }
  ];
  var ACCOUNT_TYPES = { efectivo: 'Efectivo', debito: 'Débito', ahorros: 'Ahorros', credito: 'Crédito' };
  var ACCOUNT_ICONS = { efectivo: '💵', debito: '🏦', ahorros: '🪙', credito: '💳' };
  var TX_TYPES = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' };
  var TX_ICONS = { gasto: '↓', ingreso: '↑', transferencia: '⇄' };
  var STATUS_TEXT = { ok: 'En orden', warning: 'Precaución', exceeded: 'Excedido' }; // REQ-057
  var WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  var root = null;
  var S, U; // state y ui del render en curso
  var TODAY = null; // fecha local de hoy, fijada al inicio de cada render (REQ-073)
  var lastToastAt = null, lastTab = null;

  /* ====================================================================== */
  /* Helper el(): crea elementos de forma segura (textContent, sin innerHTML) */
  /* ====================================================================== */

  function el(tag, props) {
    var node = doc.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) { return; }
      if (k === 'class') { node.className = v; }
      else if (k === 'text') { node.textContent = v; }
      else if (k === 'value') { node.value = v; }
      else if (k === 'checked') { node.checked = true; }
      else if (k === 'disabled') { node.disabled = true; }
      else if (k === 'selected') { node.selected = true; }
      else if (k === 'style') { Object.keys(v).forEach(function (p) { node.style.setProperty(p, v[p]); }); }
      else { node.setAttribute(k, v === true ? '' : String(v)); }
    });
    for (var i = 2; i < arguments.length; i++) { append(node, arguments[i]); }
    return node;
  }

  function append(node, child) {
    if (child === null || child === undefined || child === false) { return; }
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child);
  }

  function money(n, opts) { return calc.formatMoney(n, opts); }

  function dateLabel(iso) {
    var t = calc.parseISODate(iso);
    var d = new Date(t);
    return WEEKDAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS_SHORT[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function bar(percent, status) {
    var w = Math.max(0, Math.min(100, percent));
    return el('div', { class: 'bar' + (status ? ' is-' + status : ''), role: 'presentation' },
      el('div', { class: 'bar-fill', style: { width: w + '%' } }));
  }

  /** REQ-092: barra de dos tramos (gastos + apartado a ahorros). */
  function splitBar(t) {
    var e = Math.max(0, Math.min(100, t.expensePercent));
    var s = Math.max(0, Math.min(100 - e, t.savingsPercent));
    return el('div', { class: 'bar is-split' + (t.status ? ' is-' + t.status : ''), role: 'presentation' },
      el('div', { class: 'bar-fill', style: { width: e + '%' } }),
      el('div', { class: 'bar-fill bar-savings', style: { width: s + '%' } }));
  }

  /** REQ-094 / REQ-095: progreso de la meta de una cuenta de ahorros. */
  function GoalProgress(a, opts) {
    opts = opts || {};
    var g = calc.goalProgress(S, a.id, TODAY);
    if (!g) { return null; }
    var lines = [money(g.saved) + ' de ' + money(g.goal) + ' · ' + calc.formatPercent(Math.min(g.percent, 100))];
    if (g.reached) { lines.push('✓ ¡Meta alcanzada!'); }
    else {
      lines.push('Le faltan ' + money(g.missing));
      if (g.months) { // REQ-094 (v6.1): detalle de cada aporte para que el total se pueda verificar
        g.sources.forEach(function (x) {
          lines.push('• ' + x.description + ': ' + money(x.amount) + (x.frequency === 'biweekly'
            ? ' cada quincena (15 y último) = ' + money(x.monthly) + ' al mes' : ' cada mes'));
        });
        lines.push((g.sources.length > 1 ? 'Total ' + money(g.monthly) + ' al mes: la' : 'La') + ' alcanza en ' + g.months + (g.months === 1 ? ' mes' : ' meses') +
          ' (' + calc.monthLabel(g.etaMonth).toLowerCase() + ').');
        if (g.duplicates) {
          lines.push('⚠ Hay transferencias programadas repetidas hacia esta cuenta. Revise «Pagos e ingresos programados» en Gastos e ingresos.');
        }
      } else if (opts.hint) { lines.push('Programe una transferencia mensual a esta cuenta para ver cuándo la alcanza.'); }
    }
    return el('div', { class: 'goal' + (g.reached ? ' is-reached' : '') + (opts.plain ? ' is-plain' : '') },
      el('strong', { class: 'goal-title', text: '🎯 ' + (g.reason || 'Meta de ahorro') }),
      bar(g.percent, g.reached ? 'ok' : null),
      lines.map(function (t) { return el('p', { class: 'goal-line', text: t }); }));
  }

  /** REQ-094: sección Metas de ahorro en Presupuestos. */
  function SavingsGoals() {
    var accs = calc.activeAccounts(S).filter(function (a) { return a.type === 'ahorros'; });
    var withGoal = accs.filter(function (a) { return a.goalAmount; });
    var body;
    if (!accs.length) { body = el('p', { class: 'empty-inline', text: 'Cree una cuenta de ahorros para definir una meta.' }); }
    else if (!withGoal.length) {
      body = el('p', { class: 'empty-inline', text: 'Ninguna cuenta de ahorros tiene meta. En Cuentas, toque ✎ en una cuenta de ahorros y escriba la meta y su razón.' });
    } else {
      body = el('ul', { class: 'list' }, withGoal.map(function (a) {
        return el('li', { class: 'goal-row' }, el('span', { class: 'muted', text: '🪙 ' + a.name }), GoalProgress(a, { plain: true, hint: true }));
      }));
    }
    return card('Metas de ahorro', 'savings-goals', body);
  }

  function card(title, cls) {
    var children = Array.prototype.slice.call(arguments, 2);
    return el('section', { class: 'card ' + (cls || '') },
      title ? el('h2', { class: 'card-title', text: title }) : null, children);
  }

  /* ====================================================================== */
  /* Formularios: campos con error en vivo (REQ-055)                          */
  /* ====================================================================== */

  function fieldError(form, field) {
    var f = U.forms[form];
    var errors = U.errors[form] || {};
    return f.touched[field] && errors[field] ? errors[field] : '';
  }

  function field(form, name, label, control, opts) {
    opts = opts || {};
    var err = fieldError(form, name);
    return el('div', { class: 'field' + (err ? ' has-error' : '') + (opts.wide ? ' field-wide' : ''), 'data-field-wrap': form + '.' + name },
      el('label', { for: 'f-' + form + '-' + name, text: label + (opts.required ? ' *' : '') }),
      control,
      opts.hint ? el('p', { class: 'field-hint', text: opts.hint }) : null,
      el('p', { class: 'field-error', 'data-error-for': form + '.' + name, role: 'alert', text: err }));
  }

  function input(form, name, opts) {
    opts = opts || {};
    return el('input', {
      id: 'f-' + form + '-' + name, 'data-form': form, 'data-field': name,
      type: opts.type || 'text', value: U.forms[form].draft[name], inputmode: opts.inputmode,
      placeholder: opts.placeholder, maxlength: opts.maxlength, max: opts.max, min: opts.min, autocomplete: 'off', 'data-rerender': opts.rerender ? true : null,
      'aria-invalid': fieldError(form, name) ? 'true' : null
    });
  }

  function select(form, name, options, opts) {
    opts = opts || {};
    var value = U.forms[form].draft[name];
    return el('select', {
      id: 'f-' + form + '-' + name, 'data-form': form, 'data-field': name,
      'data-rerender': opts.rerender ? true : null, disabled: opts.disabled
    }, options.map(function (o) {
      return el('option', { value: o.value, selected: o.value === value, text: o.label });
    }));
  }

  function segmented(form, name, options, opts) {
    opts = opts || {};
    var value = U.forms[form].draft[name];
    return el('div', { class: 'segmented', role: 'radiogroup', id: 'f-' + form + '-' + name },
      options.map(function (o) {
        return el('label', { class: 'seg' + (o.value === value ? ' is-active' : '') + (opts.disabled ? ' is-disabled' : '') },
          el('input', {
            type: 'radio', name: form + '-' + name, value: o.value, checked: o.value === value,
            'data-form': form, 'data-field': name, 'data-rerender': true, disabled: opts.disabled
          }),
          el('span', { text: o.label }));
      }));
  }

  function formFooter(form, label, opts) {
    opts = opts || {};
    var errors = U.errors[form] || {};
    var f = U.forms[form];
    var anyTouched = Object.keys(f.touched).length > 0;
    var blocked = validate.hasErrors(errors);
    return el('div', { class: 'form-footer' },
      el('p', { class: 'form-error', 'data-form-error': form, role: 'alert', text: anyTouched && errors._form ? errors._form : '' }),
      el('p', { class: 'form-hint', 'data-form-hint': form, text: blocked && !visibleErrors(form) ? 'Complete los campos obligatorios (*).' : '' }),
      el('div', { class: 'form-actions' },
        opts.cancelAction ? el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': opts.cancelAction, 'data-form': opts.cancelForm || null, text: 'Cancelar' }) : null,
        f.editingId ? el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'CANCEL_EDIT', 'data-form': form, text: 'Cancelar edición' }) : null,
        el('button', { type: 'submit', class: 'btn btn-primary', 'data-submit-btn': form, disabled: blocked, text: label })));
  }

  function visibleErrors(form) {
    var errors = U.errors[form] || {};
    var f = U.forms[form];
    return Object.keys(errors).some(function (k) { return k === '_form' ? Object.keys(f.touched).length > 0 : f.touched[k]; });
  }

  /** Actualiza errores y botón sin re-render (no se pierde el foco ni el cursor, D16). */
  function updateForm(form, ui) {
    U = ui; TODAY = calc.todayISO();
    var errors = ui.errors[form] || {};
    var nodes = root.querySelectorAll('[data-error-for^="' + form + '."]');
    Array.prototype.forEach.call(nodes, function (p) {
      var name = p.getAttribute('data-error-for').split('.')[1];
      var msg = fieldError(form, name);
      p.textContent = msg;
      var wrap = p.parentNode;
      wrap.classList.toggle('has-error', !!msg);
      var ctl = wrap.querySelector('[data-field]');
      if (ctl) { if (msg) { ctl.setAttribute('aria-invalid', 'true'); } else { ctl.removeAttribute('aria-invalid'); } }
    });
    var fe = root.querySelector('[data-form-error="' + form + '"]');
    if (fe) { fe.textContent = Object.keys(ui.forms[form].touched).length && errors._form ? errors._form : ''; }
    var blocked = validate.hasErrors(errors);
    var hint = root.querySelector('[data-form-hint="' + form + '"]');
    if (hint) { hint.textContent = blocked && !visibleErrors(form) ? 'Complete los campos obligatorios (*).' : ''; }
    var btn = root.querySelector('[data-submit-btn="' + form + '"]');
    if (btn) { btn.disabled = blocked; }
    var avail = root.querySelector('[data-available="' + form + '"]');
    if (avail) { avail.textContent = availableHint(S, form); }
    var prev = root.querySelector('[data-preview="' + form + '"]');
    if (prev) { prev.textContent = schedulePreview(ui.forms[form].draft); }
  }

  /* ====================================================================== */
  /* Componentes generales                                                    */
  /* ====================================================================== */

  function AppHeader() {
    return el('header', { class: 'app-header' },
      el('div', { class: 'brand' },
        el('span', { class: 'brand-logo', 'aria-hidden': 'true', text: '💰' }),
        el('div', null,
          el('h1', { text: 'FinanzApp' }),
          el('p', { class: 'brand-sub', text: 'Finanzas personales · 100 % en su navegador' }))),
      S.accounts.length ? el('div', { class: 'networth' + (calc.netWorth(S, TODAY) < 0 ? ' is-negative' : '') },
        el('span', { class: 'networth-label', text: 'Patrimonio' }),
        el('strong', { text: money(calc.netWorth(S, TODAY)) }),
        calc.netWorth(S, TODAY) < 0 ? el('span', { class: 'networth-label', text: 'Negativo: las deudas superan sus saldos' }) : null) : null);
  }

  function NavTabs() {
    return el('nav', { class: 'tabs', 'aria-label': 'Secciones' }, TABS.map(function (t) {
      var active = U.activeTab === t.id;
      return el('button', {
        type: 'button', class: 'tab' + (active ? ' is-active' : ''), 'data-action': 'SET_TAB', 'data-tab': t.id,
        'aria-current': active ? 'page' : null
      }, el('span', { 'aria-hidden': 'true', text: t.icon + ' ' }), t.label);
    }));
  }

  function StorageNotice() { // REQ-053, REQ-054
    if (!U.notice) { return null; }
    return el('div', { class: 'notice is-' + U.notice.type, role: 'alert' },
      el('span', { text: '⚠ ' + U.notice.text }),
      el('button', { type: 'button', class: 'btn-icon', 'data-action': 'DISMISS_NOTICE', 'aria-label': 'Cerrar aviso', text: '✕' }));
  }

  function Toast() {
    if (!U.toast) { return null; }
    return el('div', { class: 'toast is-' + U.toast.type, role: 'status' },
      el('span', { text: U.toast.text }),
      el('button', { type: 'button', class: 'btn-icon', 'data-action': 'DISMISS_TOAST', 'aria-label': 'Cerrar', text: '✕' }));
  }

  function MonthSelector() { // REQ-038
    return el('div', { class: 'month-bar' },
      el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'PREV_MONTH', 'aria-label': 'Mes anterior', text: '◀' }),
      el('h2', { class: 'month-label', text: calc.monthLabel(U.month) }),
      el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'NEXT_MONTH', 'aria-label': 'Mes siguiente', text: '▶' }));
  }

  function NoAccounts(text) { // REQ-021
    return el('div', { class: 'empty' },
      el('p', { class: 'empty-icon', 'aria-hidden': 'true', text: '💰' }),
      el('p', { text: text }),
      el('button', { type: 'button', class: 'btn btn-primary', 'data-action': 'SET_TAB', 'data-tab': 'cuentas', text: 'Ir a Cuentas' }));
  }

  /* ====================================================================== */
  /* Helpers de cuentas                                                       */
  /* ====================================================================== */

  /** Opciones de cuenta: solo activas, más la cuenta original si se está editando (REQ-064). */
  function accountOptions(form, field, placeholder) {
    var f = U.forms[form];
    var keepId = f.editingId ? f.draft[field] : null;
    var list = S.accounts.filter(function (a) { return !a.archived || a.id === keepId; });
    return [{ value: '', label: placeholder }].concat(list.map(function (a) {
      return { value: a.id, label: ACCOUNT_ICONS[a.type] + ' ' + a.name + (a.archived ? ' (archivada)' : '') };
    }));
  }

  function availableHint(state, form) {
    var d = U.forms[form].draft;
    var acc = calc.getAccount(state, d.accountId);
    if (!acc) { return ''; }
    var excl = U.forms[form].editingId;
    if (d.type === 'ingreso') { return 'Saldo actual: ' + money(calc.accountBalance(state, acc.id, excl, TODAY)); }
    var date = calc.isValidISODate(d.date) && d.date <= TODAY ? d.date : TODAY; // RN-03 cronológica: disponible a esa fecha
    var avail = calc.availableFunds(state, acc.id, excl, date);
    var text = (calc.isLiquid(acc) ? 'Saldo disponible' : 'Crédito disponible') + (date !== TODAY ? ' al ' + date : '') + ': ' + money(avail);
    if (d.scheduled) { text = 'Hoy: ' + text + '. Los fondos se revisan en cada fecha programada.'; }
    return text;
  }

  var FREQ_LABEL = { once: 'Una vez', monthly: 'Cada mes', biweekly: 'Quincenal' };
  var MODE_LABEL = { auto: 'Auto-débito', manual: 'Manual' };
  /** D28: un ingreso programado se rotula "Automático" (no es un débito). */
  function modeLabel(x) { return x.type === 'ingreso' ? 'Automático' : MODE_LABEL[x.mode]; }

  function inDays(date) {
    var n = calc.daysBetween(TODAY, date);
    return n === 0 ? 'hoy' : n === 1 ? 'mañana' : 'en ' + n + ' días';
  }

  /** REQ-081: etiqueta de una ocurrencia programada o pendiente. */
  function scheduledBadge(t) {
    if (!t.virtual) { return t.scheduleId ? el('span', { class: 'badge is-from-schedule', text: '🔁 Programado' }) : null; }
    if (t.status === 'pending') { return el('span', { class: 'badge is-pending', text: '⏳ Pendiente de confirmar' }); }
    return el('span', { class: 'badge is-scheduled', text: '🗓 Programado · ' + modeLabel(t) + ' · ' + inDays(t.date) });
  }

  /** Acciones de una ocurrencia virtual: confirmar (si vence), ajustar, editar la programación y omitir. */
  function occurrenceActions(t) {
    var data = { 'data-schedule': t.scheduleId, 'data-date': t.date };
    function b(action, label, text, cls) {
      return el('button', Object.assign({ type: 'button', class: 'btn-icon' + (cls ? ' ' + cls : ''), 'data-action': action, 'aria-label': label + ' ' + t.description, title: label, text: text }, data));
    }
    return el('div', { class: 'row-actions' },
      t.status === 'pending' ? b('CONFIRM_OCCURRENCE', 'Confirmar', '✓', 'is-ok') : null,
      t.status === 'pending' ? b('ADJUST_OCCURRENCE', 'Ajustar', '✎') : el('button', { type: 'button', class: 'btn-icon', 'data-action': 'EDIT_SCHEDULE', 'data-id': t.scheduleId, 'aria-label': 'Editar programación ' + t.description, title: 'Editar programación', text: '✎' }),
      b('SKIP_OCCURRENCE', 'Omitir esta vez', '⏭'));
  }

  function cycleText(c) {
    return 'Corte ' + dateLabel(c.lastCutoff) + ' · Pago ' + dateLabel(c.dueDate);
  }

  /* ====================================================================== */
  /* Vista: Resumen                                                            */
  /* ====================================================================== */

  function PaymentAlerts() { // REQ-062
    var alerts = calc.paymentAlerts(S, TODAY);
    if (!alerts.length) { return null; }
    return el('div', { class: 'alerts' }, alerts.map(function (a) {
      var text = a.overdue
        ? 'Pago vencido de ' + a.account.name + ': ' + money(a.amountDue) + ' (venció el ' + dateLabel(a.dueDate) + ').'
        : 'El pago de ' + a.account.name + ' vence ' + (a.daysUntil === 0 ? 'hoy' : 'en ' + a.daysUntil + (a.daysUntil === 1 ? ' día' : ' días')) +
          ' (' + dateLabel(a.dueDate) + '): ' + money(a.amountDue) + '.';
      return el('div', { class: 'alert ' + (a.overdue ? 'is-exceeded' : 'is-warning'), role: 'status' },
        el('span', { 'aria-hidden': 'true', text: '💳 ' }), text,
        el('button', { type: 'button', class: 'btn-link', 'data-action': 'OPEN_ACCOUNT', 'data-id': a.account.id, text: 'Ver tarjeta' }));
    }));
  }

  function occurrenceRow(t) {
    var sign = t.type === 'ingreso' ? '+' : (t.type === 'gasto' ? '−' : '');
    return el('li', { class: 'tx-row is-' + t.type + ' is-scheduled' + (t.status === 'pending' ? ' is-pending' : '') },
      el('span', { class: 'tx-icon', 'aria-hidden': 'true', text: t.status === 'pending' ? '⏳' : '🗓' }),
      el('div', { class: 'grow' },
        el('strong', { class: 'tx-desc', text: t.description }),
        el('span', { class: 'muted', text: dateLabel(t.date) + ' (' + inDays(t.date) + ') · ' + modeLabel(t) + ' · ' + txMeta(t) })),
      el('span', { class: 'tx-amount', text: sign + money(t.amount) }),
      occurrenceActions(t));
  }

  function PendingOccurrences() { // REQ-083
    var list = calc.dueOccurrences(S, TODAY);
    if (!list.length) { return null; }
    return card('Pendientes de confirmar', 'pending-list',
      el('p', { class: 'muted', text: '✓ Confirmar registra el movimiento tal cual · ✎ Ajustar permite cambiar monto o fecha · ⏭ Omitir no registra nada.' }),
      el('ul', { class: 'list' }, list.map(occurrenceRow)));
  }

  /** REQ-096 (v6.2): ventana de 7 días que sigue al mes seleccionado y se corre semana a semana. */
  function UpcomingScheduled() {
    var base = calc.upcomingStart(U.month, TODAY);
    if (!base || !(S.schedules || []).length) { return null; }
    var from = U.upcomingFrom || base;
    var to = calc.addDays(from, 6);
    var list = calc.openOccurrences(S, from, to, TODAY);
    var first = calc.addDays(TODAY, 1);
    function short(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + MONTHS_SHORT[+p[1] - 1]; }
    var title = from === first ? 'Próximos programados (7 días)' : 'Programados del ' + short(from) + ' al ' + short(to);
    var prev = calc.addDays(from, -7) < first ? first : calc.addDays(from, -7);
    var next = calc.addDays(from, 7);
    return card(title, 'upcoming',
      el('div', { class: 'week-nav' },
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'data-action': 'SET_UPCOMING', 'data-date': prev, disabled: from <= first,
          'aria-label': '7 días antes', text: '◀ 7 días antes' }),
        el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'data-action': 'SET_UPCOMING', 'data-date': next,
          disabled: next > calc.addDays(TODAY, validate.MAX_SCHEDULE_DAYS), 'aria-label': '7 días después', text: '7 días después ▶' })),
      list.length ? el('ul', { class: 'list' }, list.map(occurrenceRow))
        : el('p', { class: 'empty-inline', text: 'No hay pagos ni ingresos programados en estos 7 días.' }));
  }

  function ProjectionAlerts() { // REQ-087
    var list = calc.projectionAlerts(S, TODAY);
    if (!list.length) { return null; }
    return el('div', { class: 'alerts' }, list.map(function (v) {
      var what = v.reason === 'overlimit' ? 'superaría su límite con una deuda de ' + money(-v.balance)
        : v.reason === 'overpaid' ? 'quedaría con saldo a favor (' + money(v.balance) + ')'
        : 'quedaría en ' + money(v.balance);
      return el('div', { class: 'alert is-warning', role: 'status' },
        el('span', { 'aria-hidden': 'true', text: '🔮 ' }),
        'Con los programados, ' + v.account.name + ' ' + what + (v.date ? ' el ' + dateLabel(v.date) : '') + '. Revise los pagos o transfiera fondos.');
    }));
  }

  function SummaryCards() { // REQ-039, REQ-040, REQ-046
    var m = calc.monthSummary(S, U.month, TODAY);
    var neg = m.net < 0;
    function stat(label, value, cls, sub) {
      return el('div', { class: 'stat ' + (cls || '') },
        el('span', { class: 'stat-label', text: label }),
        el('strong', { class: 'stat-value', text: value }),
        sub ? el('span', { class: 'stat-sub', text: sub }) : null);
    }
    return el('div', { class: 'stats' },
      stat('Ingresos del mes', money(m.income), 'is-income', m.scheduledIncome > 0 ? 'Incluye ' + money(m.scheduledIncome) + ' programados' : null), // REQ-081
      stat('Gastos del mes', money(m.expense), 'is-expense', m.scheduledExpense > 0 ? 'Incluye ' + money(m.scheduledExpense) + ' programados' : null),
      stat('Balance neto', money(m.net, { sign: true }), neg ? 'is-negative' : 'is-positive', neg ? 'Déficit: gastó más de lo que ingresó' : 'Superávit'),
      stat('Tasa de ahorro', m.savingsRate === null ? '—' : calc.formatPercent(m.savingsRate), m.savingsRate !== null && m.savingsRate < 0 ? 'is-negative' : '',
        m.savingsRate === null ? 'Sin ingresos este mes' : 'del ingreso del mes'));
  }

  function AccountBalance(a) { // REQ-006
    var bal = calc.currentBalance(S, a.id, TODAY);
    var after = calc.hasOpenThisMonth(S, a.id, TODAY) ? calc.projectedBalance(S, a.id, TODAY) : null; // REQ-088
    if (calc.isLiquid(a)) {
      return el('div', { class: 'acc-balance' }, el('strong', { text: money(bal) }), el('span', { class: 'muted', text: 'Saldo actual' }),
        after !== null ? el('span', { class: 'muted scheduled-note' + (after < 0 ? ' is-negative' : ''), text: 'Proyectado a fin de mes: ' + money(after) }) : null);
    }
    var debt = calc.creditDebt(S, a.id, null, TODAY);
    var pct = (debt / a.creditLimit) * 100;
    return el('div', { class: 'acc-balance' },
      el('strong', { class: debt > 0 ? 'text-debt' : '', text: debt > 0 ? '−' + money(debt) : money(0) }),
      el('span', { class: 'muted', text: 'Deuda · disponible ' + money(calc.availableFunds(S, a.id, null, TODAY)) + ' de ' + money(a.creditLimit) }),
      after !== null ? el('span', { class: 'muted scheduled-note', text: 'Deuda proyectada a fin de mes: ' + money(Math.max(0, -after)) }) : null,
      bar(pct, pct > 80 ? 'warning' : 'ok'));
  }

  function BalanceBreakdown() { // REQ-059
    var b = calc.balanceSummary(S, TODAY);
    function row(label, value, cls, sub) {
      return el('div', { class: 'bd-row ' + (cls || '') }, el('span', { text: label }), el('strong', { text: value }),
        sub ? el('span', { class: 'bd-sub', text: sub }) : null);
    }
    var diff = calc.toCents(b.availableAfterScheduled) !== calc.toCents(b.available);
    return el('div', { class: 'breakdown' },
      row('Disponible para gastar', money(b.available), '', diff ? 'Proyectado a fin de mes: ' + money(b.availableAfterScheduled) : null), // REQ-088
      row('Ahorros', money(b.savings), 'is-savings'),
      row('Deudas', b.debts > 0 ? '−' + money(b.debts) : money(0), b.debts > 0 ? 'is-debt' : ''),
      row('Patrimonio', money(b.netWorth), 'is-total'));
  }

  function AccountsOverview() {
    return card('Mis cuentas', 'accounts-overview',
      BalanceBreakdown(),
      el('ul', { class: 'list' }, calc.activeAccounts(S).map(function (a) {
        return el('li', { class: 'list-row is-clickable', 'data-action': 'OPEN_ACCOUNT', 'data-id': a.id, title: 'Ver detalle' },
          el('span', { class: 'acc-icon', 'aria-hidden': 'true', text: ACCOUNT_ICONS[a.type] }),
          el('div', { class: 'grow' }, el('strong', { text: a.name }), el('span', { class: 'muted', text: ACCOUNT_TYPES[a.type] })),
          AccountBalance(a));
      })));
  }

  function TotalBudgetCard(opts) { // REQ-070, REQ-071
    opts = opts || {};
    var t = calc.totalBudgetStatus(S, U.month);
    var sum = calc.categoryBudgetsSum(S);
    var body;
    if (t.budget === null) {
      body = [el('p', { class: 'muted', text: 'Sin presupuesto total. Gastado en el mes: ' + money(t.expense) +
        (t.savings > 0 ? ' · apartado a ahorros: ' + money(t.savings) : '') + '.' })];
    } else {
      var rest = t.remaining >= 0 ? 'Quedan ' + money(t.remaining) : 'Excedido por ' + money(-t.remaining);
      body = [
        el('div', { class: 'budget-head' },
          el('strong', { class: 'big-num', text: money(t.spent) + ' de ' + money(t.budget) }),
          el('span', { class: 'badge is-' + t.status, text: calc.formatPercent(t.percent) + ' · ' + STATUS_TEXT[t.status] })),
        splitBar(t),
        el('p', { class: 'budget-split' }, // REQ-092
          el('span', { class: 'key key-expense', text: 'Gastos ' + money(t.expense) }),
          el('span', { class: 'key key-savings', text: '🪙 Apartado a ahorros ' + money(t.savings) })),
        el('div', { class: 'budget-foot' }, el('span', { class: t.remaining < 0 ? 'text-debt' : 'muted', text: rest }), PerDay(t.remaining))];
      if (sum > t.budget) {
        body.push(el('p', { class: 'info-warning', role: 'note',
          text: 'ⓘ Los presupuestos por categoría suman ' + money(sum) + ', más que el total de ' + money(t.budget) + '.' }));
      }
    }
    return card('Presupuesto total de ' + calc.monthLabel(U.month).toLowerCase(), 'total-budget' + (t.status ? ' is-' + t.status : ''),
      body,
      opts.withForm ? SettingsForm() : el('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'data-action': 'SET_TAB', 'data-tab': 'presupuestos', text: 'Ver presupuestos →' }));
  }

  function SummaryView() {
    if (!calc.activeAccounts(S).length) { return [MonthSelector(), NoAccounts('Bienvenido a FinanzApp. Para empezar, cree su primera cuenta (efectivo, débito, ahorros o tarjeta de crédito).')]; }
    return [MonthSelector(), PaymentAlerts(), ProjectionAlerts(), PendingOccurrences(), SummaryCards(), UpcomingScheduled(), el('div', { class: 'grid-2' }, AccountsOverview(), TotalBudgetCard())];
  }

  /* ====================================================================== */
  /* Vista: Presupuestos (REQ-069..REQ-071)                                    */
  /* ====================================================================== */

  /** "Le quedan ₡X para N días (₡Y por día)" o "Mes cerrado" (REQ-069). */
  function PerDay(remaining) {
    var n = calc.remainingDays(U.month, TODAY);
    if (n === null) { return el('span', { class: 'muted', text: 'Mes cerrado' }); }
    if (remaining === null || remaining <= 0) { return null; }
    return el('span', { class: 'muted', text: 'Le quedan ' + money(remaining) + ' para ' + n + (n === 1 ? ' día' : ' días') +
      ' (' + money(remaining / n) + ' por día)' });
  }

  function SettingsForm() {
    return el('form', { 'data-submit': 'settings', novalidate: true, class: 'inline-form', id: 'form-settings' },
      field('settings', 'monthlyBudget', 'Presupuesto total mensual (₡)',
        input('settings', 'monthlyBudget', { inputmode: 'decimal', placeholder: 'Opcional — vacío para quitarlo' }),
        { hint: 'Aplica a todos los gastos de cada mes. No bloquea gastos: solo alerta.' }),
      formFooter('settings', 'Guardar total'));
  }

  function BudgetRow(c) { // REQ-041, REQ-043, REQ-045, REQ-057, REQ-069
    var b = calc.budgetStatus(S, c.id, U.month);
    if (b.budget === null) {
      return el('li', { class: 'budget-row is-none' },
        el('div', { class: 'budget-head' }, el('strong', { text: c.name }), el('span', { class: 'muted', text: 'Sin presupuesto' })),
        el('span', { class: 'muted', text: 'Gastado en el mes: ' + money(b.spent) }));
    }
    var rest = b.remaining >= 0 ? 'Quedan ' + money(b.remaining) : 'Excedido por ' + money(-b.remaining);
    return el('li', { class: 'budget-row is-' + b.status },
      el('div', { class: 'budget-head' },
        el('strong', { text: c.name }),
        el('span', { class: 'badge is-' + b.status, text: calc.formatPercent(b.percent) + ' · ' + STATUS_TEXT[b.status] })),
      bar(b.percent, b.status),
      el('div', { class: 'budget-foot' },
        el('span', { text: money(b.spent) + ' de ' + money(b.budget) }),
        el('span', { class: b.remaining < 0 ? 'text-debt' : 'muted', text: rest })),
      el('div', { class: 'budget-foot' }, PerDay(b.remaining)));
  }

  function BudgetList() {
    var cats = S.categories.filter(function (c) { return c.kind === 'gasto'; });
    return card('Por categoría', 'budgets',
      el('p', { class: 'legend' },
        el('span', { class: 'dot is-ok' }), 'Verde ≤ 80 % · ',
        el('span', { class: 'dot is-warning' }), 'Ámbar 80–100 % · ',
        el('span', { class: 'dot is-exceeded' }), 'Rojo > 100 % (solo alerta, no bloquea)'),
      el('ul', { class: 'list' }, cats.map(BudgetRow)),
      el('p', { class: 'muted', text: 'Los montos por categoría se configuran en la pestaña Categorías.' }));
  }

  function BudgetsView() {
    return [MonthSelector(), el('div', { class: 'grid-form' }, el('div', { class: 'acc-col' }, TotalBudgetCard({ withForm: true }), SavingsGoals()), BudgetList())];
  }

  /* ====================================================================== */
  /* Vista: Gastos e ingresos                                                  */
  /* ====================================================================== */

  function TransactionFields(form) {
    var d = U.forms[form].draft;
    var catOptions = [{ value: '', label: 'Elija una categoría…' }].concat(S.categories
      .filter(function (c) { return c.kind === d.type; })
      .map(function (c) { return { value: c.id, label: c.name }; }));
    var accLabel = d.type === 'ingreso' ? 'Cuenta que recibe' : (d.type === 'transferencia' ? 'Cuenta de origen' : 'Cuenta');
    var accSelect = field(form, 'accountId', accLabel, select(form, 'accountId', accountOptions(form, 'accountId', 'Elija una cuenta…'), { rerender: true }), { required: true });
    var second = d.type === 'transferencia'
      ? field(form, 'toAccountId', 'Cuenta destino', select(form, 'toAccountId', accountOptions(form, 'toAccountId', 'Elija la cuenta destino…'), { rerender: true }), { required: true })
      : field(form, 'categoryId', 'Categoría', select(form, 'categoryId', catOptions, { rerender: true }), { required: true });
    var f = U.forms[form];
    var date = field(form, 'date', d.scheduled ? (d.frequency === 'once' ? 'Fecha' : 'Primer pago (desde)') : 'Fecha',
      input(form, 'date', { type: 'date', max: d.scheduled ? calc.addDays(TODAY, validate.MAX_SCHEDULE_DAYS) : TODAY, min: d.scheduled ? calc.addDays(TODAY, -validate.MAX_SCHEDULE_DAYS) : null,
        rerender: d.scheduled }), { required: true }); // REQ-091: al cambiar la fecha se recalculan los pagos anteriores
    var amount = field(form, 'amount', 'Monto (₡)', input(form, 'amount', { inputmode: 'decimal', placeholder: '0.00' }), { required: true });
    var desc = field(form, 'description', 'Descripción', input(form, 'description', { maxlength: 120, placeholder: 'Ej. Supermercado' }), { required: true, wide: true });
    var types = form === 'quick' ? ['gasto', 'ingreso'] : ['gasto', 'ingreso', 'transferencia'];
    var typeField = field(form, 'type', 'Tipo', segmented(form, 'type', types.map(function (t) { return { value: t, label: TX_ICONS[t] + ' ' + TX_TYPES[t] }; })), { wide: true });
    var hint = el('p', { class: 'field-hint', 'data-available': form, text: availableHint(S, form) });
    var sched = ScheduleFields(form);
    if (form === 'quick') { // REQ-067: monto, categoría y descripción primero; fecha y cuenta precargadas
      return [typeField, el('div', { class: 'form-grid' }, amount, second, desc, date, accSelect), sched, hint];
    }
    return [typeField, el('div', { class: 'form-grid' }, date, amount, desc, accSelect, second), sched, hint];
  }

  /** REQ-079/080: casilla "Programar" y sus campos (frecuencia, hasta, modo) con vista previa de fechas. */
  function ScheduleFields(form) {
    var f = U.forms[form];
    var d = f.draft;
    if (f.editingId || f.link) { return null; } // un movimiento ya registrado no se convierte en programación
    var box = el('label', { class: 'check' + (d.scheduled ? ' is-on' : '') },
      el('input', { type: 'checkbox', id: 'f-' + form + '-scheduled', 'data-form': form, 'data-field': 'scheduled', 'data-rerender': true,
        checked: !!d.scheduled, disabled: !!f.editingScheduleId }),
      el('span', { text: '🗓 Programar (pago o ingreso fijo)' }));
    if (!d.scheduled) { return el('div', { class: 'schedule-box' }, box); }
    var preview = schedulePreview(d);
    return el('div', { class: 'schedule-box is-on' }, box,
      el('div', { class: 'form-grid' },
        field(form, 'frequency', 'Frecuencia', segmented(form, 'frequency', [
          { value: 'once', label: 'Una vez' }, { value: 'monthly', label: 'Cada mes' }, { value: 'biweekly', label: 'Quincenal' }]),
          { wide: true, hint: d.frequency === 'biweekly' ? 'Quincenal = días 15 y último de cada mes. El monto es por quincena.' : null }),
        d.frequency !== 'once' ? field(form, 'ends', '¿Hasta cuándo?', segmented(form, 'ends', [ // D29: por defecto se repite sin fin
          { value: 'never', label: '🔁 Sin fin' }, { value: 'date', label: '📅 Hasta una fecha' }]),
          { hint: d.ends === 'date' ? null : (d.frequency === 'monthly' ? 'Se repite todos los meses hasta que usted la elimine.' : 'Se repite cada quincena hasta que usted la elimine.') }) : null,
        d.frequency !== 'once' && d.ends === 'date' ? field(form, 'endDate', 'Último pago (fecha final)', input(form, 'endDate', { type: 'date', min: d.date, rerender: true }), {}) : null,
        d.type === 'ingreso' // D28: los ingresos no piden modo
          ? el('p', { class: 'field-hint income-auto' + (d.frequency === 'once' || d.ends === 'date' ? ' field-wide' : ''), text: '💰 Los ingresos programados se registran solos en su fecha, en la cuenta que recibe.' })
          : field(form, 'mode', 'Al llegar la fecha', segmented(form, 'mode', [
            { value: 'auto', label: '⚡ Auto-débito' }, { value: 'manual', label: '✋ Confirmar' }]),
            { wide: d.frequency === 'once' || d.ends === 'date', hint: d.mode === 'auto' ? 'Se registra solo desde la cuenta elegida si hay fondos.' : 'Queda pendiente para que usted lo confirme, ajuste u omita.' })),
      el('p', { class: 'field-hint schedule-preview', 'data-preview': form, text: preview }),
      PastOccurrences(form));
  }

  /** REQ-091: pagos con fecha anterior a hoy → registrarlos ahora u omitirlos. */
  function PastOccurrences(form) {
    var f = U.forms[form];
    var d = f.draft;
    if (!calc.isValidISODate(d.date) || d.date >= TODAY || ['once', 'monthly', 'biweekly'].indexOf(d.frequency) === -1) { return null; }
    var orig = f.editingScheduleId ? calc.getSchedule(S, f.editingScheduleId) : null;
    var sch = { id: f.editingScheduleId || 'prg-candidato', frequency: d.frequency, startDate: d.date, skippedDates: orig ? orig.skippedDates : [],
      endDate: draftEnd(d) && draftEnd(d) >= d.date ? draftEnd(d) : undefined };
    var dates = validate.pastOccurrences(S, sch, TODAY);
    if (!dates.length) { return null; }
    var amt = Number(String(d.amount).trim());
    return el('div', { class: 'past-box' },
      el('p', { class: 'past-title', text: '⏮ ' + (dates.length === 1 ? 'Hay 1 pago con fecha anterior a hoy: ' : 'Hay ' + dates.length + ' pagos con fecha anterior a hoy: ') +
        dates.map(dateLabel).join(' · ') + (amt > 0 ? ' (' + money(amt * dates.length) + ')' : '') }),
      field(form, 'pastAction', '¿Qué hago con ' + (dates.length === 1 ? 'ese pago' : 'esos pagos') + '?', segmented(form, 'pastAction', [
        { value: 'register', label: '✅ Registrarlos ahora' }, { value: 'skip', label: '↪ Ya los registré' }]),
        { wide: true, hint: d.pastAction === 'skip' ? 'No se crea ningún movimiento por esas fechas.' : 'Se crea un gasto o ingreso por cada fecha, con su fecha real, desde la cuenta elegida.' }));
  }

  /** D29: fecha final efectiva del borrador (null = sin fin). */
  function draftEnd(d) {
    return d.frequency !== 'once' && d.ends !== 'never' && calc.isValidISODate(d.endDate) ? d.endDate : null;
  }

  /** REQ-080: próximas 3 fechas y equivalente mensual (quincenal). */
  function schedulePreview(d) {
    if (!d.scheduled || !calc.isValidISODate(d.date) || ['once', 'monthly', 'biweekly'].indexOf(d.frequency) === -1) { return ''; }
    var sch = { frequency: d.frequency, startDate: d.date, endDate: draftEnd(d) };
    var next = calc.scheduleOccurrences(sch, d.date, calc.addDays(d.date, 400)).slice(0, 3);
    var text = next.length ? 'Próximas fechas: ' + next.map(dateLabel).join(' · ') : 'Sin fechas en ese rango.';
    if (d.frequency !== 'once' && sch.endDate && next.length === 1) { text += ' — ⚠ Con esa fecha final solo habrá 1 pago.'; }
    else if (d.frequency !== 'once' && !sch.endDate && next.length) { text += ' …'; }
    var amt = Number(String(d.amount).trim());
    if (d.frequency === 'biweekly' && amt > 0 && calc.hasMax2Decimals(amt)) { text += ' — ≈ ' + money(amt * 2) + ' al mes'; }
    return text;
  }

  function TransactionForm() { // REQ-020..REQ-034
    var f = U.forms.transaction;
    var title = f.editingScheduleId ? 'Editar programación' : f.link ? 'Ajustar pago programado' : f.editingId ? 'Editar movimiento' : 'Registrar movimiento';
    var editing = f.editingId || f.editingScheduleId || f.link;
    var label = f.draft.scheduled ? (f.editingScheduleId ? 'Guardar programación' : 'Programar') : (f.editingId ? 'Guardar cambios' : 'Guardar');
    return card(title, 'form-card' + (editing ? ' is-editing' : ''),
      el('form', { 'data-submit': 'transaction', novalidate: true, id: 'form-transaction' },
        TransactionFields('transaction'),
        formFooter('transaction', label, { cancelAction: f.link || f.editingScheduleId ? 'CANCEL_EDIT' : null, cancelForm: 'transaction' })));
  }

  function Filters() { // REQ-036
    function sel(name, label, options) {
      return el('label', { class: 'filter' }, el('span', { text: label }),
        el('select', { 'data-filter': name }, options.map(function (o) {
          return el('option', { value: o.value, selected: U.filters[name] === o.value, text: o.label });
        })));
    }
    return el('div', { class: 'filters' },
      sel('accountId', 'Cuenta', [{ value: '', label: 'Todas' }].concat(S.accounts.map(function (a) {
        return { value: a.id, label: a.name + (a.archived ? ' (archivada)' : '') };
      }))),
      sel('categoryId', 'Categoría', [{ value: '', label: 'Todas' }].concat(S.categories.map(function (c) {
        return { value: c.id, label: c.name + ' (' + c.kind + ')' };
      }))));
  }

  function txMeta(t) {
    var acc = calc.getAccount(S, t.accountId);
    if (t.type === 'transferencia') { return acc.name + ' → ' + calc.getAccount(S, t.toAccountId).name; }
    return calc.getCategory(S, t.categoryId).name + ' · ' + acc.name;
  }

  function rowActions(t) {
    return el('div', { class: 'row-actions' },
      el('button', { type: 'button', class: 'btn-icon', 'data-action': 'EDIT_TRANSACTION', 'data-id': t.id, 'aria-label': 'Editar ' + t.description, title: 'Editar', text: '✎' }),
      el('button', { type: 'button', class: 'btn-icon is-danger', 'data-action': 'DELETE_TRANSACTION', 'data-id': t.id, 'aria-label': 'Eliminar ' + t.description, title: 'Eliminar', text: '🗑' }));
  }

  function TransactionRow(t) {
    if (t.virtual) { return occurrenceRow(t); } // REQ-081
    var sign = t.type === 'ingreso' ? '+' : (t.type === 'gasto' ? '−' : '');
    return el('li', { class: 'tx-row is-' + t.type + (U.forms.transaction.editingId === t.id ? ' is-editing' : '') },
      el('span', { class: 'tx-icon', 'aria-hidden': 'true', text: TX_ICONS[t.type] }),
      el('div', { class: 'grow' },
        el('strong', { class: 'tx-desc' }, t.description, scheduledBadge(t)),
        el('span', { class: 'muted', text: TX_TYPES[t.type] + ' · ' + txMeta(t) })),
      el('span', { class: 'tx-amount', text: sign + money(t.amount) }),
      rowActions(t));
  }

  function TransactionList() { // REQ-036, REQ-037, REQ-046
    var groups = calc.groupByDate(calc.filterTransactions(S, U.month, U.filters, TODAY));
    return card('Gastos e ingresos de ' + calc.monthLabel(U.month).toLowerCase(), 'tx-list',
      Filters(),
      groups.length === 0 ? el('p', { class: 'empty-inline', text: 'No hay movimientos en ' + calc.monthLabel(U.month) + ' con estos filtros.' }) : null,
      groups.map(function (g) {
        return el('div', { class: 'day-group' },
          el('div', { class: 'day-head' },
            el('span', { text: dateLabel(g.date) }),
            el('span', { class: 'day-net' + (g.net < 0 ? ' is-negative' : '') },
              'Neto del día: ', el('strong', { text: money(g.net, { sign: true }) }))),
          el('ul', { class: 'list' }, g.items.map(TransactionRow)));
      }));
  }

  function TransactionsView() {
    if (!calc.activeAccounts(S).length && !S.transactions.length) { return [NoAccounts('Primero cree una cuenta para poder registrar movimientos.')]; }
    var form = calc.activeAccounts(S).length || U.forms.transaction.editingId
      ? TransactionForm() : NoAccounts('Primero cree una cuenta activa para registrar movimientos.');
    return [MonthSelector(), el('div', { class: 'grid-form' }, el('div', { class: 'acc-col' }, form, SchedulesList()), TransactionList())];
  }

  function SchedulesList() { // REQ-089
    var list = S.schedules || [];
    if (!list.length) { return null; }
    return card('Pagos e ingresos programados', 'schedules',
      el('ul', { class: 'list' }, list.map(function (sch) {
        var next = calc.nextOccurrence(S, sch, TODAY);
        var sign = sch.type === 'ingreso' ? '+' : (sch.type === 'gasto' ? '−' : '');
        var meta = FREQ_LABEL[sch.frequency] + ' · ' + modeLabel(sch) + ' · ' + txMeta(sch) +
          (sch.frequency === 'biweekly' ? ' · ≈ ' + money(calc.monthlyEquivalent(sch)) + ' al mes' : '') +
          (sch.endDate ? ' · hasta ' + sch.endDate : '');
        return el('li', { class: 'list-row' + (U.forms.transaction.editingScheduleId === sch.id ? ' is-editing' : '') },
          el('span', { class: 'acc-icon', 'aria-hidden': 'true', text: '🔁' }),
          el('div', { class: 'grow' },
            el('strong', { text: sch.description + ' · ' + sign + money(sch.amount) }),
            el('span', { class: 'muted', text: meta }),
            el('span', { class: 'muted', text: next ? 'Próxima: ' + dateLabel(next) + ' (' + inDays(next) + ')' : 'Sin más fechas' })),
          el('div', { class: 'row-actions' },
            el('button', { type: 'button', class: 'btn-icon', 'data-action': 'EDIT_SCHEDULE', 'data-id': sch.id, 'aria-label': 'Editar ' + sch.description, title: 'Editar', text: '✎' }),
            el('button', { type: 'button', class: 'btn-icon is-danger', 'data-action': 'DELETE_SCHEDULE', 'data-id': sch.id, 'aria-label': 'Eliminar ' + sch.description, title: 'Eliminar', text: '🗑' })));
      })));
  }

  /* ====================================================================== */
  /* Registro rápido (REQ-067, REQ-068)                                        */
  /* ====================================================================== */

  function QuickAddButton() {
    if (!calc.activeAccounts(S).length || U.quickOpen) { return null; }
    return el('button', { type: 'button', class: 'fab', 'data-action': 'OPEN_QUICK', id: 'fab-quick', 'aria-label': 'Registrar gasto o ingreso' },
      el('span', { 'aria-hidden': 'true', text: '+' }), el('span', { class: 'fab-label', text: 'Registrar' }));
  }

  function QuickAdd() {
    if (!U.quickOpen) { return null; }
    return el('div', { class: 'overlay overlay-quick' },
      el('div', { class: 'dialog dialog-quick', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'quick-title' },
        el('h2', { id: 'quick-title', text: 'Registro rápido' }),
        el('form', { 'data-submit': 'quick', novalidate: true, id: 'form-quick' },
          TransactionFields('quick'),
          formFooter('quick', 'Guardar', { cancelAction: 'CLOSE_QUICK' }))));
  }

  /* ====================================================================== */
  /* Vista: Cuentas (REQ-001..REQ-011, REQ-058..REQ-066)                       */
  /* ====================================================================== */

  function AccountForm() {
    var f = U.forms.account;
    var d = f.draft;
    var locked = !!f.editingId && calc.accountMovementCount(S, f.editingId) > 0; // REQ-008
    var amountFields = d.type === 'credito'
      ? [field('account', 'creditLimit', 'Límite de crédito (₡)', input('account', 'creditLimit', { inputmode: 'decimal', placeholder: '0.00' }), { required: true, wide: true }),
        field('account', 'cutoffDay', 'Día de corte', input('account', 'cutoffDay', { inputmode: 'numeric', placeholder: '1–28' }), { required: true }),
        field('account', 'paymentDay', 'Día de pago', input('account', 'paymentDay', { inputmode: 'numeric', placeholder: '1–28' }), { required: true })]
      : [field('account', 'initialBalance', 'Saldo inicial (₡)', input('account', 'initialBalance', { inputmode: 'decimal', placeholder: '0.00' }),
        { required: true, wide: true, hint: d.type === 'ahorros'
          ? 'Los ahorros no se gastan directamente: transfiéralos a efectivo o débito (REQ-058).'
          : 'El saldo actual se calcula con los movimientos; no se edita directamente.' })];
    if (d.type === 'ahorros') { // REQ-093 (v6)
      amountFields = amountFields.concat([
        field('account', 'goalAmount', '🎯 Meta de ahorro (₡)', input('account', 'goalAmount', { inputmode: 'decimal', placeholder: 'Opcional — ej. 1000000' }), {}),
        field('account', 'goalReason', 'Razón del ahorro', input('account', 'goalReason', { maxlength: 60, placeholder: 'Opcional — ej. Fondo de emergencia' }), {})]);
    }
    return card(f.editingId ? 'Editar cuenta' : 'Nueva cuenta', 'form-card' + (f.editingId ? ' is-editing' : ''),
      el('form', { 'data-submit': 'account', novalidate: true, id: 'form-account' },
        el('div', { class: 'form-grid' },
          field('account', 'name', 'Nombre', input('account', 'name', { maxlength: 60, placeholder: 'Ej. Cuenta BAC' }), { required: true, wide: true }),
          field('account', 'type', 'Tipo', segmented('account', 'type',
            ['efectivo', 'debito', 'ahorros', 'credito'].map(function (t) { return { value: t, label: ACCOUNT_ICONS[t] + ' ' + ACCOUNT_TYPES[t] }; }), { disabled: locked }),
          { wide: true, hint: locked ? 'El tipo no se puede cambiar porque la cuenta tiene movimientos.' : null }),
          amountFields),
        formFooter('account', f.editingId ? 'Guardar cambios' : 'Crear cuenta')));
  }

  /** Tarjeta visual de una cuenta (REQ-066). */
  function AccountCard(a, opts) {
    opts = opts || {};
    var bal = calc.currentBalance(S, a.id, TODAY);
    var after = calc.hasOpenThisMonth(S, a.id, TODAY) ? calc.projectedBalance(S, a.id, TODAY) : null; // REQ-088
    var n = calc.accountMovementCount(S, a.id);
    var main, sub = [];
    if (calc.isCredit(a)) {
      var debt = calc.creditDebt(S, a.id, null, TODAY);
      main = debt > 0 ? '−' + money(debt) : money(0);
      sub.push('Disponible ' + money(calc.availableFunds(S, a.id, null, TODAY)) + ' de ' + money(a.creditLimit));
      if (after !== null) { sub.push('Deuda proyectada a fin de mes: ' + money(Math.max(0, -after))); }
      var c = calc.creditCycle(S, a.id, TODAY);
      if (c) { sub.push(cycleText(c)); sub.push('Pago del periodo: ' + money(c.amountDue)); }
      else { sub.push('Sin fechas de corte y pago: edite la cuenta para configurarlas.'); }
    } else {
      main = money(bal);
      sub.push(n + (n === 1 ? ' movimiento' : ' movimientos'));
      if (after !== null) { sub.push('Proyectado a fin de mes: ' + money(after)); }
    }
    var label = calc.isCredit(a) ? 'Deuda actual' : 'Saldo actual';
    return el('article', { class: 'acc-card is-' + a.type + (a.archived ? ' is-archived' : '') + (opts.big ? ' is-big' : '') },
      el('div', { class: 'acc-card-top' },
        el('span', { class: 'acc-card-type', text: ACCOUNT_ICONS[a.type] + ' ' + ACCOUNT_TYPES[a.type] + (a.archived ? ' · Archivada' : '') }),
        opts.big ? null : el('div', { class: 'row-actions' },
          el('button', { type: 'button', class: 'btn-icon', 'data-action': 'EDIT_ACCOUNT', 'data-id': a.id, 'aria-label': 'Editar ' + a.name, title: 'Editar', text: '✎' }),
          a.archived
            ? el('button', { type: 'button', class: 'btn-icon', 'data-action': 'UNARCHIVE_ACCOUNT', 'data-id': a.id, 'aria-label': 'Reactivar ' + a.name, title: 'Reactivar', text: '↺' })
            : el('button', { type: 'button', class: 'btn-icon', 'data-action': 'ARCHIVE_ACCOUNT', 'data-id': a.id, 'aria-label': 'Archivar ' + a.name, title: 'Archivar', text: '🗄' }),
          el('button', { type: 'button', class: 'btn-icon', 'data-action': 'DELETE_ACCOUNT', 'data-id': a.id, 'aria-label': 'Eliminar ' + a.name, title: 'Eliminar', text: '🗑' }))),
      el('h3', { class: 'acc-card-name', text: a.name }),
      el('div', { class: 'acc-card-amount' }, el('span', { text: label }), el('strong', { text: main })),
      sub.map(function (t) { return el('p', { class: 'acc-card-sub', text: t }); }),
      GoalProgress(a, { hint: opts.big }), // REQ-094
      opts.big ? null : el('button', { type: 'button', class: 'btn-link acc-card-open', 'data-action': 'OPEN_ACCOUNT', 'data-id': a.id, text: 'Ver detalle →' }));
  }

  function AccountCards() {
    var active = calc.activeAccounts(S);
    var archived = S.accounts.filter(function (a) { return a.archived; });
    return el('div', { class: 'acc-col' },
      card('Mis cuentas', 'account-list',
        active.length ? el('div', { class: 'acc-grid' }, active.map(function (a) { return AccountCard(a); }))
          : el('p', { class: 'empty-inline', text: 'Todavía no hay cuentas activas.' }),
        active.length ? BalanceBreakdown() : null),
      archived.length ? card('Archivadas', 'archived-list',
        el('p', { class: 'muted', text: 'No aparecen al registrar movimientos; su historial se conserva.' }),
        el('div', { class: 'acc-grid' }, archived.map(function (a) { return AccountCard(a); }))) : null);
  }

  function AccountDetail() { // REQ-066
    var a = calc.getAccount(S, U.selectedAccountId);
    var rows = calc.runningBalances(S, a.id);
    return [
      el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'CLOSE_ACCOUNT', text: '← Volver a cuentas' }),
      el('div', { class: 'grid-form detail' },
        el('div', null, AccountCard(a, { big: true }),
          el('div', { class: 'form-actions' },
            el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'EDIT_ACCOUNT', 'data-id': a.id, text: '✎ Editar' }),
            a.archived
              ? el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'UNARCHIVE_ACCOUNT', 'data-id': a.id, text: '↺ Reactivar' })
              : el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'ARCHIVE_ACCOUNT', 'data-id': a.id, text: '🗄 Archivar' }))),
        card('Movimientos de ' + a.name, 'detail-list',
          rows.length === 0 ? el('p', { class: 'empty-inline', text: 'Esta cuenta no tiene movimientos.' }) : null,
          el('ul', { class: 'list' }, rows.map(function (r) {
            var t = r.tx;
            return el('li', { class: 'tx-row is-' + t.type },
              el('span', { class: 'tx-icon', 'aria-hidden': 'true', text: TX_ICONS[t.type] }),
              el('div', { class: 'grow' },
                el('strong', { class: 'tx-desc' }, t.description, scheduledBadge(t)),
                el('span', { class: 'muted', text: dateLabel(t.date) + ' · ' + txMeta(t) })),
              el('div', { class: 'acc-balance' },
                el('strong', { class: 'tx-amount ' + (r.effect < 0 ? 'is-out' : 'is-in'), text: money(r.effect, { sign: true }) }),
                el('span', { class: 'muted run-balance', text: 'Saldo: ' + money(r.balanceAfter) })),
              rowActions(t));
          }))))
    ];
  }

  function AccountsView() {
    if (U.selectedAccountId && calc.getAccount(S, U.selectedAccountId)) { return AccountDetail(); }
    return [el('div', { class: 'grid-form' }, AccountForm(), AccountCards())];
  }

  /* ====================================================================== */
  /* Vista: Categorías                                                         */
  /* ====================================================================== */

  function CategoryForm() { // REQ-013..REQ-016, REQ-019
    var f = U.forms.category;
    var d = f.draft;
    var original = f.editingId ? calc.getCategory(S, f.editingId) : null;
    var locked = !!original && (original.system || calc.categoryMovementCount(S, original.id) > 0);
    return card(f.editingId ? 'Editar categoría' : 'Nueva categoría', 'form-card' + (f.editingId ? ' is-editing' : ''),
      el('form', { 'data-submit': 'category', novalidate: true, id: 'form-category' },
        el('div', { class: 'form-grid' },
          field('category', 'name', 'Nombre', input('category', 'name', { maxlength: 60, placeholder: 'Ej. Mascotas' }), { required: true, wide: true }),
          field('category', 'kind', 'Tipo', segmented('category', 'kind', [{ value: 'gasto', label: '↓ Gasto' }, { value: 'ingreso', label: '↑ Ingreso' }], { disabled: locked }),
            { wide: true, hint: locked ? (original.system ? 'Categoría del sistema: su tipo no cambia.' : 'El tipo no se puede cambiar porque la categoría tiene movimientos.') : null }),
          d.kind === 'gasto'
            ? field('category', 'monthlyBudget', 'Presupuesto mensual (₡)', input('category', 'monthlyBudget', { inputmode: 'decimal', placeholder: 'Opcional' }),
              { hint: 'Vacío = sin presupuesto. El avance se ve en la pestaña Presupuestos.', wide: true })
            : null),
        formFooter('category', f.editingId ? 'Guardar cambios' : 'Crear categoría')));
  }

  function CategoryTable(kind) {
    var cats = S.categories.filter(function (c) { return c.kind === kind; });
    return el('div', { class: 'cat-group' },
      el('h3', { text: kind === 'gasto' ? 'Categorías de gasto' : 'Categorías de ingreso' }),
      el('ul', { class: 'list' }, cats.map(function (c) {
        var n = calc.categoryMovementCount(S, c.id);
        return el('li', { class: 'list-row' + (U.forms.category.editingId === c.id ? ' is-editing' : '') },
          el('div', { class: 'grow' },
            el('strong', null, c.name, c.system ? el('span', { class: 'badge is-system', text: 'Sistema' }) : null),
            el('span', { class: 'muted', text: n + (n === 1 ? ' movimiento' : ' movimientos') +
              (kind === 'gasto' ? ' · ' + (c.monthlyBudget ? 'presupuesto ' + money(c.monthlyBudget) + '/mes' : 'sin presupuesto') : '') })),
          el('div', { class: 'row-actions' },
            el('button', { type: 'button', class: 'btn-icon', 'data-action': 'EDIT_CATEGORY', 'data-id': c.id, 'aria-label': 'Editar ' + c.name, title: 'Editar', text: '✎' }),
            c.system ? null : el('button', { type: 'button', class: 'btn-icon is-danger', 'data-action': 'DELETE_CATEGORY', 'data-id': c.id, 'aria-label': 'Eliminar ' + c.name, title: 'Eliminar', text: '🗑' })));
      })));
  }

  function CategoriesView() {
    return [el('div', { class: 'grid-form' }, CategoryForm(), card('Categorías', 'cat-list', CategoryTable('gasto'), CategoryTable('ingreso')))];
  }

  /* ====================================================================== */
  /* Diálogos                                                                  */
  /* ====================================================================== */

  function Dialog() { // REQ-011, REQ-017, REQ-018, REQ-033, REQ-035, REQ-063
    var d = U.dialog;
    if (!d) { return null; }
    var body = [el('p', { text: d.text })];
    if (d.items) { body.push(el('ul', { class: 'dialog-items' }, d.items.map(function (t) { return el('li', { text: t }); }))); }
    if (d.kind === 'reassign') {
      var cat = calc.getCategory(S, d.categoryId);
      var err = (U.errors.reassign || {}).targetId;
      body.push(el('div', { class: 'field' + (err ? ' has-error' : '') },
        el('label', { for: 'f-reassign', text: 'Reasignar movimientos a *' }),
        el('select', { id: 'f-reassign', 'data-reassign': true },
          [el('option', { value: '', text: 'Elija una categoría…' })].concat(S.categories
            .filter(function (c) { return c.kind === cat.kind && c.id !== cat.id; })
            .map(function (c) { return el('option', { value: c.id, selected: c.id === d.draft.targetId, text: c.name }); }))),
        el('p', { class: 'field-error', role: 'alert', text: err || '' })));
    }
    return el('div', { class: 'overlay overlay-top' },
      el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dialog-title' },
        el('h2', { id: 'dialog-title', text: d.title }),
        body,
        el('div', { class: 'form-actions' },
          el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'CANCEL', text: 'Cancelar' }),
          el('button', { type: 'button', class: 'btn ' + (d.danger ? 'btn-danger' : 'btn-primary'), 'data-action': 'CONFIRM', id: 'dialog-confirm', text: d.confirmLabel }))));
  }

  /* ====================================================================== */
  /* Render                                                                    */
  /* ====================================================================== */

  var VIEWS = { resumen: SummaryView, movimientos: TransactionsView, presupuestos: BudgetsView, cuentas: AccountsView, categorias: CategoriesView };

  function mount(node) { root = node; }

  function render(state, ui) {
    S = state; U = ui; TODAY = calc.todayISO();
    var scrollY = global.scrollY;
    var focusId = doc.activeElement && doc.activeElement.id;
    var viewKey = ui.activeTab + (ui.selectedAccountId || '');
    var main = el('main', { class: 'view view-' + ui.activeTab + (lastTab !== viewKey ? ' is-entering' : '') }, VIEWS[ui.activeTab]());
    var tree = el('div', { class: 'shell' }, AppHeader(), NavTabs(), StorageNotice(), main, QuickAddButton(), Toast(), QuickAdd(), Dialog());
    root.textContent = '';
    root.appendChild(tree);
    var activeTab = root.querySelector('.tab.is-active'); // en móvil, la pestaña activa siempre visible
    if (activeTab) { activeTab.parentNode.scrollLeft = activeTab.offsetLeft - 16; }

    if (ui.dialog) {
      var c = root.querySelector('#f-reassign') || root.querySelector('#dialog-confirm');
      if (c) { c.focus(); }
    } else if (focusId && root.querySelector('#' + focusId)) {
      root.querySelector('#' + focusId).focus({ preventScroll: true });
    } else if (ui.quickOpen) {
      var amt = root.querySelector('#f-quick-amount');
      if (amt) { amt.focus(); }
    }
    if (lastTab === viewKey) { global.scrollTo(0, scrollY); } else { global.scrollTo(0, 0); }
    if (ui.scrollToForm) {
      var form = root.querySelector('.form-card');
      if (form && form.scrollIntoView) { form.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    }
    lastTab = viewKey;

    // Avisos efímeros: se cierran solos a los 6 s
    if (ui.toast && ui.toast.at !== lastToastAt) {
      var at = lastToastAt = ui.toast.at;
      global.setTimeout(function () {
        if (A.app && A.app.ui.toast && A.app.ui.toast.at === at) { A.app.dispatch({ type: 'DISMISS_TOAST' }); }
      }, 6000);
    }
  }

  A.ui = { el: el, mount: mount, render: render, updateForm: updateForm };
})(window);
