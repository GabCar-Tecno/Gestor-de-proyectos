// Extended requirement board (per-company flag `extended_board`, PM-only).
// Pure helpers shared by index.html (window.BOARD_EXT) and node tests (module.exports).
(function () {
  const CONTACT_ROLE = Object.freeze({ pm: 'pm' });
  const PM_ROLE = 'pm';
  const INVOICED_MONTH_ERROR = 'Indica el mes de facturación.';

  const FIELD_TO_COLUMN = Object.freeze({
    fechaSolicitud: 'request_date',
    fechaEntregaEstimacion: 'estimate_delivery_date',
    fechaAprobacionEstimacion: 'estimate_approval_date',
    fechaInicioDesarrollo: 'development_start_date',
    fechaEntregaPruebas: 'user_testing_delivery_date'
  });

  const EXTENDED_EXCEL_COLUMNS = Object.freeze([
    ['PM Entrega', 24, 'text'],
    ['Fecha de solicitud', 13, 'date'],
    ['Fecha entrega estimación', 13, 'date'],
    ['Fecha aprobación estimación', 13, 'date'],
    ['Fecha inicio desarrollo', 13, 'date'],
    ['Fecha real entrega a pruebas', 13, 'date'],
    ['Facturado', 10, 'text'],
    ['Mes de facturación', 12, 'month']
  ]);

  function canSeeExtended(company, role) {
    return !!(company && company.extendedBoard) && role === PM_ROLE;
  }

  function emptyExtendedForm() {
    return {
      pmContactId: '', fechaSolicitud: '', fechaEntregaEstimacion: '', fechaAprobacionEstimacion: '',
      fechaInicioDesarrollo: '', fechaEntregaPruebas: '', facturado: false, mesFacturado: ''
    };
  }

  function extendedFormFromReq(req) {
    const out = emptyExtendedForm();
    Object.keys(out).forEach((k) => {
      if (req && req[k] !== undefined && req[k] !== null) out[k] = req[k];
    });
    out.facturado = !!out.facturado;
    return out;
  }

  function mapExtendedRow(row) {
    const r = row || {};
    const out = emptyExtendedForm();
    out.pmContactId = r.client_pm_contact_id || '';
    Object.entries(FIELD_TO_COLUMN).forEach(([field, col]) => { out[field] = r[col] || ''; });
    out.facturado = !!r.invoiced;
    out.mesFacturado = r.invoiced_month ? String(r.invoiced_month).slice(0, 7) : '';
    return out;
  }

  function validateExtended(form) {
    return form && form.facturado && !form.mesFacturado ? INVOICED_MONTH_ERROR : null;
  }

  function extendedPayload(form) {
    const f = form || {};
    const payload = { client_pm_contact_id: f.pmContactId || null };
    Object.entries(FIELD_TO_COLUMN).forEach(([field, col]) => { payload[col] = f[field] || null; });
    payload.invoiced = !!f.facturado;
    payload.invoiced_month = f.facturado && f.mesFacturado ? f.mesFacturado + '-01' : null;
    return payload;
  }

  function formatMonth(mesFacturado, locale) {
    const m = /^(\d{4})-(\d{2})$/.exec(mesFacturado || '');
    if (!m) return '';
    const name = new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString(locale || 'es-CO', { month: 'long', timeZone: 'UTC' });
    return name + ' ' + m[1];
  }

  function monthOptions(today, selected, locale) {
    const now = today || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const opts = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 2; y--) {
      for (let m = 12; m >= 1; m--) {
        const value = y + '-' + pad(m);
        opts.push({ value, label: formatMonth(value, locale) });
      }
    }
    if (selected && /^\d{4}-\d{2}$/.test(selected) && !opts.some((o) => o.value === selected)) {
      opts.push({ value: selected, label: formatMonth(selected, locale) });
    }
    return [{ value: '', label: 'Selecciona el mes' }].concat(opts);
  }

  function formatInvoiced(facturado, mesFacturado, locale) {
    if (!facturado) return 'No';
    const month = formatMonth(mesFacturado, locale);
    return month ? 'Sí · ' + month : 'Sí';
  }

  function emailableContacts(contacts) {
    return (contacts || []).filter((c) => !!String((c && c.email) || '').trim());
  }

  function normalizeName(s) {
    return String(s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function pmContacts(contacts) {
    return (contacts || []).filter((c) => c && c.role === CONTACT_ROLE.pm)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
  }

  function findPmContactByName(contacts, name) {
    const target = normalizeName(name);
    if (!target) return null;
    return pmContacts(contacts).find((c) => normalizeName(c.name) === target) || null;
  }

  function filterPmContacts(contacts, query) {
    const q = normalizeName(query);
    return pmContacts(contacts).filter((c) => normalizeName(c.name).includes(q));
  }

  function statusLabel(company, statusId, fallback) {
    const labels = company && company.statusLabels;
    const custom = labels && typeof labels === 'object' ? labels[statusId] : '';
    return custom ? String(custom) : fallback;
  }

  function extendedExcelValues(ext, contactsById) {
    const e = ext || emptyExtendedForm();
    const pm = e.pmContactId && contactsById && contactsById[e.pmContactId];
    return [
      pm ? pm.name || '' : '',
      e.fechaSolicitud || '', e.fechaEntregaEstimacion || '', e.fechaAprobacionEstimacion || '',
      e.fechaInicioDesarrollo || '', e.fechaEntregaPruebas || '',
      e.facturado ? 'Sí' : 'No',
      e.facturado ? e.mesFacturado || '' : ''
    ];
  }

  const api = Object.freeze({
    CONTACT_ROLE, EXTENDED_EXCEL_COLUMNS, canSeeExtended, emptyExtendedForm, extendedFormFromReq, mapExtendedRow,
    validateExtended, extendedPayload, formatMonth, formatInvoiced, emailableContacts, normalizeName, pmContacts,
    findPmContactByName, filterPmContacts, extendedExcelValues, statusLabel, monthOptions
  });

  if (typeof window !== 'undefined') window.BOARD_EXT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
