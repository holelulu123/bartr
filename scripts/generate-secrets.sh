#!/usr/bin/env bash
# Generate production-ready secrets for bartr
# Usage: bash scripts/generate-secrets.sh

echo "# Production Secrets for bartr"
echo "# Generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+')"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+')"
