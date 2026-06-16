# Area: Infrastructure & Shared Libraries

## Purpose
Provides shared utilities, models, configuration, authentication, and API client generation for all other packages.

## Key Packages
- `packages/models` - Protobuf-generated domain models and converters
- `packages/commons` - Shared utilities (auth, config, file management, email, etc.)
- `packages/api-clients` - Generated API client SDKs
- `packages/commons-test` - Test utilities
- `packages/eslint-config` - ESLint shared config

## Key Paths
### Models
- `packages/models/proto/` - Protobuf definitions (v1 and v2)
- `packages/models/src/` - Generated TypeScript models
- `packages/models/src/risk-analysis/rules/` - Business rules by tenant type

### Commons
- `packages/commons/src/auth/` - JWT, JWK, authentication, authorization
- `packages/commons/src/config/` - Configuration management
- `packages/commons/src/router/` - Express router, error handlers
- `packages/commons/src/repositories/` - Event store access
- `packages/commons/src/file-manager/` - File upload/download
- `packages/commons/src/email-manager/` - Email sending
- `packages/commons/src/kafka/` - Kafka producers/consumers
- `packages/commons/src/rate-limiter/` - Rate limiting middleware
- `packages/commons/src/sqs/` - AWS SQS utilities
- `packages/commons/src/safe-storage/` - Safe storage integration
- `packages/commons/src/logging/` - Logging utilities
- `packages/commons/src/interop-token/` - Interop JWT token handling

### API Clients
- `packages/api-clients/open-api/` - OpenAPI specifications (YAML)
- `packages/api-clients/src/` - Generated Axios-based clients
- `packages/api-clients/src/generatorUtils.ts` - Code generation utilities

## Dependencies
- Used by: All other packages
