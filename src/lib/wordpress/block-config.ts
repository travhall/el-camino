// src/lib/wordpress/block-config.ts
// Configuration and utilities for WordPress block parsing

export interface BlockConfig {
  enabled: boolean;
  priority: number; // Higher priority = parsed first
  fallback: "original" | "hide" | "placeholder";
}

export interface WordPressBlockConfig {
  // Core blocks
  "core/image": BlockConfig;
  "core/gallery": BlockConfig;
  "core/quote": BlockConfig;
  "core/embed": BlockConfig;
  "core/columns": BlockConfig;
  "core/button": BlockConfig;
  "core/heading": BlockConfig;
  "core/paragraph": BlockConfig;
  "core/list": BlockConfig;

  // Jetpack blocks
  "jetpack/slideshow": BlockConfig;
  "jetpack/tiled-gallery": BlockConfig;
  "jetpack/contact-form": BlockConfig;

  // Third-party blocks
  "woocommerce/product-grid": BlockConfig;
  "contact-form-7/contact-form-selector": BlockConfig;
}

// Default configuration
export const defaultBlockConfig: WordPressBlockConfig = {
  // Highly enhanced blocks
  "jetpack/slideshow": { enabled: true, priority: 10, fallback: "original" },
  "core/gallery": { enabled: true, priority: 9, fallback: "original" },
  "core/embed": { enabled: true, priority: 8, fallback: "original" },
  "core/quote": { enabled: true, priority: 7, fallback: "original" },
  "core/image": { enabled: true, priority: 6, fallback: "original" },

  // Moderately enhanced blocks
  "core/columns": { enabled: true, priority: 5, fallback: "original" },
  "core/button": { enabled: true, priority: 4, fallback: "original" },

  // Basic blocks (might enhance later)
  "core/heading": { enabled: false, priority: 3, fallback: "original" },
  "core/paragraph": { enabled: false, priority: 2, fallback: "original" },
  "core/list": { enabled: false, priority: 1, fallback: "original" },

  // Jetpack extended blocks
  "jetpack/tiled-gallery": {
    enabled: false,
    priority: 8,
    fallback: "original",
  },
  "jetpack/contact-form": { enabled: false, priority: 7, fallback: "original" },

  // Third-party blocks (disabled by default)
  "woocommerce/product-grid": {
    enabled: false,
    priority: 5,
    fallback: "original",
  },
  "contact-form-7/contact-form-selector": {
    enabled: false,
    priority: 4,
    fallback: "original",
  },
};

// Environment-based configuration
export const getBlockConfig = (
  env: "development" | "production" = "production"
): WordPressBlockConfig => {
  if (env === "development") {
    // In development, enable more experimental blocks
    return {
      ...defaultBlockConfig,
      "jetpack/tiled-gallery": {
        enabled: true,
        priority: 8,
        fallback: "original",
      },
      "core/heading": { enabled: true, priority: 3, fallback: "original" },
    };
  }

  return defaultBlockConfig;
};

// Block detection utilities
export interface DetectedBlock {
  type: string;
  className: string;
  count: number;
  supported: boolean;
  config: BlockConfig;
}

export function analyzeWordPressContent(content: string): {
  detectedBlocks: DetectedBlock[];
  totalBlocks: number;
  supportedBlocks: number;
  unsupportedBlocks: string[];
} {
  const blockPattern = /class="[^"]*wp-block-([^"\s]+)[^"]*"/g;
  const blockCounts = new Map<string, number>();
  const blockClasses = new Map<string, string>();

  let match;
  while ((match = blockPattern.exec(content)) !== null) {
    const blockType = match[1];
    const fullClass = match[0];

    blockCounts.set(blockType, (blockCounts.get(blockType) || 0) + 1);
    if (!blockClasses.has(blockType)) {
      blockClasses.set(blockType, fullClass);
    }
  }

  const config = getBlockConfig();
  const detectedBlocks: DetectedBlock[] = [];
  const unsupportedBlocks: string[] = [];

  for (const [blockType, count] of blockCounts.entries()) {
    const normalizedType = normalizeBlockType(blockType);
    const blockConfig = config[normalizedType as keyof WordPressBlockConfig];
    const supported = !!blockConfig?.enabled;

    detectedBlocks.push({
      type: blockType,
      className: blockClasses.get(blockType) || "",
      count,
      supported,
      config: blockConfig || {
        enabled: false,
        priority: 0,
        fallback: "original",
      },
    });

    if (!supported) {
      unsupportedBlocks.push(blockType);
    }
  }

  // Sort by priority (highest first)
  detectedBlocks.sort((a, b) => b.config.priority - a.config.priority);

  return {
    detectedBlocks,
    totalBlocks: Array.from(blockCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    ),
    supportedBlocks: detectedBlocks
      .filter((b) => b.supported)
      .reduce((sum, b) => sum + b.count, 0),
    unsupportedBlocks: Array.from(new Set(unsupportedBlocks)),
  };
}

