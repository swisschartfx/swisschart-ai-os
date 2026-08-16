# Notion Trade Sequence Ordering

Date: 2026-08-15
Status: COMPLETE

The authoritative Trade ID contract is `SCT-YYNN`, where `YY` is the `America/New_York` calendar-year suffix and `NN` is the annual sequence `01..99`. The exact accepted pattern is `^SCT-\d{2}(0[1-9]|[1-9]\d)$`.

After explicit Founder approval, the `Swisschart Trading Journal` data source received one formula property named `Trade Sequence`:

`if(test(prop("Trade ID"), "^SCT-\\d{2}(0[1-9]|[1-9]\\d)$"), toNumber(replaceAll(prop("Trade ID"), "^SCT-", "")), empty())`

All 46 production rows were verified against the local canonical parser with zero mismatches. The primary `Untitled` table view was then configured with one ascending sort on `Trade Sequence`. A matching sorted production query returned the exact tail `SCT-2644`, `SCT-2645`, `SCT-2646`.

No page content, IDs, dates, times, prices, results or other views changed. Invalid future IDs produce Empty and do not participate as valid sequence values.
