from dataclasses import dataclass


@dataclass(frozen=True)
class ParsedCard:
    position: int
    phrase: str
    meaning: str
    example_en: str | None
    example_vi: str | None


@dataclass(frozen=True)
class ParsedSheet:
    sheet_name: str
    position: int
    cards: list[ParsedCard]


@dataclass(frozen=True)
class ParsedWorkbook:
    sheets: list[ParsedSheet]


@dataclass(frozen=True)
class ValidationErrorDetail:
    sheet_name: str
    row_number: int | None
    column: str | None
    message: str


class ExcelValidationError(Exception):
    """Report every workbook validation problem in one response."""

    def __init__(self, errors: list[ValidationErrorDetail]) -> None:
        self.errors = errors
        super().__init__(f"Excel validation failed with {len(errors)} error(s).")


class ExcelParseError(Exception):
    """Represent a workbook that cannot be opened as a supported .xlsx file."""
