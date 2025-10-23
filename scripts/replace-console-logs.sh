#!/bin/bash
# Script to replace console.log with logger.log in source files
# Preserves console.error (critical errors should always show)

set -e

echo "🔧 Replacing console.log statements with production-safe logger..."

# Count before
BEFORE=$(find src -type f \( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \) -exec grep -l "console\.log" {} \; | wc -l)
echo "📊 Files with console.log before: $BEFORE"

# Add logger import to files that use console.log
echo "📦 Adding logger imports..."
find src -type f \( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
  if grep -q "console\.log" "$file"; then
    # Check if logger already imported
    if ! grep -q "from.*@/lib/utils/logger" "$file"; then
      # Detect file type and add appropriate import
      if [[ $file == *.astro ]]; then
        # For .astro files, add to frontmatter
        if grep -q "^---" "$file"; then
          # Has frontmatter, add after first ---
          sed -i '' '0,/^---$/! {0,/^---$/ s/^---$/---\nimport { logger } from "@\/lib\/utils\/logger";/}' "$file"
        fi
      else
        # For .ts/.tsx files, add at top
        sed -i '' '1i\
import { logger } from "@/lib/utils/logger";\
' "$file"
      fi
    fi
  fi
done

# Replace console.log with logger.log
echo "🔄 Replacing console.log statements..."
find src -type f \( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.log/logger.log/g' {} +

# Replace console.warn with logger.warn
find src -type f \( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.warn/logger.warn/g' {} +

# Replace console.debug with logger.debug
find src -type f \( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/console\.debug/logger.debug/g' {} +

# Count after
AFTER=$(find src -type f \( -name "*.astro" -o -name "*.ts" -o -name "*.tsx" \) -exec grep -l "console\.log" {} \; | wc -l)
echo "📊 Files with console.log after: $AFTER"

echo "✅ Replacement complete!"
echo "⚠️  Note: console.error statements preserved (errors should always show)"
echo ""
echo "📝 Next steps:"
echo "1. Test the site: pnpm run dev"
echo "2. Check for any import errors"
echo "3. Build for production: pnpm run build"
