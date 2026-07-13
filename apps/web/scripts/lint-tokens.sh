#!/usr/bin/env bash
# Design-System-Gate.
#
# Die Legacy-Token-Namen (--fg, --bg-elev, --outline, --radius, --accent-*, --ok,
# --bad, --level-*) existieren nur noch als Kompatibilitäts-Aliase in globals.css,
# damit das nicht migrierte /admin-Panel stimmig rendert. Migrierter Code muss die
# SEMANTISCHEN Tokens verwenden (--text-hi/-1/-2/-3, --surface-1, --border-1,
# --gruen/--blau/--rot …) bzw. die davon abgeleiteten Tailwind-Utilities
# (text-ink, bg-surface, border-line …).
#
# Ohne dieses Gate wächst die Alias-Schicht fest und das Projekt trägt dauerhaft
# zwei Farbvokabulare. Erlaubte Ausnahmen: alles unter src/components/admin/ und
# src/app/admin/ sowie globals.css selbst (dort werden die Aliase DEFINIERT).

set -uo pipefail
cd "$(dirname "$0")/.."

PATTERN='--fg\b|--fg-muted|--fg-dim|--bg-elev|--outline\b|--border-soft|--border-base|var\(--radius\)|--accent-write|--accent-speak|--accent-shared|--ok\b|--bad\b|--level-(b|c)[12]'

hits=$(
  grep -rnE -- "$PATTERN" src 2>/dev/null \
    | grep -E '\.(tsx|ts):' \
    | grep -v '^src/components/admin/' \
    | grep -v '^src/app/admin/'
)

if [ -n "$hits" ]; then
  echo "✗ Legacy-Design-Tokens außerhalb von /admin gefunden:"
  echo ""
  echo "$hits"
  echo ""
  echo "  → Stattdessen semantische Tokens verwenden (siehe src/app/globals.css)."
  exit 1
fi

echo "✓ Keine Legacy-Design-Tokens außerhalb von /admin."
