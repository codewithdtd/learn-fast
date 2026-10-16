"""add admin speaking practice and feedback history

Revision ID: be27a591d8e0
Revises: d4b8f2a71c06
Create Date: 2026-10-15
"""

from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "be27a591d8e0"
down_revision: Union[str, Sequence[str], None] = "d4b8f2a71c06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PROMPTS = [
    ("home", "My home", "Nhà của tôi", "Can you describe your home?", "Bạn có thể mô tả ngôi nhà của mình không?", "conversation", [
        {"en": "Name the type of home and who you live with.", "vi": "Nêu loại nhà và người sống cùng bạn."},
        {"en": "Describe one room or feature you like.", "vi": "Mô tả một căn phòng hoặc điểm bạn thích."},
        {"en": "Explain why you feel comfortable there.", "vi": "Giải thích vì sao bạn cảm thấy thoải mái ở đó."},
    ]),
    ("daily-routine", "Daily routine", "Thói quen hằng ngày", "What do you usually do on a typical weekday?", "Bạn thường làm gì vào một ngày trong tuần?", "ielts_part1", [
        {"en": "Start with the time you wake up.", "vi": "Bắt đầu bằng thời gian bạn thức dậy."},
        {"en": "Mention work, study, or another regular activity.", "vi": "Nhắc đến công việc, học tập hoặc hoạt động thường ngày."},
        {"en": "Say what you enjoy or would like to change.", "vi": "Nói điều bạn thích hoặc muốn thay đổi."},
    ]),
    ("work-or-study", "Work or study", "Công việc hoặc học tập", "Do you work or are you a student? Tell me a little about it.", "Bạn đi làm hay đang là sinh viên? Hãy kể một chút về điều đó.", "ielts_part1", [
        {"en": "Say what you do and where.", "vi": "Nói bạn làm gì và ở đâu."},
        {"en": "Describe one thing you like about it.", "vi": "Mô tả một điều bạn thích ở công việc hoặc việc học."},
        {"en": "Give a simple reason or example.", "vi": "Đưa ra một lý do hoặc ví dụ đơn giản."},
    ]),
    ("neighbourhood", "My neighbourhood", "Khu phố của tôi", "What is your neighbourhood like?", "Khu phố nơi bạn sống như thế nào?", "ielts_part1", [
        {"en": "Say whether it is quiet or busy.", "vi": "Nói nơi đó yên tĩnh hay nhộn nhịp."},
        {"en": "Mention a useful place nearby.", "vi": "Nhắc đến một địa điểm hữu ích gần đó."},
        {"en": "Explain what you like about the area.", "vi": "Giải thích điều bạn thích ở khu vực đó."},
    ]),
    ("free-time", "Free-time activities", "Hoạt động lúc rảnh", "What do you like doing in your free time?", "Bạn thích làm gì vào thời gian rảnh?", "ielts_part1", [
        {"en": "Name one activity you enjoy.", "vi": "Nêu một hoạt động bạn yêu thích."},
        {"en": "Say when or where you do it.", "vi": "Nói thời gian hoặc địa điểm bạn làm việc đó."},
        {"en": "Explain how it makes you feel.", "vi": "Giải thích hoạt động đó khiến bạn cảm thấy thế nào."},
    ]),
    ("food", "Food I enjoy", "Món ăn tôi yêu thích", "What kind of food do you enjoy eating?", "Bạn thích ăn loại thức ăn nào?", "ielts_part1", [
        {"en": "Name a dish or type of food.", "vi": "Nêu một món hoặc loại thức ăn."},
        {"en": "Describe its taste or ingredients.", "vi": "Mô tả hương vị hoặc nguyên liệu."},
        {"en": "Say when you usually eat it.", "vi": "Nói khi nào bạn thường ăn món đó."},
    ]),
    ("weekend", "My weekend", "Cuối tuần của tôi", "What do you usually do at the weekend?", "Bạn thường làm gì vào cuối tuần?", "ielts_part1", [
        {"en": "Describe a typical Saturday or Sunday.", "vi": "Mô tả một ngày thứ Bảy hoặc Chủ nhật điển hình."},
        {"en": "Mention someone you spend time with.", "vi": "Nhắc đến người bạn dành thời gian cùng."},
        {"en": "Say what makes your weekend enjoyable.", "vi": "Nói điều khiến cuối tuần của bạn thú vị."},
    ]),
    ("hometown", "My hometown", "Quê hương của tôi", "Where is your hometown, and what do you like about it?", "Quê bạn ở đâu và bạn thích điều gì ở đó?", "ielts_part1", [
        {"en": "Name your hometown and describe its size.", "vi": "Nêu tên quê bạn và mô tả quy mô nơi đó."},
        {"en": "Mention a place or feature people know.", "vi": "Nhắc đến địa điểm hoặc đặc điểm quen thuộc."},
        {"en": "Explain why it is special to you.", "vi": "Giải thích vì sao nơi đó đặc biệt với bạn."},
    ]),
]


