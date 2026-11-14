const COLUMNS = [
  { header: 'ID', key: 'id', width: 9 },
  { header: 'Título', key: 'titulo', width: 34 },
  { header: 'Descripción', key: 'descripcion', width: 54 },
  { header: 'Categoría', key: 'categoria', width: 20 },
  { header: 'Prioridad', key: 'prioridad', width: 14 },
  { header: 'Estado', key: 'estado', width: 16 },
  { header: 'Responsable', key: 'responsable', width: 24 },
  { header: 'Aula o equipo', key: 'aula_equipo', width: 25 },
  { header: 'Fecha límite', key: 'fecha_limite', width: 16 },
  { header: 'Fecha de creación', key: 'creado_en', width: 21 },
]

const LABELS = {
  categoria: { hardware: 'Hardware', software: 'Software', red: 'Red e internet' },
  prioridad: { alta: 'Alta', media: 'Media', baja: 'Baja' },
  estado: { pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto' },
}

function excelDate(value, dateOnly = false) {
  if (!value) return ''

  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return String(value)

  if (!dateOnly) date.setTime(date.getTime() - date.getTimezoneOffset() * 60_000)
  return date
}

function wrappedLines(value, width) {
  return String(value ?? '').split(/\r?\n/).reduce((count, line) => (
    count + Math.max(1, Math.ceil([...line].length / width))
  ), 0)
}

export async function buildExcel(issues) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LabDesk'
  workbook.title = 'Incidencias del laboratorio'
  workbook.subject = 'Registro de incidencias'

  const worksheet = workbook.addWorksheet('Incidencias', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 24 },
  })

  worksheet.columns = COLUMNS.map(({ header, key, width }) => ({
    header,
    key,
    width,
    style: { alignment: { vertical: 'top', wrapText: true } },
  }))

  worksheet.autoFilter = { from: 'A1', to: 'J1' }

  const rows = issues.map(issue => ({
    ...issue,
    categoria: LABELS.categoria[issue.categoria] ?? issue.categoria ?? '',
    prioridad: LABELS.prioridad[issue.prioridad] ?? issue.prioridad ?? '',
    estado: LABELS.estado[issue.estado] ?? issue.estado ?? '',
    fecha_limite: excelDate(issue.fecha_limite, true),
    creado_en: excelDate(issue.creado_en),
  }))
  worksheet.addRows(rows)

  const header = worksheet.getRow(1)
  header.height = 30
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3129' } }
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })

  worksheet.getColumn('fecha_limite').numFmt = 'dd/mm/yyyy'
  worksheet.getColumn('creado_en').numFmt = 'dd/mm/yyyy hh:mm'

  issues.forEach((issue, index) => {
    const row = worksheet.getRow(index + 2)
    const lines = Math.max(
      wrappedLines(issue.titulo, 32),
      wrappedLines(issue.descripcion, 52),
      wrappedLines(issue.responsable, 22),
      wrappedLines(issue.aula_equipo, 23),
    )
    row.height = Math.min(120, Math.max(26, lines * 15 + 10))
    row.eachCell(cell => {
      cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF242A28' } }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE8E9E3' } } }
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F7F3' } }
      }
    })

    const priority = row.getCell('prioridad')
    if (issue.prioridad === 'alta') {
      priority.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF984B35' } }
      priority.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0EA' } }
    } else if (issue.prioridad === 'media') {
      priority.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF765A1B' } }
      priority.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6E5' } }
    }

    const status = row.getCell('estado')
    if (issue.estado === 'resuelto') {
      status.font = { name: 'Aptos', size: 10, color: { argb: 'FF356343' } }
    } else if (issue.estado === 'en_proceso') {
      status.font = { name: 'Aptos', size: 10, color: { argb: 'FF3E6480' } }
    }
  })

  return workbook.xlsx.writeBuffer()
}
