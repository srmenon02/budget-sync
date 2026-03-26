from fastapi import FastAPI

app = FastAPI(title="BudgetSync API - MVP")


@app.get("/health")
async def health():
    return {"status": "ok"}
