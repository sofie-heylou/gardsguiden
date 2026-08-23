# Running the admin scripts against production

**The scripts in `scripts/` cannot be run inside the Railway container as-is.**
The runner image is a Next standalone build: it ships `.next/standalone`,
`migrations/`, and `scripts/baseline-meta.ts` only. There is no `tsx`, no
`node_modules/.bin`, and none of the other scripts. `better-sqlite3` *is*
present, at `/app/node_modules/better-sqlite3`.

Verified on 2026-08-23 by inspecting the running container.

## What works today

Do the thinking locally, and send the container a plain Node script that only
touches the database. The pattern:

```bash
# 1. Always snapshot first — this is the live volume.
railway ssh "cp /data/gardsguiden.db /data/gardsguiden.db.pre-<what>-$(date +%Y%m%dT%H%M%SZ)"

# 2. Write a plain .js (not .ts) that requires the container's better-sqlite3
cat > /tmp/task.js <<'JS'
const Database = require("/app/node_modules/better-sqlite3");
const db = new Database("/data/gardsguiden.db");
db.pragma("busy_timeout = 10000");   // the app holds the same WAL
// ... work ...
db.close();
JS

# 3. Ship it over and run it
railway ssh "echo $(base64 -w 0 < /tmp/task.js) | base64 -d > /tmp/task.js && node /tmp/task.js && rm -f /tmp/task.js"
```

For anything that needs the network (geocoding) or heavy logic, run that part
locally against `https://www.gardsguiden.se/api/farms`, generate the SQL, and
send only the finished statements. That is how the coordinate backfill was
applied: 65 addresses geocoded locally, 30 `UPDATE`s shipped to the container.

## Two things to remember

- **Cache.** Farm pages are statically generated with `revalidate = 3600`, so a
  direct database write shows up within the hour, or immediately after a
  service restart. `/api/farms` is `no-store` and reflects changes at once.
- **The seed comes back.** `docker-entrypoint.sh` copies the committed
  `data/gardsguiden.db` into `/data` only when the volume is empty, but
  `initSchema()` re-inserts every seed row with `INSERT OR IGNORE` on **every**
  boot. Deleting a farm that exists in the committed seed means deleting it
  there too, or it returns on the next restart.

## If you want the scripts to run in the container

Ship them and a runtime for them. In the runner stage of the `Dockerfile`:

```dockerfile
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src        # the scripts import from src/lib
RUN npm install -g tsx
```

That costs image size and build time, and pulls `src/` into the runtime image.
Worth doing if CLI moderation becomes routine; not worth it for occasional use.