// Normalize block type names to match our config
function normalizeBlockType(blockType: string): string {
  // Convert CSS class names to block type names
  const typeMap: Record<string, string> = {
    "jetpack-slideshow": "jetpack/slideshow",
    "jetpack-tiled-gallery": "jetpack/tiled-gallery",
    "jetpack-contact-form": "jetpack/contact-form",
    gallery: "core/gallery",
    image: "core/image",
    quote: "core/quote",
    embed: "core/embed",
    "embed-youtube": "core/embed",
    "embed-vimeo": "core/embed",
    "embed-twitter": "core/embed",
    "embed-instagram": "core/embed",
    columns: "core/columns",
    column: "core/columns",
    button: "core/button",
    heading: "core/heading",
    paragraph: "core/paragraph",
    list: "core/list",
  };

  return typeMap[blockType] || `unknown/${blockType}`;
}

// Debug utilities
export function debugWordPressBlocks(content: string): void {
  if (typeof window === "undefined" || !window.console) return;

  const analysis = analyzeWordPressContent(content);

  console.group("🔧 WordPress Block Analysis");
  console.log(`📊 Total blocks detected: ${analysis.totalBlocks}`);
  console.log(`✅ Supported blocks: ${analysis.supportedBlocks}`);
  console.log(
    `❌ Unsupported blocks: ${analysis.totalBlocks - analysis.supportedBlocks}`
  );

  if (analysis.detectedBlocks.length > 0) {
    console.table(
      analysis.detectedBlocks.map((block) => ({
        "Block Type": block.type,
        Count: block.count,
        Supported: block.supported ? "✅" : "❌",
        Priority: block.config.priority,
        Fallback: block.config.fallback,
      }))
    );
  }

  if (analysis.unsupportedBlocks.length > 0) {
    console.warn("🚨 Unsupported blocks found:", analysis.unsupportedBlocks);
    console.log(
      "💡 Consider adding support for these blocks or updating the block config"
    );
  }

  console.groupEnd();
}

// Performance monitoring
export function measureBlockParsing<T>(
  fn: () => T,
  blockCount: number
): { result: T; duration: number; blocksPerMs: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;

  return {
    result,
    duration,
    blocksPerMs: blockCount / duration,
  };
}

// Content preprocessing utilities
export function preprocessWordPressContent(content: string): string {
  if (!content) return "";

  return (
    content
      // Fix common WordPress formatting issues
      .replace(/<p>(\s*<figure[^>]*>[\s\S]*?<\/figure>\s*)<\/p>/gi, "$1")
      .replace(
        /<p>(\s*<div[^>]*class="[^"]*wp-block-[^"]*"[^>]*>[\s\S]*?<\/div>\s*)<\/p>/gi,
        "$1"
      )

      // Normalize Jetpack block classes
      .replace(
        /class="wp-block-jetpack-slideshow/g,
        'class="wp-block-jetpack-slideshow'
      )

      // Add missing alt attributes for accessibility
      .replace(/<img([^>]+)(?!alt=)/g, '<img$1 alt=""')

      // Clean up excessive whitespace around blocks
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim()
  );
}

// Block extraction utilities
export function extractBlocksByType(
  content: string,
  blockType: string
): string[] {
  const normalizedType = blockType.replace("/", "-");
  const regex = new RegExp(
    `<(?:div|figure|blockquote)[^>]*class="[^"]*wp-block-${normalizedType}[^"]*"[^>]*>[\\s\\S]*?</(?:div|figure|blockquote)>`,
    "gi"
  );

  return content.match(regex) || [];
}

// Validation utilities
export function validateBlockStructure(
  blockHtml: string,
  blockType: string
): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Common validation rules
  if (!blockHtml.includes(`wp-block-${blockType.replace("/", "-")}`)) {
    issues.push(
      `Missing expected CSS class wp-block-${blockType.replace("/", "-")}`
    );
  }

  if (blockType.includes("image") || blockType.includes("gallery")) {
    if (!blockHtml.includes("<img")) {
      issues.push("Image block missing img element");
    }

    const imgTags = blockHtml.match(/<img[^>]*>/g) || [];
    for (const img of imgTags) {
      if (!img.includes("alt=")) {
        issues.push("Image missing alt attribute");
        suggestions.push("Add alt attribute for accessibility");
      }
    }
  }

  if (blockType.includes("embed")) {
    if (!blockHtml.includes("<iframe") && !blockHtml.includes("<a ")) {
      issues.push("Embed block missing iframe or link element");
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  };
}

// Export for use in components
export { preprocessWordPressContent as sanitizeWordPressContent };
