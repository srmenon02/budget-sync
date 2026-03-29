import os
from datetime import UTC, datetime


class TellerSyncService:
    """Stubbed bank-sync facade for Teller integration during MVP scaffolding."""

    def __init__(self) -> None:
        self.app_id = os.getenv("TELLER_APP_ID", "")

    async def create_connect_token(self, user_id: str) -> dict[str, object]:
        now = datetime.now(UTC).isoformat()
        return {
            "provider": "teller",
            "connect_token": f"stub-{user_id}-{int(datetime.now(UTC).timestamp())}",
            "expires_in": 1800,
            "created_at": now,
            "is_stub": True,
        }

    async def sync_user_accounts(self, user_id: str) -> dict[str, object]:
        return {
            "status": "queued",
            "provider": "teller",
            "user_id": user_id,
            "is_stub": True,
        }


async def run_periodic_sync() -> dict[str, object]:
    """Periodic job stub run every 6 hours in MVP foundation phase."""
    now = datetime.now(UTC).isoformat()
    return {"status": "ok", "provider": "teller", "is_stub": True, "ran_at": now}
