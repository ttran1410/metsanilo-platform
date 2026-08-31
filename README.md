# 🌲 METSÄNILO PLATFORM

> **Metsänilo** is a single-shop commerce, reservation, and fulfillment application for seasonal berry harvests in Satakunta, Finland. It combines a capacity-aware storefront with an operations-focused admin portal.

---

## 🌟 Key Features & Core Modules

### 🛒 1. Customer Storefront (Bilingual FI / EN)
- **Frictionless Pre-Order System**: Pay on pickup/delivery (no prepayment required), auto-matched date selection, volume-based packages (e.g. 10L containers).
- **Dynamic Availability Engine**: Calculated harvest availability badges (`upcoming`, `available`, `batches_updating`, `season_ended`) based on daily capacity allocations (ml) and seasonal windows (`availableFrom` / `availableThrough`).
- **Social Proof & Reviews**: Public review submission modal, trust ribbons on homepage & reserve pages, dedicated Reviews Hub (`/[locale]/reviews`) with star rating histograms and verified buyer badges.
- **Information Pages**: Localized *How It Works* and *About Us* pages with Admin visibility controls, plus explicit Finnish/English privacy routes. A general CMS/revision system is not implemented.

### 🛡️ 2. Admin Management Portal (`/admin`)
- **📊 Operational Dashboard**: Request-time metrics for daily intake, reserved capacity (litres), revenue, pending triage counts, and status breakdowns.
- **📦 Orders Management Hub**:
  - Full order lifecycle triage (`NEW`, `CONFIRMED`, `PICKING`, `READY`, `OUT_FOR_DELIVERY`, `PICKED_UP`, `DELIVERED`, plus documented terminal outcomes).
  - Pricing overrides, delivery fee adjustments, delivery exceptions, refund processing, and note attachments.
  - Manual & External order creation (WhatsApp, Facebook, Phone, Market Stall) with historical entry support.
  - Batch operations (archive, delete) and CSV data export.
- **📅 Availability & Capacity Planner**:
  - Daily capacity planning (ml) per product.
  - Manual capacity locks, sold-out toggles, and automated recurrence planning.
- **🍓 Product Catalog Manager**:
  - Products & package management, drag-and-drop sort order, product archive, and a Vercel Blob media gallery.
- **👤 Customer records & Facebook metadata**:
  - Normalized customer directory by phone/email, marketing consent tracking, optional Facebook profile metadata, and historical order attribution. No Facebook connector or synchronization service is implemented.
- **⭐ Review Engine & Moderation Inbox**:
  - 3-tier customer verification (`✓ Vahvistettu tilaus` [digital order match], `✓ Vahvistettu asiakas` [staff/historical customer link], `Julkinen arvostelu` [unverified]).
  - Dual-text audit trail (`originalText` for legal/GDPR audit vs `displayText` for public display).
  - Moderation, featured review scheduling, staff replies, and manual import for reviews received through offline channels. No WhatsApp/SMS connector is implemented.
