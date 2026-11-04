"""Generate an idempotent SQL import for the D1 requirements schedule.

Reads the "GESTIÓN OPERACION D1" sheet of the D1 Excel schedule and prints SQL to stdout.
It never connects to a database: review the SQL, then apply it with psql.
Meant to run once. Re-running is safe for duplicates (rows are matched by D1 + PBI code), but it
re-applies the Excel values over the matched requirements; an existing change description is kept.

Usage:
    python3 -I scripts/import_d1_excel.py "/path/CRONOGRAMA REQUERIMIENTOS D1 2025 -2026.xlsx" > import_d1.sql
"""
import re
import sys
import unicodedata
from datetime import date, datetime

SHEET_PREFIX = 'GESTIÓN OPERACION D1'
COMPANY_NAME = 'd1'

STATUS_MAP = {
    'produccion': 'produccion',
    'pruebas de usuario': 'usuarios',
    'desarrollo': 'desarrollo',
    'espera de aprobacion': 'estimacion',
}
SKIPPED_STATUSES = {'cancelado'}

PM_ALIASES = {
    'gliseth zulay viloria c': 'Zulay Viloria',
    'david alexader garcia': 'David Alexander Garcia',
}

# Excel "Aplicativo" names that differ from the project names in the app.
PROJECT_ALIASES = {
    'd1': 'D1WB',
}

MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

# Column order of the sheet (0-based).
COL = {
    'estado': 0, 'aplicativo': 1, 'req': 2, 'descripcion': 3, 'pm': 4, 'solicitud': 5,
    'entrega_estimacion': 6, 'aprobacion_estimacion': 7, 'inicio_desarrollo': 8,
    'entrega_usuario': 9, 'desarrollador': 10, 'horas': 11, 'entrega_pruebas': 12,
    'produccion': 13, 'facturado': 14,
}


def _plain(text):
    text = unicodedata.normalize('NFD', str(text or ''))
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', text).strip().lower()


def map_status(text):
    key = _plain(text)
    if key in SKIPPED_STATUSES:
        return None
    return STATUS_MAP.get(key)


def canonical_pm(name):
    clean = re.sub(r'\s+', ' ', str(name or '')).strip()
    return PM_ALIASES.get(_plain(clean), clean)


def canonical_project(name):
    clean = re.sub(r'\s+', ' ', str(name or '')).strip()
    return PROJECT_ALIASES.get(_plain(clean), clean)


def parse_invoiced(text, ref_date):
    plain = _plain(text)
    if not plain.startswith('si'):
        return (False, None)
    month = None
    for word in re.findall(r'[a-z]+', plain[2:]):
        if word[:3] in MONTHS:
            month = MONTHS.index(word[:3]) + 1
            break
    if month is None or ref_date is None:
        return (True, None)
    year = ref_date.year if month >= ref_date.month else ref_date.year + 1
    return (True, '%04d-%02d' % (year, month))


