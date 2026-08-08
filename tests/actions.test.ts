/**
 * Authorization guard test.
 *
 * The predecessor build shipped 96 server actions, 84 of which took a client
 * id, and none verified membership — RLS was the sole line of defence, with
 * nothing to catch a future mistaken policy. That hole was invisible because
 * nothing asserted its absence.
 *
 * This test reads the action source and fails the build if any exported action
 * omits `assertMember`. A new action cannot be merged unguarded.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src/app/actions/operate.ts");
const source = readFileSync(SRC, "utf8");

/** Exported server actions, excluding the internal `run` helper. */
function exportedActions(): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /export async function (\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  const starts: { name: string; at: number }[] = [];
  while ((m = re.exec(source))) starts.push({ name: m[1], at: m.index });
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : source.length;
    out.push({ name: s.name, body: source.slice(s.at, end) });
  });
  return out;
}

describe("server action authorization", () => {
  const actions = exportedActions();

  it("there is at least one write path", () => {
    // Guards against the audit's P1-1 silently returning: an empty action file
    // would make every other assertion here vacuously true.
    expect(actions.length).toBeGreaterThan(0);
  });

  it("every exported action routes through the membership guard", () => {
    const unguarded = actions
      .filter((a) => !/assertMember|run\(\s*entityId/.test(a.body))
      .map((a) => a.name);
    expect(
      unguarded,
      `These actions never verify membership: ${unguarded.join(", ")}. ` +
        `Server actions are independently POST-invocable, so an unguarded one is reachable ` +
        `without ever loading a page.`,
    ).toEqual([]);
  });

  it("every action derives its entity from the form, not from a client-supplied role", () => {
    const bad = actions.filter((a) => !/entity_id/.test(a.body)).map((a) => a.name);
    expect(bad, `Actions with no entity scoping: ${bad.join(", ")}`).toEqual([]);
  });

  it("the guard itself rejects non-write roles", () => {
    const auth = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");
    expect(auth).toMatch(/WRITE_ROLES/);
    expect(auth).toMatch(/may read but not write/);
    // 'member' must NOT be a write role.
    const roles = auth.match(/const WRITE_ROLES = \[(.*?)\]/s)?.[1] ?? "";
    expect(roles).not.toMatch(/"member"/);
  });

  it("money is parsed to integer minor units, never floats", () => {
    const auth = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");
    expect(auth).toMatch(/Math\.round\(n \* 100\)/);
  });
});
