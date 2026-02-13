#!/bin/bash
# Deployment Verification Script
# Run after deploying to verify all services are healthy.
#
# Usage:
#   ./scripts/verify-deployment.sh
#   FRONTEND_URL=https://staging.ozskr.ai ./scripts/verify-deployment.sh

set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-https://ozskr.ai}"
API_URL="${FRONTEND_URL}/api"
SUPABASE_URL="${SUPABASE_URL:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  printf "  %-30s " "$name"
  status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    printf "${GREEN}OK${NC} (%s)\n" "$status"
    PASS=$((PASS + 1))
  elif [ "$status" = "000" ]; then
    printf "${RED}UNREACHABLE${NC}\n"
    FAIL=$((FAIL + 1))
  else
    printf "${RED}FAIL${NC} (got %s, expected %s)\n" "$status" "$expected"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== ozskr.ai Deployment Verification ==="
echo "Frontend: $FRONTEND_URL"
echo "API:      $API_URL"
echo ""

echo "--- Frontend (Vercel) ---"
check "Homepage" "$FRONTEND_URL"
check "Dashboard" "$FRONTEND_URL/dashboard"

echo ""
echo "--- API (Hono) ---"
check "Health" "$API_URL/health"
check "Health (readiness)" "$API_URL/health/ready"
check "Auth (unauthenticated)" "$API_URL/auth/session" "401"
check "Trading (unauthenticated)" "$API_URL/trading/quote" "401"

echo ""
echo "--- Supabase ---"
if [ -n "$SUPABASE_URL" ]; then
  check "REST endpoint" "$SUPABASE_URL/rest/v1/" "200"
else
  printf "  %-30s ${YELLOW}SKIP${NC} (SUPABASE_URL not set)\n" "REST endpoint"
  WARN=$((WARN + 1))
fi

echo ""
echo "--- Security Headers ---"
printf "  %-30s " "X-Content-Type-Options"
header=$(curl -s -I --connect-timeout 10 "$API_URL/health" 2>/dev/null | grep -i "x-content-type-options" || echo "")
if echo "$header" | grep -qi "nosniff"; then
  printf "${GREEN}OK${NC} (nosniff)\n"
  PASS=$((PASS + 1))
else
  printf "${YELLOW}MISSING${NC}\n"
  WARN=$((WARN + 1))
fi

printf "  %-30s " "X-Frame-Options"
header=$(curl -s -I --connect-timeout 10 "$API_URL/health" 2>/dev/null | grep -i "x-frame-options" || echo "")
if echo "$header" | grep -qi "deny"; then
  printf "${GREEN}OK${NC} (DENY)\n"
  PASS=$((PASS + 1))
else
  printf "${YELLOW}MISSING${NC}\n"
  WARN=$((WARN + 1))
fi

echo ""
echo "=== Results ==="
printf "  ${GREEN}PASS: %d${NC}  ${RED}FAIL: %d${NC}  ${YELLOW}WARN: %d${NC}\n" "$PASS" "$FAIL" "$WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "Deployment verification FAILED. Check the failures above."
  exit 1
else
  echo "Deployment verification passed."
  exit 0
fi
