# LibreChat Fork → Vercel AI SDK Rebuild

> **Quick Start**: [Executive Summary](./EXECUTIVE_SUMMARY.md) → [Quick Start Guide](./QUICK_START.md) → [Starter Integration](./starter-integration.md)

## Executive Summary

This repository is a **heavily customized LibreChat fork** that has evolved into a white-label SaaS platform for business AI tools. It's time to rebuild on a modern, scalable stack optimized for multi-tenancy and easy deployment.

**All documents are cross-referenced** - follow the links to navigate between related sections.

### Current Pain Points
- **Slow builds**: 5-15 minute Docker builds, fragile caching
- **Not multi-tenant ready**: Hard-coded logic, difficult to isolate tenants
- **Heavy dependencies**: 900+ npm packages, complex build pipeline
- **Deployment fragility**: Docker-dependent, difficult to scale
- **Technical debt**: Fork maintenance burden, upstream conflicts

### Why Rebuild?

| Aspect | Current (LibreChat Fork) | Target (Vercel AI SDK) |
|--------|-------------------------|------------------------|
| **Build Time** | 5-15 minutes | 30-60 seconds |
| **Multi-tenancy** | Manual/difficult | Built-in from day 1 |
| **Deployment** | Docker-only | Vercel/Edge/Cloudflare |
| **Scaling** | Vertical (expensive) | Horizontal (auto-scale) |
| **Maintenance** | Fork management overhead | Clean codebase ownership |
| **Developer UX** | Complex setup | Modern DX |

### Technology Migration

```
FROM: LibreChat Fork (React + Express + MongoDB + Docker)
TO: Modern AI Stack (React + Hono + Neon + Vercel/Cloudflare)
```

## Documentation Structure

1. **[architecture.md](./architecture.md)** - Current system architecture deep dive
2. **[features.md](./features.md)** - Complete feature inventory with implementation details
3. **[tech-stack.md](./tech-stack.md)** - Current vs. target technology comparison
4. **[pain-points.md](./pain-points.md)** - Detailed technical debt analysis
5. **[migration-plan.md](./migration-plan.md)** - Step-by-step rebuild strategy (7 months)
6. **[starter-integration.md](./starter-integration.md)** - ⚡ **ACCELERATED: 4-month path with ShadFlareAi + oRPC**
7. **[data-models.md](./data-models.md)** - Database schemas and data relationships
8. **[api-endpoints.md](./api-endpoints.md)** - Complete API surface documentation

## Quick Facts

### Current System
- **Version**: LibreChat v0.7.9-rc1 (heavily modified)
- **Purpose**: White-label AI business tools platform (SovereignJK/Solo:OS)
- **Tech**: Node.js + React + MongoDB + Docker + LibreChat base
- **Lines of Code**: ~100K+ (including LibreChat core + customizations)
- **Dependencies**: 900+ npm packages across workspaces

### Core Features
1. **Multi-AI Chat** - OpenAI, Anthropic, xAI (Grok), Google
2. **Business Agents** - 8+ specialized agents (Hybrid Offer, DCM, ICP, etc.)
3. **Memory System** - User business context persistence
4. **CometChat Integration** - Community chat, DMs, group conversations
5. **LMS (Academy)** - Course modules with Stream video recordings
6. **RAG System** - File search and vector embeddings
7. **MCP Support** - Model Context Protocol for tool integration
8. **Stripe Payments** - Tiered access (free/pro)
9. **Stream Video** - Video calls with recording and transcription

### Target Stack

```
Frontend:
- Vite + React 18 + TypeScript
- TanStack Router (type-safe routing)
- MobX (state management)
- Shadcn UI (component library)
- Vercel AI SDK (streaming, hooks)
- Framer Motion (animations)

Backend:
- Hono (fast edge-compatible framework)
- Cloudflare Workers (edge compute)
- Neon Postgres (serverless database)
- Drizzle ORM (type-safe queries)
- Better Auth (modern auth)

AI/Tools:
- Vercel AI SDK (core)
- AI Elements (prebuilt UI components)
- Composio (tool integrations)
- OpenAI/Anthropic/etc. (LLM providers)
```

## Next Steps

### Recommended Path ⚡

**Use the accelerated approach with ShadFlareAi starter:**

1. Read **[starter-integration.md](./starter-integration.md)** (4-month timeline)
2. Fork [ShadFlareAi](https://github.com/codevibesmatter/ShadFlareAi)
3. Setup Neon Postgres + oRPC
4. Begin feature migration with 3-month head start

### Alternative Path

If you want to build from scratch:
1. Read through all documentation files in order
2. Review the migration plan (7 months)
3. Set up proof-of-concept with new stack
4. Begin phased migration starting with core chat

## Key Metrics to Improve

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Build time | 5-15 min | 30-60 sec | **20-30x faster** |
| Cold start | 5-10 sec | <500ms | **10-20x faster** |
| Deploy time | 10-20 min | 1-2 min | **10x faster** |
| Monthly cost (10K users) | $500-1000 | $100-200 | **5x cheaper** |
| Iteration speed | Hours | Minutes | **10x faster** |

## Contact & Context

- **Product**: Solo:OS (formerly SovereignAI)
- **Owner**: James Kemp business tools platform
- **Current Users**: ~50-100 active (beta)
- **Target**: White-label SaaS for business coaches
- **Timeline**: Rebuild over Q1 2025

---

**Read [architecture.md](./architecture.md) next for a deep dive into the current system.**