- **⚙️ Categorized Administration Settings**:
  - **🏢 Shop Identity**: Brand names (FI/EN), Y-Tunnus, legal business details, customer care lines, Logo & Favicon uploaders.
  - **📍 Fulfillment Hubs**: Pickup/delivery-origin locations with operating details, Finnish/English directions, and default-location controls. No Google Routes integration is implemented.
  - **💳 Payment Methods**: Method toggles and custom customer guidance notes (MobilePay #, cash notes, card reader, B2B IBAN).
  - **📥 Order Channels**: Drag-and-drop reorderable intake sources (`WEBSITE`, `PHONE`, `WHATSAPP`, `SMS`, `FACEBOOK`, `MARKET`) with custom channel creation.
  - **🌐 Storefront & CMS Media**: Page visibility switches (**How It Works**, **Reviews**, **About Us**) and CMS image uploaders (Hero, Process, Story).
  - **🎨 Storefront Themes**: Draft, publish, history, discard, and rollback workflows for controlled themes.
  - **🛡️ System & Safety**: 1-Click Emergency Storefront Intake Pause switch and shop deactivation locks.
  - **⚠️ Floating Dirty Bar**: Unsaved changes indicator sliding up to prevent accidental data loss.
- **🔑 User & RBAC Management**: Better Auth integration, granular role-based access control (`settings.read`, `settings.operational`, `orders.write`, `media.write`, etc.), session management, and password updates.

---

## 🏗️ Architecture & Technology Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, Vanilla CSS design tokens & components
- **Database & ORM**: Turso / LibSQL (SQLite-compatible) with Drizzle ORM
- **Authentication**: Better Auth with salted password hashing and role-based permissions
- **Media Storage**: Vercel Blob SDK for product & CMS page assets
- **Testing**: Vitest unit, contract, and disposable-libSQL integration tests
- **Concurrency & Safety**: Atomic database transactions, unique shop-scoped idempotency keys, integer units for currency (cents) and volume (millilitres)

---

## 🛠️ Local Development & Setup

### Prerequisites
- **Node.js**: v20.9+
- **Package Manager**: npm

### 1. Installation
```bash
git clone https://github.com/ttran1410/metsanilo-platform.git
cd metsanilo-platform
npm ci
```

For a guided local setup using a persistent Turso dev database, run:
```bash
./scripts/setup-local-turso-dev.sh
```
Keep the `turso dev` process it starts running while using the app. Its output is written to `.turso-dev.log`.

### 2. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env.local
```
Configure `.env.local` with your database and shop settings:
```env
TURSO_DATABASE_URL=file:local.db
MEDIA_STORAGE=local
MEDIA_LOCAL_DIR=public/uploads
SHOP_ID=shop-main
SHOP_SLUG=metsanilo
BETTER_AUTH_SECRET=your-32-character-secret-key
BETTER_AUTH_URL=http://localhost:3000/api/auth/better
BOOTSTRAP_ADMIN_EMAIL=admin@metsanilo.fi
BOOTSTRAP_ADMIN_PASSWORD=your-secure-password
```

### 3. Database Initialization & Seeding
Export `.env.local`, apply the existing migration chain, and seed initial shop data:
```bash
set -a; source .env.local; set +a
npm run db:migrate
npm run db:seed
```

Run `npm run db:generate` only after changing `src/db/schema.ts`. For all database procedures and safety gates, see the [database migration runbook](docs/engineering/database-migrations.md).

### 4. Start Development Server
```bash
npm run dev
```
- Customer Storefront (Finnish): `http://localhost:3000/fi`
- Customer Storefront (English): `http://localhost:3000/en`
- Admin Portal: `http://localhost:3000/admin`

---

## 🧪 Testing & Quality Assurance

Run the automated Vitest test suite, TypeScript type checker, and linter:

```bash
# Run the current Vitest suite
npm test

# Run TypeScript type check
npm run typecheck

# Run ESLint check
npm run lint

# Execute production build validation
npm run build
```

---

## 🚀 Database & Deployment Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Starts Next.js development server |
| `npm run build` | Builds production Next.js application |
| `npm run test` | Runs Vitest unit test suite |
| `npm run typecheck` | Validates TypeScript types across codebase |
| `npm run db:generate` | Generates Drizzle SQL migration files from schema |
| `npm run db:migrate` | Applies pending SQL migrations to Turso/libSQL database |
| `npm run db:migrate:production` | Loads `.env.production.local` and applies migrations; it does not force production preflight |
| `npm run db:seed` | Seeds shop catalog, availability, and initial admin account |
| `npm run db:preflight` | Performs pre-deployment safety checks on database |
| `npm run db:release` | Operator provisioning/reseed flow: migrate + seed + bootstrap-admin verification; not a routine deploy command |

---

## 🛡️ Production Deployment (Vercel + Turso)

The canonical production URL is **https://metsanilo.vercel.app/**. A Vercel deployment URL printed after `vercel deploy` may be a deployment-specific URL such as `https://metsanilo-metsanilo.vercel.app`; use the canonical alias for verification and user access.

Use the full [production deployment runbook](docs/engineering/production-deployment.md) and [database migration runbook](docs/engineering/database-migrations.md) for operator actions. The short path below assumes authenticated Vercel/Turso CLIs, a verified project/database target, explicit production authorization, and a reviewed backward-compatible migration.

1. Set and verify environment variables on Vercel (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SHOP_ID`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_SESSION_SECRET`, and `BLOB_READ_WRITE_TOKEN` when media is enabled). Never commit or print their values.
2. Pull the production environment into the ignored local file:
   ```bash
   vercel env pull .env.production.local --environment=production --yes
   ```
3. Force production preflight. The `db:migrate:production` script name alone does not enable this guard:
   ```bash
   RELEASE_PREFLIGHT=true node --env-file=.env.production.local node_modules/tsx/dist/cli.mjs scripts/preflight.ts
   ```
4. If the release includes a schema change, create the approved Turso backup and apply migrations with the production guard:
   ```bash
   turso db create <backup-db> --from-db <production-db> --wait
   RELEASE_PREFLIGHT=true node --env-file=.env.production.local node_modules/tsx/dist/cli.mjs scripts/migrate.ts
   ```
5. Deploy to the production target:
   ```bash
   vercel deploy --prod --yes
   ```
6. Verify the deployment URL, canonical alias, and health endpoint:
   ```bash
   vercel inspect <deployment-url> --wait --timeout 3m
   curl -fsS https://metsanilo.vercel.app/api/health
   curl -I https://metsanilo.vercel.app/fi
   ```

Do not use `npm run db:release` for routine deployments. It always runs the seed; on an existing shop it fails unless `SEED_ALLOW_EXISTING=true`, and an allowed seed upserts the bootstrap admin password and forces a password change. Vercel rollback also does not reverse Turso schema or data.
