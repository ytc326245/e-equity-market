# Third-party notices

Project-authored code is licensed under the root MIT license. Third-party code, dependencies, trademarks and externally obtained data retain their own terms.

## Vendored code

- `iphone/scripts/vite/sites-vite-plugin.ts`: derived from `@openai/sites-vite-plugin` 0.2.0. Copyright (c) 2026 OpenAI; MIT. The complete upstream license is retained at `iphone/scripts/vite/sites-vite-plugin.LICENSE`.
- `iphone/vendor/shadcn-tailwind-4.13.0.css`: shadcn styles. Copyright (c) 2023 shadcn; MIT. See `iphone/vendor/shadcn-tailwind-4.13.0.LICENSE.md`.
- The mobile application began with the Sites Vinext starter. Its dependencies and any retained upstream notices remain applicable. See `iphone/package-lock.json` for exact dependency versions.

## Dependencies and distributions

Electron, Chromium, Node.js, React, Vinext, Vite, Cloudflare tooling, UI libraries and their dependencies have independent licenses. Their package licenses and the notices shipped with Electron remain in effect. Windows packages retain Electron's `LICENSE` and `LICENSES.chromium.html`. Do not remove these when redistributing a packaged application.

## Data, names and service access

The software license does not grant rights to Nasdaq or Yahoo market data, exchange branding, company names, logos, or third-party services. Provider access, display, caching and redistribution must follow the provider's applicable terms. No claim of affiliation, exchange certification or guaranteed real-time coverage is made.

The public source export uses a small manually maintained security directory and synthetic price data only in tests and screenshots. It does not include captured full-day quote responses, private account files or the original deployment identity. `npm run symbols:update` downloads the current security directory from Nasdaq Trader for the user's own installation; this does not change the applicable data terms.

Sources:

- Yahoo Finance financial statistics: https://finance.yahoo.com/
- Yahoo terms: https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html
- Nasdaq website: https://www.nasdaq.com/
- Nasdaq Trader symbol-directory definitions: https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs
- Nasdaq website terms: https://www.nasdaq.com/terms

Tutorial case studies contain small, dated, attributed educational snapshots. These are separate from live quote adapters and are never used as a runtime price fallback.
