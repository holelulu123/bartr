#!/usr/bin/env bash
# Seed 40 test exchange offers via the API.
# Usage: bash scripts/seed-offers.sh
# To remove them later: bash scripts/seed-offers.sh --cleanup

set -euo pipefail

API="http://localhost:4000"
EMAIL="seedbot@test.local"
PASS="SeedBot123!"
IDS_FILE="/tmp/seeded-offer-ids.txt"

# ── Register + login ──────────────────────────────────────────────
register() {
  # May fail if already registered — that's fine
  curl -s -X POST "$API/auth/register/email" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null 2>&1 || true
}

login() {
  TOKEN=$(curl -sf -X POST "$API/auth/login/email" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '.token // .access_token // empty')

  if [ -z "$TOKEN" ]; then
    echo "ERROR: Could not login. Is the API running at $API?"
    exit 1
  fi
  echo "Logged in."
}

# ── Cleanup ───────────────────────────────────────────────────────
if [ "${1:-}" = "--cleanup" ]; then
  if [ ! -f "$IDS_FILE" ]; then
    echo "No seeded offers file found at $IDS_FILE"
    exit 1
  fi
  register
  login
  count=0
  while IFS= read -r oid; do
    curl -sf -X DELETE "$API/exchange/offers/$oid" \
      -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1 && ((count++)) || true
  done < "$IDS_FILE"
  rm -f "$IDS_FILE"
  echo "Deleted $count offers."
  exit 0
fi

# ── Seed ──────────────────────────────────────────────────────────
register
login

CRYPTOS=("BTC" "ETH" "XMR" "SOL" "USDT" "USDC")
FIATS=("USD" "EUR" "GBP" "ILS" "JPY" "CAD")
TYPES=("buy" "sell")
SOURCES=("coingecko" "binance" "kraken")
METHODS='["bank_transfer"]'
METHODS_LIST=(
  '["bank_transfer"]'
  '["cash_in_person"]'
  '["paypal"]'
  '["bank_transfer","cash_in_person"]'
  '["wise"]'
  '["revolut"]'
  '["bank_transfer","paypal"]'
  '["cash_in_person","wise"]'
)
COUNTRIES=("US" "GB" "DE" "IL" "JP" "CA" "FR" "AU" "NL" "SE")
CITIES=("New York" "London" "Berlin" "Tel Aviv" "Tokyo" "Toronto" "Paris" "Sydney" "Amsterdam" "Stockholm")
TERMS=(
  "Fast and reliable trader, reply within 5 minutes"
  "No third-party payments accepted"
  "ID verification required for amounts over 1000"
  "Weekend trades only"
  "Available Mon-Fri 9am-6pm UTC"
  "Experienced trader with 100+ completed deals"
  "First-time traders welcome"
  "Escrow preferred for large amounts"
  "Quick release, please have payment ready"
  ""
)

> "$IDS_FILE"

echo "Creating 40 offers..."
for i in $(seq 1 40); do
  ci=$((RANDOM % ${#CRYPTOS[@]}))
  fi=$((RANDOM % ${#FIATS[@]}))
  ti=$((RANDOM % 2))
  si=$((RANDOM % ${#SOURCES[@]}))
  mi=$((RANDOM % ${#METHODS_LIST[@]}))
  coi=$((RANDOM % ${#COUNTRIES[@]}))
  tei=$((RANDOM % ${#TERMS[@]}))

  crypto="${CRYPTOS[$ci]}"
  fiat="${FIATS[$fi]}"
  otype="${TYPES[$ti]}"
  source="${SOURCES[$si]}"
  methods="${METHODS_LIST[$mi]}"
  country="${COUNTRIES[$coi]}"
  city="${CITIES[$coi]}"
  terms="${TERMS[$tei]}"
  margin=$(( (RANDOM % 11) - 5 ))  # -5 to +5

  min_amount=$(( (RANDOM % 9 + 1) * 100 ))       # 100-900
  max_amount=$(( min_amount + (RANDOM % 9 + 1) * 1000 ))  # +1000 to +9000

  body=$(jq -n \
    --arg ot "$otype" \
    --arg cc "$crypto" \
    --arg fc "$fiat" \
    --arg ps "$source" \
    --argjson mp "$margin" \
    --argjson min "$min_amount" \
    --argjson max "$max_amount" \
    --arg co "$country" \
    --arg ci "$city" \
    --arg te "$terms" \
    --argjson pm "$methods" \
    '{
      offer_type: $ot,
      crypto_currency: $cc,
      fiat_currency: $fc,
      rate_type: "market",
      price_source: $ps,
      margin_percent: $mp,
      min_amount: $min,
      max_amount: $max,
      payment_methods: $pm,
      country_code: $co,
      city: $ci
    } + (if $te != "" then {terms: $te} else {} end)'
  )

  result=$(curl -sf -X POST "$API/exchange/offers" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$body" 2>&1) || {
    echo "  [$i/40] FAILED: $result"
    continue
  }

  oid=$(echo "$result" | jq -r '.id // empty')
  if [ -n "$oid" ]; then
    echo "$oid" >> "$IDS_FILE"
    echo "  [$i/40] Created $otype $crypto/$fiat (id: ${oid:0:8}...)"
  else
    echo "  [$i/40] FAILED: no id returned"
  fi
done

echo ""
echo "Done! Created $(wc -l < "$IDS_FILE") offers."
echo "To remove them: bash scripts/seed-offers.sh --cleanup"
