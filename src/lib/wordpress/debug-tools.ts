// src/lib/wordpress/debug-tools.ts
// Debug utilities for WordPress block parsing

export function analyzeWordPressContent(content: string): {
  totalLength: number;
  blockTypes: string[];
  detectedBlocks: Array<{
    type: string;
    count: number;
    firstOccurrence: number;
  }>;
  rawBlockClasses: string[];
} {
  if (!content) {
    return {
      totalLength: 0,
      blockTypes: [],
      detectedBlocks: [],
      rawBlockClasses: [],
    };
  }

  // Find all wp-block- classes
  const blockClassRegex = /class="[^"]*wp-block-([^"\s]+)[^"]*"/g;
  const rawBlockClasses: string[] = [];
  const blockCounts = new Map<
    string,
    { count: number; firstOccurrence: number }
  >();

  let match;
  while ((match = blockClassRegex.exec(content)) !== null) {
    const blockType = match[1];
    const fullMatch = match[0];

    rawBlockClasses.push(fullMatch);

    if (blockCounts.has(blockType)) {
      blockCounts.get(blockType)!.count++;
    } else {
      blockCounts.set(blockType, {
        count: 1,
        firstOccurrence: match.index || 0,
      });
    }
  }

  const detectedBlocks = Array.from(blockCounts.entries()).map(
    ([type, data]) => ({
      type,
      count: data.count,
      firstOccurrence: data.firstOccurrence,
    })
  );

  return {
    totalLength: content.length,
    blockTypes: Array.from(blockCounts.keys()),
    detectedBlocks,
    rawBlockClasses,
  };
}

export function generateDebugReport(content: string): string {
  const analysis = analyzeWordPressContent(content);

  let report = `WordPress Content Analysis Report\n`;
  report += `=====================================\n\n`;
  report += `Content Length: ${analysis.totalLength} characters\n`;
  report += `Block Types Found: ${analysis.blockTypes.length}\n\n`;

  if (analysis.detectedBlocks.length > 0) {
    report += `Detected Blocks:\n`;
    analysis.detectedBlocks.forEach((block) => {
      report += `  • ${block.type}: ${block.count} occurrence(s)\n`;
    });
    report += `\n`;
  }

  if (analysis.rawBlockClasses.length > 0) {
    report += `Raw Block Classes (first 10):\n`;
    analysis.rawBlockClasses.slice(0, 10).forEach((cls, index) => {
      report += `  ${index + 1}. ${cls}\n`;
    });
    if (analysis.rawBlockClasses.length > 10) {
      report += `  ... and ${analysis.rawBlockClasses.length - 10} more\n`;
    }
  }

  return report;
}

// Console debug function
export function debugWordPressContent(
  content: string,
  label = "WordPress Content"
): void {
  if (typeof console === "undefined") return;

  console.group(`🔧 ${label} Analysis`);

  const analysis = analyzeWordPressContent(content);

  console.log(`📊 Content length: ${analysis.totalLength} characters`);
  console.log(`🧩 Block types found: ${analysis.blockTypes.length}`);

  if (analysis.detectedBlocks.length > 0) {
    console.table(analysis.detectedBlocks);
  } else {
    console.log("❌ No WordPress blocks detected");
  }

  if (analysis.rawBlockClasses.length > 0) {
    console.log("🔍 Raw block classes:", analysis.rawBlockClasses.slice(0, 5));
  }

  // Show content preview
  const preview =
    content.length > 200 ? content.substring(0, 200) + "..." : content;
  console.log("📄 Content preview:", preview);

  console.groupEnd();
}

// Helper to extract specific block content
export function extractBlockContent(
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

// Check if content has specific blocks
export function hasWordPressBlock(content: string, blockType: string): boolean {
  const normalizedType = blockType.replace("/", "-");
  return content.includes(`wp-block-${normalizedType}`);
}

// Get all WordPress block types in content
export function getWordPressBlockTypes(content: string): string[] {
  const blockRegex = /wp-block-([a-zA-Z0-9-]+)/g;
  const blocks = new Set<string>();
  let match;

  while ((match = blockRegex.exec(content)) !== null) {
    blocks.add(match[1]);
  }

  return Array.from(blocks);
}

// Browser-friendly debug function
export function createDebugPanel(content: string): HTMLElement {
  const analysis = analyzeWordPressContent(content);

  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 300px;
    max-height: 400px;
    overflow-y: auto;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 16px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <strong>🔧 WP Debug</strong>
      <button onclick="this.parentElement.parentElement.remove()" style="background: #dc3545; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer;">×</button>
    </div>
    
    <div style="margin-bottom: 8px;">
      <strong>Content:</strong> ${analysis.totalLength} chars
    </div>
    
    <div style="margin-bottom: 8px;">
      <strong>Blocks:</strong> ${analysis.blockTypes.length} types
    </div>
    
    ${
      analysis.detectedBlocks.length > 0
        ? `
      <div style="margin-bottom: 8px;">
        <strong>Detected:</strong>
        <ul style="margin: 4px 0; padding-left: 16px;">
          ${analysis.detectedBlocks
            .map(
              (block) => `
            <li>${block.type}: ${block.count}</li>
          `
            )
            .join("")}
        </ul>
      </div>
    `
        : '<div style="color: #dc3545;">No blocks detected</div>'
    }
    
    <button onclick="console.log('WordPress Content:', ${JSON.stringify(
      content.substring(0, 500)
    )})" 
            style="width: 100%; padding: 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 8px;">
      Log Content to Console
    </button>
  `;

  return panel;
}

// Quick debug function for development
export function quickDebug(content: string): void {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    // Remove any existing debug panel
    const existing = document.querySelector("[data-wp-debug]");
    if (existing) existing.remove();

    // Create new debug panel
    const panel = createDebugPanel(content);
    panel.setAttribute("data-wp-debug", "true");
    document.body.appendChild(panel);
  }

  // Also log to console
  debugWordPressContent(content);
}
