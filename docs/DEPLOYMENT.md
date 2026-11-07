# Deployment / 部署

## Windows

Use Node.js 24 on Windows:

```sh
npm ci
npm run check
npm test
npm run dist
```

The installer appears in `release/`. It includes Electron and requires no Node.js installation on the user's device. The repository's version-tag workflow runs tests, builds the Windows installer, starts the packaged self-check with an isolated account and publishes a SHA-256 checksum. Code signing is not configured; anyone distributing their own build must provide their own signing setup if desired.

## Local web

```sh
npm run web
```

The service binds to localhost and protects its local account API with origin and token checks. Do not expose the desktop service directly to the public internet; use the mobile build for an internet-hosted app.

## Mobile PWA

```sh
npm ci --prefix iphone
npm run dev --prefix iphone
```

The predev/prebuild step creates `iphone/.openai/hosting.json` from its example only when no configuration exists. It contains no original Site ID. `npm run build --prefix iphone` emits a Cloudflare Worker at `iphone/dist/server/index.js` and assets in `iphone/dist/client/`. `npm run start --prefix iphone` previews the built app locally.

For Cloudflare hosting, deploy with your own account and the generated Worker configuration using your normal Wrangler workflow. For Sites hosting, register your own Site and put its returned project ID in your local hosting manifest before following the Sites publishing workflow. Never copy another owner's project identity or credentials. HTTPS is needed for browser installation and Service Worker behavior outside localhost.

Mobile accounts are stored in IndexedDB under each deployment's origin, not in a server database. A new hostname starts a separate local account store. Use the in-app JSON backup to transfer an account. The default app requires no database or object storage.

The public demo URL in the README is an independently operated deployment. A fork or self-hosted copy does not update it.
