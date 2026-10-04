# Library session client

Postman-style page for the Phase 1 examples. It talks to FastAPI on port 8000 and Express on port 8001 through the Vite proxy, because those servers do not send CORS headers yet.

Start the APIs from the parent folder (`./start_servers.sh`), then:

```bash
pnpm dev
```

Open the URL Vite prints. The sidebar is the worksheet examples. Edit the path and the params JSON, then Send. Reset example restores the saved call. The switch at the top chooses FastAPI or Express.
