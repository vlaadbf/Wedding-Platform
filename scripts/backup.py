"""python scripts/backup.py SOURCE.sqlite OUTPUT.sqlite — local SQLite online backup."""
import sqlite3,sys,pathlib
if len(sys.argv)!=3:raise SystemExit('Usage: python scripts/backup.py SOURCE.sqlite NEW_BACKUP.sqlite')
source,target=map(pathlib.Path,sys.argv[1:]);source=source.resolve();target=target.resolve()
if not source.is_file() or target.exists() or source==target:raise SystemExit('Source must exist; destination must be a new file.')
target.parent.mkdir(parents=True,exist_ok=True)
with sqlite3.connect('file:'+source.as_posix()+'?mode=ro',uri=True) as db,sqlite3.connect(target) as backup:
 db.backup(backup)
 if backup.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise SystemExit('Backup validation failed')
print('Backup created and integrity verified:',target)
