# Repository Map — pagopa/interop-be-monorepo

This directory contains the as-is structural orientation of the pagopa/interop-be-monorepo on branch `develop`.

## Usage

**Start here:** Open `index.md` for the complete area directory table and dependency flows.

Each area (01 through 17) has its own node file with:
- **Purpose:** What the area does
- **Key Paths:** Main packages and folders (no file contents)
- **Owned By:** Team responsible
- **Depends On:** Upstream area dependencies
- **Notes:** Critical considerations

## Key Characteristics

- **131 packages** organized into **17 coherent areas**
- **Event-driven architecture** with CQRS read models
- **Template patterns** (Catalog descriptors, Purpose templates)
- **Archival patterns** (hard-delete, scheduled cleanup)
- **Cross-cutting domains** (Notification System, API Gateways)
- **M2M v2 → v3 migration** in progress
- **PNPM monorepo** with Turborepo caching

## Dependency Hierarchy

```
Layer 0: Build & Core Models
  ↓
Layer 1: Event Platform, Read Model, Crypto
  ↓
Layer 2: Domain Logic (7 domains)
  ↓
Layer 3: APIs, Notifications, Analytics
  ↓
Layer 4: Tests & Collections
```

## Quick Commands

**Find all packages in an area:** Search area node files by package name prefix.

**Trace a dependency:** Follow the "Depends On" links through the area graph.

**Find affected areas:** For a change in area X, check which areas list X in "Depends On".

## Principles

1. **Orientation only** — No file contents, only structure
2. **As-is develop** — Reflects current branch state
3. **Pull-based reading** — Read index first, then specific areas
4. **No secrets** — Only paths, no credentials or tokens

---

Generated: 2026-06-11  
Repository: pagopa/interop-be-monorepo (develop)