def upgrade() -> None:
    op.create_table(
        "speaking_prompts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("title_en", sa.String(length=160), nullable=False),
        sa.Column("title_vi", sa.String(length=160), nullable=False),
        sa.Column("question_en", sa.Text(), nullable=False),
        sa.Column("question_vi", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("difficulty", sa.String(length=24), server_default="basic", nullable=False),
        sa.Column("hints", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("slug", name="uq_speaking_prompts_slug"),
    )
    op.create_index("ix_speaking_prompts_category", "speaking_prompts", ["category"])
    op.create_table(
        "speaking_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("prompt_id", sa.Integer(), nullable=False),
        sa.Column("prompt_snapshot", sa.JSON(), nullable=False),
        sa.Column("transcript", sa.Text(), server_default="", nullable=False),
        sa.Column("feedback_json", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="created", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("quota_consumed", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grading_token", sa.String(length=36), nullable=True),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model_name", sa.String(length=120), nullable=True),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["prompt_id"], ["speaking_prompts.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_speaking_attempts_user_id", "speaking_attempts", ["user_id"])
    op.create_index("ix_speaking_attempts_prompt_id", "speaking_attempts", ["prompt_id"])
    op.create_index("ix_speaking_attempts_status", "speaking_attempts", ["status"])
    op.create_index("ix_speaking_attempts_user_created", "speaking_attempts", ["user_id", "created_at"])
    op.create_table(
        "speaking_ai_usage",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("used_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_speaking_ai_usage_user_date"),
    )
    op.create_index("ix_speaking_ai_usage_user_id", "speaking_ai_usage", ["user_id"])

    now = datetime.now(timezone.utc)
    prompt_table = sa.table(
        "speaking_prompts",
        sa.column("slug", sa.String), sa.column("title_en", sa.String), sa.column("title_vi", sa.String),
        sa.column("question_en", sa.Text), sa.column("question_vi", sa.Text), sa.column("category", sa.String),
        sa.column("difficulty", sa.String), sa.column("hints", sa.JSON), sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)), sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(prompt_table, [
        {"slug": slug, "title_en": title_en, "title_vi": title_vi, "question_en": question_en,
         "question_vi": question_vi, "category": category, "difficulty": "basic", "hints": hints,
         "is_active": True, "created_at": now, "updated_at": now}
        for slug, title_en, title_vi, question_en, question_vi, category, hints in PROMPTS
    ])


def downgrade() -> None:
    op.drop_index("ix_speaking_ai_usage_user_id", table_name="speaking_ai_usage")
    op.drop_table("speaking_ai_usage")
    op.drop_index("ix_speaking_attempts_user_created", table_name="speaking_attempts")
    op.drop_index("ix_speaking_attempts_status", table_name="speaking_attempts")
    op.drop_index("ix_speaking_attempts_prompt_id", table_name="speaking_attempts")
    op.drop_index("ix_speaking_attempts_user_id", table_name="speaking_attempts")
    op.drop_table("speaking_attempts")
    op.drop_index("ix_speaking_prompts_category", table_name="speaking_prompts")
    op.drop_table("speaking_prompts")
