from io import BytesIO

import pytest
from openpyxl import Workbook

from app.services.excel_parser import parse_excel_workbook
from app.services.excel_types import ExcelParseError, ExcelValidationError


def workbook_bytes(*sheets: tuple[str, list[tuple[object, ...]]]) -> BytesIO:
    workbook = Workbook()
    first_sheet = workbook.active

    for index, (title, rows) in enumerate(sheets):
        worksheet = first_sheet if index == 0 else workbook.create_sheet()
        worksheet.title = title
        for row in rows:
            worksheet.append(row)

    buffer = BytesIO()
    workbook.save(buffer)
    workbook.close()
    buffer.seek(0)
    return buffer


def test_parses_all_sheets_with_normalized_headers_and_optional_examples() -> None:
    source = workbook_bytes(
        (
            "Interview Part 1",
            [
                (" phrase ", "MEANING", "Example   EN", "Example VI"),
                ("be responsible for", "chịu trách nhiệm về", "I am responsible.", None),
                ("follow up", "theo dõi", "", "Tôi sẽ theo dõi."),
            ],
        ),
        (
            "Interview Part 2",
            [
                ("Phrase", "Meaning", "Example EN", "Example VI"),
                ("look into", "xem xét", None, None),
            ],
        ),
    )

    parsed = parse_excel_workbook(source)

    assert [sheet.sheet_name for sheet in parsed.sheets] == [
        "Interview Part 1",
        "Interview Part 2",
    ]
    assert [sheet.position for sheet in parsed.sheets] == [1, 2]
    assert [card.position for card in parsed.sheets[0].cards] == [1, 2]
    assert parsed.sheets[0].cards[0].example_vi is None
    assert parsed.sheets[0].cards[1].example_en is None
    assert parsed.sheets[1].cards[0].phrase == "look into"


def test_skips_completely_empty_sheet_and_keeps_original_sheet_position() -> None:
    source = workbook_bytes(
        ("Empty", []),
        (
            "Content",
            [
                ("Phrase", "Meaning"),
                ("prepare", "chuẩn bị"),
            ],
        ),
    )

    parsed = parse_excel_workbook(source)

    assert len(parsed.sheets) == 1
    assert parsed.sheets[0].sheet_name == "Content"
    assert parsed.sheets[0].position == 2


def test_reports_missing_required_header_with_sheet_and_column() -> None:
    source = workbook_bytes(
        (
            "Vocabulary",
            [
                ("Phrase", "Example EN"),
                ("follow up", "I will follow up."),
            ],
        ),
    )

    with pytest.raises(ExcelValidationError) as raised:
        parse_excel_workbook(source)

    assert len(raised.value.errors) == 1
    error = raised.value.errors[0]
    assert error.sheet_name == "Vocabulary"
    assert error.row_number == 1
    assert error.column == "Meaning"
    assert error.message == "Required header is missing."


def test_reports_duplicate_recognized_header() -> None:
    source = workbook_bytes(
        (
            "Vocabulary",
            [
                ("Phrase", " phrase ", "Meaning"),
                ("one", "one", "một"),
            ],
        ),
    )

    with pytest.raises(ExcelValidationError) as raised:
        parse_excel_workbook(source)

    assert len(raised.value.errors) == 1
    error = raised.value.errors[0]
    assert error.row_number == 1
    assert error.column == "Phrase"
    assert error.message == "Duplicate recognized header after normalization."


def test_aggregates_missing_required_values_and_skips_blank_rows() -> None:
    source = workbook_bytes(
        (
            "Vocabulary",
            [
                ("Phrase", "Meaning", "Example EN", "Example VI"),
                ("", "nghĩa", None, None),
                ("có phrase", None, None, None),
                (None, None, None, None),
                ("valid", "hợp lệ", None, None),
            ],
        ),
    )

    with pytest.raises(ExcelValidationError) as raised:
        parse_excel_workbook(source)

    assert [(error.row_number, error.column) for error in raised.value.errors] == [
        (2, "Phrase"),
        (3, "Meaning"),
    ]

    valid_source = workbook_bytes(
        (
            "Vocabulary",
            [
                ("Phrase", "Meaning"),
                ("first", "đầu tiên"),
                (None, None),
                ("second", "thứ hai"),
            ],
        ),
    )
    parsed = parse_excel_workbook(valid_source)
    assert [card.position for card in parsed.sheets[0].cards] == [1, 2]


def test_rejects_non_xlsx_input_with_domain_error() -> None:
    with pytest.raises(ExcelParseError, match="readable .xlsx workbook"):
        parse_excel_workbook(BytesIO(b"not an Excel workbook"))
