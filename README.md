# El Camino

A modern e-commerce platform built with Astro and Square integration, featuring dynamic product catalogs, cart management, and seamless checkout experiences.

![Astro](https://img.shields.io/badge/Astro-5.0.5-orange?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue?logo=typescript&logoColor=white)
![Square](https://img.shields.io/badge/Square-39.0.0-success?logo=square&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.16-blue?logo=tailwind-css&logoColor=white)

## 🛍️ Features

### E-commerce Core

- **Dynamic Product Catalog** - Synced with Square inventory
- **Product Variations** - Size, color, and style options with individual inventory tracking
- **Real-time Inventory** - Live stock validation and out-of-stock indicators
- **Smart Cart Management** - Persistent cart state with navigation preservation
- **Secure Checkout** - Square-powered payment processing

### Technical Highlights

- **Server-Side Rendering** - Optimized for performance and SEO
- **Type-Safe Development** - Full TypeScript implementation
- **Resilient Architecture** - Circuit breaker patterns and error recovery
- **Caching System** - Intelligent caching for inventory and product data
- **Mobile-First Design** - Responsive interface with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js ≥20.0.0
- pnpm 9.15.0 (enforced)
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

# Preview production build
pnpm preview
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ProductCard.astro
│   ├── CartButton.astro
│   └── Header.astro
├── layouts/            # Page layouts
│   └── Layout.astro
├── lib/               # Business logic
│   ├── cart/          # Cart management
│   ├── square/        # Square API integration
│   └── types/         # TypeScript definitions
├── pages/             # Routes and API endpoints
│   ├── api/           # Server endpoints
│   ├── product/       # Dynamic product pages
│   └── cart.astro
└── styles/            # Global styles
```

## 🔧 Key Integrations

### Square Commerce

- **Catalog Management** - Automatic product sync
- **Inventory Tracking** - Real-time stock levels
- **Payment Processing** - Secure checkout flow
- **Order Management** - Complete order lifecycle

### Advanced Features

- **Product Variations** - Complex SKU management
- **Cart Persistence** - Survives page navigation
- **Inventory Validation** - Prevents overselling
- **Error Recovery** - Graceful API failure handling

## 🛠️ API Endpoints

| Endpoint               | Method | Purpose                    |
| ---------------------- | ------ | -------------------------- |
| `/api/list-catalog`    | GET    | Fetch product catalog      |
| `/api/create-checkout` | POST   | Initialize Square checkout |
| `/api/cart-actions`    | POST   | Cart operations            |
| `/api/square-webhook`  | POST   | Square webhook handler     |

## 📱 Pages

- **`/`** - Product catalog homepage
- **`/product/[id]`** - Dynamic product detail pages
- **`/cart`** - Shopping cart management
- **`/order-confirmation`** - Post-purchase confirmation

## 🎨 Styling

Built with Tailwind CSS featuring:

- Custom color palette for e-commerce
- Responsive breakpoints
- Component-based utility classes
- Dark/light theme support

## 🧪 Testing

```bash
# Run Square integration tests
pnpm test

# Type checking
pnpm check
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
- **Package Manager**: pnpm

## 🔒 Security

- Environment variable validation
- Webhook signature verification
- Type-safe API interactions
- Input sanitization
- Error boundary implementation

## 📊 Performance

- **SSR Optimization** - Server-side rendering for dynamic content
- **Asset Optimization** - Automatic image and code optimization
- **Caching Strategy** - Smart caching for API responses
- **Bundle Splitting** - Optimal JavaScript delivery

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Follow TypeScript strict mode
4. Ensure all tests pass
5. Submit pull request

### Development Guidelines

- Maintain type safety across all modules
- Follow existing component patterns
- Update documentation for new features
- Test Square integration thoroughly

## 📝 Documentation

Additional documentation available:

- [Square Integration Guide](docs/square-integration.md)
- [Product Variations Implementation](docs/product-variations.md)
- [Inventory Management](docs/inventory-management.md)
- [Cart System Architecture](docs/cart-system.md)

## 🔧 Dependencies

### Core

- **Astro 5.0.5** - Web framework
- **TypeScript 5.7.2** - Type safety
- **Square 39.0.0** - Payment processing
- **Tailwind CSS 3.4.16** - Styling

### Features

- **@astrojs/netlify** - Deployment adapter
- **astro-icon** - Icon system
- **astro-seo-metadata** - SEO optimization

## 📈 Roadmap

- [ ] Multi-currency support
- [ ] Advanced search and filtering
- [ ] Customer account system
- [ ] Order history and tracking
- [ ] Inventory management dashboard

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:

- Check [existing issues](https://github.com/travhall/el-camino/issues)
- Review Square API documentation
- Contact Square developer support for payment issues

---

Built with ❤️ using Astro and Square Commerce APIs
