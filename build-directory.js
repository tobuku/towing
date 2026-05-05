/**
 * TowTruck.blog — Static Directory Page Generator
 *
 * Reads towing-data.csv and generates all state/city/listing HTML pages.
 * Run: node build-directory.js
 */

var fs = require("fs");
var path = require("path");

// ── Config ───────────────────────────────────────────────────────────────────

var BASE_DIR = path.join(__dirname, "states");
var CSV_FILE = path.join(__dirname, "towing-data.csv");
var SITEMAP_FILE = path.join(__dirname, "sitemap.xml");
var AFFILIATE_TAG = "dwelldoc-20";
var GA4_ID = "G-0G9EYS155G";
var HOMEPAGE_FILE = path.join(__dirname, "index.html");

var STATE_NAMES = {
  "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California",
  "CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia",
  "HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa",
  "KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland",
  "MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi",
  "MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire",
  "NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina",
  "ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania",
  "RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee",
  "TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington",
  "WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming","DC":"District of Columbia"
};

// ── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text) {
  var rows = [];
  var lines = text.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    rows.push(parseCSVLine(line));
  }
  return rows;
}

function parseCSVLine(line) {
  var fields = [];
  var field = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        fields.push(field);
        field = "";
      } else {
        field += c;
      }
    }
  }
  fields.push(field);
  return fields;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatPhone(raw) {
  if (!raw) return "";
  var digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") digits = digits.substring(1);
  if (digits.length === 10) {
    return "(" + digits.substring(0, 3) + ") " + digits.substring(3, 6) + "-" + digits.substring(6);
  }
  return raw;
}

function phoneTel(raw) {
  if (!raw) return "";
  var digits = raw.replace(/\D/g, "");
  if (digits.length === 10) digits = "1" + digits;
  return digits;
}

function parseHoursField(val) {
  if (!val) return "";
  var cleaned = val.replace(/^\["|"\]$/g, "").replace(/^""|""$/g, "").replace(/""/g, '"');
  if (cleaned === "Open 24 hours") return "Open 24 Hours";
  return cleaned;
}

function getStarHTML(rating) {
  if (!rating) return "";
  var r = parseFloat(rating);
  if (isNaN(r)) return "";
  var full = Math.floor(r);
  var half = (r - full) >= 0.3;
  var html = "";
  var starSvg = '<svg class="star-svg" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>';
  for (var i = 0; i < full; i++) html += starSvg;
  if (half) html += starSvg;
  return html;
}

function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Parse data ───────────────────────────────────────────────────────────────

function loadBusinesses() {
  var text = fs.readFileSync(CSV_FILE, "utf8");
  var rows = parseCSV(text);
  // Skip header
  rows.shift();

  var businesses = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] || !r[3]) continue; // need name and state

    var name = r[0].trim();
    var street = (r[1] || "").trim();
    var city = (r[2] || "").trim();
    var stateAbbr = (r[3] || "").trim().toUpperCase();
    var zip = (r[4] || "").trim();
    var phone = (r[5] || "").trim();
    var website = (r[6] || "").trim();
    var rating = (r[7] || "").trim();
    var reviewCount = (r[8] || "").trim();

    // Hours are in columns 9-15
    var hours = [];
    for (var h = 9; h <= 15; h++) {
      hours.push(parseHoursField((r[h] || "").trim()));
    }

    var lat = (r[16] || "").trim();
    var lng = (r[17] || "").trim();

    if (!city) city = "Unknown";
    if (!STATE_NAMES[stateAbbr]) continue;

    // Clean up website URLs
    if (website) {
      website = website.replace(/%3F/gi, "?").replace(/%3D/gi, "=").replace(/%26/gi, "&");
      // Remove UTM params
      website = website.replace(/[?&]utm_[^&]*/gi, "").replace(/\?$/, "");
    }

    // Determine if 24 hours
    var is24 = hours.some(function(h) { return h && h.indexOf("24") > -1; });
    var hoursDisplay = is24 ? "Open 24 Hours" : (hours[0] || "Contact for hours");

    // Featured if it's Tadio's
    var featured = name.toLowerCase().indexOf("tadio") > -1;

    businesses.push({
      name: name,
      slug: slugify(name),
      street: street,
      city: city,
      state: stateAbbr,
      stateName: STATE_NAMES[stateAbbr],
      stateSlug: slugify(STATE_NAMES[stateAbbr]),
      citySlug: slugify(city),
      zip: zip,
      phone: phone,
      phoneFmt: formatPhone(phone),
      phoneTel: phoneTel(phone),
      website: website,
      rating: rating,
      reviewCount: reviewCount,
      hours: hours,
      hoursDisplay: hoursDisplay,
      is24: is24,
      lat: lat,
      lng: lng,
      featured: featured
    });
  }

  return businesses;
}

// ── Group data ───────────────────────────────────────────────────────────────

