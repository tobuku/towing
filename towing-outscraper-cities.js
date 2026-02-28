/**
 * TowTruck.blog — Outscraper: Major Cities Pull
 *
 * Targets top 30 US cities by population for deeper coverage.
 * Uses a SEPARATE sheet tab: "towing-cities-template"
 *
 * Setup:
 *   1. Create a new sheet tab named "towing-cities-template"
 *   2. Paste this script into Apps Script (replace the old one or add as new file)
 *   3. Run citiesMain() — resumes on timeout, run again until done
 *   4. Call resetCitiesProgress() to start over
 *
 * After completion:
 *   - Copy rows from "towing-cities-template" into "towing-directory-template"
 *   - Download combined sheet as CSV → towing-data.csv
 *   - Run: node build-directory.js
 */

var CITIES_CONFIG = {
  OUTSCRAPER_API_KEY: "MjVjMTU4YmYxNzdlNGZlNGEzZjI4N2U0NzA4Y2Y4OTd8MjNlYzYwOTdmZg",
  SHEET_NAME: "towing-cities-template",
  RESULTS_PER_QUERY: 20,
  DELAY_MS: 2000
};

/**
 * Targeted queries for major US cities.
 * Each city gets its own query for better coverage.
 */
var CITY_QUERIES = [
  "tow truck, New York, NY",
  "towing service, New York, NY",
  "tow truck, Los Angeles, CA",
  "towing service, Los Angeles, CA",
  "tow truck, Chicago, IL",
  "towing service, Chicago, IL",
  "tow truck, Houston, TX",
  "towing service, Houston, TX",
  "tow truck, Phoenix, AZ",
  "towing service, Phoenix, AZ",
  "tow truck, Philadelphia, PA",
  "towing service, Philadelphia, PA",
  "tow truck, San Antonio, TX",
  "towing service, San Antonio, TX",
  "tow truck, San Diego, CA",
  "towing service, San Diego, CA",
  "tow truck, Dallas, TX",
  "towing service, Dallas, TX",
  "tow truck, Austin, TX",
  "towing service, Austin, TX",
  "tow truck, Jacksonville, FL",
  "towing service, Jacksonville, FL",
  "tow truck, San Jose, CA",
  "towing service, San Jose, CA",
  "tow truck, Fort Worth, TX",
  "towing service, Fort Worth, TX",
  "tow truck, Columbus, OH",
  "towing service, Columbus, OH",
  "tow truck, Charlotte, NC",
  "towing service, Charlotte, NC",
  "tow truck, Indianapolis, IN",
  "towing service, Indianapolis, IN",
  "tow truck, San Francisco, CA",
  "towing service, San Francisco, CA",
  "tow truck, Seattle, WA",
  "towing service, Seattle, WA",
  "tow truck, Denver, CO",
  "towing service, Denver, CO",
  "tow truck, Nashville, TN",
  "towing service, Nashville, TN",
  "tow truck, Miami, FL",
  "towing service, Miami, FL",
  "tow truck, Atlanta, GA",
  "towing service, Atlanta, GA",
  "tow truck, Las Vegas, NV",
  "towing service, Las Vegas, NV",
  "tow truck, Portland, OR",
  "towing service, Portland, OR",
  "tow truck, Detroit, MI",
  "towing service, Detroit, MI",
  "tow truck, Memphis, TN",
  "towing service, Memphis, TN",
  "tow truck, Baltimore, MD",
  "towing service, Baltimore, MD",
  "tow truck, Milwaukee, WI",
  "towing service, Milwaukee, WI",
  "tow truck, Albuquerque, NM",
  "towing service, Albuquerque, NM",
  "tow truck, Tucson, AZ",
  "towing service, Tucson, AZ",
  "tow truck, Sacramento, CA",
  "towing service, Sacramento, CA",
  "tow truck, Kansas City, MO",
  "towing service, Kansas City, MO",
  "tow truck, Tampa, FL",
  "towing service, Tampa, FL",
  "tow truck, Orlando, FL",
  "towing service, Orlando, FL",
  "tow truck, Minneapolis, MN",
  "towing service, Minneapolis, MN",
  "tow truck, Honolulu, HI",
  "towing service, Honolulu, HI"
];

var STATE_ABBREVS = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
  "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
  "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
  "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
  "district of columbia": "DC"
};

// ── Main ─────────────────────────────────────────────────────────────────────

