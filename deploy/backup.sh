#!/bin/sh
# Nightly backup: the database as a pg_dump custom-format file, the uploads as a tar archive.
# Restore: pg_restore --clean --if-exists -d "$PGDATABASE" eduhub-<date>.dump ; tar -xzf media-<date>.tar.gz -C <media volume>
set -eu

KEEP_DAYS="${KEEP_DAYS:-14}"

while true; do
  stamp=$(date -u +%Y-%m-%d)
  echo "backup: starting $stamp"
  # write to a temporary name first, so a failed run never leaves a truncated file that looks complete
  if pg_dump --format=custom --file="/backups/eduhub-$stamp.dump.part" \
     && mv "/backups/eduhub-$stamp.dump.part" "/backups/eduhub-$stamp.dump" \
     && tar -czf "/backups/media-$stamp.tar.gz.part" -C /media . \
     && mv "/backups/media-$stamp.tar.gz.part" "/backups/media-$stamp.tar.gz"; then
    echo "backup: done $stamp"
  else
    echo "backup: FAILED $stamp" >&2
    rm -f /backups/*.part
  fi
  find /backups -type f \( -name 'eduhub-*.dump' -o -name 'media-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
  sleep 86400
done
