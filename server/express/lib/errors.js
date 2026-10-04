/** RFC 9457 problem+json. Same titles as the FastAPI app. */

export const TITLES = {
  400: 'Bad Request',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Content',
  500: 'Internal Server Error',
};

export class HttpError extends Error {
  constructor(status, detail, errors = null) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

export function sendProblem(res, status, detail, errors = null) {
  const body = {
    type: 'about:blank',
    title: TITLES[status] || 'Error',
    status,
    detail,
  };
  if (errors && errors.length) {
    body.errors = errors;
  }
  res.status(status).type('application/problem+json').json(body);
}
