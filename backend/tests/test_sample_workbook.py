from pathlib import Path

from app.services.excel_parser import parse_excel_workbook


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_WORKBOOK = PROJECT_ROOT / "samples" / "english-srs-sample.xlsx"


def test_versioned_sample_workbook_matches_the_import_contract() -> None:
    assert SAMPLE_WORKBOOK.is_file(), "Run scripts/create_sample_workbook.py to generate the sample asset."

    with SAMPLE_WORKBOOK.open("rb") as source:
        parsed = parse_excel_workbook(source)

    assert [sheet.sheet_name for sheet in parsed.sheets] == [
        "Everyday phrases",
        "Interview English",
    ]
    assert [len(sheet.cards) for sheet in parsed.sheets] == [3, 3]
