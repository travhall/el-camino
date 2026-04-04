# El Camino

A modern e-commerce platform built with Astro and Square integration, featuring dynamic product catalogs, cart management, and seamless checkout experiences.

![Astro](https://img.shields.io/badge/Astro-6.1.2-orange?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0.2-blue?logo=typescript&logoColor=white)
![Square](https://img.shields.io/badge/Square-44.0.1-success?logo=square&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2.2-blue?logo=tailwind-css&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production_Ready-brightgreen)

## 🛍️ Features

### E-commerce Core

- **Dynamic Product Catalog** - Synced with Square inventory
- **Product Variations** - Size, color, and style options with individual inventory tracking
- **Real-time Inventory** - Live stock validation and out-of-stock indicators
- **Smart Cart Management** - Persistent cart state with navigation preservation
- **Secure Checkout** - Square-powered payment processing with Payment Links
- **Brand Management** - Custom attribute integration for product brands
- **Measurement Units** - Flexible unit display (each, lb, oz, etc.)
- **Sale Pricing** - Full sale price support with discount badges and dedicated pages
- **QuickView** - Instant product preview modal with add-to-cart functionality
- **Fulfillment Options** - Multiple fulfillment methods including shipping selector
- **Back-in-Stock Notifications** - Email capture for sold-out items with automated notifications
- **Email System** - Order confirmations, shipping notifications, pickup reminders via Resend

### Technical Highlights

- **Server-Side Rendering** - Optimized for performance and SEO
- **Type-Safe Development** - Full TypeScript implementation with 0 errors
- **Resilient Architecture** - Circuit breaker patterns and error recovery
- **Netlify Blobs Caching** - Distributed caching with Netlify Blobs for serverless optimization
- **Performance Monitoring** - Built-in Core Web Vitals tracking and regression testing
- **Mobile-First Design** - Responsive interface with Tailwind CSS v4
- **View Transitions** - SPA-like navigation with View Transitions API
- **Image Optimization** - Enhanced image loading with format detection (AVIF, WebP) and placeholders

## 🚀 Quick Start

### Prerequisites

- \*\*Node.js ≥20.0.0
- pnpm 10.33.0 (enforced)
- Square Developer Account

### Installation

```bash
# Clone repository
git clone https://github.com/travhall/el-camino.git
cd el-camino

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
```

### Environment Setup

Create `.env` file with Square credentials:

```env
SQUARE_ACCESS_TOKEN=your_square_access_token
PUBLIC_SQUARE_APP_ID=your_square_app_id
PUBLIC_SQUARE_LOCATION_ID=your_square_location_id
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_signature_key
```

### Development

```bash
# Start development server
pnpm dev

# Run type checking
pnpm check

# Build for production
pnpm build

# Preview production build locally
pnpm preview-local

# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## 📁 Project Structure

```text
src/
├── components/          # Reusable UI components
│   ├── ProductCard.astro       # Product display cards
│   ├── QuickView.astro         # Quick view modal
│   ├── ProductFilters.astro    # Filtering interface
│   ├── ProductGrid.astro       # Product grid layout
│   ├── MiniCart.astro          # Shopping cart dropdown
│   ├── Nav.astro               # Main navigation
│   ├── BackInStock.astro       # Back-in-stock notification form
│   ├── wordpress/              # WordPress block renderers
│   └── admin/                  # Admin dashboard components
│       ├── AdminNav.astro      # Admin navigation
│       └── performance/        # Performance monitoring UI
├── layouts/            # Page layouts
│   ├── Layout.astro            # Main layout with SEO, fonts, device detection
│   └── AdminLayout.astro       # Admin dashboard layout
├── lib/               # Business logic
│   ├── cart/          # Cart management system
│   │   ├── index.ts           # CartManager singleton
│   │   ├── types.ts           # Cart type definitions
│   │   └── cartHelpers.ts     # Utility functions
│   ├── square/        # Square API integration
│   │   ├── client.ts          # Square client configuration
│   │   ├── categories.ts      # Category management
│   │   ├── variationParser.ts # Product variation parsing
│   │   ├── batchInventory.ts  # Bulk inventory checks
│   │   ├── inventory.ts       # Real-time stock validation
│   │   ├── apiUtils.ts        # Circuit breaker & utilities
│   │   ├── errorUtils.ts      # Error handling
│   │   ├── imageUtils.ts      # Image URL processing
│   │   └── types.ts           # Square type definitions
│   ├── product/       # Product logic & PDP controller
│   │   ├── pdpController.ts   # Product Detail Page controller
│   │   ├── pdpEvents.ts       # Event handling
│   │   ├── pdpUI.ts           # UI state management
│   │   └── relatedProducts.ts # Related product logic
│   ├── wordpress/     # WordPress CMS integration
│   │   ├── api.ts             # WordPress REST API client
│   │   ├── types.ts           # WordPress type definitions
│   │   └── block-config.ts    # Block renderer configuration
│   ├── cache/         # Netlify Blobs caching layer
│   │   └── blobCache.ts       # Distributed cache implementation
│   ├── performance/   # Performance monitoring
│   │   ├── PerformanceManager.ts      # Core Web Vitals tracking
│   │   └── BudgetManager.ts           # Resource budget tracking
│   ├── email/         # Email system with Resend
│   │   ├── sender.ts          # Email sending functions
│   │   └── templates.ts       # Email HTML templates
│   ├── admin/         # Admin utilities
│   │   └── dismissedOrders.ts # Order dismissal tracking
│   ├── backInStock.ts # Back-in-stock subscription management
│   └── image/         # Enhanced image optimization
├── pages/             # Routes and API endpoints
│   ├── api/           # Server endpoints
│   │   ├── list-catalog.ts         # Product catalog
│   │   ├── create-checkout.ts      # Square checkout
│   │   ├── cart-actions.ts         # Cart operations
│   │   ├── cart-inventory.ts       # Bulk inventory validation
│   │   ├── check-inventory.ts      # Single item stock check
│   │   ├── get-categories.ts       # Category listing
│   │   ├── load-more-products.ts   # Pagination
│   │   ├── quick-view-product.ts   # Quick view data
│   │   ├── sale-info.ts            # Sale pricing
│   │   ├── back-in-stock.ts        # Back-in-stock subscriptions
│   │   ├── admin/                  # Admin API endpoints
│   │   │   ├── mark-shipped.ts     # Mark order as shipped
│   │   │   ├── mark-pickedup.ts    # Mark order as picked up
│   │   │   ├── send-back-in-stock.ts # Send BIS notifications
│   │   │   └── dismiss-order.ts    # Dismiss order notifications
│   │   └── webhooks/               # Webhook handlers
│   ├── product/       # Dynamic product pages
│   │   └── [id].astro
│   ├── category/      # Dynamic category pages
│   │   └── [...slug].astro
│   ├── shop/          # Shop pages
│   ├── news/          # WordPress content pages
│   ├── admin/         # Admin dashboards
│   │   ├── index.astro           # Admin dashboard overview
│   │   ├── orders/               # Order management
│   │   │   ├── shipping.astro    # Shipping orders
│   │   │   ├── pickups.astro     # Pickup orders
│   │   │   └── archive.astro     # Order archive
│   │   ├── notifications/        # Notification management
│   │   │   └── back-in-stock.astro # BIS subscriber management
│   │   ├── content/              # Content tools
│   │   │   ├── sku-reference.astro # Product SKU reference
│   │   │   ├── styleguide.astro  # Design system reference
│   │   │   ├── event-reference.astro # Analytics events
│   │   │   └── wordpress-demo.astro # WP block demo
│   │   └── performance/          # Performance monitoring
│   │       ├── index.astro       # Performance overview
│   │       ├── core-vitals.astro # Core Web Vitals dashboard
│   │       ├── business-impact.astro # Business impact analysis
│   │       ├── competitive.astro # Competitive analysis
│   │       └── resources.astro   # Resource performance
│   ├── cart.astro     # Shopping cart page
│   └── order-confirmation.astro
├── scripts/           # Client-side scripts
├── styles/            # Global styles
└── utils/             # Utility functions
```

## 🔧 Key Integrations

### Square Commerce (v44.0.1)

- **Catalog Management** - Automatic product sync with Square POS
- **Inventory Tracking** - Real-time stock levels with bulk validation
- **Payment Processing** - Secure checkout with Square Payment Links
- **Order Management** - Complete order lifecycle integration
- **Custom Attributes** - Brand, measurement units, and sale pricing extraction
- **Product Variations** - Advanced variation parsing with type detection

### Advanced Features

- **Product Variations** - Complex SKU management with type detection and attributes
- **Cart Persistence** - Survives page navigation, browser sessions, and View Transitions
- **Inventory Validation** - Prevents overselling with real-time checks and bulk validation
- **Error Recovery** - Graceful API failure handling with circuit breakers
- **Request Deduplication** - Eliminates duplicate API calls
- **Netlify Blobs Caching** - Distributed caching for serverless functions with smart invalidation
- **QuickView Integration** - Instant product preview with full add-to-cart functionality
- **Sale Pricing System** - Complete sale price support with badges and filtering

### Email & Notifications (Resend)

- **Order Confirmations** - Automatic email receipts for customer orders
- **Shipping Notifications** - Tracking number delivery when orders ship
- **Pickup Reminders** - Automated reminders for pickup orders
- **Back-in-Stock Alerts** - Customer notifications when products restock
- **Admin Notifications** - Real-time alerts for new orders and subscriptions

### Back-in-Stock System

- **Email Capture** - Customer signup forms on sold-out product variants
- **Netlify Blobs Storage** - Persistent subscription management
- **Admin Dashboard** - View and manage subscribers by product
- **Bulk Notifications** - Send restock alerts to all subscribers
- **Deduplication** - Prevent duplicate subscriptions per product/email

### WordPress Integration

- **Content Management** - News and blog content via WordPress REST API
- **Block-Based Rendering** - WordPress block renderers for rich content
- **SEO Optimization** - Structured data and meta tag management
- **Image Processing** - Optimized image delivery with format conversion (AVIF, WebP)

## 🛠️ API Endpoints

| Endpoint                        | Method | Purpose                    |
| ------------------------------- | ------ | -------------------------- |
| `/api/list-catalog`             | GET    | Fetch product catalog      |
| `/api/create-checkout`          | POST   | Initialize Square checkout |
| `/api/cart-actions`             | POST   | Cart operations            |
| `/api/cart-inventory`           | POST   | Bulk inventory validation  |
| `/api/check-inventory`          | GET    | Single item stock check    |
| `/api/get-categories`           | GET    | Product categories         |
| `/api/load-more-products`       | GET    | Paginated product loading  |
| `/api/quick-view-product`       | GET    | Quick view product data    |
| `/api/calculate-cart`           | POST   | Calculate cart totals      |
| `/api/sale-info`                | GET    | Sale pricing information   |
| `/api/related-products`         | GET    | Related products           |
| `/api/resolve-product`          | GET    | Product resolution         |
| `/api/warmup`                   | GET    | Cache warming endpoint     |
| `/api/back-in-stock`            | POST   | Back-in-stock subscription |
| `/api/admin/mark-shipped`       | POST   | Mark order as shipped      |
| `/api/admin/mark-pickedup`      | POST   | Mark order as picked up    |
| `/api/admin/send-back-in-stock` | POST   | Send BIS notifications     |
| `/api/admin/dismiss-order`      | POST   | Dismiss order notification |
| `/api/crux-data`                | GET    | Core Web Vitals field data |

## 📱 Pages

- **`/`** - Product catalog homepage with filtering and QuickView
- **`/product/[id]`** - Dynamic product detail pages with variations and related products
- **`/category/[...slug]`** - Dynamic category pages with breadcrumbs
- **`/shop/all`** - Complete product catalog with advanced filtering
- **`/shop/sale`** - Sale items with discount badges
- **`/cart`** - Shopping cart management with quantity controls and fulfillment options
- **`/order-confirmation`** - Post-purchase confirmation with order details
- **`/news`** - WordPress-powered blog and news section
- **`/admin`** - Admin dashboard overview with needs attention summary
- **`/admin/orders/shipping`** - Shipping order management with tracking
- **`/admin/orders/pickups`** - Pickup order management
- **`/admin/orders/archive`** - Order history and archive
- **`/admin/notifications/back-in-stock`** - Back-in-stock subscriber management
- **`/admin/content/sku-reference`** - Product SKU reference for content creators
- **`/admin/content/styleguide`** - Design system and component reference
- **`/admin/content/event-reference`** - Analytics events and tracking guide
- **`/admin/content/wordpress-demo`** - WordPress block component demo
- **`/admin/performance`** - Performance monitoring dashboard with Core Web Vitals

## 🎨 Styling

Built with Tailwind CSS v4 featuring:

- Custom color palette optimized for e-commerce
- Responsive breakpoints for all device sizes
- Component-based utility classes
- Modern design system with consistent spacing
- Performance-optimized CSS generation

## 🧪 Testing

```bash
# Run unit tests with Vitest
pnpm test

# Run E2E tests with Playwright
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Type checking (0 errors across 83 files)
pnpm check

# Build verification
pnpm build
```

## 🚀 Deployment

Optimized for Netlify with automatic builds:

```bash
# Production build
pnpm build

# Preview locally
pnpm preview-local
```

### Netlify Configuration

- **Build Command**: `pnpm build`
- **Publish Directory**: `dist`
- **Node Version**: 20.x
- **Package Manager**: pnpm 10.33.0
- **Adapter**: @astrojs/netlify v7.0.5 with SSR
- **Image CDN**: Enabled with AVIF/WebP conversion
- **Caching**: Netlify Blobs for distributed state management

## 🔒 Security

- Environment variable validation on startup
- Webhook signature verification for Square events
- Type-safe API interactions throughout
- Input sanitization and validation
- Comprehensive error boundary implementation
- CORS protection for Square API endpoints

## 📊 Performance

- **SSR Optimization** - Server-side rendering for dynamic content
- **Asset Optimization** - Automatic image and code optimization with Sharp
- **Netlify Blobs Caching** - Distributed caching for serverless functions with smart invalidation
- **Bundle Splitting** - Optimal JavaScript delivery with code splitting
- **Circuit Breakers** - API resilience and failure recovery
- **Request Deduplication** - Eliminates redundant API calls
- **Core Web Vitals Monitoring** - Real-time performance tracking with automated alerts
- **Prefetching** - Viewport-based prefetching with Speculation Rules API
- **View Transitions** - SPA-like navigation for improved perceived performance
- **Lazy Loading** - Deferred Square script loading and conditional component loading
- **Image Optimization** - Format detection, responsive images, and loading placeholders

### Performance Optimizations ⚡

Recent comprehensive performance optimization strategy implementation:

- **Netlify Blobs Migration** - Solved serverless function memory isolation with distributed caching
- **Enhanced Image Loading** - Format detection (AVIF, WebP), shimmer placeholders, and responsive images
- **Core Web Vitals Tracking** - Built-in performance monitoring with regression testing
- **Mobile Optimizations** - Device-specific component loading and mobile-first design
- **Cache Warming** - Automated cache warming via GitHub Actions
- **Performance Budgets** - Resource budget tracking and alerts

### Performance Metrics

- **Build Time**: ~3 seconds
- **TypeScript Compilation**: 0 errors across 83 files
- **Codebase Size**: ~48,894 lines of code across 169 files
- **Test Coverage**: 80% threshold with Vitest
- **API Response Times**: Optimized with Netlify Blobs caching
- **Bundle Size**: Optimized with code splitting and lazy loading
- **Lighthouse Scores**: Optimized for Core Web Vitals

## 🏗️ Architecture Highlights

### Enterprise Patterns

- **Singleton Pattern** - CartManager and PerformanceManager for centralized state
- **Circuit Breaker Pattern** - API resilience and failure recovery
- **Request Deduplication** - Prevents duplicate API calls
- **Observer Pattern** - Event-driven cart and performance monitoring
- **Netlify Blobs Caching** - Distributed caching strategy for serverless functions
- **Error Recovery** - Graceful degradation and user feedback
- **Type Safety** - End-to-end TypeScript implementation with strict mode

### Square SDK Integration

- **Migration Strategy**: Using `square/legacy` for ES module compatibility
- **Separation of Concerns**: Backend API calls, frontend state management
- **Error Handling**: Comprehensive Square API error processing
- **Performance**: Batch operations for inventory and images
- **Custom Attributes**: Brand, measurement units, and sale pricing extraction
- **Variation Parsing**: Advanced type detection for product variations

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Follow TypeScript strict mode
4. Ensure all tests pass (`pnpm check && pnpm test`)
5. Submit pull request

### Development Guidelines

- Maintain type safety across all modules
- Follow existing component patterns
- Update documentation for new features
- Test Square integration thoroughly
- Use circuit breaker patterns for external APIs

## 📝 Documentation

Additional documentation available:

- [Square Integration Guide](docs/square-integration.md)
- [Product Variations Implementation](docs/product-variations.md)
- [Inventory Management](docs/inventory-management.md)
- [Cart System Architecture](docs/cart-system.md)
- [Performance Optimization](docs/performance.md)

## 🔧 Dependencies

### Core Framework

- **Astro 6.1.2** - Modern web framework with SSR
- **TypeScript 6.0.2** - Type safety and developer experience
- **Tailwind CSS 4.2.2** - Utility-first CSS framework v4

### E-commerce Integration

- **Square SDK 44.0.1** - Payment processing and inventory
- **Square Legacy Support** - ES module compatibility
- **@netlify/blobs 10.7.4** - Distributed caching layer

### Email & Notifications

- **Resend 6.10.0** - Email delivery service

### Performance & Optimization

- **@astrojs/netlify 7.0.5** - Deployment adapter with SSR
- **@astrojs/sitemap 3.7.2** - SEO sitemap generation
- **astro-icon 1.1.5** - Optimized icon system
- **astro-seo-metadata 0.6.0** - SEO optimization
- **sharp 0.34.5** - Image processing and optimization
- **web-vitals 5.2.0** - Core Web Vitals monitoring

### Development Tools

- **@astrojs/node 10.0.4** - Local development adapter
- **Vitest 4.1.2** - Unit testing framework with 80% coverage
- **Playwright 1.58.2** - E2E testing across browsers
- **pnpm 10.33.0** - Fast, disk space efficient package manager

## 📈 Roadmap

### Completed ✅

- [x] Core e-commerce functionality
- [x] Square API integration
- [x] Cart and checkout system
- [x] Sale pricing and badges
- [x] QuickView modal
- [x] Product variations with type detection
- [x] Netlify Blobs caching
- [x] Performance monitoring dashboard
- [x] WordPress content integration
- [x] E2E test suite with Playwright
- [x] Back-in-stock notification system
- [x] Email notifications (order confirmations, shipping, pickups)
- [x] Order management dashboard (shipping, pickups, archive)
- [x] Order history and tracking

### In Progress 🚧

- [ ] Enhanced search functionality (news search implemented, product search planned)
- [ ] Customer account system

### Future Enhancements 🔮

- [ ] Inventory management dashboard
- [ ] Customer analytics and insights
- [ ] Multi-currency support
- [ ] International shipping
- [ ] B2B wholesale features
- [ ] Advanced personalization engine

## 🆘 Support

For issues and questions:

- Check [existing issues](https://github.com/travhall/el-camino/issues)
- Review Square API documentation
- Contact Square developer support for payment issues
- Check project documentation in `/docs`

## 📊 Project Status

### Current State: Production Ready ✅

- **TypeScript**: 0 errors across 83 files
- **Build Status**: Successful
- **Core Features**: Complete and functional
- **Payment Processing**: Operational
- **Inventory Management**: Real-time validation
- **Performance**: Optimized for production

### Recent Achievements

- ✅ Successful Square SDK v44.0.1 migration using legacy approach
- ✅ Complete cart system implementation with View Transitions persistence
- ✅ Real-time inventory validation and stock management with bulk validation
- ✅ Product variations with advanced type detection and attribute parsing
- ✅ WordPress content integration with block-based rendering
- ✅ Netlify Blobs caching migration for distributed state
- ✅ QuickView modal with full add-to-cart functionality
- ✅ Sale pricing system with discount badges and filtering
- ✅ Core Web Vitals monitoring and performance regression testing
- ✅ Enhanced image optimization with format detection (AVIF, WebP)
- ✅ Back-in-stock notification system with Netlify Blobs storage
- ✅ Email notifications via Resend (orders, shipping, pickups, BIS)
- ✅ Order management dashboard (shipping, pickups, archive)
- ✅ Admin dashboard with needs attention summary

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built with ❤️ using Astro, TypeScript, and Square Commerce APIs

Last updated: April 2026
