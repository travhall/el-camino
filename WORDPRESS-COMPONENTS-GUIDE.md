# WordPress Business Components - Content Creator Guide

## Overview

El Camino now supports two powerful WordPress blocks for creating engaging content that drives sales and community engagement:

1. **Product Showcase Block** - Display Square products within blog posts
2. **Event Block** - Announce events with calendar integration

## Product Showcase Block

Display products directly in your WordPress posts to drive sales.

### Basic Usage

```html
<div class="wp-block-product-showcase" 
     data-product-ids="6RMQNPV2IHKOLRGRHD3DCYCY,D4NIZKNJKOKEEOYNCTFPKEHX"
     data-title="Featured Products"
     data-description="Check out these awesome items">
</div>
```

### Layout Options

**Grid Layout (Default)**
```html
<div class="wp-block-product-showcase" 
     data-product-ids="ID1,ID2,ID3"
     data-layout="grid"
     data-columns="3"
     data-title="New Arrivals">
</div>
```

**Carousel Layout**
```html
<div class="wp-block-product-showcase" 
     data-product-ids="ID1,ID2,ID3,ID4"
     data-layout="carousel"
     data-title="Featured Decks">
</div>
```

**List Layout**
```html
<div class="wp-block-product-showcase" 
     data-product-ids="ID1,ID2,ID3"
     data-layout="list"
     data-title="Complete Setup Guide">
</div>
```

### Available Product IDs

Here are some current product IDs you can use:

**Apparel:**
- `6RMQNPV2IHKOLRGRHD3DCYCY` - Spitfire Classic 87 Swirl Socks
- `D4NIZKNJKOKEEOYNCTFPKEHX` - Thrasher Thorns Hoody
- `XU4Q7N27XEHVS2WOMYHPIWCX` - Toy Machine Bronson T Shirt

**Decks:**
- `OC527UX6LJVAQNN6EPAQXRZ5` - Krooked 8.38 Manderson Just Cause Deck
- `2PY4RRFOPWE5DN4WUCCAGLC5` - Real 8.38 Nicole Hause by Marbie Deck
- `UW557YXC3NELPRHSIUFOJJB6` - Krooked Una Farrar Punx 8.38 Deck

**Accessories:**
- `DXXNMLPRCRJZREN5ZARDW3HX` - Spitfire Lil Bighead Hat Olive/Gold
- `GF3KA3AG7L62AFWI7SSCJBFI` - Skeleton Key Keyhole Hat Black
- `UYK6I6IEOMFSHFCZXDRR7TYQ` - Toy Machine Dirt Deck Bag

## Event Block

Announce store events, skate sessions, and special happenings.

### Basic Event

```html
<div class="wp-block-event" 
     data-title="Saturday Skate Session"
     data-date="2025-08-15"
     data-time="2:00 PM - 6:00 PM"
     data-location="El Camino Skate Shop"
     data-description="Join us for our weekly skate session! All skill levels welcome.">
</div>
```

### Event with RSVP

```html
<div class="wp-block-event" 
     data-title="Deck Art Workshop"
     data-date="2025-09-01"
     data-time="1:00 PM - 4:00 PM"
     data-location="El Camino Skate Shop"
     data-description="Learn to create custom deck art with local artists."
     data-rsvp-url="https://eventbrite.com/event/123">
</div>
```

### Event with Registration Required

```html
<div class="wp-block-event" 
     data-title="Advanced Trick Clinic"
     data-date="2025-09-20"
     data-time="10:00 AM - 2:00 PM"
     data-description="Intensive clinic for advanced skaters. Limited to 15 participants."
     data-rsvp-url="https://forms.google.com/registration"
     data-registration-required="true">
</div>
```

### Event with Featured Products

```html
<div class="wp-block-event" 
     data-title="New Product Launch Party"
     data-date="2025-08-30"
     data-time="6:00 PM - 9:00 PM"
     data-description="Celebrate the launch of our new deck collection!"
     data-featured-products="OC527UX6LJVAQNN6EPAQXRZ5,2PY4RRFOPWE5DN4WUCCAGLC5"
     data-image="https://your-image-url.com/event.jpg">
</div>
```

## Content Ideas

### Product Showcase Ideas
- **"New Arrivals"** - Showcase latest products
- **"Staff Picks"** - Team recommendations
- **"Complete Setup Guide"** - All components for beginners
- **"Brand Spotlight"** - Focus on specific brands
- **"Seasonal Collections"** - Summer/winter gear
- **"Sale Items"** - Featured discounted products

### Event Ideas
- **Weekly skate sessions**
- **Product launch parties**
- **Trick clinics and workshops**
- **Brand demo days**
- **Contest announcements**
- **Community meetups**

## Best Practices

### Product Showcases
1. **Keep titles short and descriptive**
2. **Use 2-4 products for best visual impact**
3. **Match products to your content theme**
4. **Update product IDs if items are discontinued**

### Events
1. **Always include date, time, and location**
2. **Write compelling descriptions**
3. **Add RSVP links for better planning**
4. **Include relevant products when appropriate**
5. **Use high-quality event images**

## Getting Product IDs

To find product IDs for showcases:
1. Visit the product page on your site
2. Look at the URL - the ID is the string after `/product/`
3. Or ask the development team for a current list

## Testing

You can test these components on the development site at:
`/test-wordpress-components`

This page shows all the different configurations and layouts available.
