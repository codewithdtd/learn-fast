from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.guest_ai_usage import GuestAIUsage


class GuestAIUsageRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def claim_many_once(self, identities: list[str], feature: str) -> bool:
        # Các khóa được ghi cùng transaction để đổi token không cho guest thêm lượt trên cùng IP.
        self.db.add_all(GuestAIUsage(guest_key_hash=key, feature=feature) for key in identities)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            return False
        return True

    def release(self, identities: list[str], feature: str) -> None:
        self.db.execute(delete(GuestAIUsage).where(
            GuestAIUsage.guest_key_hash.in_(identities), GuestAIUsage.feature == feature
        ))
        self.db.commit()

    def has_claim(self, identity: str, feature: str) -> bool:
        return self.db.scalar(select(GuestAIUsage.id).where(
            GuestAIUsage.guest_key_hash == identity, GuestAIUsage.feature == feature
        )) is not None
