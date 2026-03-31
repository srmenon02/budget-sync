# BudgetSync Deployment Readiness

This checklist is derived from `TechDesign-BudgetSync-MVP.md` and updated against the current repository state.

## Implemented in this pass

- [x] Backend auth bypass is now opt-in and disabled by default (`DEV_AUTH_BYPASS=false`).
- [x] Auth bypass is force-disabled when `ENVIRONMENT=production`.
- [x] Transactions are now user-isolated by account ownership.
- [x] Transaction creation now enforces account ownership.
- [x] API list endpoints now have bounded pagination (`limit` validation).
- [x] Backend now has a committed `.env.example`.
- [x] Backend README updated with production-safe startup guidance.
- [x] CI workflow now runs backend tests and frontend type/build checks.
- [x] Backend integration tests now cover auth requirement and transaction isolation.

## Still required before production

### 1) Infrastructure and deployment

- [x] Add CI workflow to run backend + frontend checks on every push to `main`.
- [ ] Configure Render service for `budgetsync-api` with env vars from `.env.example`.
- [ ] Configure Vercel frontend env vars (`VITE_API_URL`, Supabase vars).
- [ ] Add health monitor (UptimeRobot) on `/health`.

### 2) Data and migrations

- [ ] Switch backend from local `dev.db` to managed Postgres in production.
- [ ] Verify Alembic migrations are complete and replay cleanly from empty DB.
- [ ] Add DB indexes for production query paths (`transactions(date/account/category)`).

### 3) Security hardening

- [ ] Ensure `ALLOWED_ORIGINS` only includes production frontend URL(s).
- [ ] Confirm all secrets are injected via environment variables only.
- [ ] Add automated secret scan in CI.
- [ ] Enforce HTTPS-only deployment URLs.

### 4) Testing quality gates

- [x] Add backend integration tests for auth + account/transaction isolation.
- [ ] Add frontend tests for auth guard and create flows.
- [ ] Gate deployments on passing tests.

### 5) Product acceptance checks

- [ ] Validate Teller sync flow end-to-end in non-local environment.
- [ ] Validate partner-sharing permissions and private account isolation.
- [ ] Confirm mobile rendering on iOS Safari + Chrome Android.

## Recommended next execution order

1. Configure Render/Vercel env vars and staging deploy.
2. Add frontend tests for auth guard and create flows.
3. Add secret scan in CI.
4. Run smoke test checklist against staging.
5. Promote to production.
