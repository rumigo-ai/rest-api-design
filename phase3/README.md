# Phase 3

Postman tests, Newman, and OpenAPI for the Library API. The long narration is [phase3.txt](phase3.txt). Read a slide section, then do the example it names.

Phase 1 and Phase 2 stay as they are. This folder does not import them. The collections call those servers. The specs in `openapi/` are the design-first copy, including the reviews routes, which are not mounted yet.

| What | Where |
| --- | --- |
| Library API, FastAPI | http://127.0.0.1:8000 |
| Library API, Express | http://127.0.0.1:8001 |
| Code-first docs | http://127.0.0.1:8000/docs |
| JWT | http://127.0.0.1:8020 |
| Rate limit | http://127.0.0.1:8030 |
| Design-first docs | http://127.0.0.1:8040/docs and /docs/auth |

## Install

Node 18 or newer.

```bash
cd phase3
npm install
```

## Run the docs server

```bash
npm run docs
```

## Checks

Start the FastAPI Library API before `newman`. Start the JWT server before `newman:auth`. Restart the Library API before `newman` if you already created books. The pagination tests expect the 50-book seed. `newman:data` creates two books and leaves them.

```bash
npm run lint
npm run newman
npm run newman:express
npm run newman:bail
npm run newman:data
npm run newman:auth
```

The Rate limit folder is not in `newman:auth`. Restart the rate-limit server, then run that folder once from Postman.

Import `postman/library.postman_collection.json` and `postman/auth.postman_collection.json` into Postman. The request names in those files match the examples in phase3.txt.
