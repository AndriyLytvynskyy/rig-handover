# rig

The lane's resident service: keeps a heartbeat, serves the status board, reads the night's run
log. Hono + JSX, rendered on the server, Node 22+.

Read first: `docs/vision.md`, `docs/styleguide.md`. Decisions: `docs/adr/`.

## Commands

- `pnpm dev` / `pnpm start`: serves on `PORT` (8787). Needs `.env` (copy `.env.example`).
- `pnpm test`: vitest. `pnpm typecheck`: tsc.

## How work moves here

1. A feature starts as a plan: `plan.md` at the root (one at a time). Finished plans live in
   `docs/plans/done/`.
2. The plan is split into GitHub issues: skill `plan-to-issues` (`.agents/skills/`). A human
   reviews the split before anything is published. GitHub issues out of reach: files in
   `docs/issues/` (ADR 0004).
3. Issues are worked by workers, one issue per worker, each on its own branch or worktree.
   Pick the model per issue: the strongest for logic, a cheaper one for views and tests.
4. A worker closes its issue with a closing comment, exactly this shape:

   ```
   done: <what changed, one line>
   worker: <harness> · <model> · <effort>
   commit: <sha or "none">
   ```

5. An issue is closed only when its "Done when" holds. If it can't hold yet, leave it open and
   say what it waits on.

## Issue shape

Every issue split from a plan carries the label `plan:<plan name>` (from the plan's frontmatter)
and a body in this shape, fields in this order:

```
Source: plan.md § <n>

Scope: <what is in, from the plan's section>
Out of scope: <what is not, naming the sibling issues by #n>
Done when: <the plan's condition, word for word>
Blocked by: <#n, or —; "closing also needs #n" when it can start earlier than it can close>
Suggested worker: <harness> · <model> · <effort>
```

- `Source:` opens the body; reviewers sort issues by it and the label.
- One section may become several issues (e.g. a contract first, so others can start against it);
  never invent a section the plan doesn't have.
- A step that waits on someone outside (a review, a reply) says so in `Blocked by` and stays
  open until they confirm, even if its `Done when` reads as met earlier.

## Skills

Shared skills live in `.agents/skills/`, one folder each, `SKILL.md` inside. That folder is the
one source for every harness on the team. If yours loads skills from somewhere else, point it
here (a link or a config entry). Don't copy: copies drift.

## Rules

- Never commit `.env`, tokens or previews.
- Don't touch `runs/`: those are real nights, read-only fixtures.
- No client JS (ADR 0001).
