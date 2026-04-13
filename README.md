# BudgetSync (Inner Project)

This repository is the runnable BudgetSync app workspace.

## Project Layout

- `budgetsync-api/` - FastAPI backend
- `src/` + root `package.json` - Vite + React frontend

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm

## Local Setup

### 1) Backend

```bash
cd budgetsync-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./venv/bin/alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Backend health check:

```bash
curl http://localhost:8000/health
```

### 2) Frontend

Open a second terminal:

```bash
cd .
npm install
npm run dev
```

Frontend URL:

- http://localhost:5173

## Dev Auth Behavior

API routes currently support local auth bypass:

- `DEV_AUTH_BYPASS=true` (default behavior in code path)
- Optional: `DEV_USER_ID=dev-user`

If you want strict token checks locally, disable bypass and set a JWT secret:

```bash
export DEV_AUTH_BYPASS=false
export SUPABASE_JWT_SECRET=your_secret
```

## Useful Local API Calls

Seed sample data:

```bash
curl -X POST http://localhost:8000/dev/seed
```

List accounts and transactions:

```bash
curl http://localhost:8000/accounts/
curl http://localhost:8000/transactions/
```

Bank sync stub endpoints:

```bash
curl -X POST http://localhost:8000/bank-sync/connect-token
curl -X POST http://localhost:8000/bank-sync/sync-now
```

## Troubleshooting

### Alembic fails when run from the wrong Python

Run Alembic through the backend virtualenv executable:

```bash
cd budgetsync-api
./venv/bin/alembic upgrade head
```

### `python app/main.py` fails

Run FastAPI with Uvicorn instead:

```bash
cd budgetsync-api
uvicorn app.main:app --reload --port 8000
```

### `npm run dev` fails

Install dependencies in this folder and run commands from repo root:

```bash
cd /Users/smeno/Documents/Personal/Projects/mvi-generation/budget-sync
npm ci
npm run dev
```

## CI/CD

GitHub Actions workflows in `.github/workflows/` now enforce:

- Frontend lint, type-check, tests, and build
- Backend lint, tests with coverage, and dependency audit
- PR-only secret scan and dependency audit checks
- CD on successful CI push to `main`/`master`, with artifact pull, GHCR publish, and Trivy scan

## Branch Protection (Required)

In GitHub branch protection for `main`, require these status checks before merge:

- `frontend-quality`
- `backend-quality`
- `Gitleaks Secret Scan`
- `Dependency Audit`
- `Verify CI Passed`

Also enable:

- Require pull request reviews
- Dismiss stale approvals on new commits
- Require conversation resolution before merging
- Restrict force pushes and branch deletion

## Git Note

This inner folder is intended to be used as its own git repository.
Commit and push from this directory:

```bash
cd /Users/smeno/Documents/Personal/Projects/mvi-generation/budget-sync
git status
git add -A
git commit -m "Your message"
git push
```
