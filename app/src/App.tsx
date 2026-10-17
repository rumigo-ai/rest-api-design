import { useEffect, useMemo, useState } from 'react'
import { findExample, groups, type Example, type Method } from './examples'

type ServerId = 'fastapi' | 'express'

type Draft = {
  method: Method
  path: string
  paramsText: string
}

type Health = 'checking' | 'up' | 'down'

type ResponseView = {
  status: number
  statusText: string
  ms: number
  headers: [string, string][]
  body: string
  error?: string
}

const servers: Record<ServerId, { label: string; port: number; proxy: string }> = {
  fastapi: { label: 'FastAPI', port: 8000, proxy: '/proxy/fastapi' },
  express: { label: 'Express', port: 8001, proxy: '/proxy/express' },
}

const methods: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function draftFrom(example: Example): Draft {
  return {
    method: example.method,
    path: example.path,
    paramsText: example.params,
  }
}

function parseParams(text: string): { query: Record<string, unknown>; body: unknown } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Params are not valid JSON.')
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Params must be an object with query and body.')
  }
  const record = value as Record<string, unknown>
  const query = record.query ?? {}
  if (query === null || typeof query !== 'object' || Array.isArray(query)) {
    throw new Error('query must be an object.')
  }
  return {
    query: query as Record<string, unknown>,
    body: Object.hasOwn(record, 'body') ? record.body : null,
  }
}

function requestTarget(path: string, query: Record<string, unknown>): { pathname: string; search: string } {
  const trimmed = path.trim()
  let pathname = '/'
  let search = ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed)
    pathname = url.pathname
    search = url.search
  } else {
    const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    const url = new URL(withSlash, 'http://local')
    pathname = url.pathname
    search = url.search
  }
  const params = new URLSearchParams(search)
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    params.set(key, String(value))
  }
  const next = params.toString()
  return { pathname, search: next ? `?${next}` : '' }
}

