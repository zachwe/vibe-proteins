#!/bin/bash
set -e

# Deploy the Datasette dashboard to Fly.io
# Prerequisites:
#   1. First deploy API with Litestream enabled
#   2. Wait for initial backup to R2
#   3. Set up secrets (see below)
#   4. Create fly.datasette.toml.local with your app name

CONFIG_FILE="fly.datasette.toml.local"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: $CONFIG_FILE not found"
    echo "Copy fly.datasette.toml to fly.datasette.toml.local and set your app name"
    exit 1
fi

APP_NAME=$(grep '^app = ' "$CONFIG_FILE" | sed 's/app = "\(.*\)"/\1/')

echo "=== Deploying Datasette Dashboard ==="

# Check if app exists
if ! flyctl apps list | grep -q "$APP_NAME"; then
    echo "Creating Fly app: $APP_NAME"
    flyctl apps create "$APP_NAME"
fi

echo ""
echo "Make sure you've set the required secrets:"
echo "  flyctl secrets set -a $APP_NAME R2_ACCOUNT_ID=xxx"
echo "  flyctl secrets set -a $APP_NAME R2_ACCESS_KEY_ID=xxx"
echo "  flyctl secrets set -a $APP_NAME R2_SECRET_ACCESS_KEY=xxx"
echo "  flyctl secrets set -a $APP_NAME R2_BUCKET_NAME=vibeproteins"
echo "  flyctl secrets set -a $APP_NAME DATASETTE_PASSWORD_HASH='xxx'"
echo ""
echo "To generate password hash, run:"
echo "  python -c \"from datasette_auth_passwords import password_hash; print(password_hash('YOUR_PASSWORD'))\""
echo ""
read -p "Press Enter to continue with deployment (Ctrl+C to cancel)..."

flyctl deploy --config "$CONFIG_FILE" --remote-only

echo ""
echo "=== Deployment Complete ==="
echo "Dashboard URL: https://$APP_NAME.fly.dev"
echo ""
echo "To refresh the database (get latest data):"
echo "  flyctl apps restart $APP_NAME"
