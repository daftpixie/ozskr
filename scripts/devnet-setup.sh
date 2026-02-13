#!/usr/bin/env bash
# =============================================================================
# ozskr.ai — Devnet Alpha Testing Setup
# Sets up a local environment for testing with Solana devnet
# =============================================================================
set -euo pipefail

echo "=== ozskr.ai Devnet Setup ==="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Error: node is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm is required"; exit 1; }

# Check for Solana CLI (optional — not required for web-only testing)
if command -v solana >/dev/null 2>&1; then
  SOLANA_CLI=true
  echo "[OK] Solana CLI found: $(solana --version)"
else
  SOLANA_CLI=false
  echo "[SKIP] Solana CLI not found (optional for web-only testing)"
fi

echo ""

# Step 1: Check .env.local exists
if [ ! -f .env.local ]; then
  echo "[SETUP] Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "[ACTION REQUIRED] Fill in your API keys in .env.local"
  echo "  Required for alpha testing:"
  echo "    - NEXT_PUBLIC_HELIUS_RPC_URL (get free key at https://dev.helius.xyz)"
  echo "    - HELIUS_API_KEY (same key, used for balance queries)"
  echo "    - NEXT_PUBLIC_SUPABASE_URL + keys"
  echo "    - JWT_SECRET (generate: openssl rand -base64 32)"
  echo "    - ANTHROPIC_API_KEY (for content generation)"
  echo ""
else
  echo "[OK] .env.local exists"
fi

# Step 2: Verify critical env vars
echo ""
echo "--- Checking environment variables ---"

check_env() {
  local var_name=$1
  local required=${2:-true}
  # Source .env.local to check values
  local val=$(grep "^${var_name}=" .env.local 2>/dev/null | cut -d'=' -f2-)
  if [ -z "$val" ] || [[ "$val" == *"YOUR_KEY"* ]] || [[ "$val" == *"your-"* ]]; then
    if [ "$required" = true ]; then
      echo "[MISSING] $var_name — required for alpha testing"
      return 1
    else
      echo "[SKIP] $var_name — optional"
      return 0
    fi
  else
    echo "[OK] $var_name"
    return 0
  fi
}

MISSING=0
check_env "NEXT_PUBLIC_SOLANA_NETWORK" true || MISSING=$((MISSING + 1))
check_env "NEXT_PUBLIC_HELIUS_RPC_URL" true || MISSING=$((MISSING + 1))
check_env "HELIUS_API_KEY" true || MISSING=$((MISSING + 1))
check_env "NEXT_PUBLIC_SUPABASE_URL" true || MISSING=$((MISSING + 1))
check_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" true || MISSING=$((MISSING + 1))
check_env "SUPABASE_SERVICE_ROLE_KEY" true || MISSING=$((MISSING + 1))
check_env "JWT_SECRET" true || MISSING=$((MISSING + 1))
check_env "ANTHROPIC_API_KEY" true || MISSING=$((MISSING + 1))
check_env "UPSTASH_REDIS_REST_URL" false || true
check_env "UPSTASH_REDIS_REST_TOKEN" false || true
check_env "ADMIN_WALLETS" false || true

echo ""

if [ $MISSING -gt 0 ]; then
  echo "[WARNING] $MISSING required env vars are missing or have placeholder values"
  echo "  Edit .env.local before running the dev server"
  echo ""
fi

# Step 3: Ensure devnet network
echo "--- Network Configuration ---"
NETWORK=$(grep "^NEXT_PUBLIC_SOLANA_NETWORK=" .env.local 2>/dev/null | cut -d'=' -f2-)
if [ "$NETWORK" = "mainnet-beta" ]; then
  echo "[WARNING] Network is set to mainnet-beta!"
  echo "  For alpha testing, set NEXT_PUBLIC_SOLANA_NETWORK=devnet in .env.local"
else
  echo "[OK] Network: devnet"
fi

# Step 4: Configure Solana CLI for devnet (if available)
if [ "$SOLANA_CLI" = true ]; then
  echo ""
  echo "--- Solana CLI Setup ---"
  CURRENT_CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $NF}')
  if [[ "$CURRENT_CLUSTER" != *"devnet"* ]]; then
    echo "[ACTION] Setting Solana CLI to devnet..."
    solana config set --url https://api.devnet.solana.com
  else
    echo "[OK] Solana CLI already on devnet"
  fi

  # Check wallet
  WALLET=$(solana address 2>/dev/null || echo "none")
  if [ "$WALLET" != "none" ]; then
    echo "[OK] Wallet: $WALLET"
    BALANCE=$(solana balance 2>/dev/null || echo "0 SOL")
    echo "     Balance: $BALANCE"
    if [[ "$BALANCE" == "0 SOL" ]] || [[ "$BALANCE" == "0"* ]]; then
      echo "[TIP] Request devnet SOL: solana airdrop 2"
    fi
  else
    echo "[SKIP] No Solana wallet configured"
    echo "  Create one: solana-keygen new"
  fi
fi

# Step 5: Install dependencies
echo ""
echo "--- Dependencies ---"
if [ -d node_modules ]; then
  echo "[OK] node_modules exists"
else
  echo "[SETUP] Installing dependencies..."
  pnpm install
fi

# Step 6: Run checks
echo ""
echo "--- Verification ---"
echo "Running typecheck..."
if pnpm typecheck 2>/dev/null; then
  echo "[OK] TypeScript checks passed"
else
  echo "[WARNING] TypeScript errors found — run 'pnpm typecheck' for details"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Fill in any missing env vars in .env.local"
echo "  2. Run: pnpm dev"
echo "  3. Visit: http://localhost:3000"
echo "  4. Connect a Phantom/Solflare wallet (set to devnet)"
echo ""
echo "For alpha tester whitelist management:"
echo "  - Add ADMIN_WALLETS=<your-wallet-address> to .env.local"
echo "  - Use /api/admin-whitelist endpoints to manage access"
echo ""
echo "See docs/alpha-testing/devnet-guide.md for full instructions"
