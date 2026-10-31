"""Persistencia local. Nunca se publican archivos de este directorio como estáticos."""
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DATA_DIR = Path(os.environ.get('EXAMENES_DATA_DIR', Path(__file__).resolve().parents[2] / 'data')).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / 'app.sqlite3'

SCHEMA = '''
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS batches (
 id TEXT PRIMARY KEY, original_filename TEXT NOT NULL, source_sha256 TEXT NOT NULL,
 pages_count INTEGER NOT NULL, dpi INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
 page_index INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
 rotation INTEGER NOT NULL DEFAULT 0, is_exam_start INTEGER NOT NULL DEFAULT 0,
 UNIQUE(batch_id,page_index)
);
CREATE TABLE IF NOT EXISTS regions (
 id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, x1 INTEGER NOT NULL, y1 INTEGER NOT NULL,
 x2 INTEGER NOT NULL, y2 INTEGER NOT NULL,
 question_id TEXT, subquestion_id TEXT, reading_order INTEGER,
 scope TEXT, value_text TEXT, note_text TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exports (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
 mode TEXT NOT NULL, file_path TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_regions_page ON regions(page_id);
CREATE INDEX IF NOT EXISTS ix_pages_batch ON pages(batch_id,page_index);
'''

@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with connect() as c:
        c.executescript(SCHEMA)
        # Additive and repeatable migration: keep all original regions and legacy text.
        columns = {row['name'] for row in c.execute('PRAGMA table_info(regions)')}
        migrate_legacy = any(name not in columns for name in ('score_value', 'score_denominator'))
        for name in ('score_value', 'score_denominator'):
            if name not in columns:
                c.execute(f'ALTER TABLE regions ADD COLUMN {name} REAL')
        if migrate_legacy:
            from .grading import legacy_score
            for row in c.execute("SELECT id,value_text FROM regions WHERE kind='calificacion' AND score_value IS NULL AND score_denominator IS NULL"):
                parsed = legacy_score(row['value_text'])
                if parsed:
                    c.execute('UPDATE regions SET score_value=?,score_denominator=? WHERE id=?', (*parsed, row['id']))
