from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import CurrentUser, get_current_user, get_db
from ..services.bank_sync import TellerSyncService

router = APIRouter()
service = TellerSyncService()


@router.post("/connect-token")
async def create_connect_token(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    return await service.create_connect_token(current_user["user_id"])


@router.post("/sync-now")
async def sync_now(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    return await service.sync_user_accounts(db, current_user["user_id"])
