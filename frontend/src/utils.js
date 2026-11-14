const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 }
const STATUS_ORDER = { pendiente: 0, en_proceso: 1, resuelto: 2 }

export function filterAndSortIssues(issues, filters) {
  const search = filters.search.trim().toLocaleLowerCase('es')
  const result = issues.filter(issue => {
    const text = [
      issue.titulo,
      issue.descripcion,
      issue.responsable,
      issue.aula_equipo,
    ].join(' ').toLocaleLowerCase('es')

    return text.includes(search) &&
      (filters.estado === 'todos' || issue.estado === filters.estado) &&
      (filters.prioridad === 'todas' || issue.prioridad === filters.prioridad)
  })

  return result.sort((first, second) => {
    switch (filters.orden) {
      case 'antiguas':
        return new Date(first.creado_en) - new Date(second.creado_en)
      case 'prioridad':
        return PRIORITY_ORDER[first.prioridad] - PRIORITY_ORDER[second.prioridad]
      case 'estado':
        return STATUS_ORDER[first.estado] - STATUS_ORDER[second.estado]
      case 'fecha_limite':
        return (first.fecha_limite || '9999-12-31').localeCompare(second.fecha_limite || '9999-12-31')
      default:
        return new Date(second.creado_en) - new Date(first.creado_en)
    }
  })
}

export function paginate(items, requestedPage, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const start = (page - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page,
    totalPages,
    totalItems: items.length,
  }
}

export function getApiError(body, fallback = 'No se pudo completar la solicitud.') {
  const fields = {}

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [field, value] of Object.entries(body)) {
      if (field === 'detail') continue
      const message = Array.isArray(value) ? value.find(item => typeof item === 'string') : null
      if (message) fields[field] = message
    }
  }

  const detail = body && typeof body === 'object' ? body.detail : null
  const message = typeof detail === 'string'
    ? detail
    : Object.values(fields)[0] || fallback

  return { message, fields }
}

export async function readApiError(response, fallback = 'No se pudo completar la solicitud.') {
  const text = await response.text()
  let body = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }
  }

  return getApiError(body, `${fallback} (HTTP ${response.status}).`)
}

export function getRequestError(error, fallback) {
  if (error instanceof TypeError) return 'No se pudo conectar con Django. Comprueba que el servidor esté activo.'
  return error.message || fallback
}
