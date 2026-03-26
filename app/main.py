import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, accounts, transactions, budgets, goals, partnerships
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    start_scheduler()
    logger.info("BudgetSync API started")
    yield
    stop_scheduler()
    logger.info("BudgetSync API shutting down")


app = FastAPI(
    title="BudgetSync API",
    version="1.0.0",
    description="Personal budgeting with automatic bank sync and partner sharing",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(partnerships.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}