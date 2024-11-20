import fs from 'fs/promises';
import path from 'path';

const filesToRemove = [
    'src/lib/cart.ts',
    'src/lib/errors.ts',
    'src/lib/money-compat.ts',
    'src/lib/money-utils.ts',
    'src/lib/square-client.ts',
    'src/lib/square-debug.ts',
    'src/lib/types.ts',
    'src/pages/api/debug-endpoint.ts',
    'src/pages/api/env-debug.ts',
    'src/pages/api/verify-catalog.ts',
];

// DS_Store patterns to add to gitignore
const dsStorePattern = '.DS_Store';

async function cleanup() {
    try {
        // Remove deprecated files
        for (const file of filesToRemove) {
            try {
                await fs.unlink(file);
                console.log(`✅ Removed: ${file}`);
            } catch (error) {
                console.warn(`⚠️  Could not remove ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        // Update .gitignore
        const gitignorePath = '.gitignore';
        let gitignoreContent = '';
        try {
            gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
        } catch {
            console.log('No existing .gitignore found, creating new one');
        }

        if (!gitignoreContent.includes(dsStorePattern)) {
            gitignoreContent += `\n# System files\n${dsStorePattern}\n`;
            await fs.writeFile(gitignorePath, gitignoreContent);
            console.log('✅ Updated .gitignore');
        }

        console.log('\n🎉 Cleanup completed successfully!');
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();