function groupByState(businesses) {
  var states = {};
  for (var i = 0; i < businesses.length; i++) {
    var b = businesses[i];
    if (!states[b.state]) {
      states[b.state] = { abbr: b.state, name: b.stateName, slug: b.stateSlug, cities: {} };
    }
    if (!states[b.state].cities[b.citySlug]) {
      states[b.state].cities[b.citySlug] = { name: b.city, slug: b.citySlug, businesses: [] };
    }
    states[b.state].cities[b.citySlug].businesses.push(b);
  }
  // Sort businesses within each city: featured first, then by rating
  for (var s in states) {
    for (var c in states[s].cities) {
      states[s].cities[c].businesses.sort(function(a, b) {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
      });
    }
  }
  return states;
}

// ── HTML Templates ───────────────────────────────────────────────────────────

function ga4Snippet() {
  return '  <!-- Google tag (gtag.js) -->\n' +
    '  <script async src="https://www.googletagmanager.com/gtag/js?id=' + GA4_ID + '"></script>\n' +
    '  <script>\n' +
    '    window.dataLayer = window.dataLayer || [];\n' +
    '    function gtag(){dataLayer.push(arguments);}\n' +
    '    gtag(\'js\', new Date());\n' +
    '    gtag(\'config\', \'' + GA4_ID + '\');\n' +
    '  </script>\n';
}

function headerHTML(cssPrefix) {
  return '  <header>\n' +
    '    <div class="navbar">\n' +
    '      <div class="logo"><a href="/" style="text-decoration:none;color:inherit">TowTruck<span>.blog</span></a></div>\n' +
    '      <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>\n' +
    '      <nav class="nav-links">\n' +
    '        <a class="kls-magnet" href="/">Home</a>\n' +
    '        <a class="kls-magnet" href="/states/">Browse States</a>\n' +
    '        <a class="kls-magnet" href="/contact.html">List Your Business</a>\n' +
    '        <a class="kls-magnet" href="/about.html">About</a>\n' +
    '        <a class="kls-magnet" href="/faq.html">FAQ</a>\n' +
    '      </nav>\n' +
    '    </div>\n' +
    '  </header>\n';
}

function footerHTML(stateLinks) {
  var sl = stateLinks || [
    { href: "/states/california/", label: "California" },
    { href: "/states/texas/", label: "Texas" },
    { href: "/states/florida/", label: "Florida" },
    { href: "/states/new-york/", label: "New York" }
  ];
  var stateLinksHTML = "";
  for (var i = 0; i < sl.length; i++) {
    stateLinksHTML += '          <li><a href="' + sl[i].href + '">' + escapeHTML(sl[i].label) + '</a></li>\n';
  }

  return '  <footer>\n' +
    '    <div class="footer-inner">\n' +
    '      <div class="footer-col">\n' +
    '        <h4>TowTruck.blog</h4>\n' +
    '        <p style="font-size:.9rem;color:#999;">Nationwide tow truck directory. Find towing companies and roadside assistance near you.</p>\n' +
    '      </div>\n' +
    '      <div class="footer-col">\n' +
    '        <h4>Directory</h4>\n' +
    '        <ul>\n' +
    '          <li><a href="/">Home</a></li>\n' +
    '          <li><a href="/states/">Browse States</a></li>\n' +
    stateLinksHTML +
    '        </ul>\n' +
    '      </div>\n' +
    '      <div class="footer-col">\n' +
    '        <h4>Company</h4>\n' +
    '        <ul>\n' +
    '          <li><a href="/about.html">About</a></li>\n' +
    '          <li><a href="/contact.html">List Your Business</a></li>\n' +
    '          <li><a href="/faq.html">FAQ</a></li>\n' +
    '          <li><a href="/privacy.html">Privacy Policy</a></li>\n' +
    '          <li><a href="/terms.html">Terms of Service</a></li>\n' +
    '        </ul>\n' +
    '      </div>\n' +
    '      <div class="footer-col">\n' +
    '        <h4>Popular Cities</h4>\n' +
    '        <ul>\n' +
    '          <li><a href="/states/hawaii/honolulu/">Honolulu, HI</a></li>\n' +
    '          <li><a href="/states/texas/houston/">Houston, TX</a></li>\n' +
    '          <li><a href="/states/california/los-angeles/">Los Angeles, CA</a></li>\n' +
    '          <li><a href="/states/florida/miami/">Miami, FL</a></li>\n' +
    '          <li><a href="/states/new-york/new-york/">New York, NY</a></li>\n' +
    '        </ul>\n' +
    '      </div>\n' +
    '      <div class="footer-bottom">&copy; <span id="year"></span> TowTruck.blog. All rights reserved.</div>\n' +
    '    </div>\n' +
    '  </footer>\n\n' +
    '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>\n' +
    '  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>\n' +
    '  <script src="/gsap-init.js"></script>\n';
}

