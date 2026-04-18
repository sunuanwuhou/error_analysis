# Codex Inbox

## Goal

`Codex Inbox` is the async message bridge for remote study access.

It is designed for the case where the user can only open the workbench through a domain and cannot directly reach the Codex desktop session.

The flow is:

1. the user leaves a message inside the workbench
2. the message is stored in SQLite as `pending`
3. the Codex desktop client scans pending messages on a schedule
4. Codex writes the reply back into the same thread
5. the user reopens the domain and reads the answer in the same UI

This is intentionally not a fake realtime chat.

## Database Model

Two tables are added in [app/main.py](/E:/IdeaProject/git/xingce_v3_lab/app/main.py):

1. `codex_threads`
   - one logical conversation per topic
   - fields: `id`, `user_id`, `title`, `archived`, `created_at`, `updated_at`
2. `codex_messages`
   - message history inside a thread
   - fields: `id`, `thread_id`, `user_id`, `role`, `content`, `context_json`, `status`, `error_text`, `created_at`, `replied_at`

Message status is only meaningful for `role='user'`:

- `pending`: waiting for Codex scan
- `processing`: currently being handled
- `done`: assistant reply has been written back
- `failed`: scan attempted but did not complete

## Frontend Entry

The current UI entry is inside [xingce_v3.html](/E:/IdeaProject/git/xingce_v3_lab/xingce_v3/xingce_v3.html):

- floating button: `Codex 留言`
- more menu entry: `🧾 Codex`
- modal id: `codexInboxModal`

The composer can attach the current page context automatically, including:

- current tab
- current knowledge node
- active filters
- filtered error count
- a small sample of filtered errors

That context is saved into `context_json` so the scheduled Codex run can answer with real study context instead of pure free text.

## API Surface

The backend currently exposes:

- `GET /api/codex/threads`
- `POST /api/codex/threads`
- `GET /api/codex/threads/{thread_id}`
- `POST /api/codex/threads/{thread_id}/messages`

These APIs are authenticated with the same session cookie as the rest of the workbench.

## Scheduled Processing Bridge

The helper script is [scripts/codex_inbox.py](/E:/IdeaProject/git/xingce_v3_lab/scripts/codex_inbox.py).

Supported commands:

```powershell
python .\scripts\codex_inbox.py list-pending --limit 5
python .\scripts\codex_inbox.py set-processing --message-id cm_xxx
python .\scripts\codex_inbox.py reply --message-id cm_xxx --stdin
python .\scripts\codex_inbox.py fail --message-id cm_xxx --error "reason"
```

Recommended scheduled loop:

1. list pending messages
2. pick one message
3. mark it `processing`
4. send the message content + `context_json` + thread history to an external reply bridge
5. write the reply back with `reply`
6. if something breaks, mark it `failed`

## Server Worker

A looping Docker worker now exists at [scripts/codex_inbox_worker.py](/E:/IdeaProject/git/xingce_v3_lab/scripts/codex_inbox_worker.py).

The service is declared in [docker-compose.yml](/E:/IdeaProject/git/xingce_v3_lab/docker-compose.yml) as `codex-inbox-worker`.

This worker is now treated as an optional fallback only.

It is behind the `server-inbox` profile and is not the default reply path anymore.

It scans the inbox every `30` minutes by default and is configured through:

- `CODEX_INBOX_INTERVAL_MINUTES`
- `CODEX_INBOX_BATCH_SIZE`
- `CODEX_INBOX_TIMEOUT_SECONDS`
- `CODEX_INBOX_WEBHOOK_URL`
- `CODEX_INBOX_WEBHOOK_TOKEN`

The worker itself does not contain the Codex desktop session.

It only does three things:

1. read pending inbox messages from SQLite
2. call a configured webhook bridge
3. write the returned reply back into the inbox thread

If `CODEX_INBOX_WEBHOOK_URL` is empty, the worker keeps running but leaves messages in `pending`.

## Preferred Mode

The preferred mode is now:

1. the workbench stores inbox messages in SQLite
2. the Codex desktop client scans the inbox
3. the Codex desktop client writes the reply back

This is the only mode that preserves the meaning of “reply from this client”.

## Recommended Schedule

Recommended production cadence:

- study analysis: `10:00` and `20:00`
- Codex inbox scan: as frequently as the Codex client scheduler supports

Practical note:

- the current built-in Codex automation is better suited to hourly cadence than exact 30-minute cadence
- if exact `30` minutes becomes mandatory, we need a separate host-side bridge, but that bridge still would not turn the Docker worker into this desktop client

The inbox scan should stay more frequent than study analysis because it is the async substitute for direct chat.

## Current Limitations

1. This is not realtime chat.
2. The current implementation stores only async thread history, not the full Codex desktop conversation state.
3. The Docker worker can schedule scans, but it still cannot turn the current Codex desktop thread into an in-container agent by itself.
