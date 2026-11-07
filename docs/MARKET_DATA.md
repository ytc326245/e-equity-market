# Market data / 行情数据

## Sources

The current adapter calls Nasdaq public website endpoints for instrument information, intraday chart samples and historical daily closes. It does not use a brokerage account, place real orders, or promise exchange-certified real-time data. Endpoint formats and regional availability may change.

The public source distribution includes a manually maintained starter directory of 22 common US symbols, not a full provider directory or price feed. `npm run symbols:update` fetches the current Nasdaq Trader directory for a user's installation. Run `npm run sync:mobile` afterwards to update the phone copy.

## Financial metrics (0.3.0 / phone 1.1.0)

`GET /api/fundamentals?symbol=AAPL` is independent of the quote, chart and trade APIs. Yahoo Finance's public `quoteSummary` modules (`price`, `summaryDetail`, `defaultKeyStatistics`, `financialData`, `fundProfile`) supply trailing PE, trailing EPS, price/book and common statistics. Nasdaq's `quote/{symbol}/summary` supplies independently sourced fallback fields for market cap, current yield and the 52-week range, plus ETF AUM and expense ratio. No financial metric is used to set a simulated fill price.

Yahoo's anonymous cookie/crumb session stays in server memory. No user Yahoo login or portfolio data is involved. The cookie bootstrap normally returns HTTP 404 with a cookie; the crumb endpoint is plain text and must accept `*/*`, not require JSON. The Windows app uses its operating system's proxy configuration for this supplemental source. Standalone Node and hosted Workers use their own network configuration; provider regional restrictions or format changes can leave metrics unavailable.

PE/EPS use the provider's TTM fields, never forward estimates or a single quarter presented as TTM. EPS uses the quote currency and listed-unit/ADR basis from defaultKeyStatistics. financialData.financialCurrency describes income statements and must not be used to discard a USD-quoted ADR EPS. PB is provider-supplied with the most recent financial period when available. The regular-market timestamp is labeled as the valuation's reference quote time, not the financial statement's update time. No ratio is recomputed from independently fetched sources.

Yahoo fractional yields and fundProfile.feesExpensesInvestment.annualReportExpenseRatio are multiplied by 100 for display as percentages; fund fees retain four percentage decimals. Nasdaq percentage strings already use percent units, but undated summary fees are not used as verified current fees. Fund assets may aggregate share classes; the UI labels source scope and missing valuation date. Nasdaq ETF AUM is multiplied by 1,000 only when its label explicitly says `(,000)`. Zero dividend yield is retained only if explicitly supplied. Missing fields remain null. Nonpositive EPS/book value makes PE/PB unsuitable for ordinary comparison. ETFs display AUM/fees and do not reuse company PE/EPS/PB, even if the provider supplies a portfolio-level PE.

Successful complete snapshots are cached in memory for five minutes; incomplete snapshots retry after 30 seconds. Concurrent reads share one request and `fresh=1` bypasses the completed cache. A failed provider leaves available fields intact, labels the result partial, and never falls back to demo prices. Switching symbols or overlapping refreshes cannot replace the current metrics or quote with a late reply. Partial snapshots also retry on the client after 30 seconds.

## Time and sessions

The observed Nasdaq chart format stores ET wall-clock fields in `x`, with an explicit `z.dateTime` ET label. The adapter verifies that relationship before constructing a real UTC instant using `America/New_York`. A genuine UTC epoch is accepted only when it agrees with the ET label. Unknown or mixed formats fail visibly.

Points must match `timeAsOf` and fall within `[09:30,16:00)` New York time, or `[09:30,13:00)` on an early-close date. The close-time bucket may include extended-hours activity and is not automatically treated as the official closing print. The calendar covers 2026–2028; temporary unscheduled closures require additional provider confirmation.

Sorting and identical-duplicate removal do not alter prices. Conflicting prices at one timestamp cause an error. Large price moves are not silently deleted. Missing intervals are shown as chart gaps.

## Price semantics and execution

`primaryData.lastSalePrice` supplies the displayed quote. Chart `y` values are provider samples; they are not minute OHLC or a complete trade tape. Samples need not include the official opening/closing auction or daily extrema. Different providers may use different coverage and revisions.

Simulated fills use a newly fetched public quote. The adapter rejects mismatched response symbols. A known source calendar date must match the current New York date; an undated quote is not given an invented timestamp. Fetch freshness is checked, but a recent HTTP response does not prove the upstream price is real-time. This model does not reproduce a broker's bid/ask execution, liquidity, fees, slippage or partial fills.

The code license does not grant third-party data redistribution rights. Full-day captured provider responses are excluded from the public export. Public tests/screenshots use synthetic prices and are never a production data fallback. See [third-party notices](../THIRD_PARTY_NOTICES.md).

## Historical placeholders

An explicit all-flat OHLC daily row with missing/zero volume is treated as an unverifiable carry-forward placeholder, not as a verified close. It is excluded with diagnostics and a dated chart gap. Inconsistent OHLC and conflicting duplicate dates are also checked. Genuine large changes are not filtered by magnitude. See [the scoped debug audit](DEBUG_AUDIT_2026-11-08.md).