function ctaBanner(heading, text, btnText, btnHref) {
  return '\n    <section class="cta-banner">\n' +
    '      <h2 class="kls-drop">' + escapeHTML(heading) + '</h2>\n' +
    '      <p>' + escapeHTML(text) + '</p>\n' +
    '      <a class="btn kls-magnet" href="' + btnHref + '">' + escapeHTML(btnText) + '</a>\n' +
    '    </section>\n';
}

function affiliateSection() {
  return '      <div style="margin-top:48px;">\n' +
    '        <h2 class="section-title kls-drop">Roadside Emergency Essentials</h2>\n' +
    '        <div class="affiliate-card kls-fade">\n' +
    '          <img src="/assets/images/gear/emergency-kit.jpg" alt="Emergency Roadside Kit" width="80" height="80" loading="lazy">\n' +
    '          <div class="aff-info">\n' +
    '            <h4>Emergency Roadside Kit</h4>\n' +
    '            <p>Jumper cables, flashlight, first aid, reflective triangles. Keep one in your trunk.</p>\n' +
    '          </div>\n' +
    '          <a class="aff-link" href="https://www.amazon.com/s?k=emergency+roadside+kit&tag=' + AFFILIATE_TAG + '" target="_blank" rel="noopener nofollow">Shop on Amazon</a>\n' +
    '        </div>\n' +
    '        <div class="affiliate-card kls-fade">\n' +
    '          <img src="/assets/images/gear/portable-jump-starters.jpg" alt="Portable Jump Starter" width="80" height="80" loading="lazy">\n' +
    '          <div class="aff-info">\n' +
    '            <h4>Portable Jump Starter</h4>\n' +
    '            <p>Compact battery pack that can jump start your car without another vehicle.</p>\n' +
    '          </div>\n' +
    '          <a class="aff-link" href="https://www.amazon.com/s?k=portable+jump+starter&tag=' + AFFILIATE_TAG + '" target="_blank" rel="noopener nofollow">Shop on Amazon</a>\n' +
    '        </div>\n' +
    '        <div class="affiliate-card kls-fade">\n' +
    '          <img src="/assets/images/gear/portable-tire-inflator.jpg" alt="Portable Tire Inflator" width="80" height="80" loading="lazy">\n' +
    '          <div class="aff-info">\n' +
    '            <h4>Portable Tire Inflator</h4>\n' +
    '            <p>Plug into your 12V outlet and inflate a low tire in minutes. No spare needed for slow leaks.</p>\n' +
    '          </div>\n' +
    '          <a class="aff-link" href="https://www.amazon.com/s?k=portable+tire+inflator+12v&tag=' + AFFILIATE_TAG + '" target="_blank" rel="noopener nofollow">Shop on Amazon</a>\n' +
    '        </div>\n' +
    '      </div>\n';
}

// ── State Page Generator ─────────────────────────────────────────────────────

function generateStatePage(stateData) {
  var cityKeys = Object.keys(stateData.cities).sort();
  var cityCardsHTML = "";
  for (var i = 0; i < cityKeys.length; i++) {
    var city = stateData.cities[cityKeys[i]];
    var count = city.businesses.length;
    cityCardsHTML += '        <a class="city-card kls-fade" href="/states/' + stateData.slug + '/' + city.slug + '/">\n' +
      '          <h3>' + escapeHTML(city.name) + '</h3>\n' +
      '          <span class="city-count">' + count + ' towing compan' + (count === 1 ? 'y' : 'ies') + '</span>\n' +
      '        </a>\n';
  }

  var totalBiz = 0;
  for (var k in stateData.cities) totalBiz += stateData.cities[k].businesses.length;

  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    ga4Snippet() +
    '  <meta charset="UTF-8" />\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '  <title>Tow Truck Companies in ' + escapeHTML(stateData.name) + ' | TowTruck.blog</title>\n' +
    '  <meta name="description" content="Find tow truck companies and roadside assistance in ' + escapeHTML(stateData.name) + '. Browse ' + totalBiz + ' towing services across ' + cityKeys.length + ' cities." />\n' +
    '  <link rel="canonical" href="https://www.towtruck.blog/states/' + stateData.slug + '/" />\n' +
    '  <link rel="stylesheet" href="/style.css" />\n' +
    '  <link rel="stylesheet" href="/directory.css" />\n' +
    '  <script type="application/ld+json">\n' +
    '  {\n' +
    '    "@context": "https://schema.org",\n' +
    '    "@type": "BreadcrumbList",\n' +
    '    "itemListElement": [\n' +
    '      {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.towtruck.blog/"},\n' +
    '      {"@type": "ListItem", "position": 2, "name": "States", "item": "https://www.towtruck.blog/states/"},\n' +
    '      {"@type": "ListItem", "position": 3, "name": "' + escapeHTML(stateData.name) + '", "item": "https://www.towtruck.blog/states/' + stateData.slug + '/"}\n' +
    '    ]\n' +
    '  }\n' +
    '  </script>\n' +
    '</head>\n<body>\n\n' +
    headerHTML() +
    '\n  <main>\n    <div class="container">\n' +
    '      <div class="breadcrumbs">\n' +
    '        <a href="/">Home</a><span class="sep">/</span><a href="/states/">States</a><span class="sep">/</span><strong>' + escapeHTML(stateData.name) + '</strong>\n' +
    '      </div>\n\n' +
    '      <h1 class="kls-drop" style="text-align:center;margin-bottom:10px;">Tow Truck Companies in ' + escapeHTML(stateData.name) + '</h1>\n' +
    '      <p class="section-sub">Browse ' + totalBiz + ' towing companies across ' + cityKeys.length + ' cities in ' + escapeHTML(stateData.name) + '.</p>\n\n' +
    '      <h2 class="section-title kls-drop">Cities in ' + escapeHTML(stateData.name) + '</h2>\n' +
    '      <div class="cities-grid">\n' +
    cityCardsHTML +
    '      </div>\n' +
    '    </div>\n' +
    ctaBanner("Own a Towing Business in " + stateData.name + "?", "Get listed on TowTruck.blog and reach more local drivers.", "List Your Business", "/contact.html") +
    '  </main>\n\n' +
    footerHTML() +
    '</body>\n</html>\n';

  return html;
}

