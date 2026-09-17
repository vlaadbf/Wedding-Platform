import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE entities(id TEXT PRIMARY KEY,event_id TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,deleted_at TEXT);
  CREATE INDEX entities_schedule_due ON entities(kind,json_extract(data,'$.due')) WHERE kind='schedule' AND deleted_at IS NULL;
`);
const insert = database.prepare('INSERT INTO entities(id,event_id,kind,data) VALUES(?,?,?,?)');
for (let event = 0; event < 3; event++) {
  for (let row = 0; row < 300; row++) {
    const isDue = row === 0;
    insert.run(
      `${event}-${row}`,
      `event-${event}`,
      isDue ? 'schedule' : 'guest',
      JSON.stringify(
        isDue
          ? { name: 'Avans', due: '2026-09-17', expense_id: `expense-${event}`, amount: 100 }
          : { name: `Invitat ${row}` },
      ),
    );
  }
}
const oldRowsRead = database.prepare('SELECT COUNT(*) AS count FROM entities').get().count;
const candidateSql = `SELECT s.id,s.event_id,json_extract(s.data,'$.due') AS due
  FROM entities s
  WHERE s.kind='schedule' AND s.deleted_at IS NULL
    AND json_extract(s.data,'$.due')<=?
    AND NOT EXISTS(SELECT 1 FROM entities n WHERE n.id='due-'||s.id AND n.event_id=s.event_id)`;
const candidates = database.prepare(candidateSql).all('2026-09-23');
const plan = database.prepare('EXPLAIN QUERY PLAN ' + candidateSql).all('2026-09-23');
assert.equal(oldRowsRead, 900);
assert.equal(candidates.length, 3);
assert(
  plan.some((step) => String(step.detail).includes('entities_schedule_due')),
  JSON.stringify(plan),
);
database.close();
console.log(`PASS Tick candidate scan: ${oldRowsRead} entity rows before, ${candidates.length} due candidates after`);