function pretty(text: string): string {
  if (!text) return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function statusClass(status: number): string {
  if (status === 0) return 'status-bad'
  if (status >= 200 && status < 300) return 'status-ok'
  if (status >= 400 && status < 500) return 'status-warn'
  return 'status-bad'
}

export default function App() {
  const [serverId, setServerId] = useState<ServerId>('fastapi')
  const [selectedId, setSelectedId] = useState(groups[0].examples[0].id)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [health, setHealth] = useState<Health>('checking')
  const [paramsError, setParamsError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<ResponseView | null>(null)

  const server = servers[serverId]
  const example = findExample(selectedId)
  const draft = drafts[selectedId] ?? draftFrom(example)

  const preview = useMemo(() => {
    try {
      const parsed = parseParams(draft.paramsText)
      const target = requestTarget(draft.path, parsed.query)
      return {
        href: `http://127.0.0.1:${server.port}${target.pathname}${target.search}`,
        error: null as string | null,
      }
    } catch (err) {
      return {
        href: `http://127.0.0.1:${server.port}${draft.path.startsWith('/') ? draft.path : `/${draft.path}`}`,
        error: err instanceof Error ? err.message : 'Params are not valid JSON.',
      }
    }
  }, [draft.path, draft.paramsText, server.port])

  useEffect(() => {
    let cancelled = false
    fetch(`${server.proxy}/v1/books/1`)
      .then((res) => {
        if (!cancelled) setHealth(res.ok ? 'up' : 'down')
      })
      .catch(() => {
        if (!cancelled) setHealth('down')
      })
    return () => {
      cancelled = true
    }
  }, [server])

  function updateDraft(patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [selectedId]: { ...draft, ...patch },
    }))
    setParamsError(null)
  }

  function resetExample() {
    setDrafts((current) => {
      const next = { ...current }
      delete next[selectedId]
      return next
    })
    setParamsError(null)
    setResponse(null)
  }

  async function send() {
    let parsed: { query: Record<string, unknown>; body: unknown }
    let target: { pathname: string; search: string }
    try {
      parsed = parseParams(draft.paramsText)
      target = requestTarget(draft.path, parsed.query)
    } catch (err) {
      setParamsError(err instanceof Error ? err.message : 'Params are not valid JSON.')
      return
    }
    setParamsError(null)
    const url = `${server.proxy}${target.pathname}${target.search}`
    const headers = new Headers()
    let body: string | undefined
    if (parsed.body !== null && parsed.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = typeof parsed.body === 'string' ? parsed.body : JSON.stringify(parsed.body)
    }

    setSending(true)
    const started = performance.now()
    try {
      const res = await fetch(url, { method: draft.method, headers, body })
      const text = await res.text()
      const headerPairs: [string, string][] = []
      res.headers.forEach((value, key) => {
        headerPairs.push([key, value])
      })
      setResponse({
        status: res.status,
        statusText: res.statusText,
        ms: Math.round(performance.now() - started),
        headers: headerPairs,
        body: pretty(text),
      })
      setHealth(res.status > 0 ? 'up' : 'down')
    } catch (err) {
      setHealth('down')
      setResponse({
        status: 0,
        statusText: 'Network error',
        ms: Math.round(performance.now() - started),
        headers: [],
        body: '',
        error:
          err instanceof Error
            ? `${err.message}. Start both servers with ./start_servers.sh from rest-api-session-1.`
            : 'The server did not answer.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Library API</h1>
          <p>Phase 1 examples</p>
          <a className="catalog-link" href="/test-book">50 books</a>
        </div>
        <div className="server-switch" role="group" aria-label="Server">
          {(Object.keys(servers) as ServerId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={id === serverId ? 'on' : ''}
              aria-pressed={id === serverId}
              onClick={() => {
                setServerId(id)
                setHealth('checking')
              }}
            >
              {servers[id].label}
              <span>:{servers[id].port}</span>
            </button>
          ))}
        </div>
        <p className={`health health-${health}`}>
          {health === 'checking' && 'Checking the server…'}
          {health === 'up' && `${server.label} is answering`}
          {health === 'down' && `${server.label} is not answering`}
        </p>
        <nav>
          {groups.map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              {group.blurb && <p className="blurb">{group.blurb}</p>}
              <ul>
                {group.examples.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={item.id === selectedId ? 'selected' : ''}
                      onClick={() => {
                        setSelectedId(item.id)
                        setParamsError(null)
                        setResponse(null)
                      }}
                    >
                      <span className={`verb verb-${item.method.toLowerCase()}`}>{item.method}</span>
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </aside>
      <main>
        <form
          className="request"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <header className="request-title">
            <h2>{example.title}</h2>
            <p className="expect">{example.expect}</p>
          </header>
          <div className="request-line">
            <select
              className={`method method-${draft.method.toLowerCase()}`}
              aria-label="Method"
              value={draft.method}
              onChange={(event) => updateDraft({ method: event.target.value as Method })}
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <input
              aria-label="Endpoint"
              value={draft.path}
              spellCheck={false}
              onChange={(event) => updateDraft({ path: event.target.value })}
            />
            <button type="submit" className="send" disabled={sending}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
          <p className="url">{preview.href}</p>
          <p className="explain">{example.explain}</p>
          <div className="params-head">
            <label htmlFor="params">Params</label>
            <button type="button" className="reset" onClick={resetExample}>
              Reset example
            </button>
          </div>
          <textarea
            id="params"
            value={draft.paramsText}
            spellCheck={false}
            onChange={(event) => updateDraft({ paramsText: event.target.value })}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                void send()
              }
            }}
          />
          {(paramsError || preview.error) && <p className="params-error">{paramsError || preview.error}</p>}
        </form>
        <section className="response" aria-live="polite">
          <h2>Response</h2>
          {!response && <p className="empty">Send a request to see the status, headers, and body.</p>}
          {response && (
            <>
              <div className="response-head">
                <span className={`status ${statusClass(response.status)}`}>
                  {response.status === 0 ? 'Failed' : `${response.status} ${response.statusText}`}
                </span>
                <span className="time">{response.ms} ms</span>
              </div>
              {response.error && <p className="params-error">{response.error}</p>}
              {response.headers.length > 0 && (
                <dl className="headers">
                  {response.headers.map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {response.body && <pre>{response.body}</pre>}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
