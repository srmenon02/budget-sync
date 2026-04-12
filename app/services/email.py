import logging

import resend

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

resend.api_key = settings.resend_api_key


async def send_partner_invite(
    to_email: str, requester_name: str, invite_token: str
) -> None:
    accept_url = f"{settings.frontend_url}/accept-invite?token={invite_token}"
    try:
        resend.Emails.send(
            {
                "from": "BudgetSync <noreply@budgetsync.app>",
                "to": [to_email],
                "subject": f"{requester_name} invited you to BudgetSync",
                "html": f"""
                <h2>You've been invited to BudgetSync</h2>
                <p>{requester_name} wants to share budgets with you on BudgetSync.</p>
                <p>
                  <a href="{accept_url}" style="
                    background:#10b981;color:white;padding:12px 24px;
                    border-radius:6px;text-decoration:none;font-weight:bold;
                  ">Accept Invitation</a>
                </p>
                <p>This link expires in 7 days.</p>
            """,
            }
        )
        logger.info("Partner invite sent to %s", to_email)
    except Exception as e:
        logger.error(
            "Failed to send invite email to %s: %s", to_email, e, exc_info=True
        )
        raise


async def send_password_reset(to_email: str, reset_url: str) -> None:
    try:
        resend.Emails.send(
            {
                "from": "BudgetSync <noreply@budgetsync.app>",
                "to": [to_email],
                "subject": "Reset your BudgetSync password",
                "html": f"""
                <h2>Reset your password</h2>
                <p>Click below to reset your BudgetSync password.</p>
                <p>
                  <a href="{reset_url}" style="
                    background:#10b981;color:white;padding:12px 24px;
                    border-radius:6px;text-decoration:none;font-weight:bold;
                  ">Reset Password</a>
                </p>
                <p>If you didn't request this, ignore this email.</p>
            """,
            }
        )
        logger.info("Password reset sent to %s", to_email)
    except Exception as e:
        logger.error("Failed to send reset email to %s: %s", to_email, e, exc_info=True)
        raise
