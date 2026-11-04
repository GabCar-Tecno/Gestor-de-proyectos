import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from import_d1_excel import canonical_pm, map_status, parse_invoiced, sql_literal  # noqa: E402


class MapStatusTest(unittest.TestCase):
    def test_known_statuses(self):
        self.assertEqual(map_status('Producción'), 'produccion')
        self.assertEqual(map_status('Pruebas de usuario'), 'usuarios')
        self.assertEqual(map_status('Desarrollo'), 'desarrollo')
        self.assertEqual(map_status('Espera de Aprobación'), 'estimacion')

    def test_cancelled_is_skipped(self):
        self.assertIsNone(map_status('Cancelado'))


class CanonicalPmTest(unittest.TestCase):
    def test_aliases(self):
        self.assertEqual(canonical_pm('Gliseth Zulay Viloria C'), 'Zulay Viloria')
        self.assertEqual(canonical_pm('David Alexader Garcia'), 'David Alexander Garcia')

    def test_trims_and_collapses_spaces(self):
        self.assertEqual(canonical_pm('  Meyli   Herrera '), 'Meyli Herrera')


class ParseInvoicedTest(unittest.TestCase):
    def test_month_same_year(self):
        self.assertEqual(parse_invoiced('si-Abril', date(2026, 3, 13)), (True, '2026-04'))

    def test_month_rolls_to_next_year(self):
        self.assertEqual(parse_invoiced('si - Enero', date(2025, 12, 19)), (True, '2026-01'))

    def test_month_later_same_year(self):
        self.assertEqual(parse_invoiced('si- Noviembre', date(2025, 9, 17)), (True, '2025-11'))

    def test_abbreviated_month(self):
        self.assertEqual(parse_invoiced('si-feb', date(2025, 1, 8)), (True, '2025-02'))

    def test_empty_is_not_invoiced(self):
        self.assertEqual(parse_invoiced(None, date(2026, 1, 1)), (False, None))


class SqlLiteralTest(unittest.TestCase):
    def test_escapes_quotes_and_null(self):
        self.assertEqual(sql_literal("O'Neil"), "'O''Neil'")
        self.assertEqual(sql_literal(None), 'null')
        self.assertEqual(sql_literal(True), 'true')
        self.assertEqual(sql_literal(12.5), '12.5')
        self.assertEqual(sql_literal(date(2026, 4, 1)), "'2026-04-01'")


if __name__ == '__main__':
    unittest.main()
