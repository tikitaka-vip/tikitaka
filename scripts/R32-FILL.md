# Round-of-32 fill (29/06) — operator runbook

The group stage is complete (72/72). The 16 R32 matches (`שמינית גמר`, DB ids
73-88) ship as `TBD vs TBD` and must be filled with the real qualified teams
before users can predict them. Two scripts make this a single verified command.

## 1. Preview (read-only, safe anytime)

```sh
# Final standings + the 8 best third-placed teams, from the LIVE prod DB:
node scripts/r32-standings.js /opt/worldcup/worldcup.db

# The exact 16 R32 matchups it will write (dry-run, no changes):
node scripts/fill-r32.js --db /opt/worldcup/worldcup.db
```

## 2. Execute the fill (writes to the live game)

```sh
# ADMIN_SESSION_TOKEN = session_token of evyatar.kaplan@gmail.com (players.id=1)
node scripts/fill-r32.js --execute \
  --token <ADMIN_SESSION_TOKEN> \
  --url http://127.0.0.1:3000 \
  --db /opt/worldcup/worldcup.db
```

It POSTs each pairing to `/api/matches/:id/update-teams` (admin-auth), which also
seeds sensible default odds so a match scored before the daily odds fetch still
gets a real multiplier. The call is **idempotent** — re-running never clobbers
real odds (`INSERT OR IGNORE`).

## Safety guards (the script refuses unless all hold)

- Group stage 100% resulted (72/72). Reads through the WAL, so run it against the
  live `/opt/worldcup/worldcup.db` — a plain `cp` of just the `.db` file misses
  results still in the `-wal` and would under-count.
- No group has an unresolved tie (fair-play / drawing-of-lots can't be computed).
- The set of qualified third-placed groups equals the one the encoded FIFA 2026
  bracket assumes (`{B,D,E,F,I,J,K,L}`). FIFA's third-place slot assignment is
  combination-specific; if a different combination had qualified the script stops
  and tells you to update `BRACKET` in `scripts/fill-r32.js`.

## The bracket (verified)

Slots are the official FIFA 2026 R32 structure (matches 73-88), cross-checked
against en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage and reconciled
against the live group standings — all 12 winners, 12 runners-up and the exact 8
qualifying thirds matched.

| Match | Slot      | Pairing |
|-------|-----------|---------|
| 73 | 2A v 2B | South Africa v Canada |
| 74 | 1E v 3D | Germany v Paraguay |
| 75 | 1F v 2C | Netherlands v Morocco |
| 76 | 1C v 2F | Brazil v Japan |
| 77 | 1I v 3F | France v Sweden |
| 78 | 2E v 2I | Ivory Coast v Norway |
| 79 | 1A v 3E | Mexico v Ecuador |
| 80 | 1L v 3K | England v DR Congo |
| 81 | 1D v 3B | USA v Bosnia & Herzegovina |
| 82 | 1G v 3I | Belgium v Senegal |
| 83 | 2K v 2L | Portugal v Croatia |
| 84 | 1H v 2J | Spain v Austria |
| 85 | 1B v 3J | Switzerland v Algeria |
| 86 | 1J v 2H | Argentina v Cape Verde |
| 87 | 1K v 3L | Colombia v Ghana |
| 88 | 2D v 2G | Australia v Egypt |
