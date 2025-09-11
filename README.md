# El Camino

A modern e-commerce platform built with Astro and Square integration, featuring dynamic product catalogs, cart management, and seamless checkout experiences.

![Astro](https://img.shields.io/badge/Astro-5.12.2-orange?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue?logo=typescript&logoColor=white)
![Square](https://img.shields.io/badge/Square-43.0.1-success?logo=square&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.11-blue?logo=tailwind-css&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production_Ready-brightgreen)

## 🛍️ Features

### E-commerce Core

- **Dynamic Product Catalog** - Synced with Square inventory
- **Product Variations** - Size, color, and style options with individual inventory tracking
- **Real-time Inventory** - Live stock validation and out-of-stock indicators
- **Smart Cart Management** - Persistent cart state with navigation preservation
- **Secure Checkout** - Square-powered payment processing
- **Brand Management** - Custom attribute integration for product brands
- **Measurement Units** - Flexible unit display (each, lb, oz, etc.)

### Technical Highlights

- **Server-Side Rendering** - Optimized for performance and SEO
- **Type-Safe Development** - Full TypeScript implementation with 0 errors
- **Resilient Architecture** - Circuit breaker patterns and error recovery
- **Intelligent Caching** - Request deduplication and TTL-based caching
- **Performance Monitoring** - Built-in monitoring and analytics
- **Mobile-First Design** - Responsive interface with Tailwind CSS v4

## 🚀 Quick Start

### Prerequisites

- Node.js ≥20.0.0
- ppnpm 9.15.0 (enforced)
- Square Developer Account

### Installation

```bash
# Clone repository
git clone https://github.com/travhall/el-camino.git
cd el-camino

# Install dependencies
ppnpm install

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
ppnpm dev

# Run type checking
ppnpm check

# Build for production
ppnpm build

# Preview production build
ppnpm preview
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ProductCard.astro       # Product display cards
│   ├── CartButton.astro        # Add to cart functionality
│   ├── MiniCart.astro          # Shopping cart dropdown
│   ├── Modal.astro             # Modal system
│   └── Header.astro            # Site navigation
├── layouts/            # Page layouts
│   └── Layout.astro
├── lib/               # Business logic
│   ├── cart/          # Cart management system
│   │   ├── index.ts           # CartManager class
│   │   ├── types.ts           # Cart type definitions
│   │   └── cartHelpers.ts     # Utility functions
│   ├── square/        # Square API integration
│   │   ├── client.ts          # Square client configuration
│   │   ├── inventory.ts       # Inventory management
│   │   ├── types.ts           # Square type definitions
│   │   ├── apiUtils.ts        # Circuit breaker & utilities
│   │   ├── cacheUtils.ts      # Caching strategies
│   │   └── errorUtils.ts      # Error handling
│   └── wordpress/     # WordPress CMS integration
├── pages/             # Routes and API endpoints
│   ├── api/           # Server endpoints
│   │   ├── create-checkout.ts # Square checkout API
│   │   ├── cart-actions.ts    # Cart operations
│   │   └── check-inventory.ts # Inventory validation
│   ├── product/       # Dynamic product pages
│   │   └── [id].astro
│   ├── shop/          # Product catalog pages
│   ├── cart.astro     # Shopping cart page
│   └── order-confirmation.astro
└── styles/            # Global styles
```

## 🔧 Key Integrations

### Square Commerce (v43.0.1)

- **Catalog Management** - Automatic product sync with Square POS
- **Inventory Tracking** - Real-time stock levels with bulk validation
- **Payment Processing** - Secure checkout with Square Payment Links
- **Order Management** - Complete order lifecycle integration
- **Custom Attributes** - Brand and measurement unit extraction

### Advanced Features

- **Product Variations** - Complex SKU management with attributes
- **Cart Persistence** - Survives page navigation and browser sessions
- **Inventory Validation** - Prevents overselling with real-time checks
- **Error Recovery** - Graceful API failure handling with circuit breakers
- **Request Deduplication** - Eliminates duplicate API calls
- **Performance Caching** - Intelligent caching with TTL strategies

### WordPress Integration

- **Content Management** - News and blog content via WordPress API
- **SEO Optimization** - Structured data and meta tag management
- **Image Processing** - Optimized image delivery and responsive handling

## 🛠️ API Endpoints

| Endpoint               | Method | Purpose                    |
| ---------------------- | ------ | -------------------------- |
| `/api/list-catalog`    | GET    | Fetch product catalog      |
| `/api/create-checkout` | POST   | Initialize Square checkout |
| `/api/cart-actions`    | POST   | Cart operations            |
| `/api/cart-inventory`  | POST   | Bulk inventory validation  |
| `/api/check-inventory` | GET    | Single item stock check    |
| `/api/get-categories`  | GET    | Product categories         |
| `/api/load-more-products` | GET | Paginated product loading  |

## 📱 Pages

- **`/`** - Product catalog homepage with filtering
- **`/product/[id]`** - Dynamic product detail pages with variations
- **`/shop/all`** - Complete product catalog with advanced filtering
- **`/cart`** - Shopping cart management with quantity controls
- **`/order-confirmation`** - Post-purchase confirmation with order details
- **`/news`** - WordPress-powered blog and news section

## 🎨 Styling

Built with Tailwind CSS v4 featuring:

- Custom color palette optimized for e-commerce
- Responsive breakpoints for all device sizes
- Component-based utility classes
- Modern design system with consistent spacing
- Performance-optimized CSS generation

## 🧪 Testing

```bash
# Run Square integration tests
ppnpm test

# Type checking (0 errors across 83 files)
ppnpm check

# Build verification
ppnpm build
```

## 🚀 Deployment

Optimized for Netlify with automatic builds:

```bash
# Production build
ppnpm build

# Preview locally
ppnpm preview-local
```

### Netlify Configuration

- **Build Command**: `ppnpm build`
- **Publish Directory**: `dist`
- **Node Version**: 20.x
- **Package Manager**: pnpm
- **Function Per Route**: Enabled for optimal performance

## 🔒 Security

- Environment variable validation on startup
- Webhook signature verification for Square events
- Type-safe API interactions throughout
- Input sanitization and validation
- Comprehensive error boundary implementation
- CORS protection for Square API endpoints

## 📊 Performance

- **SSR Optimization** - Server-side rendering for dynamic content
- **Asset Optimization** - Automatic image and code optimization
- **Intelligent Caching** - Multi-layer caching for API responses with smart invalidation
- **Bundle Splitting** - Optimal JavaScript delivery
- **Circuit Breakers** - API resilience and failure recovery
- **Request Deduplication** - Eliminates redundant API calls
- **Real-time Monitoring** - Performance tracking and automated alerts

### Performance Optimizations ⚡
Recent comprehensive performance optimization strategy implementation:
- **30-50% faster API responses** through intelligent caching
- **Real-time cache monitoring** with automated health detection
- **Smart cache invalidation** preventing stale data issues
- **9 console debugging commands** for ongoing optimization
- **Automated performance alerts** for proactive issue detection

For detailed performance documentation, see [`docs/performance/`](docs/performance/).

### Performance Metrics
- **Build Time**: ~3 seconds
- **TypeScript Compilation**: 0 errors across 83 files
- **API Response Times**: <500ms average
- **Bundle Size**: Optimized with proper chunking
- **Lighthouse Scores**: Optimized for Core Web Vitals

## 🏗️ Architecture Highlights

### Enterprise Patterns
- **Circuit Breaker Pattern** - API resilience and failure recovery
- **Request Deduplication** - Prevents duplicate API calls
- **Intelligent Caching** - TTL-based caching with invalidation
- **Error Recovery** - Graceful degradation and user feedback
- **Type Safety** - End-to-end TypeScript implementation

### Square SDK Integration
- **Migration Strategy**: Using `square/legacy` for ES module compatibility
- **Separation of Concerns**: Backend API calls, frontend state management
- **Error Handling**: Comprehensive Square API error processing
- **Performance**: Batch operations for inventory and images

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Follow TypeScript strict mode
4. Ensure all tests pass (`ppnpm check`)
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
- **Astro 5.12.2** - Modern web framework with SSR
- **TypeScript 5.8.3** - Type safety and developer experience
- **Tailwind CSS 4.1.11** - Utility-first CSS framework

### E-commerce Integration
- **Square SDK 43.0.1** - Payment processing and inventory
- **Square Legacy Support** - ES module compatibility

### Performance & Optimization
- **@astrojs/netlify** - Deployment adapter with function-per-route
- **astro-icon** - Optimized icon system
- **astro-seo-metadata** - SEO optimization
- **sharp** - Image processing and optimization

### Development Tools
- **@astrojs/node** - Local development adapter
- **Vitest** - Testing framework for Square integrations
- **pnpm** - Fast, disk space efficient package manager

## 📈 Roadmap

### Immediate (Next Quarter)
- [x] Core e-commerce functionality
- [x] Square API integration
- [x] Cart and checkout system
- [ ] Sale badge implementation
- [ ] Customer account system

### Medium Term (6 months)
- [ ] Advanced search and filtering
- [ ] Order history and tracking
- [ ] Inventory management dashboard
- [ ] Customer analytics and insights

### Long Term (12+ months)
- [ ] Multi-currency support
- [ ] International shipping
- [ ] B2B wholesale features
- [ ] Mobile app development
- [ ] Advanced personalization

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
- ✅ Successful Square SDK v43 migration using legacy approach
- ✅ Complete cart system implementation with persistence
- ✅ Real-time inventory validation and stock management
- ✅ Product variations with attribute parsing
- ✅ WordPress content integration
- ✅ Performance optimization with caching and circuit breakers

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built with ❤️ using Astro, TypeScript, and Square Commerce APIs

*Last updated: July 2025*