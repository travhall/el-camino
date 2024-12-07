// netlify/plugins/setup-payload/index.js
const fs = require('fs')
const path = require('path')

module.exports = {
  onPreBuild: async ({ utils }) => {
    // Ensure data directories exist
    const dataDir = '/var/data'
    const mediaDir = path.join(dataDir, 'media')

    try {
      // Create directories if they don't exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true })
      }

      // Copy database if it exists
      const sourceDb = path.join('cms', 'cms.db')
      const targetDb = path.join(dataDir, 'cms.db')

      if (fs.existsSync(sourceDb)) {
        fs.copyFileSync(sourceDb, targetDb)
        utils.status.show({
          title: 'Database copied',
          summary: `Copied ${sourceDb} to ${targetDb}`
        })
      } else {
        utils.status.show({
          title: 'No database found',
          summary: 'Will create new database in production'
        })
      }

      // Set permissions
      fs.chmodSync(dataDir, '755')
      fs.chmodSync(mediaDir, '755')
      if (fs.existsSync(targetDb)) {
        fs.chmodSync(targetDb, '644')
      }
    } catch (error) {
      utils.build.failBuild('Failed to setup Payload', { error })
    }
  }
}