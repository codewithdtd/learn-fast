MAX_ENTITY_NAME_LENGTH = 255


def normalize_entity_name(value: str) -> str:
    """Normalize editable entity names before they reach the database."""
    normalized = value.strip()
    if not normalized:
        raise ValueError("Name must contain at least one non-whitespace character.")
    if len(normalized) > MAX_ENTITY_NAME_LENGTH:
        raise ValueError(f"Name must be {MAX_ENTITY_NAME_LENGTH} characters or fewer.")
    return normalized
