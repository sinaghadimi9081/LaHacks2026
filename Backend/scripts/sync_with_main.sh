#!/usr/bin/env bash
# Pull origin/main into the local branch without losing the local-only work
# (tesseract changes in setup.{sh,ps1}, scripts/seed_demo_data.py, and
# core/management/commands/reset_demo_users.py).
#
# Run from anywhere:  bash Backend/scripts/sync_with_main.sh
# Or from Backend/:    bash scripts/sync_with_main.sh

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

BACKUP_DIR="$HOME/.nf_local_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "==> Backing up local-only work to $BACKUP_DIR"

[ -f Backend/scripts/seed_demo_data.py ] && \
  cp Backend/scripts/seed_demo_data.py "$BACKUP_DIR/seed_demo_data.py"
[ -f Backend/core/management/commands/reset_demo_users.py ] && \
  cp Backend/core/management/commands/reset_demo_users.py "$BACKUP_DIR/reset_demo_users.py"
[ -f Backend/setup.sh ] && cp Backend/setup.sh "$BACKUP_DIR/setup.sh.local"
[ -f Backend/setup.ps1 ] && cp Backend/setup.ps1 "$BACKUP_DIR/setup.ps1.local"

echo "==> Clearing any stale git index lock"
rm -f .git/index.lock || true

echo "==> Stashing local changes to setup.sh / setup.ps1"
git stash push -m "tesseract install + local edits" Backend/setup.sh Backend/setup.ps1 2>/dev/null || \
  echo "    (nothing to stash)"

# Untracked dirs that origin/main also creates would block the pull.
echo "==> Moving untracked Backend/core and Backend/scripts aside"
[ -d Backend/core ] && mv Backend/core "$BACKUP_DIR/core_untracked"
[ -d Backend/scripts ] && mv Backend/scripts "$BACKUP_DIR/scripts_untracked"

echo "==> Fetching and fast-forwarding main"
git fetch origin
git checkout main
git pull origin main

echo "==> Restoring your seed script and reset_demo_users command on top"
mkdir -p Backend/core/management/commands
cp "$BACKUP_DIR/seed_demo_data.py" Backend/scripts/seed_demo_data.py 2>/dev/null || true
cp "$BACKUP_DIR/reset_demo_users.py" Backend/core/management/commands/reset_demo_users.py 2>/dev/null || true

echo "==> Re-applying the setup.sh / setup.ps1 changes"
if ! git stash pop 2>/dev/null; then
  echo
  echo "    Stash pop produced conflicts. Open Backend/setup.sh and Backend/setup.ps1"
  echo "    and keep BOTH the upstream --fresh flag AND the ensure_tesseract block."
  echo "    Your originals are saved at:"
  echo "      $BACKUP_DIR/setup.sh.local"
  echo "      $BACKUP_DIR/setup.ps1.local"
fi

echo
echo "==> Done. Local main is now in sync with origin/main."
echo "    Backups (incl. anything from your old core/ folder) are in:"
echo "      $BACKUP_DIR"
echo
echo "    Next: switch to your dev branch and pull main into it:"
echo "        git checkout dev/sina"
echo "        git merge main"
