#!/usr/bin/env sh
# Production start sequence for the backend container (used by Render).
# Local development uses the docker-compose command instead.
set -e

python manage.py migrate --no-input
python manage.py seed_demo --skip-if-exists
python manage.py collectstatic --no-input

exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}"
