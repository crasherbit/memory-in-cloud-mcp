# Build & Infrastructure

**Purpose:**  
Monorepo workspace, build configuration, linting, testing, CI/CD pipeline, and development tooling.

**Key Paths:**
- `packages/eslint-config/` — Shared ESLint rules across all packages
- `pnpm-workspace.yaml` — PNPM monorepo configuration
- `pnpm-lock.yaml` — Dependency lock file
- `package.json` — Root workspace manifest
- `tsconfig.json` — TypeScript compiler configuration
- `turbo.json` — Turborepo build cache & task definitions
- `knip.json` — Knip unused file/export checker
- `.github/workflows/` — CI/CD pipelines (build, PR validation, docker)
- `docker/` — Docker build & deployment configs
- `scripts/` — Utility scripts (setup, migration, etc.)
- `.madgerc` — Circular dependency detector
- `.spectral.yaml` — OpenAPI linting
- `renovate.json` — Dependency update automation
- `CODEOWNERS` — Code ownership rules
- `.npmrc` — NPM registry configuration
- `register-connector-postgres.json` — Database migration connector

**Owned By:**  
DevOps & Build team

**Depends On:**  
None (foundational)

**Notes:**  
Breaking changes to workspace config or TypeScript settings affect all packages; turborepo cache invalidation can slow builds.
