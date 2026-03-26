import logging
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.partnership import Partnership
from app.schemas.partnership import PartnershipInvite, PartnershipResponse
from app.services.email import send_partner_invite
from app.exceptions import PartnershipNotFoundError, ForbiddenError, DuplicatePartnershipError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/partnerships", tags=["partnerships"])


@router.get("/", response_model=list[PartnershipResponse])
async def list_partnerships(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Partnership]:
    result = await db.execute(
        select(Partnership).where(
            or_(
                Partnership.requester_id == current_user.id,
                Partnership.partner_id == current_user.id,
            )
        )
    )
    return result.scalars().all()


@router.post("/invite", response_model=PartnershipResponse, status_code=201)
async def invite_partner(
    payload: PartnershipInvite,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Partnership:
    existing_result = await db.execute(
        select(Partnership).where(
            Partnership.requester_id == current_user.id,
            Partnership.invite_email == payload.email,
            Partnership.status.in_(["pending", "active"]),
        )
    )
    if existing_result.scalar_one_or_none():
        raise DuplicatePartnershipError()

    token = secrets.token_urlsafe(32)
    partnership = Partnership(
        requester_id=current_user.id,
        invite_email=payload.email,
        invite_token=token,
        status="pending",
    )
    db.add(partnership)
    await db.commit()
    await db.refresh(partnership)

    requester_name = current_user.display_name or current_user.email
    await send_partner_invite(payload.email, requester_name, token)

    return partnership


@router.post("/accept", response_model=PartnershipResponse)
async def accept_invite(
    token: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Partnership:
    result = await db.execute(
        select(Partnership).where(
            Partnership.invite_token == token,
            Partnership.status == "pending",
        )
    )
    partnership = result.scalar_one_or_none()
    if not partnership:
        raise PartnershipNotFoundError()

    partnership.partner_id = current_user.id
    partnership.status = "active"
    partnership.accepted_at = datetime.utcnow()
    partnership.invite_token = None

    await db.commit()
    await db.refresh(partnership)
    return partnership


@router.delete("/{partnership_id}", status_code=204)
async def remove_partnership(
    partnership_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Partnership).where(Partnership.id == partnership_id))
    partnership = result.scalar_one_or_none()
    if not partnership:
        raise PartnershipNotFoundError()
    if partnership.requester_id != current_user.id and partnership.partner_id != current_user.id:
        raise ForbiddenError()
    await db.delete(partnership)
    await db.commit()