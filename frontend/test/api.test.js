import test from 'node:test'
import assert from 'node:assert/strict'
import { apiFetch } from '../src/api.js'

test('apiFetch includes session credentials and the CSRF cookie on mutations', async () => {
  const previousDocument = globalThis.document
  const previousFetch = globalThis.fetch
  globalThis.document = { cookie: 'csrftoken=csrf-token; sessionid=session-token' }
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/incidencias/')
    assert.equal(options.credentials, 'include')
    assert.equal(options.headers.get('X-CSRFToken'), 'csrf-token')
    return new Response(null, { status: 204 })
  }

  try {
    const response = await apiFetch('/api/incidencias/', { method: 'POST' })
    assert.equal(response.status, 204)
  } finally {
    globalThis.fetch = previousFetch
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})

test('apiFetch includes session credentials without a CSRF header on reads', async () => {
  const previousDocument = globalThis.document
  const previousFetch = globalThis.fetch
  globalThis.document = { cookie: 'csrftoken=csrf-token' }
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.credentials, 'include')
    assert.equal(options.headers.has('X-CSRFToken'), false)
    return new Response(null, { status: 204 })
  }

  try {
    await apiFetch('/api/incidencias/')
  } finally {
    globalThis.fetch = previousFetch
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  }
})
