# WordPress High-ROI Business Components - Content Creator Guide

## Overview

The WordPress High-ROI Business Components seamlessly bridge content and commerce, allowing you to showcase products, promote events, and highlight team members directly within your blog posts.

**NEW**: All components now support **human-readable SKUs** for easier content creation! Use descriptive SKUs like `SPITFIRE-CLASSIC-SOCKS` instead of cryptic IDs.

## Quick Reference

**🔗 SKU Reference Tool**: Visit `/admin/content/sku-reference` to see all available product SKUs with copy-to-clipboard functionality.

## Component 1: Product Showcase

**Purpose**: Display Square catalog products within blog posts for direct content-to-purchase conversion.

### Usage Examples

#### Basic Product Grid (NEW SKU Format)

```html
<div
  class="wp-block-product-showcase"
  data-product-skus="SPITFIRE-CLASSIC-87-SWIRL,THRASHER-THORNS-HOODY"
  data-title="New Arrivals"
></div>
```

#### Carousel Layout

```html
<div
  class="wp-block-product-showcase"
  data-product-skus="KROOKED-838-MANDERSON-JUST,REAL-838-NICOLE-HAUSE,KROOKED-UNA-FARRAR-PUNX"
  data-layout="carousel"
  data-columns="3"
  data-title="Featured Decks"
  data-description="Check out our latest pro model decks"
></div>
```

#### List Layout for Setup Guides

```html
<div
  class="wp-block-product-showcase"
  data-product-skus="REAL-838-NICOLE-HAUSE,SLAPPY-ST1-HOLLOW-LOW,SPITFIRE-CLASSIC-87-SWIRL"
  data-layout="list"
  data-title="Complete Beginner Setup"
  data-description="Everything you need to get started"
></div>
```

### Available Product SKUs (Examples)

**Visit `/admin/content/sku-reference` for the complete, up-to-date list with copy functionality.**

**Sample SKUs:**

- `SPITFIRE-CLASSIC-SOCKS` - Spitfire Classic 87 Swirl 3-pack Socks
- `THRASHER-THORNS-HOODY` - Thrasher Thorns Hoody
- `KROOKED-MANDERSON-DECK` - Krooked 8.38 Manderson Just Cause Deck
- `REAL-NICOLE-DECK` - Real 8.38 Nicole Hause by Marbie Deck
- `SLAPPY-HOLLOW-TRUCKS` - Slappy ST1 Hollow Low Trucks Black 8.25

### Configuration Options

| Attribute           | Values                       | Default | Description                                   |
| ------------------- | ---------------------------- | ------- | --------------------------------------------- |
| `data-product-skus` | Comma-separated SKUs         | None    | **NEW**: Human-readable product SKUs          |
| `data-product-ids`  | Comma-separated IDs          | None    | Legacy: Cryptic product IDs (still supported) |
| `data-layout`       | `grid`, `carousel`, `list`   | `grid`  | Display layout                                |
| `data-columns`      | `1`, `2`, `3`, `4`, `5`, `6` | `3`     | Grid columns                                  |
| `data-title`        | Any text                     | None    | Showcase title                                |
| `data-description`  | Any text                     | None    | Showcase description                          |

**Recommendation**: Use `data-product-skus` for new content. The system will automatically fall back to `data-product-ids` for backward compatibility.

---

## Component 2: Event Announcements

**Purpose**: Promote shop events, skate sessions, and community gatherings with structured event information.

### Usage Examples

#### Basic Event

```html
<div
  class="wp-block-event"
  data-title="Saturday Skate Session"
  data-date="2025-08-15"
  data-time="2:00 PM - 6:00 PM"
  data-location="El Camino Skate Shop"
  data-description="Join us for our weekly skate session! All skill levels welcome."
></div>
```

#### Event with Registration

```html
<div
  class="wp-block-event"
  data-title="Pro Demo Day"
  data-date="2025-08-20"
  data-time="1:00 PM - 5:00 PM"
  data-location="El Camino Skate Shop"
  data-description="Meet our pro team and try out new gear."
  data-rsvp-url="https://eventbrite.com/event/123"
  data-registration-required="true"
  data-image="https://your-cdn.com/pro-demo-day.jpg"
></div>
```

#### Event with Featured Products

```html
<div
  class="wp-block-event"
  data-title="New Brand Launch Party"
  data-date="2025-08-25"
  data-time="6:00 PM - 9:00 PM"
  data-location="El Camino Skate Shop"
  data-description="Celebrate the launch of our new brand partnership!"
  data-featured-products="SPITFIRE-CLASSIC-SOCKS,THRASHER-THORNS-HOODY"
  data-image="https://your-cdn.com/launch-party.jpg"
></div>
```

### Configuration Options

| Attribute                    | Required | Description                                           |
| ---------------------------- | -------- | ----------------------------------------------------- |
| `data-title`                 | ✅       | Event name                                            |
| `data-date`                  | ✅       | Date (YYYY-MM-DD format)                              |
| `data-time`                  | ✅       | Time range                                            |
| `data-location`              | ❌       | Event location                                        |
| `data-description`           | ✅       | Event description                                     |
| `data-rsvp-url`              | ❌       | Registration/RSVP link                                |
| `data-registration-required` | ❌       | Set to "true" if registration required                |
| `data-image`                 | ❌       | Event featured image URL                              |
| `data-featured-products`     | ❌       | **NEW**: Comma-separated product SKUs (or legacy IDs) |

