// /src/lib/square/variationParser.ts
import type {
  ProductVariation,
  VariationConfig,
  VariationSelectionState,
} from "./types";

/**
 * Configuration for variation parsing
 * Maps number of parts to attribute names
 */
export const VARIATION_CONFIG: VariationConfig = {
  // Position mappings for different part counts
  attributeMappings: {
    1: ["variant"],
    2: ["size", "color"],
    3: ["size", "color", "material"],
    4: ["size", "color", "material", "style"],
  },

  // Display names for UI
  displayNames: {
    size: "Size",
    color: "Color",
    material: "Material",
    style: "Style",
    variant: "Option",
  },
};

/**
 * Parse a variation name into structured attributes
 * Handles position-based parsing: "Large, Red, Cotton" → {size: "Large", color: "Red", material: "Cotton"}
 *
 * @param name - The variation name to parse (e.g., "Large, Red" or "Medium, Black, Cotton")
 * @returns Structured attributes object
 */
export function parseVariationName(name: string): Record<string, string> {
  if (!name || name.trim() === "") {
    return {};
  }

  // Split by comma and trim whitespace
  const parts = name
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return {};
  }

  // Get attribute mapping for this number of parts
  const attributeNames =
    VARIATION_CONFIG.attributeMappings[parts.length] ||
    // Fallback for unknown counts - generate generic names
    Array.from({ length: parts.length }, (_, i) => `attribute_${i + 1}`);

  // Build attributes object
  const attributes: Record<string, string> = {};
  parts.forEach((part, index) => {
    if (index < attributeNames.length) {
      attributes[attributeNames[index]] = part;
    }
  });

  return attributes;
}

/**
 * Build available attributes map from all variations
 * Creates a structure like: { size: ["Small", "Medium", "Large"], color: ["Red", "Blue"] }
 *
 * @param variations - Array of product variations
 * @returns Map of attribute types to their possible values
 */
export function buildAvailableAttributes(
  variations: ProductVariation[]
): Record<string, string[]> {
  const attributeMap: Record<string, Set<string>> = {};

  variations.forEach((variation) => {
    if (!variation.attributes) {
      // Parse attributes if not already done
      variation.attributes = parseVariationName(variation.name);
    }

    // Add each attribute value to the appropriate set
    Object.entries(variation.attributes).forEach(([attributeType, value]) => {
      if (!attributeMap[attributeType]) {
        attributeMap[attributeType] = new Set();
      }
      attributeMap[attributeType].add(value);
    });
  });

  // Convert sets to sorted arrays
  const result: Record<string, string[]> = {};
  Object.entries(attributeMap).forEach(([attributeType, valueSet]) => {
    result[attributeType] = Array.from(valueSet).sort();
  });

  return result;
}

/**
 * Find a variation that matches the given attributes
 *
 * @param variations - Array of product variations
 * @param selectedAttributes - Attributes to match against
 * @returns Matching variation or undefined
 */
export function findVariationByAttributes(
  variations: ProductVariation[],
  selectedAttributes: Record<string, string>
): ProductVariation | undefined {
  return variations.find((variation) => {
    if (!variation.attributes) {
      variation.attributes = parseVariationName(variation.name);
    }

    // Check if all selected attributes match this variation
    return Object.entries(selectedAttributes).every(
      ([attributeType, value]) => {
        return variation.attributes?.[attributeType] === value;
      }
    );
  });
}

/**
 * Get all possible values for a specific attribute type
 *
 * @param variations - Array of product variations
 * @param attributeType - The attribute type to get values for (e.g., 'size', 'color')
 * @returns Array of unique values for that attribute
 */
export function getAttributeValues(
  variations: ProductVariation[],
  attributeType: string
): string[] {
  const values = new Set<string>();

  variations.forEach((variation) => {
    if (!variation.attributes) {
      variation.attributes = parseVariationName(variation.name);
    }

    const value = variation.attributes[attributeType];
    if (value) {
      values.add(value);
    }
  });

  return Array.from(values).sort();
}

/**
 * Get the first available variation for a product
 * Useful for setting default selections
 *
 * @param variations - Array of product variations
 * @returns First variation or undefined
 */
export function getDefaultVariation(
  variations: ProductVariation[]
): ProductVariation | undefined {
  return variations.length > 0 ? variations[0] : undefined;
}

/**
 * Get attributes for the default variation
 *
 * @param variations - Array of product variations
 * @returns Attributes of the first variation
 */
export function getDefaultAttributes(
  variations: ProductVariation[]
): Record<string, string> {
  const defaultVariation = getDefaultVariation(variations);
  if (!defaultVariation) {
    return {};
  }

  if (!defaultVariation.attributes) {
    defaultVariation.attributes = parseVariationName(defaultVariation.name);
  }

  return defaultVariation.attributes;
}

/**
 * Check if variations use a specific attribute type
 *
 * @param variations - Array of product variations
 * @param attributeType - The attribute type to check for
 * @returns True if any variation has this attribute type
 */
export function hasAttributeType(
  variations: ProductVariation[],
  attributeType: string
): boolean {
  return variations.some((variation) => {
    if (!variation.attributes) {
      variation.attributes = parseVariationName(variation.name);
    }
    return variation.attributes[attributeType] !== undefined;
  });
}

/**
 * Get display name for an attribute type
 *
 * @param attributeType - The attribute type (e.g., 'size', 'color')
 * @returns Human-readable display name
 */
export function getAttributeDisplayName(attributeType: string): string {
  return (
    VARIATION_CONFIG.displayNames[attributeType] ||
    // Fallback: capitalize first letter
    attributeType.charAt(0).toUpperCase() + attributeType.slice(1)
  );
}

/**
 * Create initial variation selection state
 *
 * @param variations - Array of product variations
 * @returns Initial selection state
 */
export function createInitialSelectionState(
  variations: ProductVariation[]
): VariationSelectionState {
  // Ensure all variations have parsed attributes
  variations.forEach((variation) => {
    if (!variation.attributes) {
      variation.attributes = parseVariationName(variation.name);
    }
  });

  const availableAttributes = buildAvailableAttributes(variations);
  const defaultAttributes = getDefaultAttributes(variations);
  const currentVariation = findVariationByAttributes(
    variations,
    defaultAttributes
  );

  return {
    selectedAttributes: defaultAttributes,
    availableAttributes,
    currentVariation,
  };
}