function citiesMain() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CITIES_CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + CITIES_CONFIG.SHEET_NAME + "' not found. Create a tab named '" + CITIES_CONFIG.SHEET_NAME + "'.");

  var props = PropertiesService.getScriptProperties();
  var startIndex = parseInt(props.getProperty("lastCityQuery") || "-1", 10) + 1;

  if (startIndex >= CITY_QUERIES.length) {
    Logger.log("All " + CITY_QUERIES.length + " city queries completed. Call resetCitiesProgress() to start over.");
    return;
  }

  Logger.log("Resuming from query " + (startIndex + 1) + "/" + CITY_QUERIES.length);

  var existingRows = getCitiesExistingRows(sheet);
  var added = 0;

  for (var i = startIndex; i < CITY_QUERIES.length; i++) {
    var query = CITY_QUERIES[i];
    Logger.log("Query " + (i + 1) + "/" + CITY_QUERIES.length + ": " + query);

    var places = citiesFetchOutscraper(query);
    if (!places || places.length === 0) {
      Logger.log("  No results.");
      props.setProperty("lastCityQuery", String(i));
      continue;
    }

    for (var j = 0; j < places.length; j++) {
      var row = citiesMapToRow(places[j]);
      if (!row) continue;

      var businessName = row[0];
      var phone = row[5];
      var address = row[1];

      if (citiesIsDuplicate(existingRows, businessName, phone, address)) continue;

      sheet.appendRow(row);
      existingRows.push({ businessName: businessName, phone: phone, address: address });
      added++;
    }

    props.setProperty("lastCityQuery", String(i));

    if (i < CITY_QUERIES.length - 1) {
      Utilities.sleep(CITIES_CONFIG.DELAY_MS);
    }
  }

  Logger.log("Done. Added " + added + " new rows. Completed through query " + CITY_QUERIES.length + "/" + CITY_QUERIES.length);
}

function resetCitiesProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastCityQuery");
  Logger.log("Cities progress reset. Next citiesMain() run will start from query 1.");
}

// ── Outscraper API ───────────────────────────────────────────────────────────

function citiesFetchOutscraper(query) {
  var url = "https://api.app.outscraper.com/maps/search-v3"
    + "?query=" + encodeURIComponent(query)
    + "&limit=" + CITIES_CONFIG.RESULTS_PER_QUERY
    + "&async=false";

  var options = {
    method: "get",
    headers: { "X-API-KEY": CITIES_CONFIG.OUTSCRAPER_API_KEY },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log("  API error " + code + ": " + response.getContentText().substring(0, 200));
    return [];
  }

  var json = JSON.parse(response.getContentText());
  if (json.data && json.data.length > 0 && Array.isArray(json.data[0])) {
    return json.data[0];
  }
  return [];
}

// ── Row mapping ──────────────────────────────────────────────────────────────

function citiesMapToRow(place) {
  if (!place || !place.name) return null;

  var state = citiesNormalizeState(place.us_state || place.state || "");
  var hours = citiesParseHours(place.working_hours);

  return [
    citiesSafeString(place.name).trim(),
    citiesSafeString(place.street || place.full_address).trim(),
    citiesSafeString(place.city).trim(),
    state,
    citiesSafeString(place.postal_code).toString().trim(),
    citiesSafeString(place.phone).trim().replace(/^\+/, ""),
    citiesSafeString(place.site || place.website || place.website_url || "").trim(),
    citiesSafeString(place.rating),
    citiesSafeString(place.reviews),
    hours[0], hours[1], hours[2], hours[3], hours[4], hours[5], hours[6],
    citiesSafeString(place.latitude),
    citiesSafeString(place.longitude)
  ];
}

function citiesSafeString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return val;
  try { return JSON.stringify(val); } catch (e) { return ""; }
}

function citiesParseHours(workingHours) {
  var result = ["", "", "", "", "", "", ""];
  if (!workingHours) return result;

  var hoursStr = "";
  try { hoursStr = JSON.stringify(workingHours); } catch (e) { return result; }

  var hoursObj = JSON.parse(hoursStr);
  var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (hoursObj && typeof hoursObj === "object" && !Array.isArray(hoursObj)) {
    for (var i = 0; i < days.length; i++) {
      var val = hoursObj[days[i]];
      if (val) result[i] = (typeof val === "string") ? val : JSON.stringify(val);
    }
    return result;
  }

  if (Array.isArray(hoursObj)) { result[0] = hoursStr; }
  return result;
}

// ── Deduplication ────────────────────────────────────────────────────────────

function getCitiesExistingRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    rows.push({
      businessName: String(data[i][0]).trim().toLowerCase(),
      phone: String(data[i][5]).trim(),
      address: String(data[i][1]).trim().toLowerCase()
    });
  }
  return rows;
}

function citiesIsDuplicate(existingRows, businessName, phone, address) {
  var n = (businessName || "").trim().toLowerCase();
  var p = (phone || "").trim();
  var a = (address || "").trim().toLowerCase();

  if (!n && !p && !a) return false;

  for (var i = 0; i < existingRows.length; i++) {
    var row = existingRows[i];
    if (n && row.businessName && n === row.businessName) return true;
    if (p && row.phone && p === row.phone) return true;
    if (a && row.address && a === row.address) return true;
  }
  return false;
}

// ── State normalization ──────────────────────────────────────────────────────

function citiesNormalizeState(raw) {
  if (!raw) return "";
  var trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  var key = trimmed.toLowerCase();
  if (STATE_ABBREVS[key]) return STATE_ABBREVS[key];
  return trimmed.toUpperCase().substring(0, 2);
}
