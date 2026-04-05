import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Load .env file from the budgetsync-api directory
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

from .routers import (
    accounts_router,
    auth_router,
    bank_sync_router,
    budgets_router,
    dev_router,
    transactions_router,
    loans_router,
)
from .services.bank_sync import run_periodic_sync

app = FastAPI(title="BudgetSync API - MVP")

_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
_origins = [o.strip() for o in _raw.split(",") if o.strip()]

# In local development, frontend tooling may use either localhost or 127.0.0.1
# and may auto-select a different port if the preferred one is in use.
_local_origin_regex = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_local_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def on_startup():
    if not scheduler.running:
        scheduler.add_job(
            run_periodic_sync,
            "interval",
            hours=6,
            id="bank-sync-job",
            replace_existing=True,
        )
        scheduler.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


@app.get("/health")
async def health():
    return {"status": "ok"}


# include routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
app.include_router(accounts_router, prefix="/accounts", tags=["accounts"])
app.include_router(budgets_router, prefix="/budgets", tags=["budgets"])
app.include_router(bank_sync_router, prefix="/bank-sync", tags=["bank-sync"])
app.include_router(loans_router, prefix="/loans", tags=["loans"])
app.include_router(dev_router, prefix="/dev", tags=["dev"])
