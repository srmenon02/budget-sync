from .auth import router as auth_router
from .transactions import router as transactions_router
from .accounts import router as accounts_router
from .budgets import router as budgets_router
from .bank_sync import router as bank_sync_router
from .dev import router as dev_router
from .loans import router as loans_router

__all__ = [
	"auth_router",
	"transactions_router",
	"accounts_router",
	"budgets_router",
	"bank_sync_router",
	"dev_router",
	"loans_router",
]
