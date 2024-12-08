# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── Card.astro
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

```
el-camino
├─ .git
│  ├─ COMMIT_EDITMSG
│  ├─ FETCH_HEAD
│  ├─ HEAD
│  ├─ ORIG_HEAD
│  ├─ branches
│  ├─ config
│  ├─ description
│  ├─ hooks
│  │  ├─ applypatch-msg.sample
│  │  ├─ commit-msg.sample
│  │  ├─ fsmonitor-watchman.sample
│  │  ├─ post-update.sample
│  │  ├─ pre-applypatch.sample
│  │  ├─ pre-commit.sample
│  │  ├─ pre-merge-commit.sample
│  │  ├─ pre-push.sample
│  │  ├─ pre-rebase.sample
│  │  ├─ pre-receive.sample
│  │  ├─ prepare-commit-msg.sample
│  │  ├─ push-to-checkout.sample
│  │  ├─ sendemail-validate.sample
│  │  └─ update.sample
│  ├─ index
│  ├─ info
│  │  └─ exclude
│  ├─ logs
│  │  ├─ HEAD
│  │  └─ refs
│  │     ├─ heads
│  │     │  └─ master
│  │     └─ remotes
│  │        └─ origin
│  │           ├─ HEAD
│  │           └─ master
│  ├─ objects
│  │  ├─ 08
│  │  │  └─ ...
│  │  ├─ info
│  │  └─ pack
│  │     ├─ pack-1c3cf46a32f382dc11a78a4a1b185e9e97209a19.idx
│  │     ├─ pack-1c3cf46a32f382dc11a78a4a1b185e9e97209a19.pack
│  │     └─ pack-1c3cf46a32f382dc11a78a4a1b185e9e97209a19.rev
│  ├─ packed-refs
│  └─ refs
│     ├─ heads
│     │  └─ master
│     ├─ remotes
│     │  └─ origin
│     │     ├─ HEAD
│     │     └─ master
│     └─ tags
├─ .github
│  └─ workflows
│     └─ strapi-deploy.yml
├─ .gitignore
├─ .vscode
│  ├─ extensions.json
│  ├─ launch.json
│  └─ settings.json
├─ README.md
├─ astro.config.mjs
├─ cms
│  ├─ .eslintrc.cjs
│  ├─ .gitignore
│  ├─ .next
│  │  ├─ app-build-manifest.json
│  │  ├─ build-manifest.json
│  │  ├─ cache
│  │  │  ├─ .rscinfo
│  │  │  ├─ swc
│  │  │  │  └─ plugins
│  │  │  │     └─ v7_macos_aarch64_4.0.0
│  │  │  └─ webpack
│  │  │     ├─ client-development
│  │  │     │  ├─ 0.pack.gz
│  │  │     │  ├─ 1.pack.gz
│  │  │     │  ├─ 2.pack.gz
│  │  │     │  ├─ 3.pack.gz
│  │  │     │  ├─ 4.pack.gz
│  │  │     │  ├─ 5.pack.gz
│  │  │     │  ├─ 6.pack.gz
│  │  │     │  ├─ 7.pack.gz
│  │  │     │  ├─ index.pack.gz
│  │  │     │  └─ index.pack.gz.old
│  │  │     └─ server-development
│  │  │        ├─ 0.pack.gz
│  │  │        ├─ 1.pack.gz
│  │  │        ├─ 10.pack.gz
│  │  │        ├─ 11.pack.gz
│  │  │        ├─ 2.pack.gz
│  │  │        ├─ 3.pack.gz
│  │  │        ├─ 4.pack.gz
│  │  │        ├─ 5.pack.gz
│  │  │        ├─ 6.pack.gz
│  │  │        ├─ 6.pack.gz_
│  │  │        ├─ 7.pack.gz
│  │  │        ├─ 8.pack.gz
│  │  │        ├─ 9.pack.gz
│  │  │        ├─ index.pack.gz
│  │  │        └─ index.pack.gz.old
│  │  ├─ package.json
│  │  ├─ react-loadable-manifest.json
│  │  ├─ server
│  │  │  ├─ app
│  │  │  │  └─ (payload)
│  │  │  │     ├─ admin
│  │  │  │     │  └─ [[...segments]]
│  │  │  │     │     ├─ page.js
│  │  │  │     │     └─ page_client-reference-manifest.js
│  │  │  │     └─ api
│  │  │  │        └─ [...slug]
│  │  │  │           ├─ route.js
│  │  │  │           └─ route_client-reference-manifest.js
│  │  │  ├─ app-paths-manifest.json
│  │  │  ├─ interception-route-rewrite-manifest.js
│  │  │  ├─ middleware-build-manifest.js
│  │  │  ├─ middleware-manifest.json
│  │  │  ├─ middleware-react-loadable-manifest.js
│  │  │  ├─ next-font-manifest.js
│  │  │  ├─ next-font-manifest.json
│  │  │  ├─ pages-manifest.json
│  │  │  ├─ server-reference-manifest.js
│  │  │  ├─ server-reference-manifest.json
│  │  │  ├─ vendor-chunks
│  │  │  │  ├─ @aws-sdk.js
│  │  │  │  ├─ @dnd-kit.js
│  │  │  │  ├─ @emotion.js
│  │  │  │  ├─ @lexical.js
│  │  │  │  ├─ @payloadcms.js
│  │  │  │  ├─ @smithy.js
│  │  │  │  ├─ @swc.js
│  │  │  │  ├─ amazon-cognito-identity-js.js
│  │  │  │  ├─ bson-objectid.js
│  │  │  │  ├─ busboy.js
│  │  │  │  ├─ ci-info.js
│  │  │  │  ├─ classnames.js
│  │  │  │  ├─ console-table-printer.js
│  │  │  │  ├─ cssfilter.js
│  │  │  │  ├─ dataloader.js
│  │  │  │  ├─ date-fns.js
│  │  │  │  ├─ deepmerge.js
│  │  │  │  ├─ dequal.js
│  │  │  │  ├─ diff.js
│  │  │  │  ├─ drizzle-orm.js
│  │  │  │  ├─ escape-html.js
│  │  │  │  ├─ fast-deep-equal.js
│  │  │  │  ├─ fast-uri.js
│  │  │  │  ├─ fast-xml-parser.js
│  │  │  │  ├─ file-type.js
│  │  │  │  ├─ get-tsconfig.js
│  │  │  │  ├─ graphql-http.js
│  │  │  │  ├─ graphql-playground-html.js
│  │  │  │  ├─ graphql-scalars.js
│  │  │  │  ├─ http-status.js
│  │  │  │  ├─ ieee754.js
│  │  │  │  ├─ image-size.js
│  │  │  │  ├─ inherits.js
│  │  │  │  ├─ isomorphic-unfetch.js
│  │  │  │  ├─ jose.js
│  │  │  │  ├─ js-cookie.js
│  │  │  │  ├─ kleur.js
│  │  │  │  ├─ lexical.js
│  │  │  │  ├─ memoize-one.js
│  │  │  │  ├─ next.js
│  │  │  │  ├─ nodemailer.js
│  │  │  │  ├─ object-assign.js
│  │  │  │  ├─ path-to-regexp.js
│  │  │  │  ├─ payload.js
│  │  │  │  ├─ peek-readable.js
│  │  │  │  ├─ pluralize.js
│  │  │  │  ├─ prompts.js
│  │  │  │  ├─ prop-types.js
│  │  │  │  ├─ qs-esm.js
│  │  │  │  ├─ queue.js
│  │  │  │  ├─ react-diff-viewer-continued.js
│  │  │  │  ├─ react-error-boundary.js
│  │  │  │  ├─ react-image-crop.js
│  │  │  │  ├─ react-is.js
│  │  │  │  ├─ resolve-pkg-maps.js
│  │  │  │  ├─ sanitize-filename.js
│  │  │  │  ├─ scmp.js
│  │  │  │  ├─ simple-wcswidth.js
│  │  │  │  ├─ sisteransi.js
│  │  │  │  ├─ sonner.js
│  │  │  │  ├─ streamsearch.js
│  │  │  │  ├─ strnum.js
│  │  │  │  ├─ strtok3.js
│  │  │  │  ├─ stylis.js
│  │  │  │  ├─ to-no-case.js
│  │  │  │  ├─ to-snake-case.js
│  │  │  │  ├─ to-space-case.js
│  │  │  │  ├─ token-types.js
│  │  │  │  ├─ tr46.js
│  │  │  │  ├─ truncate-utf8-bytes.js
│  │  │  │  ├─ uint8array-extras.js
│  │  │  │  ├─ unfetch.js
│  │  │  │  ├─ uuid.js
│  │  │  │  ├─ webidl-conversions.js
│  │  │  │  ├─ whatwg-url.js
│  │  │  │  ├─ ws.js
│  │  │  │  └─ xss.js
│  │  │  └─ webpack-runtime.js
│  │  ├─ static
│  │  │  ├─ chunks
│  │  │  │  ├─ ...
│  │  │  │  ├─ app
│  │  │  │  │  └─ (payload)
│  │  │  │  │     ├─ admin
│  │  │  │  │     │  └─ [[...segments]]
│  │  │  │  │     │     ├─ not-found.js
│  │  │  │  │     │     └─ page.js
│  │  │  │  │     ├─ api
│  │  │  │  │     │  └─ [...slug]
│  │  │  │  │     │     └─ route.js
│  │  │  │  │     └─ layout.js
│  │  │  │  ├─ app-pages-internals.js
│  │  │  │  ├─ main-app.js
│  │  │  │  ├─ polyfills.js
│  │  │  │  └─ webpack.js
│  │  │  ├─ css
│  │  │  │  ├─ _app-pages-browser_node_modules_payloadcms_richtext-lexical_dist_exports_client_Field-KHGUSLMB_js.css
│  │  │  │  └─ app
│  │  │  │     └─ (payload)
│  │  │  │        ├─ admin
│  │  │  │        │  └─ [[...segments]]
│  │  │  │        │     ├─ not-found.css
│  │  │  │        │     └─ page.css
│  │  │  │        ├─ api
│  │  │  │        │  └─ [...slug]
│  │  │  │        │     └─ route.css
│  │  │  │        └─ layout.css
│  │  │  ├─ development
│  │  │  │  ├─ _buildManifest.js
│  │  │  │  └─ _ssgManifest.js
│  │  │  ├─ media
│  │  │  │  ├─ payload-favicon-dark.c322d81c.png
│  │  │  │  ├─ payload-favicon-light.b8a65007.png
│  │  │  │  ├─ payload-favicon.7c819288.svg
│  │  │  │  └─ static-og-image.477255a8.png
│  │  │  └─ webpack
│  │  │     ├─ 22890f157a4cb675.webpack.hot-update.json
│  │  │     ├─ 633457081244afec._.hot-update.json
│  │  │     └─ webpack.22890f157a4cb675.hot-update.js
│  │  ├─ trace
│  │  └─ types
│  │     ├─ app
│  │     │  └─ (payload)
│  │     │     ├─ admin
│  │     │     │  └─ [[...segments]]
│  │     │     │     └─ page.ts
│  │     │     ├─ api
│  │     │     │  └─ [...slug]
│  │     │     │     └─ route.ts
│  │     │     └─ layout.ts
│  │     ├─ cache-life.d.ts
│  │     └─ package.json
│  ├─ .npmrc
│  ├─ .prettierrc.json
│  ├─ .yarnrc
│  ├─ Dockerfile
│  ├─ README.md
│  ├─ cms.db
│  ├─ docker-compose.yml
│  ├─ media
│  │  ├─ ...
│  ├─ next-env.d.ts
│  ├─ next.config.mjs
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ src
│  │  ├─ app
│  │  │  ├─ (payload)
│  │  │  │  ├─ admin
│  │  │  │  │  ├─ [[...segments]]
│  │  │  │  │  │  ├─ not-found.tsx
│  │  │  │  │  │  └─ page.tsx
│  │  │  │  │  └─ importMap.js
│  │  │  │  ├─ api
│  │  │  │  │  ├─ [...slug]
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  ├─ graphql
│  │  │  │  │  │  └─ route.ts
│  │  │  │  │  └─ graphql-playground
│  │  │  │  │     └─ route.ts
│  │  │  │  ├─ custom.scss
│  │  │  │  └─ layout.tsx
│  │  │  └─ my-route
│  │  │     └─ route.ts
│  │  ├─ collections
│  │  │  ├─ Blog.ts
│  │  │  ├─ Media.ts
│  │  │  ├─ Pages.ts
│  │  │  └─ Users.ts
│  │  ├─ payload-types.ts
│  │  └─ payload.config.ts
│  └─ tsconfig.json
├─ netlify
│  ├─ functions
│  │  └─ payload.ts
│  └─ plugins
│     └─ setup-payload
│        └─ index.js
├─ netlify.toml
├─ package-lock.json
├─ package.json
├─ public
│  ├─ favicon.svg
│  ├─ fonts
│  │  ├─ AlumniSans-Italic.woff2
│  │  ├─ AlumniSans.woff2
│  │  ├─ Cabin-Italic.woff2
│  │  └─ Cabin.woff2
│  └─ images
│     ├─ ...
├─ src
│  ├─ assets
│  │  └─ icons
│  │     ├─ Icon.svg
│  │     └─ Logo.svg
│  ├─ components
│  │  ├─ Button.astro
│  │  ├─ CartButton.astro
│  │  ├─ CartDebug.astro
│  │  ├─ Footer.astro
│  │  ├─ Header.astro
│  │  ├─ Nav.astro
│  │  ├─ ProductCard.astro
│  │  ├─ Sidebar.astro
│  │  ├─ ThemeToggle.astro
│  │  ├─ blocks
│  │  │  ├─ ContentBlock.astro
│  │  │  ├─ ImageGallery.astro
│  │  │  └─ VideoPlayer.astro
│  │  └─ blog
│  │     ├─ BlogCard.astro
│  │     ├─ BlogGrid.astro
│  │     └─ BlogPost.astro
│  ├─ env.d.ts
│  ├─ layouts
│  │  └─ Layout.astro
│  ├─ lib
│  │  ├─ cart
│  │  │  ├─ index.ts
│  │  │  └─ types.ts
│  │  ├─ config
│  │  │  └─ verify-deployment.ts
│  │  ├─ payload
│  │  │  ├─ __tests__
│  │  │  │  └─ blog.test.ts
│  │  │  ├─ blog.ts
│  │  │  ├─ index.ts
│  │  │  ├─ module.d.ts
│  │  │  ├─ queries.ts
│  │  │  ├─ seo.ts
│  │  │  ├─ structured-data.ts
│  │  │  ├─ types.ts
│  │  │  └─ utils.ts
│  │  ├─ square
│  │  │  ├─ client.ts
│  │  │  ├─ money.ts
│  │  │  ├─ testing.ts
│  │  │  └─ types.ts
│  │  └─ types
│  │     ├─ content.ts
│  │     └─ index.ts
│  ├─ pages
│  │  ├─ 404.astro
│  │  ├─ [...slug]
│  │  │  └─ index.astro
│  │  ├─ api
│  │  │  ├─ cart-actions.ts
│  │  │  ├─ create-checkout.ts
│  │  │  ├─ list-catalog.ts
│  │  │  ├─ square-webhook.ts
│  │  │  └─ ssr-verify.ts
│  │  ├─ cart.astro
│  │  ├─ debug.astro
│  │  ├─ index.astro
│  │  ├─ news
│  │  │  ├─ [slug].astro
│  │  │  ├─ category
│  │  │  │  └─ [slug].astro
│  │  │  ├─ index.astro
│  │  │  └─ tag
│  │  │     └─ [slug].astro
│  │  ├─ order-confirmation.astro
│  │  ├─ product
│  │  │  └─ [id].astro
│  │  ├─ styleguide.astro
│  │  └─ test.astro
│  ├─ styles
│  │  ├─ globals.css
│  │  └─ print.css
│  └─ utils
│     ├─ dates.ts
│     └─ urls.ts
├─ tailwind.config.mjs
└─ tsconfig.json

```