import { useEffect, useState } from 'react'
import './test-books.css'

type ServerId = 'fastapi' | 'express'

type Book = {
  id: number
  title: string
  author: string
  year: number
}

type Meta = {
  total: number
  limit: number
  offset: number
  page: number
  total_pages: number
}

const servers: Record<ServerId, { label: string; port: number; proxy: string }> = {
  fastapi: { label: 'FastAPI', port: 8000, proxy: '/proxy/fastapi' },
  express: { label: 'Express', port: 8001, proxy: '/proxy/express' },
}

const perPageChoices = [5, 10, 20, 25, 50]

export default function TestBooks() {
  const [serverId, setServerId] = useState<ServerId>('fastapi')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [books, setBooks] = useState<Book[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const server = servers[serverId]
  const totalPages = meta?.total_pages ?? 1
  const pageChoices = Array.from({ length: Math.max(totalPages, 1) }, (_, index) => index + 1)

  useEffect(() => {
    const url = `${server.proxy}/v1/books?page=${page}&per_page=${perPage}`
    const controller = new AbortController()
    let cancelled = false
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const text = await res.text()
        if (!res.ok) throw new Error(text || `${res.status} ${res.statusText}`)
        return JSON.parse(text) as { data: Book[]; meta: Meta }
      })
      .then((body) => {
        if (cancelled) return
        setBooks(body.data)
        setMeta(body.meta)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setBooks([])
        setMeta(null)
        setError(err instanceof Error ? err.message : 'The catalog did not load.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [server.proxy, page, perPage])

  function choosePerPage(next: number) {
    setLoading(true)
    setPerPage(next)
    setPage(1)
  }

  function choosePage(next: number) {
    setLoading(true)
    setPage(next)
  }

  const from = meta && books.length ? meta.offset + 1 : 0
  const to = meta ? meta.offset + books.length : 0
  const offset = (page - 1) * perPage

  return (
    <div className="catalog">
      <header className="catalog-bar">
        <div>
          <p className="catalog-kicker">Page-number pagination</p>
          <h1>{meta ? `${meta.total} books` : 'Books'}</h1>
        </div>
        <a href="/">Back to the client</a>
      </header>

      <section className="catalog-controls">
        <div className="server-switch" role="group" aria-label="Server">
          {(Object.keys(servers) as ServerId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={id === serverId ? 'on' : ''}
              aria-pressed={id === serverId}
              onClick={() => {
                setLoading(true)
                setServerId(id)
                setPage(1)
              }}
            >
              {servers[id].label}
              <span>:{servers[id].port}</span>
            </button>
          ))}
        </div>

        <label>
          Books per page
          <select
            value={perPage}
            onChange={(event) => choosePerPage(Number(event.target.value))}
          >
            {perPageChoices.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <label>
          Page
          <select value={page} onChange={(event) => choosePage(Number(event.target.value))}>
            {pageChoices.map((number) => (
              <option key={number} value={number}>
                {number}
              </option>
            ))}
          </select>
        </label>

        <p className="catalog-summary">
          {loading
            ? 'Loading the catalog…'
            : meta
              ? `Showing ${from}–${to} of ${meta.total}. Page ${meta.page} of ${meta.total_pages}.`
              : 'No page loaded.'}
        </p>
      </section>

      <p className="catalog-url">
        http://127.0.0.1:{server.port}/v1/books?page={page}&per_page={perPage}
        <span>offset = ({page} − 1) × {perPage} = {offset}</span>
      </p>

      {error && <p className="catalog-error">{error}</p>}

      <ul className="catalog-grid">
        {books.map((book) => (
          <li key={book.id}>
            <span className="catalog-id">{book.id}</span>
            <h2>{book.title}</h2>
            <p>{book.author}</p>
            <p className="catalog-year">{book.year}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
