# Changelog

## 0.4.0 — 2026-11-08

- Add a dedicated beginner classroom with nine lessons covering quotes, account figures, EPS/TTM, PE/PB/market cap, dividends/ranges, ETFs, price formation and data provenance.
- Add dated AAPL, MSFT and INTC observation cards, progressive examples, comprehension questions, glossary search and a valuation-assumption exercise.
- Link metric explanations to relevant lessons, retain learning progress on-device and include lesson assets in the phone offline shell.
- Explain uncertainty, financial periods and source scope; examples do not produce trade recommendations or place orders.
- Permit only reviewed tutorial reference URLs to open in the external desktop browser. Mobile runtime is 1.2.0.

## 0.3.1 — 2026-11-08

- Audit 22 starter symbols against Yahoo Finance and TradingView, including daily/intraday histories for AAPL, MSFT and SPY.
- Read ETF fees from fundProfile, preserve fractional-cent price/fee precision, restore quote-currency ADR EPS and map class-share Yahoo symbols.
- Reject mismatched provider symbols and known quotes from another New York trading date.
- Leave gaps for unverifiable historical carry-forward placeholders; retain genuine sharp moves.
- Guard quote refresh races, preserve missing percentage changes, retry incomplete financial snapshots after 30 seconds and reload full quote metadata after fills.
- Clarify source last-sale, volume and multi-share-class fund-asset semantics. Mobile runtime is 1.1.1.

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
