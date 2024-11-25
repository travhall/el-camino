export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'http://localhost:1337'),
  app: {
    keys: env.array('APP_KEYS', ['devKey1', 'devKey2', 'devKey3', 'devKey4']),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // Add base path configuration for GitHub Pages
  prefix: env('PUBLIC_URL', '').includes('github.io') ? '/el-camino/api' : '',
});