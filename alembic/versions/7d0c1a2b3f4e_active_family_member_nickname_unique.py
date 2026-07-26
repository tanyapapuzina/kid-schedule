"""active family member nickname unique

Revision ID: 7d0c1a2b3f4e
Revises: f1858a16a753
Create Date: 2026-07-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7d0c1a2b3f4e"
down_revision: Union[str, Sequence[str], None] = "f1858a16a753"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_family_member_family_nickname",
        "family_members",
        type_="unique",
    )
    op.create_index(
        "uq_active_family_member_family_nickname",
        "family_members",
        ["family_id", "nickname"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_active_family_member_family_nickname",
        table_name="family_members",
    )
    op.create_unique_constraint(
        "uq_family_member_family_nickname",
        "family_members",
        ["family_id", "nickname"],
    )
