<!-- Purpose: Reference required GitHub Actions and runtime secrets for CI/CD and production deployment. -->
# Secrets Management

Use GitHub repository or environment secrets for all sensitive values. Do not store secrets in source files, workflow YAML, or pull requests.

## Required GitHub Secrets

### Backend Runtime
- `DATABASE_URL`
- `SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELLER_APP_ID`
- `TELLER_API_KEY`
- `RESEND_API_KEY`

### Optional/Environment-Specific
- `SUPABASE_JWT_SECRET`
- `DEV_USER_ID`

## Notes About CI/CD

- `GITHUB_TOKEN` is automatically injected by GitHub Actions and is used for GHCR image pushes and workflow API reads.
- CD publishes to `ghcr.io/<owner>/budget-sync-api`.
- Keep production secrets in a protected environment with required reviewers.

## Rotation Policy

Rotate all provider credentials on this cadence:
- Database and app secrets: every 90 days
- Third-party API keys (Teller, Resend, Supabase service role): every 60 days
- Emergency rotation immediately after suspected exposure
