# Odds-API.io: Sports Odds for Sheets

Live odds from 450+ bookmakers in Google Sheets, from the [Odds-API.io](https://odds-api.io) team. An Excel version is on the way.

- **Explore**: search a team or league, see the best price per market across bookmakers, the fair price and line movement, then insert it as a sheet.
- **Recipes**: one click builds a clean sheet of best prices, arbitrage, value bets or dropping odds, with optional refresh every minute.
- **Playground**: call any GET endpoint of the API, preview the response and insert it as a table.
- **Formulas**: `=ODDS(eventId, market, bookmaker)` and `=ODDS_TABLE(sport, league, market)`.
- **AI-ready**: every table is typed and tidy, comes with suggested questions for Gemini in Sheets, and can be copied as a prompt for ChatGPT or any AI assistant. To let an assistant query the API itself, use the [Odds-API.io MCP server](https://odds-api.io/mcp).

## Install

1. Open the [Odds-API listing on the Google Workspace Marketplace](https://odds-api.io/google-sheets) and click **Install**.
2. In any spreadsheet, open **Extensions > Odds-API.io > Open**.
3. Paste your API key. Done.

You need an Odds-API.io API key ([see plans](https://odds-api.io/pricing)). The key is stored in your Google account's add-on storage and only sent to `api.odds-api.io`. Details: [privacy policy](https://odds-api.io/privacy#google-sheets-addon).

## Formulas

| Formula | Returns |
| --- | --- |
| `=ODDS(eventId, [market], [bookmaker], [refresh])` | One row per bookmaker, line and selection for an event |
| `=ODDS_TABLE(sport, [league], [market], [refresh])` | Upcoming events with the best price per selection |

Sheets caches formula results, so pass a cell you change as `refresh` (a checkbox works well) and change it to fetch new prices. Sheets does not allow `=NOW()` or `=RAND()` here. `ODDS_GET_ML`, `ODDS_GET_SPREAD` and `ODDS_GET_TOTALS` from version 1 keep working.

## Project layout

```
pane/      the side panel: Preact + TypeScript, built into one HTML file
sheets/    the Apps Script project: menu, sheet writer, custom formulas
scripts/   build and API catalogue helpers
```

The panel calls the API directly from the browser and hands finished tables to the host, so the same panel can run in Excel later with a different host.

## Development

```bash
npm install
npm run dev        # panel at http://localhost:5173 with a browser-only host
npm run check      # types, tests and build
```

`http://localhost:5173/frame.html` shows the panel at the real 300 px sidebar width. To use a key in development, put `VITE_DEV_KEY=<key>` in `pane/.env.development.local` and open the page with `?devkey`.

To try it in a real spreadsheet, create an Apps Script project bound to a test sheet, copy `sheets/.clasp.json.example` to `sheets/.clasp.json` with its script ID, then:

```bash
npx clasp login
npm run push:sheets
```

The API catalogue in `pane/src/api/endpoints.json` is generated from the published OpenAPI spec with `npm run catalogue`.

## Releases

Every merge to `main` runs [deploy.yml](.github/workflows/deploy.yml): it checks the code, pushes it to the Apps Script project and creates a numbered version. The run summary shows the version number. To release it, set **Sheets add-on script version** to that number in Google Cloud console > Google Workspace Marketplace SDK > App Configuration.

Repository settings it needs:

| Name | Type | Value |
| --- | --- | --- |
| `CLASPRC_JSON` | secret | contents of `~/.clasprc.json` after `clasp login` with the publishing account |
| `SHEETS_SCRIPT_ID` | variable | Apps Script project ID |

Changes to OAuth scopes or the store listing need a new Marketplace review; code changes alone do not.

## License

MIT
