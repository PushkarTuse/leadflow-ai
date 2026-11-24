"""Back up Wrangler D1 and clear only unworked local discoveries."""
import sqlite3
import sys
from pathlib import Path

workspace = Path(__file__).resolve().parents[2]
state = workspace / "leadflow-leads" / ".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
backup = Path(sys.argv[1]).resolve()
if backup.parent != (workspace / "leadflow-local-backups").resolve() or backup.exists():
    raise SystemExit("Expected a new timestamped workspace backup directory")
matches = []
for path in state.glob("*.sqlite"):
    if not path.is_file() or path.resolve().parent != state.resolve():
        continue
    with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as probe:
        tables = {row[0] for row in probe.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if {"leads", "runs", "pipeline_source_state"} <= tables:
            matches.append(path)
if len(matches) != 1:
    raise SystemExit(f"Expected one local LeadFlow database, found {len(matches)}")
backup.mkdir()
with sqlite3.connect(matches[0], timeout=5) as source:
    source.execute("PRAGMA foreign_keys=ON")
    with sqlite3.connect(backup / "leadflow.sqlite") as archive:
        source.backup(archive)
        if archive.execute("PRAGMA quick_check").fetchone() != ("ok",):
            raise SystemExit("Backup integrity check failed")
    before = source.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    cleanup = """category IN ('freelance_request','company_hiring','local_business')
        AND status='new' AND (notes IS NULL OR trim(notes)='')"""
    source.execute(f"DELETE FROM source_observations WHERE lead_id IN (SELECT id FROM leads WHERE {cleanup})")
    removed = source.execute(f"DELETE FROM leads WHERE {cleanup}").rowcount
    remaining = source.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    cooldowns = source.execute("SELECT COUNT(*) FROM pipeline_source_state").fetchone()[0]
    # Conditional validators describe the removed inventory. Re-download at the
    # next permitted poll without changing lease, due time or failure metadata.
    source.execute("UPDATE pipeline_source_state SET etag=NULL,last_modified=NULL WHERE lease_id IS NULL")
print(f"Backup {backup} | before={before} removed={removed} preserved={remaining} source_states={cooldowns}")
