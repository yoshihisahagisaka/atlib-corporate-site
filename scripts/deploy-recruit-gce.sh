#!/usr/bin/env bash
# Run from a clean, pinned Git checkout in Google Cloud Shell.
# Only /var/www/html/recruit is modified. DNS, Apache config, WP and Cloud Run stay untouched.
set -Eeuo pipefail

if [[ "${1:-}" != "--apply" ]]; then
  echo "Usage: bash scripts/deploy-recruit-gce.sh --apply"
  echo "Run only after reviewing the approved Git commit and the production target."
  exit 2
fi

PROJECT="atlib-corporate-site"
ZONE="asia-northeast1-a"
VM="corporate-site-wp"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for bin in git gcloud tar; do
  command -v "$bin" >/dev/null || { echo "[STOP] Missing $bin"; exit 1; }
done
[[ -z "$(git status --porcelain)" ]] || { echo "[STOP] Git worktree is not clean"; exit 1; }
REV="$(git rev-parse HEAD)"
SHORT="${REV:0:12}"
grep -Fq '<!--License20261119vzyRP-->' public/recruit/index.html
! grep -Eq 'noindex|リニューアルプレビュー' public/recruit/index.html
test -s public/recruit/redesign-preview/assets/site.css
test -s public/recruit/redesign-preview/assets/site.js
test -s public/recruit/entry/index.html

echo "=== Target: ${VM} (${PROJECT}/${ZONE}), /var/www/html/recruit ==="
echo "=== Git release: ${REV} ==="
echo "=== Read-only remote preflight ==="
gcloud compute ssh "$VM" --project="$PROJECT" --zone="$ZONE" --tunnel-through-iap \
  --command="bash -c 'set -e; test \"\$(hostname)\" = corporate-site-wp; sudo test -d /var/www/html/recruit; sudo test -f /var/www/html/recruit/index.html; sudo grep -q \"DocumentRoot /var/www/html\" /etc/apache2/sites-enabled/production-le-ssl.conf; sudo grep -q \"recruit.atlib.jp\" /etc/apache2/sites-enabled/production-le-ssl.conf; sudo apache2ctl configtest; df -h /var/www/html; echo PREFLIGHT_OK'"

ARCHIVE="$(mktemp "/tmp/atlib-recruit-${SHORT}-XXXXXX.tar.gz")"
trap 'rm -f "$ARCHIVE"' EXIT
tar -C "$ROOT/public" -czf "$ARCHIVE" recruit
tar -tzf "$ARCHIVE" | grep -Fx 'recruit/index.html' >/dev/null
echo "=== Uploading package to VM home (production is not changed yet) ==="
gcloud compute scp "$ARCHIVE" "${VM}:~/atlib-recruit-${SHORT}.tar.gz" \
  --project="$PROJECT" --zone="$ZONE" --tunnel-through-iap

echo "=== Creating rollback backup, publishing assets/pages, then homepage last ==="
gcloud compute ssh "$VM" --project="$PROJECT" --zone="$ZONE" --tunnel-through-iap \
  --command="bash -s -- ${SHORT}" <<'REMOTE'
set -Eeuo pipefail
SHORT="$1"
ROOT="/var/www/html/recruit"
ARCHIVE="$HOME/atlib-recruit-${SHORT}.tar.gz"
STAGE="$(mktemp -d)"
BACKUP="/var/backups/atlib-recruit-before-${SHORT}-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
CHANGED=0
on_exit() {
  status=$?
  if [[ "$status" -ne 0 && "$CHANGED" -eq 1 ]]; then
    echo "[ROLLBACK] Deployment failed; restoring ${BACKUP}"
    sudo tar -C /var/www/html -xzf "$BACKUP" || echo "[CRITICAL] Restore failed; manual recovery required"
  fi
  rm -rf "$STAGE"
  exit "$status"
}
trap on_exit EXIT

[[ "$(hostname)" == "corporate-site-wp" ]]
test -s "$ARCHIVE"
command -v rsync >/dev/null
tar -xzf "$ARCHIVE" -C "$STAGE"
test -s "$STAGE/recruit/index.html"
test -s "$STAGE/recruit/redesign-preview/assets/hero-team.webp"
test -s "$STAGE/recruit/css/recruit-nav.css"
test -s "$STAGE/recruit/js/recruit-nav.js"
! find "$STAGE/recruit" -type l | grep . >/dev/null
grep -Fq '<!--License20261119vzyRP-->' "$STAGE/recruit/index.html"
! grep -q 'noindex' "$STAGE/recruit/index.html"
sudo mkdir -p /var/backups
sudo tar -C /var/www/html -czf "$BACKUP" recruit
test -s "$BACKUP"
echo "[BACKUP] $BACKUP"

CHANGED=1
sudo rsync -r --no-perms --no-owner --no-group --exclude='/index.html' \
  "$STAGE/recruit/" "$ROOT/"
sudo cp "$STAGE/recruit/index.html" "$ROOT/index.html"
sudo cmp "$STAGE/recruit/index.html" "$ROOT/index.html"
sudo cmp "$STAGE/recruit/entry/index.html" "$ROOT/entry/index.html"
sudo cmp "$STAGE/recruit/redesign-preview/assets/site.css" "$ROOT/redesign-preview/assets/site.css"

echo "=== Live smoke tests ==="
for host in https://recruit.atlib.jp https://www.atlib.jp/recruit; do
  curl -fsSL --max-time 20 "${host}/?release=${SHORT}" | grep -F '<!--License20261119vzyRP-->' >/dev/null
done
for path in /message/ /member/ /workstyle/ /entry/ /redesign-preview/assets/site.css; do
  curl -fsSL -o /dev/null --max-time 20 "https://recruit.atlib.jp${path}"
done
CHANGED=0
echo "[PASS] Public site and routes verified. Rollback archive: $BACKUP"
REMOTE

echo "=== Deployment complete. Confirm PC and mobile rendering on the live hostname. ==="
