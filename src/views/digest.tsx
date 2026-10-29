import type { Night } from '../digest/types.js';

const dash = (v: string | null) => (v === null || v === '' ? '—' : v);

export function Digest({ night }: { night: Night }) {
  const { counts } = night;
  return (
    <>
      <h1>digest {night.night}</h1>
      <p>
        ok {counts.ok} · retry {counts.retry} · fail {counts.fail}
      </p>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? "line couldn't" : "lines couldn't"} be read
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th>
              <th>last status</th><th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{dash(r.owner)}</td>
                <td>{r.runs}</td>
                <td class={r.retries >= 3 ? 'warn' : undefined}>
                  {r.retries >= 3 ? `${r.retries} (many)` : r.retries}
                </td>
                <td class={r.lastStatus === 'fail' ? 'warn' : undefined}>
                  {r.lastStatus === 'fail' ? 'fail (!)' : r.lastStatus}
                </td>
                <td>{dash(r.lastError)}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
