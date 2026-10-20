#!/usr/bin/env bash
# Schema and migration-runner tests for PLT.S4 (DAT-08, DAT-09).
#
# Starts a throwaway PostgreSQL in Docker, builds the schema with Flyway, and checks:
#   build        two empty databases build with no manual step, and are identical
#   conformance  table, foreign key, index and policy counts match the DDL (schema-baseline.sql)
#   idempotence  running migrate again changes nothing
#   ordering     migrations apply in version order; a late, out-of-order migration is refused
#   history      an applied migration that was edited is refused
#   guard        a destructive migration is refused with the statement named; an additive one and
#                a reviewed exception pass
#
# Needs only Docker and bash (Git Bash on Windows). Runs in CI (job `schema`) and locally:
#   bash tests/integration/schema/run-tests.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash: hand container paths to docker unchanged

# Keep in step with docker-compose.dev.yml and .github/actions/lint-migrations.
POSTGRES_IMAGE="${POSTGRES_IMAGE:-pgvector/pgvector:pg18}"
FLYWAY_IMAGE="${FLYWAY_IMAGE:-flyway/flyway:13.9.0-alpine}"
SQUAWK_VERSION="${SQUAWK_VERSION:-2.68.0}"

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
run="schema-test-$$"
pg="$run-pg"
squawk="$run-squawk"
work="$(mktemp -d)"
failures=0

cleanup() {
  docker rm -f "$pg" "$squawk" >/dev/null 2>&1
  docker network rm "$run" >/dev/null 2>&1
  rm -rf "$work"
}
trap cleanup EXIT

pass() { echo "ok   - $1"; }
fail() {
  echo "FAIL - $1"
  [ -n "${2:-}" ] && printf '%s\n' "$2" | tail -n 15 | sed 's/^/       /'
  failures=$((failures + 1))
}

# Docker on Windows needs C:/… paths for bind mounts; elsewhere this is plain pwd.
host_path() { (cd "$1" && { pwd -W 2>/dev/null || pwd; }); }

psql_db() {
  local db="$1"
  shift
  docker exec -i "$pg" psql -X -q -v ON_ERROR_STOP=1 -U test -d "$db" "$@" 2>&1
}

# pg_dump marks its output with a random \restrict key, which is not part of the schema.
dump() { docker exec "$pg" pg_dump -U test --schema-only "$1" | grep -vE '^\\(un)?restrict '; }

# flyway <database> <project directory> <flyway arguments…>
flyway() {
  local db="$1" project="$2"
  shift 2
  docker run --rm --network "$run" \
    -e FLYWAY_URL="jdbc:postgresql://$pg:5432/$db" -e FLYWAY_USER=test -e FLYWAY_PASSWORD=test \
    -v "$(host_path "$project"):/flyway/project:ro" \
    "$FLYWAY_IMAGE" -workingDirectory=/flyway/project "$@" 2>&1
}

# A copy of database/ that a test can change without touching the repository.
copy_project() {
  cp -R "$repo/database" "$work/$1"
  echo "$work/$1"
}

echo "Starting PostgreSQL ($POSTGRES_IMAGE)…"
docker network create "$run" >/dev/null
docker run -d --name "$pg" --network "$run" \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test "$POSTGRES_IMAGE" >/dev/null
# During initialisation the server listens on its socket only, so wait for TCP.
for _ in $(seq 60); do
  docker exec "$pg" pg_isready -h 127.0.0.1 -U test -d test >/dev/null 2>&1 && break
  sleep 1
done

# --- build (DAT-08) ------------------------------------------------------------------------------
psql_db test -c "CREATE DATABASE build_a" -c "CREATE DATABASE build_b" >/dev/null
out_a="$(flyway build_a "$repo/database" migrate)"
status_a=$?
out_b="$(flyway build_b "$repo/database" migrate)"
status_b=$?
if [ $status_a -eq 0 ] && [ $status_b -eq 0 ]; then
  pass "build: two empty databases build with no manual step"
else
  fail "build: Flyway could not build an empty database" "$out_a$out_b"
  exit 1 # nothing else can be tested
fi

