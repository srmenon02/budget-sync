"""Paycheck utility functions for date range calculations."""

from datetime import date, timedelta
from typing import Literal

PaycheckFrequency = Literal["weekly", "bi-weekly", "monthly"]


def calculate_paycheck_number(
    tx_date: date,
    primary_payday_day: int,
    secondary_payday_day: int,
    frequency: PaycheckFrequency,
) -> int | None:
    """
    Calculate which paycheck a transaction falls under.

    For weekly: paycheck_number is the week number of the month (1-5).
    For bi-weekly: paycheck_number is 1 or 2 based on primary/secondary payday.
    For monthly: paycheck_number is always 1.

    Returns None if frequency is not recognized.
    """
    if frequency == "monthly":
        return 1
    elif frequency == "bi-weekly":
        # Determine if this date is closer to primary or secondary payday
        primary_date = date(tx_date.year, tx_date.month, primary_payday_day)
        try:
            secondary_date = date(tx_date.year, tx_date.month, secondary_payday_day)
        except ValueError:
            # Secondary payday doesn't exist (e.g., 02-30)
            secondary_date = date(tx_date.year, tx_date.month + 1, 1) - timedelta(days=1)

        # Calculate distance to each payday
        dist_to_primary = abs((tx_date - primary_date).days)
        dist_to_secondary = abs((tx_date - secondary_date).days)

        if dist_to_primary <= dist_to_secondary:
            return 1
        else:
            return 2
    elif frequency == "weekly":
        # Week 1 starts on the 1st of the month
        week_num = (tx_date.day - 1) // 7 + 1
        return min(week_num, 5)  # Cap at 5 weeks in a month
    else:
        return None


def get_paycheck_date_range(
    paycheck_number: int,
    primary_payday_day: int,
    secondary_payday_day: int,
    frequency: PaycheckFrequency,
    month: str,  # "YYYY-MM" format
) -> tuple[date, date]:
    """
    Get the start and end dates for a specific paycheck.

    Returns (start_date, end_date) as a tuple.
    """
    import calendar

    year, month_num = map(int, month.split("-"))

    if frequency == "monthly":
        # Full month
        first_day = date(year, month_num, 1)
        last_day = date(
            year, month_num, calendar.monthrange(year, month_num)[1]
        )
        return (first_day, last_day)

    elif frequency == "bi-weekly":
        if paycheck_number == 1:
            try:
                primary_date = date(year, month_num, primary_payday_day)
            except ValueError:
                # Handle invalid days like Feb 30
                primary_date = date(year, month_num + 1, 1) - timedelta(days=1)
            start_date = date(year, month_num, 1)
            end_date = primary_date
        else:  # paycheck_number == 2
            try:
                secondary_date = date(year, month_num, secondary_payday_day)
            except ValueError:
                secondary_date = date(year, month_num + 1, 1) - timedelta(days=1)
            try:
                primary_date = date(year, month_num, primary_payday_day)
            except ValueError:
                primary_date = date(year, month_num + 1, 1) - timedelta(days=1)
            start_date = primary_date + timedelta(days=1)
            end_date = secondary_date
        return (start_date, end_date)

    elif frequency == "weekly":
        # Each week is 7 days starting from the 1st
        start_day = (paycheck_number - 1) * 7 + 1
        end_day = min(paycheck_number * 7, calendar.monthrange(year, month_num)[1])
        start_date = date(year, month_num, start_day)
        end_date = date(year, month_num, end_day)
        return (start_date, end_date)

    else:
        # Default to full month
        first_day = date(year, month_num, 1)
        last_day = date(
            year, month_num, calendar.monthrange(year, month_num)[1]
        )
        return (first_day, last_day)
