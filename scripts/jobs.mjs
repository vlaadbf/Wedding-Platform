// Run under a process supervisor. State lives in SQL, not in this process.
const origin = process.env.APP_ORIGIN,
  secret = process.env.JOB_SECRET;
if (!origin || !secret)
  throw new Error('APP_ORIGIN and JOB_SECRET are required');
async function tick() {
  try {
    const r = await fetch(origin + '/api/jobs', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secret },
      signal: AbortSignal.timeout(45000),
    });
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ok: r.ok,
        status: r.status,
      }),
    );
  } catch {
    console.error(
      JSON.stringify({
        at: new Date().toISOString(),
        ok: false,
        error: 'job_endpoint_unavailable',
      }),
    );
  }
}
await tick();
setInterval(tick, 60000);
