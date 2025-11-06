# Token Bundle Billing - Complete Implementation Guide

> **Updated Model**: Bundle-based pricing with overage charges (no more CometChat)

---

## 🎯 Billing Architecture

### Two-Layer System

```
LAYER 1: Owner → Users (Stripe Connect)
┌───────────────────────────────────────────┐
│ Owner configures tiers with token bundles │
│ - Free: 100K tokens/mo → BLOCK on exhaust │
│ - Pro: $29/mo + 1M tokens → $0.02/1K over │
│ - Enterprise: Custom pricing              │
└───────────────────────────────────────────┘

LAYER 2: God (You) → Owners (Usage-Based)
┌───────────────────────────────────────────┐
│ Track actual AI costs per tenant          │
│ - Token usage across all providers        │
│ - Storage costs                            │
│ - Compute costs                            │
│ Monthly invoice to Owner                   │
└───────────────────────────────────────────┘
```

---

## 📊 Database Schema

### Key Tables (in `db/schema/billing.ts`)

**`tierPricing`** - Owner-configurable tiers
```typescript
{
  tier: 'free' | 'pro' | 'enterprise',
  priceMonthly: 2900,              // $29.00 in cents
  tokenBundleMonthly: 1_000_000,   // Included tokens
  overagePricePer1K: 2,            // $0.02 per 1K overage
  overageBehavior: 'block' | 'charge' | 'warn',
  features: { maxAgents, chatAccess, ... }
}
```

**`ownerSubscriptions`** - User subscriptions with usage tracking
```typescript
{
  userId: uuid,
  tier: 'free' | 'pro' | 'enterprise',
  tokenBundleSize: 1_000_000,
  tokensUsedThisPeriod: 485_432,   // Current usage
  tokensOverage: 0,                 // Tokens beyond bundle
  overageChargesCents: 0,           // Accumulated overage charges
  bundleExhausted: false,
  currentPeriodEnd: '2025-02-01'
}
```

---

## 🔧 Implementation Files

### 1. Token Enforcement Middleware

**File**: `worker/middleware/token-enforcement.ts`

**What it does**:
- Checks token bundle before allowing chat
- Blocks free tier when exhausted
- Allows paid tiers with overage tracking
- Returns clear error messages

**Usage in routes**:
```typescript
import { tokenEnforcementMiddleware } from '@/worker/middleware/token-enforcement';

app.use('/v1/chat', tokenEnforcementMiddleware);
```

### 2. Chat API with Token Tracking

**File**: `worker/routes/chat-with-enforcement.ts`

**Key features**:
- Uses Vercel AI SDK `streamText()`
- Tracks tokens in `onFinish` callback
- Calls `incrementTokenUsage()` after completion
- Returns usage headers to client

**Response headers**:
```
X-Token-Warning: "Running low on tokens"
X-Tokens-Overage: "15432"
```

### 3. Token Usage Display

**File**: `src/features/billing/components/TokenUsageDisplay.tsx`

**What it shows**:
- Progress bar: 485K / 1M tokens (48%)
- Warning at 80%: "Running low, upgrade to continue"
- Danger at 100%: "Bundle exhausted" (with CTA)
- Overage charges if applicable

**Where to use**:
```tsx
// In user dashboard
import { TokenUsageDisplay } from '@/features/billing/components/TokenUsageDisplay';

<TokenUsageDisplay />
```

### 4. Tier Configuration Form

**File**: `src/features/billing/components/TierConfigForm.tsx`

**Owner controls**:
- Base price (monthly/yearly)
- Token bundle size
- Overage price per 1K tokens
- Overage behavior (block/charge/warn)
- Feature toggles

**Where to use**:
```tsx
// In Owner billing settings
<TierConfigForm 
  tier="pro"
  onSave={async (config) => {
    await fetch('/api/billing/tiers/configure', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }}
/>
```

---

## 🎨 User Experience Flow

### 1. User Signs Up
```
1. Register → Assigned Free Tier (100K tokens)
2. Can immediately use chat
3. Usage tracked per message
```

### 2. Using Chat
```
Message 1: 750 tokens → 750 / 100,000 (0.75%)
Message 2: 820 tokens → 1,570 / 100,000 (1.57%)
...
Message 120: → 85,000 / 100,000 (85%) ⚠️ Warning
```

### 3. Bundle Exhausted

**Free Tier** (100K+ tokens):
```
❌ BLOCKED
┌──────────────────────────────────────┐
│ Token Bundle Exhausted               │
│                                      │
│ You've used all 100,000 tokens      │
│ this month.                          │
│                                      │
│ [Upgrade to Pro] to continue         │
└──────────────────────────────────────┘
```

**Pro Tier** (1M+ tokens):
```
⚠️ OVERAGE (continues working)
┌──────────────────────────────────────┐
│ You're in overage                    │
│                                      │
│ Used: 1,015,432 tokens               │
│ Overage: 15,432 tokens               │
│ Extra charge: $0.31                  │
│                                      │
│ [Upgrade to Enterprise] for cheaper  │
│ overage rates                        │
└──────────────────────────────────────┘
```