# --- conformance ---------------------------------------------------------------------------------
if out="$(psql_db build_a <"$here/schema-baseline.sql")"; then
  pass "conformance: $(grep -o 'Schema matches.*' <<<"$out")"
else
  fail "conformance: the schema does not match the DDL" "$out"
fi

# --- reproducibility (DAT-08, acceptance criterion 3) ----------------------------------------------
dump build_a >"$work/a.sql"
dump build_b >"$work/b.sql"
if diff -q "$work/a.sql" "$work/b.sql" >/dev/null; then
  pass "build: the two builds are identical ($(wc -l <"$work/a.sql") lines of schema)"
else
  fail "build: the two builds differ" "$(diff "$work/a.sql" "$work/b.sql")"
fi

# --- idempotence ---------------------------------------------------------------------------------
out="$(flyway build_a "$repo/database" migrate)"
status=$?
dump build_a >"$work/a-again.sql"
if [ $status -eq 0 ] && grep -q 'No migration necessary' <<<"$out" && diff -q "$work/a.sql" "$work/a-again.sql" >/dev/null; then
  pass "idempotence: a second migrate applies nothing and changes nothing"
else
  fail "idempotence: a second migrate was not a no-op" "$out"
fi

# --- ordering ------------------------------------------------------------------------------------
expected="$(find "$repo/database" -name 'V*.sql' | wc -l | tr -d ' ')"
result="$(psql_db build_a -At -c "
  SELECT count(*) || ',' || count(*) FILTER (WHERE NOT success) || ',' ||
         (array_agg(version ORDER BY installed_rank)
          = array_agg(version ORDER BY string_to_array(version, '.')::int[]))::text
  FROM _migrations WHERE version IS NOT NULL")"
if [ "$result" = "$expected,0,true" ]; then
  pass "ordering: all $expected migrations applied, in version order"
else
  fail "ordering: expected '$expected,0,true' (applied, failed, in order), got '$result'"
fi

late="$(copy_project late)"
cp "$here/fixtures/V1.250__late_change.sql" "$late/migrations/"
out="$(flyway build_a "$late" migrate)"
status=$?
column="$(psql_db build_a -At -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'tenant' AND column_name = 'late_note'")"
if [ $status -ne 0 ] && grep -q '1.250' <<<"$out" && [ "$column" = "0" ]; then
  pass "ordering: a migration older than the applied version is refused"
else
  fail "ordering: an out-of-order migration was not refused" "$out"
fi

# --- history -------------------------------------------------------------------------------------
edited="$(copy_project edited)"
first="$(find "$edited/ddl" -name 'V*.sql' | sort | head -n 1)"
printf '\n-- edited after it was applied\n' >>"$first"
out="$(flyway build_a "$edited" migrate)"
status=$?
if [ $status -ne 0 ] && grep -qi 'checksum mismatch' <<<"$out"; then
  pass "history: an edited migration is refused (checksum mismatch on $(basename "$first"))"
else
  fail "history: an edited migration was not refused" "$out"
fi

# --- guard (DAT-09, acceptance criterion 2) ------------------------------------------------------
docker run -d --name "$squawk" -v "$(host_path "$repo"):/repo:ro" -w /repo python:3.12-slim sleep infinity >/dev/null
docker exec "$squawk" pip install -q --disable-pip-version-check --root-user-action=ignore "squawk-cli==$SQUAWK_VERSION"
lint() { docker exec "$squawk" squawk "tests/integration/schema/fixtures/guard/$1" 2>&1; }

out="$(lint V2__drop_table.sql)"
status=$?
if [ $status -ne 0 ] && grep -q 'ban-drop-table' <<<"$out" && grep -q 'DROP TABLE AUDIT_LOG' <<<"$out"; then
  pass "guard: a DROP TABLE migration is refused and the statement named"
else
  fail "guard: a DROP TABLE migration was not refused" "$out"
fi
for fixture in V2__add_column.sql V2__approved_exception.sql; do
  if out="$(lint "$fixture")"; then
    pass "guard: $fixture passes"
  else
    fail "guard: $fixture was refused" "$out"
  fi
done

echo
if [ $failures -eq 0 ]; then
  echo "All schema tests passed."
else
  echo "$failures schema test(s) failed."
  exit 1
fi
