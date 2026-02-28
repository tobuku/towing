/**
 * TowTruck.blog — Outscraper Automation for Tow Truck Directory
 *
 * Setup:
 *   1. Paste this script into Apps Script.
 *   2. Click Save.
 *   3. Run fillMissingWebsites() first to backfill existing 116 rows.
 *   4. Run main() to continue the full pull (resumes where it left off).
 *   5. If it times out (6-min limit), just run the same function again.
 *   6. Call resetProgress() / resetWebsiteProgress() to start over.
 */

var CONFIG = {
  OUTSCRAPER_API_KEY: "MjVjMTU4YmYxNzdlNGZlNGEzZjI4N2U0NzA4Y2Y4OTd8MjNlYzYwOTdmZg",
  SHEET_NAME: "towing-directory-template",
  RESULTS_PER_QUERY: 20,
  DELAY_MS: 2000
};

var SEARCH_QUERIES = [
  "towing service, Alabama",
  "towing service, Alaska",
  "towing service, Arizona",
  "towing service, Arkansas",
  "towing service, California",
  "towing service, Colorado",
  "towing service, Connecticut",
  "towing service, Delaware",
  "towing service, Florida",
  "towing service, Georgia",
  "towing service, Hawaii",
  "towing service, Idaho",
  "towing service, Illinois",
  "towing service, Indiana",
  "towing service, Iowa",
  "towing service, Kansas",
  "towing service, Kentucky",
  "towing service, Louisiana",
  "towing service, Maine",
  "towing service, Maryland",
  "towing service, Massachusetts",
  "towing service, Michigan",
  "towing service, Minnesota",
  "towing service, Mississippi",
  "towing service, Missouri",
  "towing service, Montana",
  "towing service, Nebraska",
  "towing service, Nevada",
  "towing service, New Hampshire",
  "towing service, New Jersey",
  "towing service, New Mexico",
  "towing service, New York",
  "towing service, North Carolina",
  "towing service, North Dakota",
  "towing service, Ohio",
  "towing service, Oklahoma",
  "towing service, Oregon",
  "towing service, Pennsylvania",
  "towing service, Rhode Island",
  "towing service, South Carolina",
  "towing service, South Dakota",
  "towing service, Tennessee",
  "towing service, Texas",
  "towing service, Utah",
  "towing service, Vermont",
  "towing service, Virginia",
  "towing service, Washington",
  "towing service, West Virginia",
  "towing service, Wisconsin",
  "towing service, Wyoming"
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

function main() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + CONFIG.SHEET_NAME + "' not found.");

  var props = PropertiesService.getScriptProperties();
  var startIndex = parseInt(props.getProperty("lastCompletedQuery") || "-1", 10) + 1;

  if (startIndex >= SEARCH_QUERIES.length) {
    Logger.log("All " + SEARCH_QUERIES.length + " states already completed. Call resetProgress() to start over.");
    return;
  }

  Logger.log("Resuming from query " + (startIndex + 1) + "/" + SEARCH_QUERIES.length);

  var existingRows = getExistingRows(sheet);
  var added = 0;

  for (var i = startIndex; i < SEARCH_QUERIES.length; i++) {
    var query = SEARCH_QUERIES[i];
    Logger.log("Query " + (i + 1) + "/" + SEARCH_QUERIES.length + ": " + query);

    var places = fetchOutscraper(query);
    if (!places || places.length === 0) {
      Logger.log("  No results.");
      props.setProperty("lastCompletedQuery", String(i));
      continue;
    }

    for (var j = 0; j < places.length; j++) {
      var row = mapToRow(places[j]);
      if (!row) continue;

      var businessName = row[0];
      var phone = row[5];
      var address = row[1];

      if (isDuplicate(existingRows, businessName, phone, address)) continue;

      sheet.appendRow(row);
      existingRows.push({ businessName: businessName, phone: phone, address: address });
      added++;
    }

    props.setProperty("lastCompletedQuery", String(i));

    if (i < SEARCH_QUERIES.length - 1) {
      Utilities.sleep(CONFIG.DELAY_MS);
    }
  }

  Logger.log("Done. Added " + added + " new rows. Completed through query " + SEARCH_QUERIES.length + "/" + SEARCH_QUERIES.length);
}

function resetProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastCompletedQuery");
  Logger.log("Progress reset. Next main() run will start from query 1.");
}

// ── Fill Missing Phones ──────────────────────────────────────────────────────

