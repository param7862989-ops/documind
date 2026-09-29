"""initial_documind_schema

Revision ID: 0d9774478bc5
Revises: 
Create Date: 2026-09-26 20:49:29.699271

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d9774478bc5'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    if dialect_name == "postgresql":
        op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector;"))
        op.execute(sa.text("""
            DO $$ BEGIN
                CREATE TYPE documentstatus AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        op.execute(sa.text("""
            DO $$ BEGIN
                CREATE TYPE messagerole AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        from pgvector.sqlalchemy import Vector
        vector_col = Vector(1536)
        doc_status_enum = sa.Enum('UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', name='documentstatus', create_type=False)
        msg_role_enum = sa.Enum('USER', 'ASSISTANT', 'SYSTEM', name='messagerole', create_type=False)
    else:
        vector_col = sa.Text()
        doc_status_enum = sa.Enum('UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', name='documentstatus')
        msg_role_enum = sa.Enum('USER', 'ASSISTANT', 'SYSTEM', name='messagerole')

    # 1. users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('storage_path', sa.String(length=512), nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=True),
        sa.Column('status', doc_status_enum, nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('page_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('doc_metadata', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_documents_user_id'), 'documents', ['user_id'], unique=False)
    op.create_index(op.f('ix_documents_content_hash'), 'documents', ['content_hash'], unique=False)
    op.create_index(op.f('ix_documents_status'), 'documents', ['status'], unique=False)

    # 3. document_chunks table
    op.create_table(
        'document_chunks',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('document_id', sa.String(length=36), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('section_title', sa.String(length=255), nullable=True),
        sa.Column('text_content', sa.Text(), nullable=False),
        sa.Column('embedding', vector_col, nullable=True),
        sa.Column('chunk_metadata', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_document_chunks_document_id'), 'document_chunks', ['document_id'], unique=False)
    op.create_index(op.f('ix_document_chunks_chunk_index'), 'document_chunks', ['chunk_index'], unique=False)
    op.create_index(op.f('ix_document_chunks_page_number'), 'document_chunks', ['page_number'], unique=False)

    if dialect_name == "postgresql":
        op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops);"))

    # 4. conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('selected_document_ids', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_conversations_user_id'), 'conversations', ['user_id'], unique=False)

    # 5. messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('conversation_id', sa.String(length=36), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', msg_role_enum, nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('citations', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    op.drop_table('messages')
    op.drop_table('conversations')
    op.drop_table('document_chunks')
    op.drop_table('documents')
    op.drop_table('users')

    if dialect_name == "postgresql":
        op.execute(sa.text("DROP TYPE IF EXISTS documentstatus CASCADE;"))
        op.execute(sa.text("DROP TYPE IF EXISTS messagerole CASCADE;"))