---

## Component 3: Team Member Profiles

**Purpose**: Showcase team expertise, build credibility, and promote gear recommendations.

### Usage Examples

#### Basic Team Profile

```html
<div
  class="wp-block-team-member"
  data-name="Alex Rodriguez"
  data-role="Pro Team Rider"
  data-bio="Alex has been skating for over 15 years and specializes in street and transition riding."
  data-image="https://your-cdn.com/alex-profile.jpg"
></div>
```

#### Complete Profile with Social Links

```html
<div
  class="wp-block-team-member"
  data-name="Alex Rodriguez"
  data-role="Pro Team Rider"
  data-bio="Alex has been skating for over 15 years and specializes in street and transition riding. Known for his technical approach and smooth style."
  data-image="https://your-cdn.com/alex-profile.jpg"
  data-instagram="https://instagram.com/alexskates"
  data-youtube="https://youtube.com/alexrodriguez"
  data-years-skating="15"
  data-hometown="San Diego, CA"
></div>
```

#### Profile with Setup Details and Achievements

```html
<div
  class="wp-block-team-member"
  data-name="Alex Rodriguez"
  data-role="Pro Team Rider"
  data-bio="Alex has been skating for over 15 years and specializes in street and transition riding."
  data-image="https://your-cdn.com/alex-profile.jpg"
  data-instagram="https://instagram.com/alexskates"
  data-youtube="https://youtube.com/alexrodriguez"
  data-favorite-products="KROOKED-MANDERSON-DECK,SLAPPY-HOLLOW-TRUCKS,SPITFIRE-CLASSIC-SOCKS"
  data-setup-deck="Real 8.25 Street Series"
  data-setup-trucks="Independent 149"
  data-setup-wheels="Spitfire Formula Four 54mm"
  data-setup-bearings="Bones Reds"
  data-achievements="2023 Street League Champion,X-Games Bronze Medalist,Thrasher SOTY Nominee"
  data-years-skating="15"
  data-hometown="San Diego, CA"
></div>
```

### Configuration Options

| Attribute                | Required | Description                                           |
| ------------------------ | -------- | ----------------------------------------------------- |
| `data-name`              | ✅       | Team member name                                      |
| `data-role`              | ✅       | Role/position                                         |
| `data-bio`               | ✅       | Biography                                             |
| `data-image`             | ✅       | Profile image URL                                     |
| `data-instagram`         | ❌       | Instagram profile URL                                 |
| `data-youtube`           | ❌       | YouTube channel URL                                   |
| `data-tiktok`            | ❌       | TikTok profile URL                                    |
| `data-website`           | ❌       | Personal website URL                                  |
| `data-favorite-products` | ❌       | **NEW**: Comma-separated product SKUs (or legacy IDs) |
| `data-setup-deck`        | ❌       | Current deck setup                                    |
| `data-setup-trucks`      | ❌       | Current trucks                                        |
| `data-setup-wheels`      | ❌       | Current wheels                                        |
| `data-setup-bearings`    | ❌       | Current bearings                                      |
| `data-setup-grip`        | ❌       | Current grip tape                                     |
| `data-achievements`      | ❌       | Comma-separated achievements                          |
| `data-years-skating`     | ❌       | Years skating (number)                                |
| `data-hometown`          | ❌       | Hometown                                              |

---

## Content Strategy Tips

### Product Showcases

- **New Arrivals**: Use product showcases to highlight fresh inventory
- **Seasonal Collections**: Group related products for seasonal promotions
- **Setup Guides**: Use list layout to show complete skateboard builds
- **Brand Spotlights**: Feature products from specific brands

### Event Announcements

- **Regular Sessions**: Promote weekly skate sessions to build community
- **Product Launches**: Create excitement around new gear arrivals
- **Pro Visits**: Announce when sponsored riders visit the shop
- **Contests**: Promote shop competitions and giveaways

### Team Profiles

- **Staff Introductions**: Help customers connect with your team
- **Pro Riders**: Showcase sponsored athlete credentials
- **Guest Features**: Highlight visiting pros or local legends
- **Setup Breakdowns**: Show what the pros actually ride

### SEO Benefits

These components automatically generate:

- **Structured Data**: Search engines understand your content better
- **Product Schema**: Products appear in Google Shopping results
- **Event Schema**: Events may appear in Google Events
- **Person Schema**: Team profiles enhance local SEO

### Performance Notes

- **Optimized Loading**: Components use efficient bulk product fetching
- **Error Handling**: Graceful degradation when products aren't found
- **Mobile Responsive**: All components work perfectly on mobile devices
- **Accessibility**: Full keyboard navigation and screen reader support

---

## Testing Your Components

Visit `/test-wordpress-components` on your site to see all components in action and verify they're working correctly.

## Support

If you encounter issues with these components, check the browser console for helpful error messages. The components provide detailed debugging information in development mode.
