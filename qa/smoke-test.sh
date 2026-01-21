#!/bin/bash
#
# ProteinDojo Smoke Test
#
# Quick automated checks to verify the app is functioning.
# Run after deploys or significant changes.
#
# Usage:
#   ./qa/smoke-test.sh              # Test local (default)
#   ./qa/smoke-test.sh production   # Test production
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Determine environment
ENV=${1:-local}

if [ "$ENV" = "production" ] || [ "$ENV" = "prod" ]; then
  BASE_URL="https://proteindojo.com"
  API_URL="https://proteindojo.com"
else
  BASE_URL="http://localhost:5173"
  API_URL="http://localhost:3000"
fi

echo "========================================"
echo "ProteinDojo Smoke Test"
echo "Environment: $ENV"
echo "Frontend: $BASE_URL"
echo "API: $API_URL"
echo "========================================"
echo ""

PASSED=0
FAILED=0

# Test function
test_endpoint() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}
  local method=${4:-GET}

  printf "%-40s" "$name..."

  status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} ($status)"
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC} (expected $expected_status, got $status)"
    ((FAILED++))
  fi
}

# Test JSON response
test_json_endpoint() {
  local name=$1
  local url=$2
  local json_path=$3

  printf "%-40s" "$name..."

  response=$(curl -s "$url" 2>/dev/null)

  if echo "$response" | jq -e "$json_path" > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}FAIL${NC} (missing $json_path)"
    ((FAILED++))
  fi
}

echo "=== API Health Checks ==="
test_endpoint "API root" "$API_URL/"
test_json_endpoint "API returns status" "$API_URL/" ".status"

echo ""
echo "=== Public Endpoints ==="
test_endpoint "Challenges list" "$API_URL/api/challenges"
test_json_endpoint "Challenges has array" "$API_URL/api/challenges" ".challenges"
test_endpoint "GPU pricing" "$API_URL/api/billing/gpu-pricing"
test_endpoint "Help articles" "$API_URL/api/help"
test_endpoint "Reference binders" "$API_URL/api/reference-binders"

echo ""
echo "=== Protected Endpoints (expect 401) ==="
test_endpoint "Jobs (no auth)" "$API_URL/api/jobs" "401"
test_endpoint "Submissions (no auth)" "$API_URL/api/submissions" "401"
test_endpoint "Teams (no auth)" "$API_URL/api/teams" "401"
test_endpoint "User profile (no auth)" "$API_URL/api/users/me" "401"
test_endpoint "Transactions (no auth)" "$API_URL/api/billing/transactions" "401"

echo ""
echo "=== Frontend Pages ==="
test_endpoint "Home page" "$BASE_URL/"
test_endpoint "Challenges page" "$BASE_URL/challenges"
test_endpoint "Leaderboards page" "$BASE_URL/leaderboards"
test_endpoint "Help page" "$BASE_URL/help"
test_endpoint "Login page" "$BASE_URL/login"
test_endpoint "Signup page" "$BASE_URL/signup"

echo ""
echo "========================================"
echo "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Smoke test FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}Smoke test PASSED${NC}"
  exit 0
fi