// ── City Page Generator ──────────────────────────────────────────────────────

function generateCityPage(stateData, cityData) {
  var listingsHTML = "";
  for (var i = 0; i < cityData.businesses.length; i++) {
    var b = cityData.businesses[i];
    var featuredClass = b.featured ? " featured" : "";
    var featuredBadge = b.featured ? '          <span class="badge-featured">Featured</span>\n' : "";

    var ratingHTML = "";
    if (b.rating) {
      ratingHTML = '            <span class="listing-rating"><span class="stars">' + getStarHTML(b.rating) + '</span> ' + escapeHTML(b.rating) + '</span>\n';
      if (b.reviewCount) {
        ratingHTML += '            <span class="listing-reviews">' + escapeHTML(b.reviewCount) + ' reviews</span>\n';
      }
    }

    var hoursHTML = '            <span class="listing-hours">' + escapeHTML(b.hoursDisplay) + '</span>\n';

    var actionsHTML = "";
    if (b.phoneTel) {
      actionsHTML += '            <a class="btn primary kls-magnet" href="tel:' + b.phoneTel + '" onclick="typeof gtag!==\'undefined\'&&gtag(\'event\',\'click_to_call\',{company:\'' + escapeHTML(b.name).replace(/'/g, "\\'") + '\',city:\'' + escapeHTML(b.city) + '\'})">' + escapeHTML(b.phoneFmt || "Call") + '</a>\n';
    }
    actionsHTML += '            <a class="btn secondary kls-magnet" href="/states/' + stateData.slug + '/' + cityData.slug + '/' + b.slug + '/">View Details</a>\n';

    var tagsHTML = "";
    tagsHTML += '            <span class="service-tag">Towing</span>\n';
    if (b.is24) tagsHTML += '            <span class="service-tag">24-Hour</span>\n';
    if (b.website) tagsHTML += '            <span class="service-tag">Website</span>\n';

    listingsHTML += '        <div class="listing-card' + featuredClass + ' kls-fade">\n' +
      featuredBadge +
      '          <h3><a href="/states/' + stateData.slug + '/' + cityData.slug + '/' + b.slug + '/">' + escapeHTML(b.name) + '</a></h3>\n' +
      '          <div class="listing-address">' + escapeHTML(b.street ? b.street + ", " : "") + escapeHTML(b.city) + ', ' + escapeHTML(b.state) + (b.zip ? ' ' + escapeHTML(b.zip) : '') + '</div>\n' +
      '          <div class="listing-meta">\n' +
      ratingHTML + hoursHTML +
      '          </div>\n' +
      '          <div class="service-tags">\n' + tagsHTML + '          </div>\n' +
      '          <div class="listing-actions">\n' + actionsHTML + '          </div>\n' +
      '        </div>\n\n';
  }

  // ItemList schema
  var itemListItems = "";
  for (var j = 0; j < cityData.businesses.length; j++) {
    var biz = cityData.businesses[j];
    itemListItems += '      {"@type": "ListItem", "position": ' + (j + 1) + ', "url": "https://www.towtruck.blog/states/' + stateData.slug + '/' + cityData.slug + '/' + biz.slug + '/", "name": "' + escapeHTML(biz.name) + '"}';
    if (j < cityData.businesses.length - 1) itemListItems += ",";
    itemListItems += "\n";
  }

  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    ga4Snippet() +
    '  <meta charset="UTF-8" />\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '  <title>Tow Truck Companies in ' + escapeHTML(cityData.name) + ', ' + escapeHTML(stateData.abbr) + ' | TowTruck.blog</title>\n' +
    '  <meta name="description" content="Find ' + cityData.businesses.length + ' tow truck companies in ' + escapeHTML(cityData.name) + ', ' + escapeHTML(stateData.name) + '. Compare ratings, check hours, and call directly." />\n' +
    '  <link rel="canonical" href="https://www.towtruck.blog/states/' + stateData.slug + '/' + cityData.slug + '/" />\n' +
    '  <link rel="stylesheet" href="/style.css" />\n' +
    '  <link rel="stylesheet" href="/directory.css" />\n' +
    '  <script type="application/ld+json">\n' +
    '  {\n' +
    '    "@context": "https://schema.org",\n' +
    '    "@type": "BreadcrumbList",\n' +
    '    "itemListElement": [\n' +
    '      {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.towtruck.blog/"},\n' +
    '      {"@type": "ListItem", "position": 2, "name": "States", "item": "https://www.towtruck.blog/states/"},\n' +
    '      {"@type": "ListItem", "position": 3, "name": "' + escapeHTML(stateData.name) + '", "item": "https://www.towtruck.blog/states/' + stateData.slug + '/"},\n' +
    '      {"@type": "ListItem", "position": 4, "name": "' + escapeHTML(cityData.name) + '", "item": "https://www.towtruck.blog/states/' + stateData.slug + '/' + cityData.slug + '/"}\n' +
    '    ]\n' +
    '  }\n' +
    '  </script>\n' +
    '  <script type="application/ld+json">\n' +
    '  {\n' +
    '    "@context": "https://schema.org",\n' +
    '    "@type": "ItemList",\n' +
    '    "name": "Tow Truck Companies in ' + escapeHTML(cityData.name) + ', ' + escapeHTML(stateData.abbr) + '",\n' +
    '    "itemListElement": [\n' +
    itemListItems +
    '    ]\n' +
    '  }\n' +
    '  </script>\n' +
    '</head>\n<body>\n\n' +
    headerHTML() +
    '\n  <main>\n    <div class="container">\n' +
    '      <div class="breadcrumbs">\n' +
    '        <a href="/">Home</a><span class="sep">/</span><a href="/states/">States</a><span class="sep">/</span><a href="/states/' + stateData.slug + '/">' + escapeHTML(stateData.name) + '</a><span class="sep">/</span><strong>' + escapeHTML(cityData.name) + '</strong>\n' +
    '      </div>\n\n' +
    '      <h1 class="kls-drop" style="text-align:center;margin-bottom:10px;">Tow Truck Companies in ' + escapeHTML(cityData.name) + ', ' + escapeHTML(stateData.abbr) + '</h1>\n' +
    '      <p class="section-sub">Compare ' + cityData.businesses.length + ' towing companies in ' + escapeHTML(cityData.name) + '. Check ratings, hours, and services, then call directly.</p>\n\n' +
    '      <div class="listings-grid">\n' +
    listingsHTML +
    '      </div>\n\n' +
    '      <!-- Request a Quote -->\n' +
    '      <div class="quote-form kls-fade" style="margin-top:48px;">\n' +
    '        <h3>Request a Towing Quote in ' + escapeHTML(cityData.name) + '</h3>\n' +
    '        <form action="https://formspree.io/f/xpqjneyj" method="POST">\n' +
    '          <input type="hidden" name="city" value="' + escapeHTML(cityData.name) + ', ' + escapeHTML(stateData.abbr) + '" />\n' +
    '          <label for="q-name">Your Name</label>\n' +
    '          <input type="text" id="q-name" name="name" required placeholder="Full name" />\n' +
    '          <label for="q-phone">Phone Number</label>\n' +
    '          <input type="tel" id="q-phone" name="phone" required placeholder="(555) 555-1234" />\n' +
    '          <label for="q-service">Service Needed</label>\n' +
    '          <select id="q-service" name="service">\n' +
    '            <option value="towing">Towing</option>\n' +
    '            <option value="roadside">Roadside Assistance</option>\n' +
    '            <option value="accident">Accident Recovery</option>\n' +
    '            <option value="junk">Junk Car Removal</option>\n' +
    '            <option value="other">Other</option>\n' +
    '          </select>\n' +
    '          <label for="q-details">Details</label>\n' +
    '          <textarea id="q-details" name="details" placeholder="Vehicle type, location, issue..."></textarea>\n' +
    '          <button type="submit" class="btn primary kls-magnet">Request Quote</button>\n' +
    '        </form>\n' +
    '      </div>\n\n' +
    affiliateSection() +
    '    </div>\n' +
    ctaBanner("Own a Towing Business in " + cityData.name + "?", "Get listed on TowTruck.blog for free.", "List Your Business", "/contact.html") +
    '  </main>\n\n' +
    footerHTML() +
    '</body>\n</html>\n';

  return html;
}

// ── Listing Page Generator ───────────────────────────────────────────────────

function generateListingPage(stateData, cityData, biz) {
  var featuredBadge = biz.featured ? '        <span class="badge-featured" style="position:static;display:inline-block;margin-bottom:12px;">Featured Listing</span>\n' : '';

  var contactCardHTML = '        <div class="contact-card kls-fade">\n';
  if (biz.phoneTel) {
    contactCardHTML += '          <span class="phone-big"><a href="tel:' + biz.phoneTel + '" onclick="typeof gtag!==\'undefined\'&&gtag(\'event\',\'click_to_call\',{company:\'' + escapeHTML(biz.name).replace(/'/g, "\\'") + '\',city:\'' + escapeHTML(biz.city) + '\'})">' + escapeHTML(biz.phoneFmt) + '</a></span>\n';
  }
  if (biz.street) contactCardHTML += '          <div><strong>Address:</strong> ' + escapeHTML(biz.street) + ', ' + escapeHTML(biz.city) + ', ' + escapeHTML(biz.state) + (biz.zip ? ' ' + escapeHTML(biz.zip) : '') + '</div>\n';
  contactCardHTML += '          <div><strong>Hours:</strong> ' + escapeHTML(biz.hoursDisplay) + '</div>\n';
  if (biz.website) contactCardHTML += '          <div><strong>Website:</strong> <a href="' + escapeHTML(biz.website) + '" target="_blank" rel="noopener">' + escapeHTML(biz.website.replace(/^https?:\/\//, "").replace(/\/$/, "")) + '</a></div>\n';
  if (biz.phoneTel) {
    contactCardHTML += '          <div style="margin-top:14px;"><a class="btn primary kls-magnet" href="tel:' + biz.phoneTel + '">Call Now</a></div>\n';
  }
  contactCardHTML += '        </div>\n';

  var ratingMeta = "";
  if (biz.rating) {
    ratingMeta += '          <span class="listing-rating"><span class="stars">' + getStarHTML(biz.rating) + '</span> ' + escapeHTML(biz.rating) + '</span>\n';
    if (biz.reviewCount) ratingMeta += '          <span class="listing-reviews">' + escapeHTML(biz.reviewCount) + ' reviews</span>\n';
  }

  var tagsHTML = '          <span class="service-tag">Towing</span>\n';
  if (biz.is24) tagsHTML += '          <span class="service-tag">24-Hour</span>\n';
  tagsHTML += '          <span class="service-tag">Roadside Assistance</span>\n';

  // LocalBusiness schema
  var schemaJSON = '  {\n' +
    '    "@context": "https://schema.org",\n' +
    '    "@type": "LocalBusiness",\n' +
    '    "name": "' + escapeHTML(biz.name) + '",\n' +
    '    "address": {\n' +
    '      "@type": "PostalAddress",\n' +
    (biz.street ? '      "streetAddress": "' + escapeHTML(biz.street) + '",\n' : '') +
    '      "addressLocality": "' + escapeHTML(biz.city) + '",\n' +
    '      "addressRegion": "' + escapeHTML(biz.state) + '",\n' +
    (biz.zip ? '      "postalCode": "' + escapeHTML(biz.zip) + '",\n' : '') +
    '      "addressCountry": "US"\n' +
    '    },\n' +
    (biz.phoneTel ? '    "telephone": "+' + biz.phoneTel + '",\n' : '') +
    (biz.rating && biz.reviewCount ? '    "aggregateRating": {"@type": "AggregateRating", "ratingValue": "' + escapeHTML(biz.rating) + '", "reviewCount": "' + escapeHTML(biz.reviewCount) + '", "bestRating": "5"},\n' : '') +
    '    "url": "https://www.towtruck.blog/states/' + stateData.slug + '/' + cityData.slug + '/' + biz.slug + '/"\n' +
    '  }\n';

  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    ga4Snippet() +
    '  <meta charset="UTF-8" />\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '  <title>' + escapeHTML(biz.name) + ' - ' + escapeHTML(biz.city) + ', ' + escapeHTML(biz.state) + ' | TowTruck.blog</title>\n' +
    '  <meta name="description" content="' + escapeHTML(biz.name) + ' provides towing and roadside assistance in ' + escapeHTML(biz.city) + ', ' + escapeHTML(stateData.name) + '.' + (biz.rating ? ' Rated ' + biz.rating + ' stars.' : '') + (biz.phoneFmt ? ' Call ' + biz.phoneFmt + '.' : '') + '" />\n' +
    '  <link rel="canonical" href="https://www.towtruck.blog/states/' + stateData.slug + '/' + cityData.slug + '/' + biz.slug + '/" />\n' +
    '  <link rel="stylesheet" href="/style.css" />\n' +
    '  <link rel="stylesheet" href="/directory.css" />\n' +
    '  <script type="application/ld+json">\n' +
    '  {\n' +
    '    "@context": "https://schema.org",\n' +
    '    "@type": "BreadcrumbList",\n' +
    '    "itemListElement": [\n' +
    '      {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.towtruck.blog/"},\n' +
    '      {"@type": "ListItem", "position": 2, "name": "States", "item": "https://www.towtruck.blog/states/"},\n' +
    '      {"@type": "ListItem", "position": 3, "name": "' + escapeHTML(stateData.name) + '", "item": "https://www.towtruck.blog/states/' + stateData.slug + '/"},\n' +
    '      {"@type": "ListItem", "position": 4, "name": "' + escapeHTML(cityData.name) + '", "item": "https://www.towtruck.blog/states/' + stateData.slug + '/' + cityData.slug + '/"},\n' +
    '      {"@type": "ListItem", "position": 5, "name": "' + escapeHTML(biz.name) + '", "item": "https://www.towtruck.blog/states/' + stateData.slug + '/' + cityData.slug + '/' + biz.slug + '/"}\n' +
    '    ]\n' +
    '  }\n' +
    '  </script>\n' +
    '  <script type="application/ld+json">\n' +
    schemaJSON +
    '  </script>\n' +
    '</head>\n<body>\n\n' +
    headerHTML() +
    '\n  <main>\n    <div class="container">\n' +
    '      <div class="breadcrumbs">\n' +
    '        <a href="/">Home</a><span class="sep">/</span><a href="/states/">States</a><span class="sep">/</span><a href="/states/' + stateData.slug + '/">' + escapeHTML(stateData.name) + '</a><span class="sep">/</span><a href="/states/' + stateData.slug + '/' + cityData.slug + '/">' + escapeHTML(cityData.name) + '</a><span class="sep">/</span><strong>' + escapeHTML(biz.name) + '</strong>\n' +
    '      </div>\n\n' +
    '      <div class="listing-detail">\n' +
    featuredBadge +
    '        <h1 class="kls-drop">' + escapeHTML(biz.name) + '</h1>\n\n' +
    '        <div class="listing-meta">\n' +
    ratingMeta +
    '          <span class="listing-hours">' + escapeHTML(biz.hoursDisplay) + '</span>\n' +
    '        </div>\n\n' +
    contactCardHTML + '\n' +
    '        <div class="service-tags" style="margin-bottom:24px;">\n' +
    tagsHTML +
    '        </div>\n\n' +
    (biz.phoneTel ? '        <div style="text-align:center;margin-top:36px;">\n          <a class="btn primary kls-magnet" href="tel:' + biz.phoneTel + '" style="font-size:1.1rem;padding:18px 48px;">Call ' + escapeHTML(biz.name) + ': ' + escapeHTML(biz.phoneFmt) + '</a>\n        </div>\n\n' : '') +
    affiliateSection() +
    '      </div>\n' +
    '    </div>\n' +
    ctaBanner("More Towing Companies in " + cityData.name, "Compare all towing companies on the " + cityData.name + " city page.", "View All " + cityData.name + " Listings", "/states/" + stateData.slug + "/" + cityData.slug + "/") +
    '  </main>\n\n' +
    footerHTML() +
    '</body>\n</html>\n';

  return html;
}

// ── Sitemap Generator ────────────────────────────────────────────────────────

function generateSitemap(states) {
  var urls = [];
  urls.push({ loc: "https://www.towtruck.blog/", priority: "1.0", freq: "weekly" });
  urls.push({ loc: "https://www.towtruck.blog/states/", priority: "0.9", freq: "weekly" });
  urls.push({ loc: "https://www.towtruck.blog/about.html", priority: "0.6", freq: "monthly" });
  urls.push({ loc: "https://www.towtruck.blog/contact.html", priority: "0.7", freq: "monthly" });
  urls.push({ loc: "https://www.towtruck.blog/faq.html", priority: "0.6", freq: "monthly" });
  urls.push({ loc: "https://www.towtruck.blog/privacy.html", priority: "0.3", freq: "yearly" });
  urls.push({ loc: "https://www.towtruck.blog/terms.html", priority: "0.3", freq: "yearly" });

  var stateKeys = Object.keys(states).sort();
  for (var s = 0; s < stateKeys.length; s++) {
    var state = states[stateKeys[s]];
    urls.push({ loc: "https://www.towtruck.blog/states/" + state.slug + "/", priority: "0.8", freq: "weekly" });

    var cityKeys = Object.keys(state.cities).sort();
    for (var c = 0; c < cityKeys.length; c++) {
      var city = state.cities[cityKeys[c]];
      urls.push({ loc: "https://www.towtruck.blog/states/" + state.slug + "/" + city.slug + "/", priority: "0.8", freq: "weekly" });

      for (var b = 0; b < city.businesses.length; b++) {
        var biz = city.businesses[b];
        urls.push({ loc: "https://www.towtruck.blog/states/" + state.slug + "/" + city.slug + "/" + biz.slug + "/", priority: "0.7", freq: "monthly" });
      }
    }
  }

  var today = new Date().toISOString().slice(0, 10);
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (var i = 0; i < urls.length; i++) {
    xml += '  <url><loc>' + urls[i].loc + '</loc><lastmod>' + today + '</lastmod><changefreq>' + urls[i].freq + '</changefreq><priority>' + urls[i].priority + '</priority></url>\n';
  }
  xml += '</urlset>\n';
  return xml;
}

// ── Main Build ───────────────────────────────────────────────────────────────

function build() {
  console.log("Loading businesses from CSV...");
  var businesses = loadBusinesses();
  console.log("Loaded " + businesses.length + " businesses.");

  var states = groupByState(businesses);
  var stateCount = Object.keys(states).length;
  console.log("Found " + stateCount + " states.");

  var pagesCreated = 0;

  // Generate state pages
  var stateKeys = Object.keys(states).sort();
  for (var s = 0; s < stateKeys.length; s++) {
    var state = states[stateKeys[s]];
    var stateDir = path.join(BASE_DIR, state.slug);
    mkdirp(stateDir);

    var stateHTML = generateStatePage(state);
    fs.writeFileSync(path.join(stateDir, "index.html"), stateHTML);
    pagesCreated++;

    // Generate city pages
    var cityKeys = Object.keys(state.cities).sort();
    for (var c = 0; c < cityKeys.length; c++) {
      var city = state.cities[cityKeys[c]];
      var cityDir = path.join(stateDir, city.slug);
      mkdirp(cityDir);

      var cityHTML = generateCityPage(state, city);
      fs.writeFileSync(path.join(cityDir, "index.html"), cityHTML);
      pagesCreated++;

      // Generate listing pages
      for (var b = 0; b < city.businesses.length; b++) {
        var biz = city.businesses[b];
        var bizDir = path.join(cityDir, biz.slug);
        mkdirp(bizDir);

        var bizHTML = generateListingPage(state, city, biz);
        fs.writeFileSync(path.join(bizDir, "index.html"), bizHTML);
        pagesCreated++;
      }
    }

    console.log("  " + state.name + ": " + cityKeys.length + " cities");
  }

  // Generate sitemap
  console.log("Generating sitemap...");
  var sitemapXML = generateSitemap(states);
  fs.writeFileSync(SITEMAP_FILE, sitemapXML);

  // Update homepage search data
  updateHomepageSearch(states);

  console.log("\nDone! Created " + pagesCreated + " pages + sitemap.");
}

// ── Homepage Search Data Injector ────────────────────────────────────────────

function updateHomepageSearch(states) {
  if (!fs.existsSync(HOMEPAGE_FILE)) {
    console.log("Warning: index.html not found, skipping search data update.");
    return;
  }

  var locations = [];
  var stateKeys = Object.keys(states).sort();
  for (var s = 0; s < stateKeys.length; s++) {
    var state = states[stateKeys[s]];
    var cityKeys = Object.keys(state.cities).sort();
    for (var c = 0; c < cityKeys.length; c++) {
      var city = state.cities[cityKeys[c]];
      locations.push({
        city: city.name,
        state: state.name,
        abbr: state.abbr,
        url: "/states/" + state.slug + "/" + city.slug + "/",
        count: city.businesses.length
      });
    }
  }

  // Sort by business count descending so popular cities appear first
  locations.sort(function(a, b) { return b.count - a.count; });

  var locJS = "[\n";
  for (var i = 0; i < locations.length; i++) {
    var l = locations[i];
    locJS += '      {city:"' + l.city.replace(/"/g, '\\"') + '",state:"' + l.state + '",abbr:"' + l.abbr + '",url:"' + l.url + '"}';
    if (i < locations.length - 1) locJS += ",";
    locJS += "\n";
  }
  locJS += "    ]";

  var homepageHTML = fs.readFileSync(HOMEPAGE_FILE, "utf8");

  var startMarker = "var locations = [";
  var endMarker = "    ]";
  var startIdx = homepageHTML.indexOf(startMarker);
  if (startIdx === -1) {
    console.log("Warning: Could not find search locations in index.html.");
    return;
  }
  var endIdx = homepageHTML.indexOf(endMarker, startIdx);
  if (endIdx === -1) {
    console.log("Warning: Could not find end of search locations in index.html.");
    return;
  }

  homepageHTML = homepageHTML.substring(0, startIdx) + "var locations = " + locJS + homepageHTML.substring(endIdx + endMarker.length);

  fs.writeFileSync(HOMEPAGE_FILE, homepageHTML);
  console.log("Updated homepage search with " + locations.length + " cities.");
}

build();
