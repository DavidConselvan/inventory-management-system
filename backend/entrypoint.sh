#!/usr/bin/env sh
# Production start sequence for the backend container (used by Render).
# Local development uses the docker-compose command instead.
set -e

python manage.py migrate --no-input
python manage.py seed_demo --skip-if-exists
python manage.py collectstatic --no-input

# Threads (not just workers) so JP's streamed SSE replies don't block the rest
# of the API, and a longer timeout so a slow stream isn't killed mid-response.
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 2 --threads 4 --timeout 120
