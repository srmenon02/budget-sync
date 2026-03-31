# BudgetSync - Backend (MVP)

Minimal FastAPI scaffold for Phase 1.

## Local Setup

```bash
cd budgetsync-api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Production-Safe Local Mode

Use this to mirror production auth behavior (no auth bypass):

```bash
cd budgetsync-api
source venv/bin/activate
ENVIRONMENT=production DEV_AUTH_BYPASS=false uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Health: `GET /health` returns {"status":"ok"}

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `ALLOWED_ORIGINS`
- `ENVIRONMENT` (`production` in deployed environments)

## Deployment Notes

- Keep `DEV_AUTH_BYPASS=false` in production.
- Ensure frontend origin is included in `ALLOWED_ORIGINS`.
- Keep API behind HTTPS in deployed environments.
