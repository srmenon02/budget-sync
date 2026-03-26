from fastapi import HTTPException, status


class BudgetSyncException(HTTPException):
    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(status_code=status_code, detail=detail)


class AccountNotFoundError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Account not found", status_code=status.HTTP_404_NOT_FOUND)


class TransactionNotFoundError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Transaction not found", status_code=status.HTTP_404_NOT_FOUND)


class UnauthorizedError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Unauthorized", status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Forbidden", status_code=status.HTTP_403_FORBIDDEN)


class PartnershipNotFoundError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Partnership not found", status_code=status.HTTP_404_NOT_FOUND)


class DuplicatePartnershipError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Partnership already exists", status_code=status.HTTP_409_CONFLICT)


class BankSyncError(BudgetSyncException):
    def __init__(self, detail: str = "Bank sync failed"):
        super().__init__(detail=detail, status_code=status.HTTP_502_BAD_GATEWAY)


class GoalNotFoundError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Goal not found", status_code=status.HTTP_404_NOT_FOUND)


class BudgetNotFoundError(BudgetSyncException):
    def __init__(self):
        super().__init__(detail="Budget not found", status_code=status.HTTP_404_NOT_FOUND)