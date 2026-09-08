"""Exercise real SQLite constraints and verify a backup restore, without app credentials."""
import sqlite3,tempfile,pathlib,json
schema=pathlib.Path('drizzle/0000_initial.sql').read_text(encoding='utf-8')
with tempfile.TemporaryDirectory() as directory:
 db=sqlite3.connect(pathlib.Path(directory)/'test.sqlite');db.execute('PRAGMA foreign_keys=ON');db.executescript(schema)
 db.execute("INSERT INTO users(id,email,name,created_at) VALUES('u','qa@example.invalid','QA','2026-09-08')")
 db.execute("INSERT INTO workspaces VALUES('w','Test','2026-09-08')")
 for e in ['a','b']:db.execute("INSERT INTO events(id,workspace_id,name,data,created_at,updated_at) VALUES(?,'w',?,'{}','2026-09-08','2026-09-08')",(e,e))
 def entity(id,event,kind,data):db.execute("INSERT INTO entities(id,event_id,kind,data,author_id,created_at,updated_at) VALUES(?,?,?,?, 'u','2026-09-08','2026-09-08')",(id,event,kind,json.dumps(data)))
 entity('family','a','household',{'name':'Familie'});entity('guest','b','guest',{'name':'Invitat'})
 try:db.execute("INSERT INTO entity_links VALUES('b','guest','household_id','family')");raise AssertionError('Cross-event FK accepted')
 except sqlite3.IntegrityError:print('PASS composite FK rejects cross-event relation')
 entity('seat1','a','assignment',{'table_id':'t','guest_id':'g','seat':1,'subevent_id':'s'})
 for id,data in [('seat2',{'table_id':'t','guest_id':'other','seat':1,'subevent_id':'s'}),('seat3',{'table_id':'other','guest_id':'g','seat':2,'subevent_id':'s'})]:
  try:entity(id,'a','assignment',data);raise AssertionError('Duplicate seating accepted')
  except sqlite3.IntegrityError:print('PASS seating unique index',id)
 db.execute("INSERT INTO mutations VALUES('m1','a',1,'2026-09-08')")
 try:db.execute("INSERT INTO mutations VALUES('m2','a',1,'2026-09-08')");raise AssertionError('Stale mutation accepted')
 except sqlite3.IntegrityError:print('PASS database concurrency trigger')
 db.commit();backup=sqlite3.connect(pathlib.Path(directory)/'backup.sqlite');db.backup(backup);backup.close();restored=sqlite3.connect(pathlib.Path(directory)/'backup.sqlite');assert restored.execute('PRAGMA integrity_check').fetchone()[0]=='ok';assert restored.execute('SELECT count(*) FROM entities').fetchone()==db.execute('SELECT count(*) FROM entities').fetchone();assert restored.execute("SELECT version FROM events WHERE id='a'").fetchone()[0]==2
 print('PASS consistent backup and restoration');restored.close();db.close()