function fillMissingPhones() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + CONFIG.SHEET_NAME + "' not found.");

  var props = PropertiesService.getScriptProperties();
  var lastProcessed = parseInt(props.getProperty("lastPhoneRow") || "1", 10);
  var lastRow = sheet.getLastRow();
  var phoneCol = 6;
  var updated = 0, skipped = 0;

  Logger.log("Filling missing phones starting from row " + (lastProcessed + 1));

  for (var row = lastProcessed + 1; row <= lastRow; row++) {
    var phone = sheet.getRange(row, phoneCol).getValue();
    if (phone && String(phone).trim() !== "") {
      skipped++;
      props.setProperty("lastPhoneRow", String(row));
      continue;
    }

    var name = sheet.getRange(row, 1).getValue();
    var city = sheet.getRange(row, 3).getValue();
    var state = sheet.getRange(row, 4).getValue();
    if (!name) { props.setProperty("lastPhoneRow", String(row)); continue; }

    var query = name + ", " + city + ", " + state;
    Logger.log("Row " + row + ": Looking up " + query);

    var places = fetchOutscraper(query);
    if (places && places.length > 0) {
      var foundPhone = (places[0].phone || "").trim().replace(/^\+/, "");
      if (foundPhone) {
        sheet.getRange(row, phoneCol).setValue(foundPhone);
        updated++;
        Logger.log("  Found: " + foundPhone);
      } else {
        Logger.log("  No phone in result.");
      }
    } else {
      Logger.log("  No results.");
    }

    props.setProperty("lastPhoneRow", String(row));
    Utilities.sleep(CONFIG.DELAY_MS);
  }

  Logger.log("Done. Updated " + updated + " phones. Skipped " + skipped + " (already had phone).");
}

function resetPhoneProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastPhoneRow");
  Logger.log("Phone progress reset.");
}

// ── Fill Missing Websites ────────────────────────────────────────────────────

function fillMissingWebsites() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("Sheet '" + CONFIG.SHEET_NAME + "' not found.");

  var props = PropertiesService.getScriptProperties();
  var lastProcessed = parseInt(props.getProperty("lastWebsiteRow") || "1", 10);
  var lastRow = sheet.getLastRow();
  var websiteCol = 7;
  var updated = 0, skipped = 0;

  Logger.log("Filling missing websites starting from row " + (lastProcessed + 1));

  for (var row = lastProcessed + 1; row <= lastRow; row++) {
    var website = sheet.getRange(row, websiteCol).getValue();
    if (website && String(website).trim() !== "") {
      skipped++;
      props.setProperty("lastWebsiteRow", String(row));
      continue;
    }

    var name = sheet.getRange(row, 1).getValue();
    var city = sheet.getRange(row, 3).getValue();
    var state = sheet.getRange(row, 4).getValue();
    if (!name) { props.setProperty("lastWebsiteRow", String(row)); continue; }

    var query = name + ", " + city + ", " + state;
    Logger.log("Row " + row + ": Looking up " + query);

    var places = fetchOutscraper(query);
    if (places && places.length > 0) {
      var p = places[0];
      var foundSite = safeString(p.site || p.website || p.website_url || "").trim();
      if (foundSite) {
        sheet.getRange(row, websiteCol).setValue(foundSite);
        updated++;
        Logger.log("  Found: " + foundSite);
      } else {
        Logger.log("  No website in result.");
      }
    } else {
      Logger.log("  No results.");
    }

    props.setProperty("lastWebsiteRow", String(row));
    Utilities.sleep(CONFIG.DELAY_MS);
  }

  Logger.log("Done. Updated " + updated + " websites. Skipped " + skipped + " (already had website).");
}

function resetWebsiteProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastWebsiteRow");
  Logger.log("Website progress reset.");
}

// ── Outscraper API ───────────────────────────────────────────────────────────

function fetchOutscraper(query) {
  var url = "https://api.app.outscraper.com/maps/search-v3"
    + "?query=" + encodeURIComponent(query)
    + "&limit=" + CONFIG.RESULTS_PER_QUERY
    + "&async=false";

  var options = {
    method: "get",
    headers: { "X-API-KEY": CONFIG.OUTSCRAPER_API_KEY },
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

function mapToRow(place) {
  if (!place || !place.name) return null;

  var state = normalizeState(place.us_state || place.state || "");
  var hours = parseHours(place.working_hours);

  return [
    safeString(place.name).trim(),
    safeString(place.street || place.full_address).trim(),
    safeString(place.city).trim(),
    state,
    safeString(place.postal_code).toString().trim(),
    safeString(place.phone).trim().replace(/^\+/, ""),
    safeString(place.site || place.website || place.website_url || "").trim(),
    safeString(place.rating),
    safeString(place.reviews),
    hours[0], hours[1], hours[2], hours[3], hours[4], hours[5], hours[6],
    safeString(place.latitude),
    safeString(place.longitude)
  ];
}

function safeString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return val;
  try { return JSON.stringify(val); } catch (e) { return ""; }
}

function parseHours(workingHours) {
  var result = ["", "", "", "", "", "", ""];
  if (!workingHours) return result;

  try { Logger.log("  working_hours raw: " + JSON.stringify(workingHours)); } catch (e) {}

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

function getExistingRows(sheet) {
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

function isDuplicate(existingRows, businessName, phone, address) {
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

function normalizeState(raw) {
  if (!raw) return "";
  var trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  var key = trimmed.toLowerCase();
  if (STATE_ABBREVS[key]) return STATE_ABBREVS[key];
  return trimmed.toUpperCase().substring(0, 2);
}
