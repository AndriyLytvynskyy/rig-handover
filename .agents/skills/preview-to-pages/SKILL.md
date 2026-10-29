---
name: preview-to-pages
description: Save a rig page as one HTML file and put it on GitHub Pages as a public preview, then later upload it again without the lane marker. Use for a plan's "Preview for review" and "Clean up" steps (ADR 0003).
---

# preview-to-pages

A preview is a static copy of one rig page on a public HTTPS link that we can upload over
(ADR 0003). This skill puts it on GitHub Pages in a separate public repo, never in this one.
Needs `gh`, authenticated with the `repo` scope, in a shell this agent can run.

Every upload is public. **Ask the human before each one**: what goes up, the link, who can see
it (anyone), how to undo it. A "yes" for this repo's pushes does not cover the preview repo.

## 1. Save the page

A command, not a browser's "save as". The page is self-contained (ADR 0001).

```sh
PORT=8787 pnpm start &                      # reads .env, so the banner shows LANE_MARKER
curl -sf -o <preview-dir>/index.html localhost:8787/<path>
kill $(lsof -ti tcp:8787)
grep -oE '<(script|link|img)[^>]*' <preview-dir>/index.html   # expect nothing
```

`<preview-dir>` lives outside this repo (no previews here: ADR 0003).

## 2. First upload

```sh
cd <preview-dir>
git init -q -b main
git config user.email "<id>+<login>@users.noreply.github.com"   # repo-local; never a work address
git add index.html && git commit -m "Preview: <page> for review"
gh repo create <owner>/<name> --public --source . --remote origin --push
gh api -X POST repos/<owner>/<name>/pages -f 'source[branch]=main' -f 'source[path]=/'
```

The link is `https://<owner>.github.io/<name>/` (owner in lower case).

## 3. Check it opens for someone else

Pages takes about a minute to build. Before you send the link:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://<owner>.github.io/<name>/   # until 200
curl -s https://<owner>.github.io/<name>/ | cmp - <preview-dir>/index.html   # same bytes
```

Then open it in a browser. Only a link that passed both goes to the reviewer.

## 4. Wait for the review

The preview issue stays open until the reviewer confirms they have looked (AGENTS.md, Issue
shape). Sending the link is not the end of it.

## 5. Clean up: upload again without the marker

Only after the review is in, and after the human's yes.

```sh
LANE_MARKER= PORT=8788 npx tsx src/server.ts &     # no .env: banner reads "no marker set"
curl -sf -o /tmp/clean.html localhost:8788/<path>
kill $(lsof -ti tcp:8788)
grep -c '<marker>' /tmp/clean.html                 # expect 0
```

A plain commit on top leaves the marked page in the preview repo's history. To remove it,
replace the history with one fresh commit:

```sh
cd <preview-dir>
OLD=$(git rev-parse origin/main)
git checkout -q --orphan clean && cp /tmp/clean.html index.html
git add index.html && git commit -m "Preview: <page>, lane marker removed (ADR 0003)"
git branch -M clean main
```

The force-push is the human's to run (agents may be blocked from it). Give them:

```sh
git -C <preview-dir> push --force-with-lease=main:<OLD> origin main
```

Then repeat step 3 until the live page shows "no marker set" and no marker (Pages caches
for up to 10 minutes).

## Undo

Turn Pages off (`gh api -X DELETE repos/<owner>/<name>/pages`) or delete the repo
(`gh repo delete <owner>/<name>`, needs the `delete_repo` scope). Ask first.

## Don'ts

- Don't put the preview in this repo, an issue or a chat attachment: the marker can't be taken
  off there.
- Don't send a link you haven't fetched from outside.
- Don't take the marker off before the reviewer has looked.
