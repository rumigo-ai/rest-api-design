/** Hand-written checks. FastAPI does the same work with Pydantic. */

import { HttpError } from './errors.js';

export const SORTS = ['id', '-id', 'title', '-title', 'year', '-year'];
export const SORT_DETAIL = 'Sort must be one of: id, -id, title, -title, year, -year';

const LIST_PARAMS = new Set(['author', 'sort', 'limit', 'offset', 'page', 'per_page']);
const FEED_PARAMS = new Set(['limit', 'cursor']);
const BOOK_FIELDS = ['title', 'author', 'year'];
const STRING_LIMITS = { title: 200, author: 100 };
const INT_PATTERN = /^-?\d{1,15}$/;

export function validateBook(body, { partial }) {
  const errors = [];
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return [{ pointer: '/', detail: 'Body must be an object' }];
  }

  for (const field of ['title', 'author']) {
    if (!Object.hasOwn(body, field)) {
      if (!partial) errors.push({ pointer: `/${field}`, detail: 'Field required' });
      continue;
    }
    const value = body[field];
    if (typeof value !== 'string') {
      errors.push({ pointer: `/${field}`, detail: 'Field must be a string' });
      continue;
    }
    if (value.length < 1) {
      errors.push({
        pointer: `/${field}`,
        detail: 'String should have at least 1 character',
      });
    } else if (value.length > STRING_LIMITS[field]) {
      errors.push({
        pointer: `/${field}`,
        detail: `String should have at most ${STRING_LIMITS[field]} characters`,
      });
    }
  }

  if (!Object.hasOwn(body, 'year')) {
    if (!partial) errors.push({ pointer: '/year', detail: 'Field required' });
  } else if (typeof body.year !== 'number' || !Number.isInteger(body.year)) {
    errors.push({ pointer: '/year', detail: 'Year must be an integer' });
  } else if (body.year < 1450 || body.year > 2100) {
    errors.push({ pointer: '/year', detail: 'Year must be between 1450 and 2100' });
  }

  for (const key of Object.keys(body)) {
    if (!BOOK_FIELDS.includes(key)) {
      errors.push({ pointer: `/${key}`, detail: 'Unknown field' });
    }
  }
  return errors;
}

export function changesFrom(body) {
  const changes = {};
  for (const field of BOOK_FIELDS) {
    if (Object.hasOwn(body, field)) changes[field] = body[field];
  }
  return changes;
}

export function readId(raw) {
  if (!/^\d{1,15}$/.test(raw)) {
    throw new HttpError(422, 'Your request is not valid.', [
      { pointer: '/id', detail: 'Id must be an integer' },
    ]);
  }
  return Number(raw);
}

function unknownParams(params, allowed, errors) {
  for (const key of Object.keys(params)) {
    if (!allowed.has(key)) {
      errors.push({ pointer: `/${key}`, detail: 'Unknown query parameter' });
    }
  }
}

function takeInt(params, key, { defaultValue, minimum, maximum, label, errors }) {
  if (!Object.hasOwn(params, key)) return defaultValue;
  const raw = params[key];
  const pointer = `/${key}`;
  if (typeof raw !== 'string' || !INT_PATTERN.test(raw)) {
    errors.push({ pointer, detail: `${label} must be an integer` });
    return defaultValue;
  }
  const value = Number(raw);
  if (maximum == null) {
    if (value < minimum) {
      errors.push({ pointer, detail: `${label} must be ${minimum} or greater` });
    }
  } else if (value < minimum || value > maximum) {
    errors.push({
      pointer,
      detail: `${label} must be between ${minimum} and ${maximum}`,
    });
  }
  return value;
}

export function parseListQuery(params, { allowAuthor = true } = {}) {
  const errors = [];
  const allowed = new Set(LIST_PARAMS);
  if (!allowAuthor) allowed.delete('author');
  unknownParams(params, allowed, errors);

  const pageStyle = Object.hasOwn(params, 'page') || Object.hasOwn(params, 'per_page');
  const offsetStyle = Object.hasOwn(params, 'offset') || Object.hasOwn(params, 'limit');
  if (pageStyle && offsetStyle) {
    throw new HttpError(422, 'Your request is not valid.', [
      {
        pointer: '/',
        detail: 'Use limit and offset, or page and per_page, not both.',
      },
    ]);
  }

  let author = null;
  if (allowAuthor && Object.hasOwn(params, 'author')) {
    author = params.author || '';
    if (author === '') author = null;
    else if (author.length > 100) {
      errors.push({
        pointer: '/author',
        detail: 'String should have at most 100 characters',
      });
    }
  }

  let sort = 'id';
  if (Object.hasOwn(params, 'sort')) {
    sort = params.sort || '';
    if (!SORTS.includes(sort)) {
      errors.push({ pointer: '/sort', detail: SORT_DETAIL });
    }
  }

  let page = null;
  let limit;
  let offset;
  if (pageStyle) {
    page = takeInt(params, 'page', {
      defaultValue: 1,
      minimum: 1,
      maximum: null,
      label: 'Page',
      errors,
    });
    limit = takeInt(params, 'per_page', {
      defaultValue: 10,
      minimum: 1,
      maximum: 50,
      label: 'Per page',
      errors,
    });
    offset = (page - 1) * limit;
  } else {
    limit = takeInt(params, 'limit', {
      defaultValue: 10,
      minimum: 1,
      maximum: 50,
      label: 'Limit',
      errors,
    });
    offset = takeInt(params, 'offset', {
      defaultValue: 0,
      minimum: 0,
      maximum: null,
      label: 'Offset',
      errors,
    });
  }

  if (errors.length) {
    throw new HttpError(422, 'Your request is not valid.', errors);
  }
  return { author, sort, limit, offset, page };
}

export function parseFeedQuery(params) {
  const errors = [];
  unknownParams(params, FEED_PARAMS, errors);
  const limit = takeInt(params, 'limit', {
    defaultValue: 10,
    minimum: 1,
    maximum: 50,
    label: 'Limit',
    errors,
  });
  if (errors.length) {
    throw new HttpError(422, 'Your request is not valid.', errors);
  }
  const cursor = Object.hasOwn(params, 'cursor') ? params.cursor : undefined;
  return { limit, cursor };
}
