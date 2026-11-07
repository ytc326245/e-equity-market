# Changelog

## 0.3.0 — 2026-11-08

- Add independent Yahoo/Nasdaq financial snapshots: PE/EPS (TTM), market cap, PB, dividend yield and 52-week range.
- Show core metrics inline and expanded explanations, provenance, reporting periods and explicit unavailable states.
- Treat ETFs separately with AUM and expense ratio; do not apply company EPS or valuation ratios.
- Add a dismissible/reopenable four-step beginner guide and contextual order-entry tips.
- Preserve independent quote/trade behavior during financial-provider failures and guard against stale UI replies.
- Update phone runtime to 1.1.0.

## 0.2.2 — 2026-11-07

- Prepare the first public source release with MIT licensing, Chinese/English documentation, contribution and security guidance.
- Add clean-source export, synthetic regression coverage, reproducible demo screenshots and GitHub Actions checks/releases.
- Keep private accounts, deployment identity and captured full-day data out of the public export.
- Support a manually maintained starter symbol directory; the packaged self-check accepts any nonempty valid directory.
- Retain the 0.2.1 intraday time-normalization fix. Mobile runtime version remains 1.0.2.

## 0.2.1 — 2026-11-07

- Verify Nasdaq ET time labels before converting chart timestamps to UTC.
- Filter by New York trading date and regular session, including early close and DST.
- Sort/deduplicate chart points, reject conflicting duplicates and render using time spacing.
- Refresh quotes and charts together and prevent stale chart requests from replacing newer results.

## 0.2.0 — 2026-11-07

- Enable virtual trading using newly fetched public quotes with explicit source/fetch timestamps.
- Preserve local accounting, backups, market-session restrictions and quote validation.
