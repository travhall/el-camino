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
└── 📁el-camino
    └── 📁.astro
        └── 📁collections
            └── blog.schema.json
            └── pages.schema.json
        └── content-assets.mjs
        └── content-modules.mjs
        └── content.d.ts
        └── data-store.json
        └── icon.d.ts
        └── settings.json
        └── types.d.ts
    └── 📁.git
        └── 📁branches
        └── 📁hooks
            └── …
        └── 📁info
            └── exclude
        └── 📁logs
            └── 📁refs
                └── 📁heads
                    └── master
                └── 📁remotes
                    └── 📁origin
                        └── HEAD
                        └── master
            └── HEAD
        └── 📁objects
            └── 📁00
                └── …
            └── 📁info
            └── 📁pack
                └── pack-1c3cf46a32f382dc11a78a4a1b185e9e97209a19.idx
                └── pack-1c3cf46a32f382dc11a78a4a1b185e9e97209a19.pack
                └── pack-1c3cf46a32f382dc11a78a4a1b185e9e97209a19.rev
        └── 📁refs
            └── 📁heads
                └── master
            └── 📁remotes
                └── 📁origin
                    └── HEAD
                    └── master
            ├── tags
        └── .DS_Store
        └── COMMIT_EDITMSG
        └── config
        └── description
        └── FETCH_HEAD
        └── HEAD
        └── index
        └── ORIG_HEAD
        └── packed-refs
    └── 📁.github
        ├── workflows
    └── 📁.netlify
        └── 📁build
        └── 📁v1
            └── 📁edge-functions
                ├── middleware
            └── 📁functions
                ├── ssr
            └── .DS_Store
            └── config.json
        └── .DS_Store
    └── 📁.vscode
        └── extensions.json
        └── launch.json
        └── settings.json
    └── 📁content
        └── 📁pages
            └── About.md
        └── 📁posts
            └── Test-post-one-title.md
    └── 📁netlify
        └── 📁functions
        └── 📁plugins
            └── .DS_Store
        └── .DS_Store
    └── 📁public
        └── 📁admin
            └── .gitignore
            └── index.html
        └── 📁fonts
            └── AlumniSans-Italic.woff2
            └── AlumniSans.woff2
            └── Cabin-Italic.woff2
            └── Cabin.woff2
        └── 📁images
            └── category-apparel.png
            └── category-footwear.png
            └── category-skateboarding.png
            └── placeholder.png
            └── promo-img-01.png
            └── promo-img-02.png
            └── promo-img-03.png
            └── promo-img-04.png
            └── promo-img-05.png
            └── promo-img-06.png
        └── .DS_Store
        └── favicon.svg
    └── 📁src
        └── 📁assets
            └── 📁icons
                └── Icon.svg
                └── Logo.svg
        └── 📁components
            └── .DS_Store
            └── Button.astro
            └── CartButton.astro
            └── CartDebug.astro
            └── Footer.astro
            └── Header.astro
            └── Nav.astro
            └── ProductCard.astro
            └── Sidebar.astro
            └── ThemeToggle.astro
        └── 📁layouts
            └── Layout.astro
        └── 📁lib
            └── 📁cart
                └── index.ts
                └── types.ts
            └── 📁cms
                └── structured-data.ts
            └── 📁square
                └── client.ts
                └── money.ts
                └── testing.ts
                └── types.ts
            └── 📁types
                └── .DS_Store
                └── content.ts
                └── index.ts
            └── .DS_Store
        └── 📁pages
            └── 📁api
                └── cart-actions.ts
                └── create-checkout.ts
                └── list-catalog.ts
                └── square-webhook.ts
                └── ssr-verify.ts
            └── 📁product
                └── [id].astro
            └── .DS_Store
            └── 404.astro
            └── cart.astro
            └── debug.astro
            └── index.astro
            └── order-confirmation.astro
            └── styleguide.astro
        └── 📁styles
            └── globals.css
        └── 📁utils
            └── dates.ts
            └── urls.ts
        └── .DS_Store
        └── env.d.ts
    └── 📁tina
        └── 📁__generated__
            └── _graphql.json
            └── _lookup.json
            └── _schema.json
            └── client.ts
            └── config.prebuild.jsx
            └── frags.gql
            └── queries.gql
            └── schema.gql
            └── static-media.json
            └── types.ts
        └── .gitignore
        └── config.ts
        └── tina-lock.json
    └── .DS_Store
    └── .env
    └── .env.production
    └── .gitignore
    └── .npmrc
    └── astro.config.mjs
    └── netlify.toml
    └── package.json
    └── pnpm-lock.yaml
    └── README.md
    └── tailwind.config.mjs
    └── tsconfig.json
```
