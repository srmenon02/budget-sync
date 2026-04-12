from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User
from ..schemas.user import UserSettingsRead, UserSettingsUpdate


def _placeholder_email(user_id: str) -> str:
    return f"{user_id}@local.invalid"


async def ensure_local_user(
    db: AsyncSession,
    user_id: str,
    email: str | None = None,
) -> User:
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        user = User(
            id=user_id,
            email=email or _placeholder_email(user_id),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    changed = False
    if email and user.email != email:
        user.email = email
        changed = True

    if changed:
        await db.commit()
        await db.refresh(user)

    return user


async def get_user_settings(
    db: AsyncSession,
    user_id: str,
    email: str | None = None,
) -> UserSettingsRead:
    user = await ensure_local_user(db, user_id=user_id, email=email)
    return UserSettingsRead(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        primary_payday_day=user.primary_payday_day,
        secondary_payday_day=user.secondary_payday_day,
        paycheck_frequency=user.paycheck_frequency,
    )


async def update_user_settings(
    db: AsyncSession,
    user_id: str,
    payload: UserSettingsUpdate,
    email: str | None = None,
) -> UserSettingsRead:
    user = await ensure_local_user(db, user_id=user_id, email=email)
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.primary_payday_day is not None:
        user.primary_payday_day = payload.primary_payday_day
    if payload.secondary_payday_day is not None:
        user.secondary_payday_day = payload.secondary_payday_day
    if payload.paycheck_frequency is not None:
        user.paycheck_frequency = payload.paycheck_frequency
    await db.commit()
    await db.refresh(user)
    return UserSettingsRead(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        primary_payday_day=user.primary_payday_day,
        secondary_payday_day=user.secondary_payday_day,
        paycheck_frequency=user.paycheck_frequency,
    )