def sql_literal(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return "'" + value.isoformat() + "'"
    return "'" + str(value).replace("'", "''") + "'"


def _as_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _slug(text):
    return re.sub(r'[^a-z0-9]+', '-', _plain(text)).strip('-')


def read_rows(path):
    import openpyxl  # imported lazily so the pure helpers are testable without it

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    sheet = next(ws for ws in wb.worksheets if ws.title.strip().upper().startswith(SHEET_PREFIX))
    rows, skipped = [], []
    for raw in sheet.iter_rows(min_row=2, values_only=True):
        r = list(raw) + [None] * 20
        if not r[COL['estado']] or not r[COL['descripcion']] or not r[COL['req']]:
            continue
        status = map_status(r[COL['estado']])
        code = str(r[COL['req']]).strip()
        if status is None:
            skipped.append((code, r[COL['estado']]))
            continue
        ref = _as_date(r[COL['entrega_pruebas']]) or _as_date(r[COL['entrega_usuario']]) or _as_date(r[COL['solicitud']])
        invoiced, month = parse_invoiced(r[COL['facturado']], ref)
        hours = r[COL['horas']]
        rows.append({
            'code': code,
            'status': status,
            'project': canonical_project(r[COL['aplicativo']] or 'D1'),
            'title': re.sub(r'\s+', ' ', str(r[COL['descripcion']])).strip(),
            'pm': canonical_pm(r[COL['pm']]) if r[COL['pm']] else None,
            'owner': re.sub(r'\s+', ' ', str(r[COL['desarrollador']] or '')).strip(),
            'hours': float(hours) if isinstance(hours, (int, float)) else None,
            'request_date': _as_date(r[COL['solicitud']]),
            'estimate_delivery_date': _as_date(r[COL['entrega_estimacion']]),
            'estimate_approval_date': _as_date(r[COL['aprobacion_estimacion']]),
            'development_start_date': _as_date(r[COL['inicio_desarrollo']]),
            'user_delivery_date': _as_date(r[COL['entrega_usuario']]),
            'user_testing_delivery_date': _as_date(r[COL['entrega_pruebas']]),
            'production_date': _as_date(r[COL['produccion']]),
            'invoiced': invoiced,
            'invoiced_month': (month + '-01') if month else None,
        })
    return rows, skipped


def build_sql(rows):
    out = ['-- D1 schedule import. Idempotent: safe to run more than once.', 'begin;', 'do $$', 'declare',
           '  v_company text; v_project text; v_contact text; v_req text; v_status text;', 'begin',
           "  select id into v_company from public.companies where lower(trim(name)) = %s;" % sql_literal(COMPANY_NAME),
           "  if v_company is null then raise exception 'D1 company not found'; end if;"]
    for r in rows:
        L = sql_literal
        out.append('')
        out.append('  -- #%s %s' % (r['code'], r['title'][:60].replace('\n', ' ')))
        out.append("  select id into v_project from public.projects where company_id = v_company and lower(trim(name)) = lower(%s) limit 1;" % L(r['project']))
        out.append("  if v_project is null then v_project := %s; insert into public.projects (id, company_id, name, description) values (v_project, v_company, %s, ''); end if;"
                   % (L('p-d1x-' + _slug(r['project'])), L(r['project'])))
        if r['pm']:
            out.append("  select id into v_contact from public.company_contacts where company_id = v_company"
                       " and lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = lower(%s) order by (role = 'pm') desc nulls last limit 1;" % L(r['pm']))
            out.append("  if v_contact is null then v_contact := %s; insert into public.company_contacts (id, company_id, name, email, role, sort_order)"
                       " values (v_contact, v_company, %s, null, 'pm', coalesce((select max(sort_order) from public.company_contacts where company_id = v_company), 0) + 1);"
                       " else update public.company_contacts set role = 'pm' where id = v_contact and role is distinct from 'pm'; end if;"
                       % (L('cto-d1x-' + _slug(r['pm'])), L(r['pm'])))
        else:
            out.append('  v_contact := null;')
        out.append("  select coalesce((select id from public.statuses where lower(id) = %s limit 1), %s) into v_status;" % (L(r['status']), L(r['status'])))
        out.append("  select r.id into v_req from public.requirements r join public.projects p on p.id = r.project_id"
                   " join public.requirement_codes c on c.requirement_id = r.id"
                   " where p.company_id = v_company and lower(btrim(c.code)) = lower(%s) limit 1;" % L(r['code']))
        fields = ("project_id = v_project, title = {t}, owner = {o}, status = v_status, status_id = v_status, estimated_hours = {h},"
                  " user_delivery_date = {ud}, production_date = {pd}, request_date = {rd}, estimate_delivery_date = {ed},"
                  " estimate_approval_date = {ad}, development_start_date = {sd}, user_testing_delivery_date = {td},"
                  " client_pm_contact_id = v_contact, invoiced = {inv}, invoiced_month = {im}").format(
            t=L(r['title']), o=L(r['owner'] or 'Sin asignar'), h=L(r['hours']), ud=L(r['user_delivery_date']), pd=L(r['production_date']),
            rd=L(r['request_date']), ed=L(r['estimate_delivery_date']), ad=L(r['estimate_approval_date']),
            sd=L(r['development_start_date']), td=L(r['user_testing_delivery_date']), inv=L(r['invoiced']), im=L(r['invoiced_month']))
        keep = ("change_description = case when btrim(coalesce(change_description, '')) = '' then {t} else change_description end,"
                " status_updated_at = case when status_id is distinct from v_status then now() else status_updated_at end, ").format(t=L(r['title']))
        out.append("  if v_req is not null then update public.requirements set %s%s where id = v_req; else" % (keep, fields))
        out.append("    v_req := %s;" % L('r-d1x-' + r['code']))
        out.append("    insert into public.requirements (id, project_id, title, code, status, status_id, owner) values (v_req, v_project, %s, %s, v_status, v_status, %s);"
                   % (L(r['title']), L(r['code']), L(r['owner'] or 'Sin asignar')))
        out.append("    update public.requirements set change_description = %s, status_updated_at = now(), %s where id = v_req;" % (L(r['title']), fields))
        out.append("    insert into public.requirement_codes (id, requirement_id, code, is_principal, sort_order) values (%s, v_req, %s, true, 1);"
                   % (L('rc-d1x-' + r['code']), L(r['code'])))
        out.append('  end if;')
    out += ['end;', '$$;', 'commit;']
    return '\n'.join(out) + '\n'


def main(argv):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    rows, skipped = read_rows(argv[1])
    sys.stdout.write(build_sql(rows))
    print('rows to import: %d' % len(rows), file=sys.stderr)
    for code, status in skipped:
        print('skipped #%s (%s)' % (code, status), file=sys.stderr)
    pms = sorted({r['pm'] for r in rows if r['pm']})
    print('PM contacts: %d -> %s' % (len(pms), ', '.join(pms)), file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
