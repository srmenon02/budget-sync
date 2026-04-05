from pydantic import BaseModel, Field, model_validator


class UserSettingsRead(BaseModel):
    user_id: str
    email: str
    display_name: str | None = None
    primary_payday_day: int = Field(ge=1, le=31)
    secondary_payday_day: int = Field(ge=1, le=31)


class UserSettingsUpdate(BaseModel):
    display_name: str | None = None
    primary_payday_day: int = Field(ge=1, le=31)
    secondary_payday_day: int = Field(ge=1, le=31)

    @model_validator(mode="after")
    def validate_distinct_days(self) -> "UserSettingsUpdate":
        if self.primary_payday_day == self.secondary_payday_day:
            raise ValueError("Payday days must be different")
        return self