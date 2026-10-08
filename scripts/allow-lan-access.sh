#!/usr/bin/env bash
# Opens the LAN firewall for the ERP API (Swagger) and the Next.js client.
# UFW defaults to DROP on incoming, so without these rules other machines on the
# LAN get a silent connection timeout even though the app binds 0.0.0.0.
# Run with: sudo bash scripts/allow-lan-access.sh
set -euo pipefail

SUBNET="${SUBNET:-192.168.0.0/24}"
API_PORT="${API_PORT:-3011}"
CLIENT_PORT="${CLIENT_PORT:-3000}"

ufw allow from "$SUBNET" to any port "$API_PORT" proto tcp comment 'ERP API / Swagger (LAN)'
ufw allow from "$SUBNET" to any port "$CLIENT_PORT" proto tcp comment 'ERP client (LAN)'
ufw reload
ufw status numbered
