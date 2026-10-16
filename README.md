# Mintborn ghost workshop

Interactive 3D ghost trait editor and a browsable draft collection of 10,000 ghosts. This is a standalone snapshot of Mintborn's ghost study from September 28, 2026, published for sharing. The workshop keeps the expanded fabrics, expressions and accessories on the original sheet-01 body; body variations are disabled throughout the editor, collection and exported recipes.

Live URL: https://mintborn-ghost-workshop.novox-robot.workers.dev

Collection browser: https://mintborn-ghost-workshop.novox-robot.workers.dev/collection

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Wrangler. `/` opens the editor; `/collection` opens the collection browser, including trait filters, accessory sheets and rare fabrics. Portraits and recipes can be downloaded in the browser. No app secrets or environment variables are needed.

## Deploy

Authenticate Wrangler with your Cloudflare account, then run `npm run deploy`. `wrangler.jsonc` serves only `dist/` as Worker static assets. The build copies the pinned Three.js runtime locally and regenerates both draft recipe collections. The workshop needs no backend or wallet.

## Source and license

The editable snapshot is in `src/`. `npm run build` produces the ignored `dist/` directory. Code: MIT, copyright Jonathan Mann. See ASSETS.md for dependency licensing, excluded reference material and collection-art terms.
