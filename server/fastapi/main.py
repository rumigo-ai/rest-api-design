"""Library API entrypoint. Run: uvicorn main:app --reload"""

from fastapi import FastAPI

from lib.errors import install_exception_handlers
from api.authors import router as authors_router
from api.books import router as books_router
from api.feed import router as feed_router
from api.v2 import router as v2_router

app = FastAPI(
    title="Library API",
    version="1.0.0",
    description=(
        "Phase 1 of the REST session. Books, authors, and a cursor feed. "
        "Errors use application/problem+json. The Express app on port 8001 "
        "implements this same contract."
    ),
)

install_exception_handlers(app)
app.include_router(books_router)
app.include_router(authors_router)
app.include_router(feed_router)
app.include_router(v2_router)
