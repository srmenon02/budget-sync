from typing import Literal

from pydantic import BaseModel, Field, model_validator

PaycheckFrequency = Literal["weekly", "bi-weekly", "monthly"]


class UserSettingsRead(BaseModel):
    user_id: str
    email: str
    display_name: str | None = None
    primary_payday_day: int = Field(ge=1, le=31)
    secondary_payday_day: int = Field(ge=1, le=31)
    paycheck_frequency: PaycheckFrequency = "monthly"


class UserSettingsUpdate(BaseModel):
    display_name: str | None = None
    primary_payday_day: int | None = Field(ge=1, le=31, default=None)
    secondary_payday_day: int | None = Field(ge=1, le=31, default=None)
    paycheck_frequency: PaycheckFrequency | None = None

    @model_validator(mode="after")
    def validate_distinct_days(self) -> "UserSettingsUpdate":
        if (
            self.primary_payday_day is not None
            and self.secondary_payday_day is not None
            and self.primary_payday_day == self.secondary_payday_day
        ):
            raise ValueError("Payday days must be different")
        return self
