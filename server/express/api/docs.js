import { Router } from 'express';

export const docsRouter = Router();

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Library API — Express</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 2rem auto; max-width: 46rem; padding: 0 1rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #8884; vertical-align: top; }
    h1 { font-size: 1.6rem; }
  </style>
</head>
<body>
  <h1>Library API <small>Express · port 8001</small></h1>
  <p>Phase 1 contract. The FastAPI app on port 8000 serves the same routes, with generated docs at <code>/docs</code>. OpenAPI for this server comes in Phase 3.</p>
  <table>
    <thead><tr><th>Method</th><th>Path</th><th>What it does</th></tr></thead>
    <tbody>
      <tr><td>GET</td><td><code>/v1/books</code></td><td>List books. <code>limit</code>/<code>offset</code> or <code>page</code>/<code>per_page</code>. Optional <code>author</code>, <code>sort</code>.</td></tr>
      <tr><td>POST</td><td><code>/v1/books</code></td><td>Create a book. 201 and a Location header.</td></tr>
      <tr><td>GET</td><td><code>/v1/books/{id}</code></td><td>Read one book.</td></tr>
      <tr><td>PUT</td><td><code>/v1/books/{id}</code></td><td>Replace every field. A missing field is 422.</td></tr>
      <tr><td>PATCH</td><td><code>/v1/books/{id}</code></td><td>Change only the fields you send.</td></tr>
      <tr><td>DELETE</td><td><code>/v1/books/{id}</code></td><td>204, then 404 if you delete it again.</td></tr>
      <tr><td>GET</td><td><code>/v1/authors</code></td><td>Author catalog.</td></tr>
      <tr><td>GET</td><td><code>/v1/authors/{id}</code></td><td>One author.</td></tr>
      <tr><td>GET</td><td><code>/v1/authors/{id}/books</code></td><td>That author's books. Same list query, without <code>author</code>.</td></tr>
      <tr><td>GET</td><td><code>/v1/feed/books</code></td><td>Cursor feed. <code>limit</code> and opaque <code>cursor</code>.</td></tr>
      <tr><td>GET</td><td><code>/v2/books</code></td><td>Same list as v1, each book adds <code>links.self</code>. v1 does not change.</td></tr>
      <tr><td>GET</td><td><code>/v2/books/{id}</code></td><td>Same book as v1, plus <code>links.self</code>.</td></tr>
      <tr><td>POST</td><td><code>/v1/books/{id}</code></td><td>405. Create with POST <code>/v1/books</code>. Allow lists the real methods.</td></tr>
    </tbody>
  </table>
  <p>Errors are <code>application/problem+json</code>. Limit defaults to 10 and cannot be more than 50.</p>
</body>
</html>`;

docsRouter.get('/docs', (_req, res) => {
  res.type('html').send(page);
});
