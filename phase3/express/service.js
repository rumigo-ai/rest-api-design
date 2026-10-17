// Serve the design-first specs in Swagger UI.
//
//   node express/service.js
//
// Library docs:  http://127.0.0.1:8040/docs
// Auth docs:     http://127.0.0.1:8040/docs/auth
// Raw YAML:      http://127.0.0.1:8040/openapi/library.yaml
//                http://127.0.0.1:8040/openapi/auth.yaml
//
// Try it out on /docs calls the Library API at http://127.0.0.1:8000.
// Try it out on /docs/auth calls the JWT server at http://127.0.0.1:8020.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const openapiDir = path.join(here, "..", "openapi");
const port = 8040;

function readSpec(name) {
  const file = path.join(openapiDir, name);
  const text = fs.readFileSync(file, "utf8");
  return { file, text, spec: YAML.parse(text) };
}

const library = readSpec("library.yaml");
const auth = readSpec("auth.yaml");

const app = express();

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Phase 3 docs</title></head>
<body>
  <h1>Phase 3 docs</h1>
  <ul>
    <li><a href="/docs">Library API</a> (design-first, calls port 8000)</li>
    <li><a href="/docs/auth">Auth</a> (bearer token, calls port 8020)</li>
    <li><a href="/openapi/library.yaml">library.yaml</a></li>
    <li><a href="/openapi/auth.yaml">auth.yaml</a></li>
  </ul>
</body>
</html>`);
});

app.get("/openapi/library.yaml", (_req, res) => {
  res.type("yaml").send(library.text);
});

app.get("/openapi/auth.yaml", (_req, res) => {
  res.type("yaml").send(auth.text);
});

// Mount the longer path first. /docs would otherwise swallow /docs/auth.
app.use("/docs/auth", swaggerUi.serveFiles(auth.spec), swaggerUi.setup(auth.spec));
app.use("/docs", swaggerUi.serveFiles(library.spec), swaggerUi.setup(library.spec));

app.listen(port, "127.0.0.1", () => {
  console.log(`Phase 3 docs on http://127.0.0.1:${port}/docs`);
});
