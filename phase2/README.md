# Phase 2

API keys, JWT bearer tokens, and rate limiting with CORS. Each topic is one server file. These servers do not import phase 1 and they do not share a lib. Open `service.py` or `service.js` and the routes, checks, and errors are all in that file.

FastAPI and Express use the same paths and status codes. Errors are `application/problem+json`.

| Topic | FastAPI | Express |
| --- | --- | --- |
| API keys | 8010 | 8011 |
| JWT | 8020 | 8021 |
| Rate limit and CORS | 8030 | 8031 |

Phase 1 can stay on 8000 and 8001 while these run.

## Install

Python 3.11 or newer, and Node 18 or newer.

```bash
cd phase2/fastapi
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cd ../express
npm install
```

## Run one file

```bash
cd phase2/fastapi/api-keys && ../.venv/bin/python service.py
cd phase2/express/api-keys && node service.js
```

The other topics are the same command from `jwt` or `rate-limit-cors`.

API key client, after that server is up. The Python client can also call Express by passing the Express URL.

```bash
cd phase2/fastapi/api-keys && ../.venv/bin/python client.py
cd phase2/fastapi/api-keys && ../.venv/bin/python client.py http://127.0.0.1:8011
cd phase2/express/api-keys && node client.js
```

The client calls `/v1/health` with no key, `/v1/admin/stats` with `demo-key-123`, then the same path with a bad key.

## Tests

Run the FastAPI tests as three commands. Each topic has a file named `service.py`, and one pytest process would import the wrong one.

```bash
cd phase2/fastapi
.venv/bin/python -m pytest api-keys/test_service.py
.venv/bin/python -m pytest jwt/test_service.py
.venv/bin/python -m pytest rate-limit-cors/test_service.py

cd ../express
npm test
```
