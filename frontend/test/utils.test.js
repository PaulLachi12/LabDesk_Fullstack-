import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { buildExcel } from '../src/excel.js'
import {
  filterAndSortIssues,
  getApiError,
  getRequestError,
  paginate,
  readApiError,
} from '../src/utils.js'

const issues = [
  {
    id: 1,
    titulo: 'Teclado',
    descripcion: 'Tecla rota',
    prioridad: 'baja',
    estado: 'resuelto',
    creado_en: '2026-11-12T10:00:00Z',
  },
  {
    id: 2,
    titulo: 'Wi-Fi',
    descripcion: 'Red lenta',
    prioridad: 'alta',
    estado: 'pendiente',
    creado_en: '2026-11-13T10:00:00Z',
    responsable: 'Ana',
    aula_equipo: 'Aula 2',
  },
]

test('filterAndSortIssues filters by assigned person and sorts by priority', () => {
  const result = filterAndSortIssues(issues, {
    search: 'ana',
    estado: 'todos',
    prioridad: 'todas',
    orden: 'prioridad',
  })

  assert.deepEqual(result.map(issue => issue.id), [2])
})

test('filterAndSortIssues filters by status and sorts by the nearest due date', () => {
  const result = filterAndSortIssues([
    { ...issues[0], estado: 'pendiente', fecha_limite: '2026-11-25' },
    { ...issues[1], fecha_limite: '2026-11-20' },
  ], {
    search: '',
    estado: 'pendiente',
    prioridad: 'todas',
    orden: 'fecha_limite',
  })

  assert.deepEqual(result.map(issue => issue.id), [2, 1])
})

test('paginate clamps the requested page after filters reduce the results', () => {
  const result = paginate(issues, 9, 1)

  assert.equal(result.page, 2)
  assert.equal(result.totalPages, 2)
  assert.deepEqual(result.items.map(issue => issue.id), [2])
})

test('buildExcel creates a readable workbook with filters, frozen headings and wrapped text', async () => {
  const issue = {
    ...issues[0],
    titulo: '=HYPERLINK("https://example.com","abrir")',
    descripcion: 'Detalle, con comas y texto largo. '.repeat(8),
    categoria: 'hardware',
    fecha_limite: '2026-11-20',
    creado_en: '2026-11-13T14:15:00-05:00',
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await buildExcel([issue]))

  const worksheet = workbook.getWorksheet('Incidencias')
  assert.equal(worksheet.getCell('A1').value, 'ID')
  assert.equal(worksheet.getCell('C1').value, 'Descripción')
  assert.equal(worksheet.getCell('D2').value, 'Hardware')
  assert.equal(worksheet.getCell('E2').value, 'Baja')
  assert.equal(worksheet.getCell('C2').value, issue.descripcion)
  assert.equal(worksheet.getCell('B2').value, issue.titulo)
  assert.equal(worksheet.getCell('B2').type, ExcelJS.ValueType.String)
  assert.equal(worksheet.getColumn(3).width, 54)
  assert.ok(worksheet.getRow(2).height > 26)
  assert.equal(worksheet.autoFilter, 'A1:J1')
  assert.equal(worksheet.views[0].state, 'frozen')
  assert.equal(worksheet.views[0].ySplit, 1)
})

test('getApiError exposes field validation messages', () => {
  assert.deepEqual(
    getApiError({ titulo: ['El título no puede estar vacío.'] }),
    {
      message: 'El título no puede estar vacío.',
      fields: { titulo: 'El título no puede estar vacío.' },
    },
  )
})

test('readApiError gives a useful message for non-JSON server errors', async () => {
  const response = new Response('<html>Server error</html>', { status: 500 })

  assert.deepEqual(
    await readApiError(response, 'No se pudo cargar.'),
    { message: 'No se pudo cargar. (HTTP 500).', fields: {} },
  )
})

test('getRequestError explains a network failure in Spanish', () => {
  assert.match(getRequestError(new TypeError('Failed to fetch'), 'No disponible'), /Comprueba que el servidor esté activo/)
})
