#!/bin/sh
set -e

# Apply database migrations on every start; Alembic skips what's already applied.
alembic upgrade head

# Optional demo data for local and demo deployments only.
if [ "$SEED_DEMO_DATA" = "true" ]; then
  if [ "$ENVIRONMENT" = "production" ]; then
    python -m app.seed --allow-production
  else
    python -m app.seed
  fi
fi

exec "$@"
