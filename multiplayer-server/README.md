# Multiplayer Lobby Server

This server powers rooms, invites, and commit-reveal fairness for MAO card games.

## Run locally

```bash
cd multiplayer-server
npm install
npm start
```

## Environment

Copy `.env.example` to `.env` and update:

- `PORT`
- `ALLOWED_ORIGINS` (comma-separated)

## Protocol (WebSocket)

Client sends JSON messages with `type`:

- `hello` `{ name, address }`
- `list_rooms`
- `create_room` `{ gameType, maxPlayers, rules, isPrivate }`
- `join_room` `{ roomId }`
- `leave_room`
- `ready` `{ ready: true }`
- `start_match` (host only)
- `commit` `{ roundId, commit }`
- `reveal` `{ roundId, reveal }`
- `action` `{ action, payload }`
- `request_settle` `{ resultHash }`
- `arbitrate` `{ evidenceHash, note }`

Server broadcasts:

- `welcome`, `room_list`, `room_update`
- `round_start`, `reveal_start`, `round_seed`
- `action`, `settle_requested`, `arbitration_requested`

Commit-reveal:

1. Server sends `round_start` with `serverCommit`.
2. Clients send `commit = sha256(reveal)`.
3. Server asks `reveal_start`.
4. Clients send `reveal`, server verifies, broadcasts `round_seed`.

Use `round_seed` to deterministically shuffle and replay.
