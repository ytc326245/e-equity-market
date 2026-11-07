# Market data / 行情数据

## Sources

The current adapter calls Nasdaq public website endpoints for instrument information, intraday chart samples and historical daily closes. It does not use a brokerage account, place real orders, or promise exchange-certified real-time data. Endpoint formats and regional availability may change.

The public source distribution includes a manually maintained starter directory of 22 common US symbols, not a full provider directory or price feed. `npm run symbols:update` fetches the current Nasdaq Trader directory for a user's installation. Run `npm run sync:mobile` afterwards to update the phone copy.

## Time and sessions

The observed Nasdaq chart format stores ET wall-clock fields in `x`, with an explicit `z.dateTime` ET label. The adapter verifies that relationship before constructing a real UTC instant using `America/New_York`. A genuine UTC epoch is accepted only when it agrees with the ET label. Unknown or mixed formats fail visibly.

Points must match `timeAsOf` and fall within `[09:30,16:00)` New York time, or `[09:30,13:00)` on an early-close date. The close-time bucket may include extended-hours activity and is not automatically treated as the official closing print. The calendar covers 2026–2028; temporary unscheduled closures require additional provider confirmation.

Sorting and identical-duplicate removal do not alter prices. Conflicting prices at one timestamp cause an error. Large price moves are not silently deleted. Missing intervals are shown as chart gaps.

## Price semantics and execution

`primaryData.lastSalePrice` supplies the displayed quote. Chart `y` values are provider samples; they are not minute OHLC or a complete trade tape. Samples need not include the official opening/closing auction or daily extrema. Different providers may use different coverage and revisions.

Simulated fills use a newly fetched public quote. Fetch freshness is checked, but a recent HTTP response does not prove the upstream price is real-time. This model does not reproduce a broker's bid/ask execution, liquidity, fees, slippage or partial fills.

The code license does not grant third-party data redistribution rights. Full-day captured provider responses are excluded from the public export. Public tests/screenshots use synthetic prices and are never a production data fallback. See [third-party notices](../THIRD_PARTY_NOTICES.md).
