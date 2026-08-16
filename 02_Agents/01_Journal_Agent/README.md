# Journal Agent

## Mission
This agent manages the entire Swisschart trading journal.

## Responsibilities
- Read all historical trades from the Notion database
- Import every signal with all available data
- Monitor the Telegram channel for new signals
- Create new trade records automatically
- Update TP1, TP2, TP3, SL, Cancelled and Missed trades
- Calculate RR automatically
- Convert all Telegram timestamps to New York (Eastern Time)
- Generate daily, weekly and monthly performance reports
- Prepare all journal data for migration to the future Swisschart website

## Current Data Source
- Notion Database
- Telegram Channel

## Future Data Source
- Swisschart Website Database