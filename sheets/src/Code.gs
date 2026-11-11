var API_BASE = 'https://api.odds-api.io/v3';
var CHUNK_NOTE_COL_GAP = 2;
var FILTER_ICON_PX = 28;
var NOT_SELECTIONS = { hdp: 1, label: 1, max: 1 };
var POPULAR_BOOKMAKERS = ['Bet365', 'Unibet', 'William Hill', 'Betfair Exchange', 'DraftKings', 'FanDuel', '1xbet', 'Betano', 'BetMGM', 'Betway', 'Bwin', 'Stake'];
var NO_KEY = 'Add your API key: Extensions > Odds-API.io > Open';
var NUMBER_FORMATS = { odds: '0.00', percent: '0.00"%"', datetime: 'yyyy-mm-dd hh:mm', id: '0', number: '0.##' };

function onOpen() {
  SpreadsheetApp.getUi().createAddonMenu().addItem('Open', 'showSidebar').addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Odds-API.io');
  SpreadsheetApp.getUi().showSidebar(html);
}

function readSettings_() {
  var raw = PropertiesService.getUserProperties().getProperty('settings');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function getSettings() {
  return JSON.stringify(readSettings_());
}

function saveSettings(json) {
  var next = readSettings_();
  var patch = JSON.parse(json);
  for (var k in patch) next[k] = patch[k];
  PropertiesService.getUserProperties().setProperty('settings', JSON.stringify(next));
  return JSON.stringify(next);
}

function clearSettings() {
  PropertiesService.getUserProperties().deleteProperty('settings');
}

function sheetExists(name) {
  return !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function activateSheet(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (sheet) sheet.activate();
}

function freeSheetName_(ss, name) {
  if (!ss.getSheetByName(name)) return name;
  for (var i = 2; ; i++) {
    var candidate = name + ' (' + i + ')';
    if (!ss.getSheetByName(candidate)) return candidate;
  }
}

function toCell_(value, type) {
  if (value === null || value === undefined) return '';
  if (type === 'datetime' && typeof value === 'string') {
    var d = new Date(value);
    return isNaN(d.getTime()) ? value : d;
  }
  return value;
}

/**
 * Writes one chunk of a table. The pane sends rows in chunks so large tables never hit the execution limit.
 * Payload: {name, headers, types, notes, rows, mode: replace|append|new, first, last, startRow?, sheet?, total?}
 */
function lastDataRow_(sheet) {
  var last = sheet.getLastRow();
  if (!last) return 0;
  var col = sheet.getRange(1, 1, last, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) if (col[i][0] !== '' && col[i][0] !== null) return i + 1;
  return 0;
}

function writeChunk(json) {
  var p = JSON.parse(json);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet;
  var startRow = p.startRow;

  if (p.first) {
    var name = p.mode === 'new' ? freeSheetName_(ss, p.name) : p.name;
    sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var lastData = lastDataRow_(sheet);
    if (p.mode === 'append' && lastData > 0) {
      startRow = lastData + 1;
    } else {
      sheet.clear();
      sheet.getRange(1, 1, 1, p.headers.length).setValues([p.headers]);
      sheet.getRange(1, 1, 1, p.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      startRow = 2;
    }
  } else {
    sheet = ss.getSheetByName(p.sheet);
  }

  if (p.rows.length) {
    var values = p.rows.map(function (r) {
      return r.map(function (v, i) {
        return toCell_(v, p.types[i]);
      });
    });
    sheet.getRange(startRow, 1, values.length, p.headers.length).setValues(values);
  }
  var nextRow = startRow + p.rows.length;

  if (p.last) finishTable_(ss, sheet, p, nextRow - 1);
  return { sheet: sheet.getName(), nextRow: nextRow, rows: nextRow - 2 };
}

function finishTable_(ss, sheet, p, lastRow) {
  var dataRows = Math.max(lastRow - 1, 1);
  p.types.forEach(function (type, i) {
    if (NUMBER_FORMATS[type]) sheet.getRange(2, i + 1, dataRows, 1).setNumberFormat(NUMBER_FORMATS[type]);
  });
  var existing = sheet.getFilter();
  if (existing) existing.remove();
  sheet.getRange(1, 1, Math.max(lastRow, 1), p.headers.length).createFilter();

  var rangeName = 'oddsapi_' + sheet.getName().replace(/[^A-Za-z0-9_]/g, '_').slice(0, 80);
  ss.setNamedRange(rangeName, sheet.getRange(1, 1, Math.max(lastRow, 1), p.headers.length));

  if (p.notes && p.notes.length) {
    var noteCol = p.headers.length + CHUNK_NOTE_COL_GAP;
    sheet.getRange(1, noteCol, p.notes.length, 1).setValues(p.notes.map(function (n) { return [n]; }));
  }
  sheet.autoResizeColumns(1, p.headers.length);
  for (var c = 1; c <= p.headers.length; c++) sheet.setColumnWidth(c, sheet.getColumnWidth(c) + FILTER_ICON_PX);
  sheet.activate();
}

function fetchJson_(path, params) {
  var key = (readSettings_().apiKey || '').trim();
  if (!key) return { error: NO_KEY };
  var query = [];
  for (var k in params) {
    if (params[k] !== undefined && params[k] !== null && params[k] !== '') query.push(k + '=' + encodeURIComponent(params[k]));
  }
  query.push('apiKey=' + encodeURIComponent(key));
  var url = API_BASE + path + '?' + query.join('&');
  var cache = CacheService.getUserCache();
  var cacheKey = 'f:' + path + '?' + query.slice(0, -1).join('&');
  var hit = cacheKey.length < 240 ? cache.get(cacheKey) : null;
  if (hit) return { data: JSON.parse(hit) };

  var res;
  try {
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  } catch (err) {
    return { error: 'Odds-API: request failed, try again in a moment' };
  }
  var text = res.getContentText();
  var body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    return { error: 'Odds-API: unexpected response (' + res.getResponseCode() + ')' };
  }
  if (res.getResponseCode() !== 200) {
    return { error: 'Odds-API: ' + ((body && body.error) || 'HTTP ' + res.getResponseCode()) };
  }
  if (cacheKey.length < 240 && text.length < 90000) {
    try {
      cache.put(cacheKey, text, 30);
    } catch (err) {}
  }
  return { data: body };
}

function oddsLines_(event, market, bookmaker) {
  var rows = [];
  var wantMarket = market ? String(market).toLowerCase() : '';
  var wantBook = bookmaker ? String(bookmaker).toLowerCase() : '';
  var books = event.bookmakers || {};
  for (var name in books) {
    if (wantBook && name.toLowerCase() !== wantBook) continue;
    books[name].forEach(function (m) {
      if (wantMarket && m.name.toLowerCase() !== wantMarket) return;
      (m.odds || []).forEach(function (line) {
        var hdp = line.hdp !== undefined && line.hdp !== null ? Number(line.hdp) : line.label || '';
        for (var sel in line) {
          if (NOT_SELECTIONS[sel]) continue;
          var price = Number(line[sel]);
          if (!isFinite(price)) continue;
          rows.push([name, m.name, hdp, sel, price, m.updatedAt ? new Date(m.updatedAt) : '']);
        }
      });
    });
  }
  return rows;
}

/**
 * Odds for one event: one row per bookmaker, market line and selection.
 * @param {number} eventId Event ID (copy it from the Odds-API sidebar).
 * @param {string} market Optional market name, for example "ML", "Spread" or "Totals".
 * @param {string} bookmaker Optional bookmaker name, for example "Bet365".
 * @param {any} refresh Optional changing value (for example a cell with =NOW()) to fetch fresh odds.
 * @return Odds table with a header row.
 * @customfunction
 */
function ODDS(eventId, market, bookmaker, refresh) {
  if (!readSettings_().apiKey) return [[NO_KEY]];
  if (!eventId) return [['Odds-API: eventId is required']];
  var params = { eventId: eventId };
  if (bookmaker) {
    params.bookmakers = bookmaker;
  } else {
    var selected = fetchJson_('/bookmakers/selected', {});
    if (selected.error) return [[selected.error]];
    var books = selected.data.bookmakers || [];
    var preferred = POPULAR_BOOKMAKERS.filter(function (b) { return books.indexOf(b) >= 0; });
    var rest = books.filter(function (b) { return POPULAR_BOOKMAKERS.indexOf(b) < 0; });
    params.bookmakers = preferred.concat(rest).slice(0, 30).join(',');
  }
  var res = fetchJson_('/odds', params);
  if (res.error) return [[res.error]];
  var rows = oddsLines_(res.data, market, bookmaker);
  if (!rows.length) return [['Odds-API: no odds for these filters']];
  return [['bookmaker', 'market', 'line', 'selection', 'odds', 'updated_at']].concat(rows);
}

/**
 * Upcoming events with the best price per selection for one market.
 * @param {string} sport Sport slug, for example "football".
 * @param {string} league Optional league slug, for example "england-premier-league".
 * @param {string} market Optional market, default "ML".
 * @param {any} refresh Optional changing value to fetch fresh prices.
 * @return Table with a header row.
 * @customfunction
 */
function ODDS_TABLE(sport, league, market, refresh) {
  if (!readSettings_().apiKey) return [[NO_KEY]];
  if (!sport) return [['Odds-API: sport is required']];
  var wanted = String(market || 'ML').toLowerCase();
  var ev = fetchJson_('/events', { sport: sport, league: league, status: 'pending', limit: 20 });
  if (ev.error) return [[ev.error]];
  var events = ev.data || [];
  if (!events.length) return [['Odds-API: no upcoming events']];

  var byId = {};
  events.forEach(function (e) { byId[String(e.id)] = e; });
  var rows = [];
  for (var i = 0; i < events.length; i += 10) {
    var ids = events.slice(i, i + 10).map(function (e) { return e.id; }).join(',');
    var res = fetchJson_('/odds/summary/multi', { eventIds: ids });
    if (res.error) return [[res.error]];
    if ((res.data || []).some(function (s) { return s.demo; })) {
      return [['Odds-API: ODDS_TABLE needs the Growth plan or higher. Use =ODDS(eventId) or see https://odds-api.io/pricing']];
    }
    (res.data || []).forEach(function (s) {
      var e = byId[String(s.eventId)] || s;
      (s.markets || []).forEach(function (m) {
        if (m.name.toLowerCase() !== wanted) return;
        var line = m.lines.filter(function (l) { return l.main; })[0] || m.lines[0];
        if (!line) return;
        for (var sel in line.outcomes) {
          var o = line.outcomes[sel];
          rows.push([Number(e.id), new Date(e.date), e.home, e.away, sel, o.best, (o.bestBookmakers || []).join(', ')]);
        }
      });
    });
  }
  if (!rows.length) return [['Odds-API: no prices for this market']];
  return [['event_id', 'date', 'home', 'away', 'selection', 'best_odds', 'best_bookmaker']].concat(rows);
}

/** @customfunction */
function ODDS_GET_ML(eventId, bookmaker) {
  return ODDS(eventId, 'ML', bookmaker);
}

/** @customfunction */
function ODDS_GET_SPREAD(eventId, bookmaker) {
  return ODDS(eventId, 'Spread', bookmaker);
}

/** @customfunction */
function ODDS_GET_TOTALS(eventId, bookmaker) {
  return ODDS(eventId, 'Totals', bookmaker);
}

/** @customfunction */
function ODDS_GET_ARBITRAGE() {
  return [['Arbitrage moved to the sidebar: Extensions > Odds-API > Open > Recipes']];
}

/** @customfunction */
function ODDS_GET_VALUE() {
  return [['Value bets moved to the sidebar: Extensions > Odds-API > Open > Recipes']];
}