### 4. Next Billing Period
```
✅ Auto-reset on subscription renewal
- tokensUsedThisPeriod → 0
- tokensOverage → 0
- overageCharges → invoiced and reset
- bundleExhausted → false
```

---

## 💰 Owner Experience

### 1. Initial Setup

**Connect Stripe** (Stripe Connect):
```
1. Click "Set up billing"
2. Redirected to Stripe onboarding
3. Completes Stripe verification
4. Returns to app → billing enabled ✅
```

**Configure Tiers**:
```typescript
FREE_TIER:
  Price: $0/month
  Bundle: 100K tokens
  Overage: Block access
  Features: 1 agent, chat only

PRO_TIER:
  Price: $29/month (or Owner's choice)
  Bundle: 1M tokens
  Overage: $0.02 per 1K tokens
  Features: 10 agents, chat + LMS

ENTERPRISE_TIER:
  Price: $299/month
  Bundle: 10M tokens
  Overage: $0.015 per 1K (cheaper)
  Features: 100 agents, all features
```

### 2. User Subscribes

**Stripe Checkout Flow**:
```
1. User clicks "Upgrade to Pro"
2. Stripe Checkout session created
3. User enters payment info
4. Stripe processes payment
5. Webhook fires → update subscription
6. User upgraded → token bundle increased
```

### 3. Monthly Revenue

**Owner's Stripe Dashboard**:
```
Revenue This Month:
- Base subscriptions: $2,900 (100 users × $29)
- Overage charges: $450 (auto-billed)
Total: $3,350

Stripe fees: -$100
Net: $3,250 → paid to Owner
```

---

## 🔱 God Mode (Your Experience)

### 1. Track All Usage

**Automatic tracking** (in chat API):
```typescript
onFinish: async (completion) => {
  await trackTokenUsage({
    tenantId,
    userId,
    provider: 'openai',
    model: 'gpt-4o',
    tokensPrompt: 1500,
    tokensCompletion: 800,
    totalCost: 0.046  // $0.046
  });
}
```

### 2. Monthly Aggregation

**Cron job** (runs on 1st of month):
```typescript
Tenant A (100 users):
- Total tokens: 5M
- Providers: OpenAI (3M), Anthropic (2M)
- Actual cost: $75
- Your margin: 30%
- Invoice: $97.50

Tenant B (50 users):
- Total tokens: 2M
- Actual cost: $30
- Invoice: $39

Total monthly revenue from God billing: $136.50
```

### 3. God Dashboard

**Your admin view**:
```
┌─────────────────────────────────────────┐
│ God Mode - Usage & Billing              │
├─────────────────────────────────────────┤
│ This Month:                             │
│ • Total tokens: 25M                     │
│ • Total cost: $375                      │
│ • Total revenue: $487.50 (30% margin)   │
│                                         │
│ Per Tenant:                             │
│ • Tenant A: 5M tokens → $97.50          │
│ • Tenant B: 2M tokens → $39.00          │
│ • Tenant C: 8M tokens → $156.00         │
│                                         │
│ [Generate Invoices] [Send to Owners]   │
└─────────────────────────────────────────┘
```

---

## 🔢 Pricing Examples

### Example 1: Free User

```
Tier: Free
Bundle: 100K tokens
Behavior: Block on exhaust

Usage Timeline:
- Week 1: 25K tokens (25%)
- Week 2: 30K tokens (55%)
- Week 3: 35K tokens (90%) ⚠️ Warning shown
- Week 4: 15K tokens → 105K total

Result: BLOCKED at 100K
Message: "Upgrade to Pro ($29/mo) to continue"
```

### Example 2: Pro User (Light Usage)

```
Tier: Pro ($29/month)
Bundle: 1M tokens
Behavior: Charge overage at $0.02/1K

Usage Timeline:
- Used: 450K tokens (45%)

Result: No overage, under bundle
Total charge: $29.00 (base only)
```

### Example 3: Pro User (Heavy Usage)

```
Tier: Pro ($29/month)
Bundle: 1M tokens
Overage rate: $0.02 per 1K

Usage Timeline:
- Base: 1M tokens (included)
- Overage: 250K tokens

Calculation:
- Base: $29.00
- Overage: 250K / 1K × $0.02 = $5.00
- Total: $34.00

Stripe invoice line items:
1. Pro Plan: $29.00
2. Token overage (250K): $5.00
```

### Example 4: Enterprise User

```
Tier: Enterprise ($299/month)
Bundle: 10M tokens
Overage rate: $0.015 per 1K (cheaper)

Usage Timeline:
- Base: 10M tokens
- Overage: 2M tokens

Calculation:
- Base: $299.00
- Overage: 2M / 1K × $0.015 = $30.00
- Total: $329.00

Still cheaper per token than Pro tier!
```

---

## 🧪 Testing Checklist

### Unit Tests

