/**
 * EMMA'S PRETTY MOMMY — BACKEND (Google Apps Script)
 * Stores bookings, Makeup Madness votes, and your email list in a Google Sheet.
 * Setup: see SETUP_GUIDE.txt. You paste this whole file once and never touch it again.
 */

const NOTIFY_EMAIL = ""; // optional: leave blank to use the Google account that owns the Sheet

const TABS = {
  Matches:     ["id","round","creator_a","creator_b","status","youtube_votes_a","youtube_votes_b","winner","video_url"],
  Votes:       ["timestamp","match_id","choice","first_name","email","products_tried","email_optin"],
  Subscribers: ["timestamp","email","first_name","source"],
  Bookings:    ["timestamp","name","contact","instagram","service","date","time","location","party","notes","source","utm"]
};

// Run this ONE time from the editor (Run ▶ setup). It builds all tabs and the first bracket.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(name => {
    let sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(TABS[name]);
      sh.getRange(1, 1, 1, TABS[name].length).setFontWeight("bold");
      sh.setFrozenRows(1);
    }
  });
  const m = ss.getSheetByName("Matches");
  if (m.getLastRow() === 1) {
    [
      ["qf1","Quarterfinal","Next Door Diva","Brittney Fox","open",0,0,"",""],
      ["qf2","Quarterfinal","Robert Welsh","Johnny Ross","upcoming",0,0,"",""],
      ["qf3","Quarterfinal","The Makeup Chair","Nina Ubhi","upcoming",0,0,"",""],
      ["qf4","Quarterfinal","Alexandra Anele","Michelle K Doria","upcoming",0,0,"",""],
      ["sf1","Semifinal","","","upcoming",0,0,"",""],
      ["sf2","Semifinal","","","upcoming",0,0,"",""],
      ["final","Final","","","upcoming",0,0,"",""]
    ].forEach(r => m.appendRow(r));
  }
}

function doGet() {
  return json_({ ok: true, matches: matchesWithTotals_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || "{}");
    if (d.type === "booking") return booking_(d);
    if (d.type === "vote") return vote_(d);
    return json_({ ok: false, error: "Unknown request" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function booking_(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const clean = v => String(v || "").slice(0, 1000);
  ss.getSheetByName("Bookings").appendRow([new Date(), clean(d.name), clean(d.contact), clean(d.instagram),
    clean(d.service), clean(d.date), clean(d.time), clean(d.location), clean(d.party), clean(d.notes),
    clean(d.source), clean(d.utm)]);
  const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (to) {
    MailApp.sendEmail(to, "New booking request: " + clean(d.service) + " — " + clean(d.name),
      ["Name: " + d.name, "Contact: " + d.contact, "Instagram: " + d.instagram, "Service: " + d.service,
       "Date: " + d.date + " at " + d.time, "Location: " + d.location, "People: " + d.party,
       "Found you via: " + d.source + (d.utm ? " (" + d.utm + ")" : ""), "", "Notes:", d.notes].join("\n"));
  }
  return json_({ ok: true });
}

function vote_(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const email = String(d.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: "Please enter a valid email." });
  const match = matchesWithTotals_().find(m => m.id === d.match_id);
  if (!match || match.status !== "open") return json_({ ok: false, error: "Voting for this matchup is closed." });
  if (d.choice !== match.creator_a && d.choice !== match.creator_b) return json_({ ok: false, error: "Pick one of the two creators." });

  const votes = ss.getSheetByName("Votes").getDataRange().getValues();
  const already = votes.some((r, i) => i > 0 && r[1] === d.match_id && String(r[4]).toLowerCase() === email);
  if (already) return json_({ ok: false, error: "You already voted in this matchup. Come back next week!", matches: matchesWithTotals_() });

  ss.getSheetByName("Votes").appendRow([new Date(), d.match_id, d.choice, String(d.first_name || "").slice(0, 80),
    email, String(d.products || "").slice(0, 500), d.optin ? "yes" : "no"]);

  if (d.optin) {
    const subs = ss.getSheetByName("Subscribers").getDataRange().getValues();
    if (!subs.some((r, i) => i > 0 && String(r[1]).toLowerCase() === email)) {
      ss.getSheetByName("Subscribers").appendRow([new Date(), email, String(d.first_name || "").slice(0, 80), "makeup_madness"]);
    }
  }
  return json_({ ok: true, matches: matchesWithTotals_() });
}

// Total = website votes + the YouTube poll numbers you type into the Matches tab
function matchesWithTotals_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName("Matches").getDataRange().getValues().slice(1);
  const votes = ss.getSheetByName("Votes").getDataRange().getValues().slice(1);
  const list = rows.filter(r => r[0]).map(r => ({
    id: String(r[0]), round: String(r[1]), creator_a: String(r[2]), creator_b: String(r[3]),
    status: String(r[4]).trim().toLowerCase(), yt_a: Number(r[5]) || 0, yt_b: Number(r[6]) || 0,
    winner: String(r[7]), video_url: String(r[8])
  }));
  // Winners move up automatically: empty semifinal/final slots fill from earlier winners
  const get = id => list.find(m => m.id === id) || {};
  const feed = { sf1: ["qf1","qf2"], sf2: ["qf3","qf4"], final: ["sf1","sf2"] };
  ["sf1","sf2","final"].forEach(id => {
    const m = get(id);
    if (!m.id) return;
    if (!m.creator_a) m.creator_a = get(feed[id][0]).winner || "";
    if (!m.creator_b) m.creator_b = get(feed[id][1]).winner || "";
  });
  list.forEach(m => {
    m.total_a = m.yt_a + votes.filter(v => v[1] === m.id && v[2] === m.creator_a && m.creator_a).length;
    m.total_b = m.yt_b + votes.filter(v => v[1] === m.id && v[2] === m.creator_b && m.creator_b).length;
    delete m.yt_a; delete m.yt_b;
  });
  return list;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
