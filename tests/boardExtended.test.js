const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../boardExtended.js');

test('canSeeExtended requires flagged company and PM role', () => {
  assert.equal(X.canSeeExtended({ extendedBoard: true }, 'pm'), true);
  assert.equal(X.canSeeExtended({ extendedBoard: true }, 'dev'), false);
  assert.equal(X.canSeeExtended({ extendedBoard: false }, 'pm'), false);
  assert.equal(X.canSeeExtended(undefined, 'pm'), false);
});

test('validateExtended requires invoiced month when invoiced', () => {
  const base = X.emptyExtendedForm();
  assert.equal(X.validateExtended({ ...base, facturado: true }), 'Indica el mes de facturación.');
  assert.equal(X.validateExtended({ ...base, facturado: true, mesFacturado: '2026-04' }), null);
  assert.equal(X.validateExtended({ ...base, facturado: false }), null);
});

test('emptyExtendedForm defaults invoiced to false', () => {
  assert.equal(X.emptyExtendedForm().facturado, false);
});

test('extendedPayload clears month when not invoiced and nulls empty dates', () => {
  const base = X.emptyExtendedForm();
  assert.equal(X.extendedPayload({ ...base, facturado: false, mesFacturado: '2026-04' }).invoiced_month, null);
  assert.equal(X.extendedPayload({ ...base, facturado: true, mesFacturado: '2026-04' }).invoiced_month, '2026-04-01');
  const p = X.extendedPayload({ ...base, fechaSolicitud: '' });
  assert.equal(p.request_date, null);
  assert.equal(p.client_pm_contact_id, null);
  assert.equal(p.invoiced, false);
});

test('mapExtendedRow maps DB row to form shape', () => {
  const m = X.mapExtendedRow({ invoiced: true, invoiced_month: '2026-04-01', request_date: '2026-03-05', client_pm_contact_id: null });
  assert.equal(m.mesFacturado, '2026-04');
  assert.equal(m.pmContactId, '');
  assert.equal(m.fechaSolicitud, '2026-03-05');
  assert.equal(m.facturado, true);
});

test('extendedFormFromReq copies extended keys from a mapped requirement', () => {
  const req = { ...X.emptyExtendedForm(), pmContactId: 'c1', facturado: true, mesFacturado: '2026-04', titulo: 'x' };
  const f = X.extendedFormFromReq(req);
  assert.deepEqual(f, { ...X.emptyExtendedForm(), pmContactId: 'c1', facturado: true, mesFacturado: '2026-04' });
});

test('formatInvoiced renders No or Sí with month', () => {
  assert.equal(X.formatInvoiced(false, ''), 'No');
  assert.equal(X.formatInvoiced(true, '2026-04'), 'Sí · abril 2026');
});

test('emailableContacts keeps only contacts with an email', () => {
  assert.equal(X.emailableContacts([{ email: 'a@b.co' }, { email: null }, { email: '  ' }]).length, 1);
});

test('findPmContactByName matches PM contacts ignoring case, accents and spaces', () => {
  const list = [{ id: '1', name: 'Germán Eduardo Celemin', role: 'pm' }, { id: '2', name: 'Meyli Herrera', role: null }];
  assert.equal(X.findPmContactByName(list, 'german eduardo  celemin').id, '1');
  assert.equal(X.findPmContactByName(list, 'Meyli Herrera'), null);
});

test('filterPmContacts filters PM contacts by partial name', () => {
  const list = [{ id: '1', name: 'Germán Eduardo Celemin', role: 'pm' }, { id: '2', name: 'Celestino', role: null }];
  assert.equal(X.filterPmContacts(list, 'cele').length, 1);
});

test('extendedExcelValues aligns with EXTENDED_EXCEL_COLUMNS', () => {
  const v = X.extendedExcelValues({ ...X.emptyExtendedForm(), pmContactId: '1', facturado: true, mesFacturado: '2026-04' }, { 1: { name: 'Ana' } });
  const headers = X.EXTENDED_EXCEL_COLUMNS.map((c) => c[0]);
  assert.equal(v.length, X.EXTENDED_EXCEL_COLUMNS.length);
  assert.equal(v[0], 'Ana');
  assert.equal(v[headers.indexOf('Facturado')], 'Sí');
  assert.equal(v[headers.indexOf('Mes de facturación')], '2026-04');
  assert.deepEqual(headers, ['PM Entrega', 'Fecha de solicitud', 'Fecha entrega estimación', 'Fecha aprobación estimación',
    'Fecha inicio desarrollo', 'Fecha real entrega a pruebas', 'Facturado', 'Mes de facturación']);
});

test('statusLabel uses the company override, else the default label', () => {
  const d1 = { statusLabels: { usuarios: 'En pruebas de usuario' } };
  assert.equal(X.statusLabel(d1, 'usuarios', 'Usuarios'), 'En pruebas de usuario');
  assert.equal(X.statusLabel(d1, 'produccion', 'Produccion'), 'Produccion');
  assert.equal(X.statusLabel({}, 'usuarios', 'Usuarios'), 'Usuarios');
  assert.equal(X.statusLabel(null, 'usuarios', 'Usuarios'), 'Usuarios');
});

test('monthOptions lists months newest first from next year back two years', () => {
  const opts = X.monthOptions(new Date(2026, 10, 4), '');
  assert.equal(opts[0].value, '');
  assert.equal(opts[0].label, 'Selecciona el mes');
  assert.deepEqual(opts[1], { value: '2027-12', label: 'diciembre 2027' });
  assert.deepEqual(opts[opts.length - 1], { value: '2024-01', label: 'enero 2024' });
  assert.equal(opts.length, 1 + 48);
  assert.ok(opts.some((o) => o.value === '2026-11' && o.label === 'noviembre 2026'));
});

test('monthOptions keeps a selected month outside the range', () => {
  const opts = X.monthOptions(new Date(2026, 10, 4), '2020-03');
  assert.ok(opts.some((o) => o.value === '2020-03' && o.label === 'marzo 2020'));
});
