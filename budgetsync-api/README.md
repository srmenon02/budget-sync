# BudgetSync - Backend (MVP)

Minimal FastAPI scaffold for Phase 1.

Setup (recommended):

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health: `GET /health` returns {"status":"ok"}
