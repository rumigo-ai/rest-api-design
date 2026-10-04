# Library API

Phase 1 of the REST session: the same Library API in FastAPI and Express.

Both servers use the seed in [seed/library.json](seed/library.json). Book 1 is Dune. There are 50 books, so the next create is id 51 until you restart. Restarting clears anything you created. The rules both servers follow are in [CONTRACT.md](CONTRACT.md).

| | FastAPI | Express |
| --- | --- | --- |
| Port | 8000 | 8001 |
| Docs | http://127.0.0.1:8000/docs | http://127.0.0.1:8001/docs |
| Start | `uvicorn main:app --reload` | `npm start` |

Express `/docs` is a route list you can put on the projector. Full OpenAPI for Express is Phase 3. FastAPI generates `/docs` from the code.

Auth, rate limits, CORS, Postman, and OpenAPI are later phases. The decision-guide slides name 401, 403, and 429 now; the servers answer with the codes that have behavior in this phase: 200, 201, 204, 400, 404, and 422.

## Install

Python 3.11 or newer, and Node 18 or newer.

```bash
cd server/fastapi
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cd ../express
npm install
```

## Run

From this folder:

```bash
./start_servers.sh
```

Or by hand, in two terminals, which is what slide 22 shows:

```bash
cd server/fastapi && .venv/bin/uvicorn main:app --reload
cd server/express && npm start
```

Stop both:

```bash
./stop_servers.sh
```

Check a known book:

```bash
curl -i http://127.0.0.1:8000/v1/books/1
curl -i http://127.0.0.1:8001/v1/books/1
```

The narrated demo is [demos/live-demo.sh](demos/live-demo.sh). Run it once per server:

```bash
./demos/live-demo.sh
./demos/live-demo.sh http://127.0.0.1:8001
```

## Live client

[app](app) is a Postman-style page for the same examples. With the servers running:

```bash
cd app && pnpm dev
```

The switch at the top sends the call to FastAPI or Express. The browser talks to the Vite dev server, which proxies to port 8000 or 8001.

## Layout

Each server has the same three folders:

- `lib` is shared: errors, validation, and the in-memory store.
- `api` is the live endpoints. The route and the handler are in the same file. This is what the servers run.
- `worksheet` is the same endpoints with the example written in a comment and an empty function for the room to fill in. Those files are not imported.

Reviews are the exercise. `api/reviews.py` and `api/reviews.js` are finished and not mounted, so `POST /v1/books/1/reviews` is 404 until you wire that router in and restart. The stubs to fill in first are `worksheet/reviews.py` and `worksheet/reviews.js`.