```bash
# Test token enforcement
✓ Free tier blocks at 100K tokens
✓ Pro tier allows overage with charges
✓ Enterprise tier cheaper overage rate
✓ Period reset clears usage
✓ Multiple users don't interfere

# Test calculations
✓ Overage math correct (tokens / 1K × rate)
✓ Stripe invoice item created for overages
✓ God mode cost tracking accurate
```

### Integration Tests

```bash
# Full user journey
✓ User subscribes to Pro
✓ Uses 1.2M tokens
✓ Charged $29 + overage at period end
✓ Next period resets to 0 tokens used

# Owner journey
✓ Owner configures tiers
✓ Users see correct limits
✓ Stripe Connect works
✓ Revenue flows to Owner

# God journey
✓ All tokens tracked
✓ Cost calculated correctly
✓ Invoice generated for Owner
```

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

```bash
cd ~/jk-ai/shadcn-admin-cf-ai

# Generate migration
pnpm db:generate

# Review migration in db/migrations/
# Should add token bundle columns to owner_subscriptions and tier_pricing

# Apply to Neon
pnpm db:push
```

### Step 2: Update Existing Subscriptions

```typescript
// Run once to migrate existing subscriptions
import { db } from '@/lib/db';
import { ownerSubscriptions } from '@/db/schema/billing';

async function migrateExistingSubscriptions() {
  const subs = await db.query.ownerSubscriptions.findMany();
  
  for (const sub of subs) {
    await db.update(ownerSubscriptions)
      .set({
        tokenBundleSize: sub.tier === 'free' ? 100_000 : 1_000_000,
        tokensUsedThisPeriod: 0,
        tokensOverage: 0,
        overageChargesCents: 0,
        bundleExhausted: false
      })
      .where(eq(ownerSubscriptions.id, sub.id));
  }
}
```

### Step 3: Update Chat Routes

```typescript
// worker/routes/chat.ts
// Replace with chat-with-enforcement.ts

import chatRoutes from './chat-with-enforcement';
app.route('/api/chat', chatRoutes);
```

### Step 4: Add UI Components

```tsx
// src/app/dashboard/page.tsx
import { TokenUsageDisplay } from '@/features/billing/components/TokenUsageDisplay';

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <TokenUsageDisplay />
      {/* ... rest of dashboard */}
    </div>
  );
}
```

### Step 5: Deploy

```bash
# Deploy worker (backend)
pnpm deploy:worker

# Deploy frontend
vercel --prod
```

---

## 📝 Environment Variables

Add to `.env.local` and Cloudflare Workers secrets:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# For overage invoice items
STRIPE_CONNECT_CLIENT_ID=ca_...

# Token pricing (your costs + margin)
GOD_MODE_MARGIN_PERCENT=30  # 30% markup on actual costs
```

---

## 🎯 Success Metrics

After implementation, track:

```
User Metrics:
- Avg tokens per user per month
- % users hitting bundle limit
- Upgrade rate (free → pro)
- Overage charges per user

Owner Metrics:
- Avg revenue per tenant
- Overage revenue vs base revenue
- Churn rate by tier

God Metrics:
- Total tokens processed
- Actual AI costs
- Margin percentage
- Revenue per tenant
```

---

## 🆘 Common Issues

### Issue: Users complain about hitting limits

**Solution**: Owner can increase bundle size or reduce overage price

### Issue: Free users blocked too quickly

**Solution**: Owner increases free tier bundle (e.g., 100K → 250K)

### Issue: Overage charges too high

**Solution**: Owner reduces overage rate (e.g., $0.02 → $0.01/1K)

### Issue: God invoice doesn't match reality

**Solution**: Check `usageEvents` table for missing entries, ensure `onFinish` callback fires

---

## 🔗 Related Files

**Backend**:
- `worker/middleware/token-enforcement.ts` - Enforcement logic
- `worker/routes/chat-with-enforcement.ts` - Chat API
- `db/schema/billing.ts` - Database schema
- `lib/usage-tracking.ts` - God mode tracking

**Frontend**:
- `src/features/billing/components/TokenUsageDisplay.tsx` - User widget
- `src/features/billing/components/TierConfigForm.tsx` - Owner config
- `src/features/admin/components/GodUsageDashboard.tsx` - God dashboard

**Documentation**:
- `docs/BILLING_GUIDE.md` - Original billing guide
- `docs/TOKEN_BUNDLE_GUIDE.md` - This file

---

## ✅ Implementation Timeline

**Week 11**: Backend + Database
- [ ] Apply migration
- [ ] Test token enforcement middleware
- [ ] Test chat API with tracking
- [ ] Test Stripe overage invoice items

**Week 12**: Frontend + Testing
- [ ] Add TokenUsageDisplay to dashboard
- [ ] Add TierConfigForm to Owner settings
- [ ] Build upgrade flow UI
- [ ] End-to-end testing

**Week 13**: God Mode
- [ ] Usage aggregation cron
- [ ] God dashboard UI
- [ ] Invoice generation
- [ ] Test full billing cycle

---

**This is the complete implementation guide for token bundle billing!** 🎉

Save this file and refer back during Weeks 11-13.