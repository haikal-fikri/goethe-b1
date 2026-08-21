#!/usr/bin/env bash
# Design-System-Gate.
#
# Die Legacy-Token-Namen (--fg, --bg-elev, --outline, --radius, --accent-*, --ok,
# --bad, --level-*) sind ERSATZLOS entfallen: die Kompatibilitäts-Alias-Schicht in
# globals.css ist mit dem Legacy-/admin-Panel gelöscht worden. Sie zeigen heute
# also auf gar nichts mehr — wer sie benutzt, bekommt keine Farbe, keinen Fehler.
# Zu verwenden sind die SEMANTISCHEN Tokens (--text-hi/-1/-2/-3, --surface-1,
# --border-1, --gruen/--blau/--rot …) bzw. die davon abgeleiteten
# Tailwind-Utilities (text-ink, bg-surface, border-line …).
#
# Das Gate gilt jetzt ohne Ausnahme — es gibt keinen nicht migrierten Bereich
# mehr. Geprüft werden .ts/.tsx unter src/.

set -uo pipefail
cd "$(dirname "$0")/.."

PATTERN='--fg\b|--fg-muted|--fg-dim|--bg-elev|--outline\b|--border-soft|--border-base|var\(--radius\)|--accent-write|--accent-speak|--accent-shared|--ok\b|--bad\b|--level-(b|c)[12]'

hits=$(
  grep -rnE -- "$PATTERN" src 2>/dev/null \
    | grep -E '\.(tsx|ts):'
)

if [ -n "$hits" ]; then
  echo "✗ Legacy-Design-Tokens gefunden:"
  echo ""
  echo "$hits"
  echo ""
  echo "  → Stattdessen semantische Tokens verwenden (siehe src/app/globals.css)."
  exit 1
fi

echo "✓ Keine Legacy-Design-Tokens."
