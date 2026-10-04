/** In-memory library. Restarting the process restores the seed. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HttpError } from './errors.js';

const seedPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../seed/library.json',
);

export function encodeCursor(after) {
  return Buffer.from(`{"after": ${after}}`, 'utf8')
    .toString('base64')
    .replace(/=+$/, '');
}

export function decodeCursor(value) {
  try {
    if (!value || /\s/.test(value) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      throw new Error('bad cursor');
    }
    const stripped = value.replace(/=+$/, '');
    const padded = stripped + '='.repeat((4 - (stripped.length % 4)) % 4);
    const bytes = Buffer.from(padded, 'base64');
    const again = bytes.toString('base64').replace(/=+$/, '');
    if (again !== stripped) throw new Error('bad cursor');
    const data = JSON.parse(bytes.toString('utf8'));
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('bad cursor');
    }
    const after = data.after;
    if (typeof after !== 'number' || !Number.isInteger(after) || after < 0) {
      throw new Error('bad cursor');
    }
    return after;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'The cursor is not valid.');
  }
}

function sortBooks(books, sort) {
  const byTitle = (book) => book.title.toLowerCase();
  if (sort === 'id') books.sort((a, b) => a.id - b.id);
  else if (sort === '-id') books.sort((a, b) => b.id - a.id);
  else if (sort === 'title') {
    books.sort((a, b) => byTitle(a).localeCompare(byTitle(b)) || a.id - b.id);
  } else if (sort === '-title') {
    books.sort((a, b) => a.id - b.id);
    books.sort((a, b) => byTitle(b).localeCompare(byTitle(a)));
  } else if (sort === 'year') books.sort((a, b) => a.year - b.year || a.id - b.id);
  else if (sort === '-year') books.sort((a, b) => b.year - a.year || a.id - b.id);
}

export function pageMeta({ total, limit, offset, page }) {
  const meta = { total, limit, offset };
  if (page != null) {
    meta.page = page;
    meta.total_pages = limit ? Math.ceil(total / limit) : 0;
  }
  return meta;
}

class Store {
  constructor() {
    this.reset();
  }

  reset() {
    const data = JSON.parse(readFileSync(seedPath, 'utf8'));
    this.authors = new Map(data.authors.map((author) => [author.id, { ...author }]));
    this.books = new Map(data.books.map((book) => [book.id, { ...book }]));
    const ids = [...this.books.keys()];
    this.nextBookId = ids.length ? Math.max(...ids) + 1 : 1;
  }

  listAuthors() {
    return [...this.authors.keys()]
      .sort((a, b) => a - b)
      .map((id) => ({ ...this.authors.get(id) }));
  }

  getAuthor(authorId) {
    const author = this.authors.get(authorId);
    return author ? { ...author } : null;
  }

  getBook(bookId) {
    const book = this.books.get(bookId);
    return book ? { ...book } : null;
  }

  createBook({ title, author, year }) {
    const book = { id: this.nextBookId, title, author, year };
    this.books.set(book.id, book);
    this.nextBookId += 1;
    return { ...book };
  }

  replaceBook(bookId, { title, author, year }) {
    const book = { id: bookId, title, author, year };
    this.books.set(bookId, book);
    return { ...book };
  }

  updateBook(bookId, changes) {
    Object.assign(this.books.get(bookId), changes);
    return { ...this.books.get(bookId) };
  }

  deleteBook(bookId) {
    return this.books.delete(bookId);
  }

  listBooks({ author, sort, offset, limit }) {
    let rows = [...this.books.values()].map((book) => ({ ...book }));
    if (author != null) {
      const wanted = author.toLowerCase();
      rows = rows.filter((book) => book.author.toLowerCase() === wanted);
    }
    sortBooks(rows, sort);
    return { data: rows.slice(offset, offset + limit), total: rows.length };
  }

  feed({ limit, after }) {
    let ids = [...this.books.keys()].sort((a, b) => a - b);
    if (after != null) ids = ids.filter((id) => id > after);
    const window = ids.slice(0, limit + 1);
    const chosen = window.slice(0, limit);
    const data = chosen.map((id) => ({ ...this.books.get(id) }));
    const nextCursor = window.length > limit ? encodeCursor(chosen[chosen.length - 1]) : null;
    return { data, nextCursor };
  }
}

export const store = new Store();
