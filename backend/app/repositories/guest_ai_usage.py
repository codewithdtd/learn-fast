from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.guest_ai_usage import GuestAIUsage


class GuestAIUsageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def claim_once(self, guest_key_hash: str, feature: str) -> bool:
        """Use a unique database key to make concurrent guest quota claims atomic."""
        self.db.add(GuestAIUsage(guest_key_hash=guest_key_hash, feature=feature))
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            return False
        return True
