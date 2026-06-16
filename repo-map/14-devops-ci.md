# Area: DevOps, CI/CD, and Configuration

## Purpose
Docker compose, infrastructure setup, GitHub workflows, configuration files, and local development environment management.

## Key Paths

### Docker Compose & Infrastructure
- `docker/docker-compose.yml` - Local development environment (PostgreSQL, DynamoDB, etc.)
- `docker/readmodel-db/` - Read model database initialization scripts
- `docker/in-app-notification-db/` - In-app notification DB schema
- `docker/m2m-event-db/` - M2M event DB schema
- `docker/scheduled-notification-db/` - Scheduled notification DB schema
- `docker/digest-tracking-db/` - Digest tracking DB schema
- `docker/event-store-init.sql` - Event store schema
- `docker/tenant-kind-history-db/` - Tenant kind history DB schema
- `docker/dynamo-db/` - DynamoDB schemas and seed data
- `docker/self-signed-certs/` - Local TLS certificates
- `docker/local-kms-seed/` - Local KMS seed data
- `docker/minio-seed/` - MinIO S3-compatible storage seed

### Infrastructure Scripts
- `scripts/infra-start.sh` - Start local infrastructure
- `scripts/infra-stop.sh` - Stop local infrastructure
- `scripts/infra-destroy.sh` - Destroy local infrastructure

### GitHub Workflows
- `.github/workflows/build-push.yaml` - Docker image build and push
- `.github/workflows/pr-app-validation.yaml` - PR app validation
- `.github/workflows/pr-docker-validation.yaml` - PR Docker validation

### Configuration
- `.madgerc` - Madge (module dependency) configuration
- `.npmrc` - NPM configuration
- `.spectral.yaml` - Spectral linting (OpenAPI specs)
- `knip.json` - Knip unused files checker
- `.vscode/settings.json` - VS Code settings
- `package.json` - Root workspace configuration
- `.gitignore` - Git ignore patterns
- `.dockerignore` - Docker ignore patterns

### Documentation
- `README.md` - Project overview
- `AUTHORS` - Contributors
- `LICENSE` - License file
- `CODEOWNERS` - CODEOWNERS file

## Collections (API Test Collections)
- `collections/` - Bruno API test collections for:
  - Agreement operations
  - Authorization and client management
  - Catalog and e-service management
  - Delegation operations
  - Purpose and purpose templates
  - Tenant operations
  - Attributes
  - Authentication
  - Notifications
  - M2M events and gateway endpoints
  - API Gateway endpoints
  - In-app notifications

## Dependencies
- Supports: All development and deployment workflows
