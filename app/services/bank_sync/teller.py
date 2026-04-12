import logging
from datetime import date, datetime, timedelta
from typing import Any

import httpx

from app.config import get_settings
from app.exceptions import BankSyncError

logger = logging.getLogger(__name__)
settings = get_settings()

TELLER_BASE_URL = "https://api.teller.io"


class TellerClient:
    def __init__(self, access_token: str) -> None:
        self._access_token = access_token

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Basic {self._access_token}:"}

    async def get_accounts(self) -> list[dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{TELLER_BASE_URL}/accounts",
                    headers=self._headers(),
                    timeout=15.0,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error("Teller accounts fetch failed: %s", e, exc_info=True)
                raise BankSyncError(f"Teller API error: {e.response.status_code}")
            except httpx.RequestError as e:
                logger.error("Teller request error: %s", e, exc_info=True)
                raise BankSyncError("Teller unreachable")

    async def get_transactions(
        self, account_id: str, since: date | None = None
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if since:
            params["from_date"] = since.isoformat()

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{TELLER_BASE_URL}/accounts/{account_id}/transactions",
                    headers=self._headers(),
                    params=params,
                    timeout=30.0,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(
                    "Teller transactions fetch failed for account %s: %s",
                    account_id,
                    e,
                    exc_info=True,
                )
                raise BankSyncError(f"Teller API error: {e.response.status_code}")
            except httpx.RequestError as e:
                logger.error("Teller request error: %s", e, exc_info=True)
                raise BankSyncError("Teller unreachable")

    async def get_account_balance(self, account_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{TELLER_BASE_URL}/accounts/{account_id}/balances",
                    headers=self._headers(),
                    timeout=15.0,
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error("Teller balance fetch failed: %s", e, exc_info=True)
                raise BankSyncError(f"Teller API error: {e.response.status_code}")
            except httpx.RequestError as e:
                logger.error("Teller request error: %s", e, exc_info=True)
                raise BankSyncError("Teller unreachable")
