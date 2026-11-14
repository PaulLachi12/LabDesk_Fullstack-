import { useEffect, useMemo, useRef, useState } from 'react'
import {
  filterAndSortIssues,
  getRequestError,
  paginate,
  readApiError,
} from './utils.js'
import { buildExcel } from './excel.js'
import { apiFetch, AUTH_API, INCIDENCIAS_API } from './api.js'

const EMPTY_FORM = {
  titulo: '',
  descripcion: '',
  categoria: 'hardware',
  prioridad: 'media',
  estado: 'pendiente',
  responsable: '',
  aula_equipo: '',
  fecha_limite: '',
}
const PAGE_SIZE = 5

const ESTADOS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
}

const CATEGORIAS = {
  hardware: 'Hardware',
  software: 'Software',
  red: 'Red e internet',
}

const PRIORIDADES = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const ROLE_LABELS = {
  admin: 'Administración',
  support: 'Soporte',
  reporter: 'Solicitante',
}

function Icon({ name, size = 18 }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    edit: <><path d="m15 5 4 4M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function LoginScreen({ onAuthenticated, initialError }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function iniciarSesion(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch(`${AUTH_API}login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) {
        const apiError = await readApiError(response, 'No se pudo iniciar sesión.')
        throw new Error(apiError.message)
      }
      onAuthenticated(await response.json())
    } catch (e) {
      setError(getRequestError(e, 'No se pudo iniciar sesión.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-heading">
        <a className="brand auth-brand" href="#" aria-label="LabDesk, inicio">LabDesk</a>
        <p className="auth-kicker">Soporte de laboratorio</p>
        <h1 id="login-heading">Iniciar sesión</h1>
        <p className="auth-description">Accede con la cuenta que te proporcionó la administración.</p>
        {(error || initialError) && (
          <div className="auth-error" role="alert">{error || initialError}</div>
        )}
        <form className="auth-form" onSubmit={iniciarSesion}>
          <label htmlFor="login-username">Usuario</label>
          <input
            id="login-username"
            autoComplete="username"
            required
            value={username}
            onChange={event => setUsername(event.target.value)}
          />
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Verificando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="auth-footnote">Solicita una cuenta al administrador del sistema.</p>
      </section>
    </main>
  )
}

function formatCreatedAt(value) {
  if (!value) return 'Fecha no disponible'

  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDueDate(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function getLocalDate() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function ActivityPanel({ incidencia, onCommentAdded }) {
  const [actividades, setActividades] = useState([])
  const [detalle, setDetalle] = useState('')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const activityApi = `${INCIDENCIAS_API}${incidencia.id}/actividades/`

  async function cargarActividades() {
    setCargando(true)
    setError('')
    try {
      const response = await apiFetch(activityApi)
      if (!response.ok) throw new Error('No se pudo cargar el historial.')
      setActividades(await response.json())
    } catch (e) {
      setError(getRequestError(e, 'No se pudo conectar con Django.'))
    } finally {
      setCargando(false)
    }
  }

  async function publicarComentario(event) {
    event.preventDefault()
    setGuardando(true)
    setError('')
    try {
      const response = await apiFetch(activityApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detalle }),
      })
      if (!response.ok) {
        const apiError = await readApiError(response, 'No se pudo guardar el comentario.')
        throw new Error(apiError.message)
      }
      setDetalle('')
      await cargarActividades()
      onCommentAdded()
    } catch (e) {
      setError(getRequestError(e, 'No se pudo guardar el comentario.'))
    } finally {
      setGuardando(false)
    }
  }

  function alAbrir(event) {
    if (event.currentTarget.open && !cargando) cargarActividades()
  }

  return (
    <details className="activity-panel" onToggle={alAbrir}>
      <summary>Seguimiento e historial</summary>
      <div className="activity-content">
        <p className="activity-note">La actividad queda asociada a la cuenta que inició sesión.</p>
        {cargando && <p className="activity-message">Cargando historial…</p>}
        {!cargando && actividades.length === 0 && !error && (
          <p className="activity-message">Todavía no hay actividad registrada.</p>
        )}
        {actividades.length > 0 && (
          <ol className="activity-list">
            {actividades.map(item => (
              <li key={item.id}>
                <span className={`activity-marker activity-${item.tipo}`} />
                <div>
                  <p>{item.detalle}</p>
                  <span>{item.autor} · {formatCreatedAt(item.creado_en)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        {error && (
          <div className="activity-error" role="alert">
            <span>{error}</span>
            {!cargando && <button type="button" onClick={cargarActividades}>Reintentar</button>}
          </div>
        )}
        <form className="comment-form" onSubmit={publicarComentario}>
          <label>
            <span className="form-label">Nota de seguimiento</span>
            <textarea maxLength="2000" required rows="2" value={detalle} onChange={event => setDetalle(event.target.value)} />
          </label>
          <button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Añadir nota'}
          </button>
        </form>
      </div>
    </details>
  )
}

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [datos, setDatos] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editando, setEditando] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas')
  const [orden, setOrden] = useState('recientes')
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(true)
  const [apiDisponible, setApiDisponible] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [accionId, setAccionId] = useState(null)
  const searchRef = useRef(null)

  async function cargar() {
    setCargando(true)
    try {
      const respuesta = await apiFetch(INCIDENCIAS_API)
      if (!respuesta.ok) {
        const apiError = await readApiError(respuesta, 'No se pudo consultar la API.')
        throw new Error(apiError.message)
      }
      const issues = await respuesta.json()
      if (!Array.isArray(issues)) throw new Error('La API devolvió un formato inesperado.')
      setDatos(issues)
      setApiDisponible(true)
      setError('')
      return true
    } catch (e) {
      setApiDisponible(false)
      setError(getRequestError(e, 'No se pudo conectar con Django.'))
      return false
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    let active = true
    async function recuperarSesion() {
      try {
        const csrfResponse = await apiFetch(`${AUTH_API}csrf/`)
        if (!csrfResponse.ok) throw new Error('No se pudo preparar la sesión segura.')

        const response = await apiFetch(`${AUTH_API}me/`)
        if (response.status === 204 || response.status === 401 || response.status === 403) return
        if (!response.ok) throw new Error('No se pudo consultar la sesión.')
        if (active) setUsuario(await response.json())
      } catch (e) {
        if (active) setAuthError(getRequestError(e, 'No se pudo consultar la sesión.'))
      } finally {
        if (active) setAuthReady(true)
      }
    }
    recuperarSesion()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (usuario) cargar()
    else setDatos([])
  }, [usuario])

  useEffect(() => {
    function atajoTeclado(event) {
      const escribiendo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (event.key === '/' && !escribiendo) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        setBusqueda('')
      }
    }
    window.addEventListener('keydown', atajoTeclado)
    return () => window.removeEventListener('keydown', atajoTeclado)
  }, [])

  function cambiar(e) {
    setForm(actual => ({ ...actual, [e.target.name]: e.target.value }))
    setFieldErrors(actual => ({ ...actual, [e.target.name]: '' }))
  }

  function reportarError(error, fallback) {
    if (error instanceof TypeError) setApiDisponible(false)
    setError(getRequestError(error, fallback))
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setAviso('')
    setFieldErrors({})

    try {
      const url = editando === null ? INCIDENCIAS_API : `${INCIDENCIAS_API}${editando}/`
      const respuesta = await apiFetch(url, {
        method: editando === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!respuesta.ok) {
        const apiError = await readApiError(respuesta, 'No se guardó. Revisa los datos.')
        setFieldErrors(apiError.fields)
        throw new Error(apiError.message)
      }
      const mensaje = editando === null ? 'Incidencia creada correctamente.' : 'Cambios guardados correctamente.'
      cancelar()
      await cargar()
      setAviso(mensaje)
    } catch (e) {
      reportarError(e, 'No se pudo guardar la incidencia.')
    } finally {
      setGuardando(false)
    }
  }

  function editar(item) {
    setEditando(item.id)
    setForm({
      titulo: item.titulo,
      descripcion: item.descripcion,
      categoria: item.categoria,
      prioridad: item.prioridad,
      estado: item.estado,
      responsable: item.responsable || '',
      aula_equipo: item.aula_equipo || '',
      fecha_limite: item.fecha_limite || '',
    })
    document.getElementById('issue-title')?.focus({ preventScroll: true })
    document.getElementById('issue-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function cancelar() {
    setEditando(null)
    setForm({ ...EMPTY_FORM })
    setFieldErrors({})
  }

  async function actualizarEstado(id, estado) {
    setAccionId(id)
    try {
      const respuesta = await apiFetch(`${INCIDENCIAS_API}${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (!respuesta.ok) {
        const apiError = await readApiError(respuesta, 'No se pudo actualizar el estado.')
        throw new Error(apiError.message)
      }
      await cargar()
      setAviso('Estado actualizado.')
    } catch (e) {
      reportarError(e, 'No se pudo actualizar el estado.')
    } finally {
      setAccionId(null)
    }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta incidencia? Esta acción no se puede deshacer.')) return

    setAccionId(id)
    try {
      const respuesta = await apiFetch(`${INCIDENCIAS_API}${id}/`, {
        method: 'DELETE',
      })
      if (!respuesta.ok) throw new Error('No se pudo eliminar la incidencia.')
      await cargar()
      if (editando === id) cancelar()
      setAviso('Incidencia eliminada.')
    } catch (e) {
      reportarError(e, 'No se pudo eliminar la incidencia.')
    } finally {
      setAccionId(null)
    }
  }

  const filtrados = useMemo(
    () => filterAndSortIssues(datos, {
      search: busqueda,
      estado: filtroEstado,
      prioridad: filtroPrioridad,
      orden,
    }),
    [datos, busqueda, filtroEstado, filtroPrioridad, orden],
  )
  const paginaActual = useMemo(() => paginate(filtrados, pagina, PAGE_SIZE), [filtrados, pagina])
  const rangoInicial = filtrados.length === 0 ? 0 : (paginaActual.page - 1) * PAGE_SIZE + 1
  const rangoFinal = Math.min(paginaActual.page * PAGE_SIZE, filtrados.length)

  const pendientes = datos.filter(item => item.estado === 'pendiente').length
  const enProceso = datos.filter(item => item.estado === 'en_proceso').length
  const resueltas = datos.filter(item => item.estado === 'resuelto').length
  const fechaHoy = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  async function cerrarSesion() {
    try {
      const response = await apiFetch(`${AUTH_API}logout/`, { method: 'POST' })
      if (!response.ok) {
        const apiError = await readApiError(response, 'No se pudo cerrar sesión.')
        throw new Error(apiError.message)
      }
      setUsuario(null)
      setApiDisponible(false)
      setAviso('')
      setError('')
    } catch (e) {
      setAuthError(getRequestError(e, 'No se pudo cerrar sesión.'))
    }
  }

  async function exportarExcel() {
    setExportando(true)
    setError('')
    setAviso('')
    try {
      const buffer = await buildExcel(filtrados)
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const date = new Date()
      const localDate = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-')
      link.href = url
      link.download = `labdesk-incidencias-${localDate}.xlsx`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setAviso(`Archivo Excel listo con ${filtrados.length} incidencias.`)
    } catch (e) {
      setError(e instanceof Error
        ? `No se pudo generar el archivo Excel: ${e.message}`
        : 'No se pudo generar el archivo Excel.')
    } finally {
      setExportando(false)
    }
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroEstado('todos')
    setFiltroPrioridad('todas')
    setOrden('recientes')
    setPagina(1)
  }

  if (!authReady) {
    return <main className="auth-page"><p role="status">Comprobando sesión…</p></main>
  }

  if (!usuario) {
    return (
      <LoginScreen
        initialError={authError}
        onAuthenticated={account => {
          setAuthError('')
          setUsuario(account)
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="LabDesk, inicio">LabDesk</a>

        <nav className="main-nav" aria-label="Navegación principal">
          <p className="sidebar-label">Laboratorio</p>
          <a className="nav-item active" href="#issues-heading" aria-current="page">
            <span>Incidencias</span>
            <span className="nav-count">{datos.length}</span>
          </a>
          <a className="nav-item" href="#issue-form">
            <span>Reportar incidencia</span>
          </a>
        </nav>

        <div className="sidebar-account">
          <strong>{usuario.name}</strong>
          <span>{ROLE_LABELS[usuario.role] || 'Solicitante'}</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Laboratorio</span><i>/</i><strong>Incidencias</strong></div>
          <div className="topbar-status">
            <span className="today">{fechaHoy}</span>
            <button className="logout-button" type="button" onClick={cerrarSesion}>Cerrar sesión</button>
          </div>
        </header>

        <div className="page-content">
          <section className="intro">
            <div className="intro-copy">
              <h1>Incidencias</h1>
              <p className="intro-description">Consulta y actualiza los reportes del laboratorio.</p>
            </div>
            <button
              className="primary-button new-issue-button"
              type="button"
              onClick={() => document.getElementById('issue-title')?.focus()}
            >
              Nueva incidencia
            </button>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {!apiDisponible && <button className="retry-button" type="button" disabled={cargando} onClick={cargar}>{cargando ? 'Conectando…' : 'Reintentar'}</button>}
              <button type="button" aria-label="Cerrar aviso" onClick={() => setError('')}><Icon name="close" size={16} /></button>
            </div>
          )}
          {aviso && (
            <div className="success-banner" role="status">
              <span>{aviso}</span>
              <button type="button" aria-label="Cerrar aviso" onClick={() => setAviso('')}><Icon name="close" size={16} /></button>
            </div>
          )}

          <div className="work-area">
            <section className="issues-panel" aria-labelledby="issues-heading">
              <div className="section-heading">
                <div>
                  <h2 id="issues-heading">Registro</h2>
                  <p className="section-description">
                    {filtrados.length} {filtrados.length === 1 ? 'incidencia' : 'incidencias'}
                  </p>
                </div>
                <div className="section-actions">
                  <button className="export-button" type="button" onClick={exportarExcel} disabled={filtrados.length === 0 || exportando}>
                    {exportando ? 'Preparando Excel…' : 'Exportar Excel'}
                  </button>
                </div>
              </div>

              <div className="status-filters" role="group" aria-label="Filtrar por estado">
                {[
                  ['todos', 'Todas', datos.length],
                  ['pendiente', 'Pendientes', pendientes],
                  ['en_proceso', 'En proceso', enProceso],
                  ['resuelto', 'Resueltas', resueltas],
                ].map(([value, label, count]) => (
                  <button
                    className={filtroEstado === value ? 'status-filter active' : 'status-filter'}
                    type="button"
                    key={value}
                    aria-pressed={filtroEstado === value}
                    onClick={() => { setFiltroEstado(value); setPagina(1) }}
                  >
                    {label} <span>{count}</span>
                  </button>
                ))}
              </div>

              <div className="filters">
                <label className="search-field">
                  <Icon name="search" size={17} />
                  <input
                    ref={searchRef}
                    type="search"
                    aria-label="Buscar incidencias"
                    aria-describedby="search-hint"
                    placeholder="Buscar incidencias"
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
                  />
                  <span className="sr-only" id="search-hint">También puedes pulsar la tecla diagonal para enfocar la búsqueda.</span>
                </label>
                <label className="select-field" aria-label="Filtrar por prioridad">
                  <select value={filtroPrioridad} onChange={e => { setFiltroPrioridad(e.target.value); setPagina(1) }}>
                    <option value="todas">Toda prioridad</option>
                    <option value="alta">Prioridad alta</option>
                    <option value="media">Prioridad media</option>
                    <option value="baja">Prioridad baja</option>
                  </select>
                </label>
                <label className="select-field" aria-label="Ordenar incidencias">
                  <select value={orden} onChange={e => { setOrden(e.target.value); setPagina(1) }}>
                    <option value="recientes">Más recientes</option>
                    <option value="antiguas">Más antiguas</option>
                    <option value="prioridad">Prioridad alta primero</option>
                    <option value="estado">Ordenar por estado</option>
                    <option value="fecha_limite">Fecha límite próxima</option>
                  </select>
                </label>
              </div>

              <div className="issue-columns" aria-hidden="true">
                <span>Incidencia</span>
                <span>Prioridad</span>
                <span>Estado</span>
                <span>Responsable</span>
                <span />
              </div>

              <div className="issue-list" aria-live="polite" aria-busy={cargando}>
                {cargando ? (
                  <div className="list-message"><span className="loader" /> Cargando incidencias...</div>
                ) : filtrados.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon"><Icon name={busqueda || filtroEstado !== 'todos' || filtroPrioridad !== 'todas' ? 'search' : 'check'} size={21} /></span>
                    <strong>{datos.length === 0 ? 'No hay incidencias.' : 'No hay coincidencias.'}</strong>
                    <p>{datos.length === 0 ? 'Crea un reporte para empezar.' : 'Prueba con otros términos o filtros.'}</p>
                    {datos.length > 0 && (
                    <button type="button" className="text-button" onClick={limpiarFiltros}>
                        Limpiar filtros <Icon name="arrow" size={15} />
                      </button>
                    )}
                  </div>
              ) : paginaActual.items.map(item => (
                  <article className="issue-item" key={item.id}>
                    <div className="issue-main">
                      <div className="issue-title-line">
                        <h3>{item.titulo}</h3>
                      </div>
                      <p className="issue-description">{item.descripcion}</p>
                      <div className="issue-meta">
                        <span>{CATEGORIAS[item.categoria] || item.categoria}</span>
                        <span className="meta-separator" />
                        <span>#{String(item.id).padStart(3, '0')}</span>
                        <span className="meta-separator" />
                        <span>{formatCreatedAt(item.creado_en)}</span>
                        {item.aula_equipo && <><span className="meta-separator" /><span>{item.aula_equipo}</span></>}
                        {item.fecha_limite && (
                          <span className={`due-date ${item.fecha_limite < getLocalDate() && item.estado !== 'resuelto' ? 'overdue' : ''}`}>
                            Límite: {formatDueDate(item.fecha_limite)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="issue-priority">
                      <span className={`priority-label ${item.prioridad}`}>{PRIORIDADES[item.prioridad] || item.prioridad}</span>
                    </div>
                    <div className="issue-state">
                      <label className={`state-select state-${item.estado}`}>
                        <select
                          aria-label={`Estado de ${item.titulo}`}
                          value={item.estado}
                          disabled={accionId === item.id}
                          onChange={e => actualizarEstado(item.id, e.target.value)}
                        >
                          {Object.entries(ESTADOS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="issue-assignee">{item.responsable || 'Sin asignar'}</div>
                    <div className="issue-controls">
                      <button className="icon-button" type="button" aria-label={`Editar ${item.titulo}`} onClick={() => editar(item)}>
                        <Icon name="edit" size={16} />
                      </button>
                      {usuario.role === 'admin' && (
                        <button className="icon-button delete-button" type="button" aria-label={`Eliminar ${item.titulo}`} disabled={accionId === item.id} onClick={() => eliminar(item.id)}>
                          <Icon name="trash" size={16} />
                        </button>
                      )}
                    </div>
                    <ActivityPanel incidencia={item} onCommentAdded={() => setAviso('Nota de seguimiento guardada.')} />
                  </article>
                ))}
              </div>

              {!cargando && filtrados.length > 0 && (
                <nav className="pagination" aria-label="Paginación de incidencias">
                  <span>Mostrando {rangoInicial}–{rangoFinal} de {filtrados.length}</span>
                  <div>
                    <button type="button" disabled={paginaActual.page <= 1} onClick={() => setPagina(paginaActual.page - 1)} aria-label="Página anterior">Anterior</button>
                    <span aria-live="polite">Página {paginaActual.page} de {paginaActual.totalPages}</span>
                    <button type="button" disabled={paginaActual.page >= paginaActual.totalPages} onClick={() => setPagina(paginaActual.page + 1)} aria-label="Página siguiente">Siguiente</button>
                  </div>
                </nav>
              )}

              <div className="list-foot">
                <span>Los cambios se guardan al confirmar cada acción.</span>
              </div>
            </section>

            <aside className="form-column">
              <section className="form-panel" id="issue-form" aria-labelledby="form-heading">
                <div className="form-heading">
                  <span className="form-icon"><Icon name={editando === null ? 'plus' : 'edit'} size={18} /></span>
                  <div>
                    <p className="section-kicker">{editando === null ? 'Nuevo reporte' : `Editando #${String(editando).padStart(3, '0')}`}</p>
                    <h2 id="form-heading">{editando === null ? 'Reportar incidencia' : 'Actualizar incidencia'}</h2>
                  </div>
                  {editando !== null && <button className="icon-button form-close" type="button" aria-label="Cancelar edición" onClick={cancelar}><Icon name="close" size={16} /></button>}
                </div>

                <form onSubmit={guardar}>
                  <label className="form-label" htmlFor="issue-title">Título <span>Obligatorio</span></label>
                  <input
                    id="issue-title"
                    required
                    maxLength="120"
                    name="titulo"
                    aria-invalid={Boolean(fieldErrors.titulo)}
                    aria-describedby={fieldErrors.titulo ? 'title-error' : undefined}
                    value={form.titulo}
                    onChange={cambiar}
                    placeholder="Ej. El equipo no enciende"
                  />
                  {fieldErrors.titulo && <span className="field-error" id="title-error" role="alert">{fieldErrors.titulo}</span>}

                  <label className="form-label" htmlFor="issue-description">Descripción <span>Obligatorio</span></label>
                  <textarea
                    id="issue-description"
                    required
                    name="descripcion"
                    aria-invalid={Boolean(fieldErrors.descripcion)}
                    aria-describedby={fieldErrors.descripcion ? 'description-error' : undefined}
                    rows="3"
                    value={form.descripcion}
                    onChange={cambiar}
                    placeholder="Añade un detalle que ayude a resolverlo."
                  />
                  {fieldErrors.descripcion && <span className="field-error" id="description-error" role="alert">{fieldErrors.descripcion}</span>}

                  <div className="form-row">
                    <label>
                      <span className="form-label">Categoría</span>
                      <select name="categoria" value={form.categoria} onChange={cambiar}>
                        <option value="hardware">Hardware</option>
                        <option value="software">Software</option>
                        <option value="red">Red e internet</option>
                      </select>
                    </label>
                    <label>
                      <span className="form-label">Prioridad</span>
                      <select name="prioridad" value={form.prioridad} onChange={cambiar}>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </label>
                  </div>

                  <label className="form-label" htmlFor="issue-state">Estado</label>
                  <select id="issue-state" name="estado" value={form.estado} onChange={cambiar}>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En proceso</option>
                    <option value="resuelto">Resuelto</option>
                  </select>

                  <label className="form-label" htmlFor="issue-assignee">Responsable</label>
                  <input id="issue-assignee" name="responsable" maxLength="80" value={form.responsable} onChange={cambiar} placeholder="Persona encargada (opcional)" />

                  <label className="form-label" htmlFor="issue-location">Aula o equipo</label>
                  <input id="issue-location" name="aula_equipo" maxLength="100" value={form.aula_equipo} onChange={cambiar} placeholder="Ej. Aula 2 · PC 04" />

                  <label className="form-label" htmlFor="issue-due-date">Fecha límite</label>
                  <input id="issue-due-date" name="fecha_limite" type="date" value={form.fecha_limite} onChange={cambiar} />

                  <button className="submit-button" type="submit" disabled={guardando}>
                    <span>{guardando ? 'Guardando...' : editando === null ? 'Crear incidencia' : 'Guardar cambios'}</span>
                    {!guardando && <Icon name={editando === null ? 'plus' : 'check'} size={17} />}
                  </button>
                  {editando !== null && <button className="cancel-button" type="button" onClick={cancelar}>Cancelar edición</button>}
                </form>

                <div className="form-footnote"><span className="footnote-mark">i</span> Los cambios se guardan en la base de datos del laboratorio.</div>
              </section>

            </aside>
          </div>

          <footer className="page-footer">LabDesk · Soporte de laboratorio</footer>
        </div>
      </main>
    </div>
  )
}
