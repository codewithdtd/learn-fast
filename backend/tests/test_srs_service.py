import pytest

from app.models import SrsRating
from app.services.srs import (
    MAX_SRS_LEVEL,
    calculate_srs_schedule,
    derive_rating_from_session_metrics,
)


@pytest.mark.parametrize(
    ("level", "interval", "rating", "expected_level", "expected_interval", "is_lapse"),
    [
        (0, 0, SrsRating.GOOD, 1, 1, False),
        (1, 1, SrsRating.GOOD, 2, 3, False),
        (2, 3, SrsRating.EASY, 4, 14, False),
        (5, 30, SrsRating.FORGOT, 1, 1, True),
        (0, 0, SrsRating.HARD, 1, 1, False),
        (4, 14, SrsRating.HARD, 4, 14, False),
        (MAX_SRS_LEVEL, 90, SrsRating.GOOD, MAX_SRS_LEVEL, 90, False),
        (MAX_SRS_LEVEL, 90, SrsRating.EASY, MAX_SRS_LEVEL, 90, False),
    ],
)
def test_calculate_srs_schedule(
    level: int,
    interval: int,
    rating: SrsRating,
    expected_level: int,
    expected_interval: int,
    is_lapse: bool,
) -> None:
    schedule = calculate_srs_schedule(level, interval, rating)

    assert schedule.level == expected_level
    assert schedule.interval_days == expected_interval
    assert schedule.increment_lapse_count is is_lapse


@pytest.mark.parametrize(
    ("mastery_score", "again_count", "total_cards", "expected_rating"),
    [
        (100.0, 0, 10, SrsRating.GOOD),
        (85.0, 1, 10, SrsRating.GOOD),
        (75.0, 2, 10, SrsRating.HARD),
        (50.0, 4, 10, SrsRating.HARD),
        (45.0, 6, 10, SrsRating.FORGOT),
        (85.0, 10, 10, SrsRating.FORGOT),  # Sai >= tổng số thẻ bị coi là forgot
    ],
)
def test_derive_rating_from_session_metrics(
    mastery_score: float,
    again_count: int,
    total_cards: int,
    expected_rating: SrsRating,
) -> None:
    rating = derive_rating_from_session_metrics(mastery_score, again_count, total_cards)
    assert rating == expected_rating
