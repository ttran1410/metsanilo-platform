# 🌲 METSÄNILO PLATFORM

> **Metsänilo** is a specialized e-commerce, reservation, and fulfillment platform for wild berry harvests (blueberries, raspberries, lingonberries) in Satakunta, Finland. It connects local berry harvesters directly with retail and wholesale customers through an atomic capacity reservation storefront and an enterprise administration portal.

---

## 🌟 Key Features & Core Modules

### 🛒 1. Customer Storefront (Bilingual FI / EN)
- **Frictionless Pre-Order System**: Pay on pickup/delivery (no prepayment required), auto-matched date selection, volume-based packages (e.g. 10L containers).
- **Dynamic Availability Engine**: Real-time harvest availability badges (`upcoming`, `available`, `batches_updating`, `season_ended`) based on daily capacity allocations (ml) and seasonal windows (`availableFrom` / `availableThrough`).
- **Social Proof & Reviews**: Public review submission modal, trust ribbons on homepage & reserve pages, dedicated Reviews Hub (`/[locale]/reviews`) with star rating histograms and verified buyer badges.
- **CMS Info Pages**: Modular pages for *How It Works*, *About Us*, and *Privacy Notices* with dynamic visibility controls managed from Admin.

### 🛡️ 2. Admin Management Portal (`/admin`)
- **📊 Operational Dashboard**: Real-time metrics for daily intake, reserved capacity (litres), revenue, pending triage counts, and status breakdowns.
- **📦 Orders Management Hub**:
  - Full order lifecycle triage (`PENDING`, `CONFIRMED`, `FULFILLMENT_STARTED`, `READY`, `DISPATCHED`, `COMPLETED`, `CANCELLED`).
  - Pricing overrides, delivery fee adjustments, delivery exceptions, refund processing, and note attachments.
  - Manual & External order creation (WhatsApp, Facebook, Phone, Market Stall) with historical entry support.
  - Batch operations (archive, delete) and CSV data export.
- **📅 Availability & Capacity Planner**:
  - Daily capacity planning (ml) per product.
  - Manual capacity locks, sold-out toggles, and automated recurrence planning.
- **🍓 Product Catalog Manager**:
  - Products & package management, drag-and-drop sort order, product archive, media gallery (Vercel Blob / local).
- **👤 Customer CRM & Facebook Sync**:
  - Normalized customer directory by phone/email, marketing consent tracking, Facebook profile linking, and historical order attribution.
- **⭐ Review Engine & Moderation Inbox**:
  - 3-tier customer verification (`✓ Vahvistettu tilaus` [digital order match], `✓ Vahvistettu asiakas` [staff/historical customer link], `Julkinen arvostelu` [unverified]).
  - Dual-text audit trail (`originalText` for legal/GDPR audit vs `displayText` for public display).
  - 1-click moderation, featured review scheduling, staff replies, and offline WhatsApp/SMS review importer.
- **⚙️ Categorized 6-Domain Administration Settings**:
  - **🏢 Shop Identity**: Brand names (FI/EN), Y-Tunnus, legal business details, customer care lines, Logo & Favicon uploaders.
  - **📍 Fulfillment Hubs**: Interactive pickup locations with operating times, Finnish/English directions, default badges, and Google Maps pin previews.
  - **💳 Payment Methods**: Method toggles and custom customer guidance notes (MobilePay #, cash notes, card reader, B2B IBAN).
  - **📥 Order Channels**: Drag-and-drop reorderable intake sources (`WEBSITE`, `PHONE`, `WHATSAPP`, `SMS`, `FACEBOOK`, `MARKET`) with custom channel creation.
  - **🌐 Storefront & CMS Media**: Page visibility switches (**How It Works**, **Reviews**, **About Us**) and CMS image uploaders (Hero, Process, Story).
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
- **Testing**: Vitest (61 unit tests across 9 test suites)
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
npm install
```

### 2. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env.local
```
Configure `.env.local` with your database and shop settings:
```env
TURSO_DATABASE_URL=file:local.db
SHOP_ID=shop-main
SHOP_SLUG=metsanilo
BETTER_AUTH_SECRET=your-32-character-secret-key
BETTER_AUTH_URL=http://localhost:3000/api/auth/better
BOOTSTRAP_ADMIN_EMAIL=admin@metsanilo.fi
BOOTSTRAP_ADMIN_PASSWORD=your-secure-password
```

### 3. Database Initialization & Seeding
Generate migrations, apply schema to your local database, and seed initial shop data:
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

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
# Run unit test suite (61 tests)
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
| `npm run db:seed` | Seeds shop catalog, availability, and initial admin account |
| `npm run db:preflight` | Performs pre-deployment safety checks on database |
| `npm run db:release` | Performs complete release flow (migrate + seed + verify) |

---

## 🛡️ Production Deployment (Vercel + Turso)

1. Set environment variables on Vercel (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SHOP_ID`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_SESSION_SECRET`).
2. Run database migration and release preflight:
   ```bash
   npm run db:release
   ```
3. Deploy to Vercel via CLI or connected Git repository.
