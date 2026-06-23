#!/usr/bin/env python3
"""
Indian Calendar — Web Edition (Flask)
--------------------------------------------------------------
Same holiday/event logic as the original Tkinter app, served as a
small JSON API + a single polished HTML/CSS/JS frontend. Because it's
a web app, anyone on your network can open it in a browser on their
own phone/laptop by visiting http://<your-ip>:5000

Run:
    python app.py

Requires: Flask (pip install flask)
Events are saved to indian_calendar_events.json next to this file.
"""

import json
import os
import uuid
import calendar as cal
from datetime import date, timedelta
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "indian_calendar_events.json")

# ───────────────────────── Persistence ─────────────────────────

def load_events():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except (json.JSONDecodeError, OSError):
            pass
    return []


def save_events(events):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2, ensure_ascii=False)
    except OSError as e:
        print(f"Failed to save events: {e}")


# ───────────────────────── Holiday Data ─────────────────────────

FIXED_HOLIDAYS = [
    (1, 1, "New Year's Day", "national", "government"),
    (1, 14, "Makar Sankranti / Pongal", "national", "hindu"),
    (1, 23, "Netaji Subhas Chandra Bose Jayanti", "optional", "government"),
    (1, 26, "Republic Day", "national", "government"),
    (4, 14, "Dr. Ambedkar Jayanti", "national", "government"),
    (5, 1, "Maharashtra Day / May Day", "optional", "government"),
    (8, 15, "Independence Day", "national", "government"),
    (10, 2, "Gandhi Jayanti", "national", "government"),
    (12, 25, "Christmas Day", "national", "christian"),
]

LUNAR_HOLIDAYS = {
    2024: [(3, 8, "Maha Shivaratri", "national", "hindu"), (3, 25, "Holi", "national", "hindu"),
           (4, 11, "Eid al-Fitr", "national", "muslim"), (6, 17, "Eid al-Adha", "national", "muslim"),
           (7, 7, "Muharram", "national", "muslim"), (4, 17, "Ram Navami", "national", "hindu"),
           (4, 21, "Mahavir Jayanti", "national", "jain"), (5, 23, "Buddha Purnima", "optional", "buddhist"),
           (9, 16, "Milad-un-Nabi", "national", "muslim"), (7, 21, "Guru Purnima", "optional", "hindu"),
           (8, 19, "Raksha Bandhan", "optional", "hindu"), (8, 26, "Janmashtami", "national", "hindu"),
           (9, 7, "Ganesh Chaturthi", "national", "hindu"), (9, 15, "Onam", "optional", "hindu"),
           (10, 12, "Dussehra", "national", "hindu"), (11, 1, "Diwali", "national", "hindu"),
           (11, 15, "Guru Nanak Jayanti", "national", "sikh")],
    2025: [(2, 26, "Maha Shivaratri", "national", "hindu"), (3, 14, "Holi", "national", "hindu"),
           (3, 31, "Eid al-Fitr", "national", "muslim"), (6, 7, "Eid al-Adha", "national", "muslim"),
           (6, 27, "Muharram", "national", "muslim"), (4, 6, "Ram Navami", "national", "hindu"),
           (4, 10, "Mahavir Jayanti", "national", "jain"), (5, 12, "Buddha Purnima", "optional", "buddhist"),
           (9, 4, "Milad-un-Nabi", "national", "muslim"), (7, 10, "Guru Purnima", "optional", "hindu"),
           (8, 9, "Raksha Bandhan", "optional", "hindu"), (8, 16, "Janmashtami", "national", "hindu"),
           (8, 27, "Ganesh Chaturthi", "national", "hindu"), (9, 5, "Onam", "optional", "hindu"),
           (10, 2, "Dussehra", "national", "hindu"), (10, 20, "Diwali", "national", "hindu"),
           (11, 5, "Guru Nanak Jayanti", "national", "sikh")],
    2026: [(2, 15, "Maha Shivaratri", "national", "hindu"), (3, 4, "Holi", "national", "hindu"),
           (3, 20, "Eid al-Fitr", "national", "muslim"), (5, 27, "Eid al-Adha", "national", "muslim"),
           (6, 17, "Muharram", "national", "muslim"),(6, 26, "Muharram", "national", "muslim"), (3, 27, "Ram Navami", "national", "hindu"),
           (3, 31, "Mahavir Jayanti", "national", "jain"), (5, 1, "Buddha Purnima", "optional", "buddhist"),
           (8, 25, "Milad-un-Nabi", "national", "muslim"), (6, 29, "Guru Purnima", "optional", "hindu"),
           (8, 28, "Raksha Bandhan", "optional", "hindu"), (9, 4, "Janmashtami", "national", "hindu"),
           (9, 14, "Ganesh Chaturthi", "national", "hindu"), (8, 25, "Onam", "optional", "hindu"),
           (10, 20, "Dussehra", "national", "hindu"), (11, 8, "Diwali", "national", "hindu"),
           (11, 24, "Guru Nanak Jayanti", "national", "sikh")],
    2027: [(2, 5, "Maha Shivaratri", "national", "hindu"), (3, 22, "Holi", "national", "hindu"),
           (3, 10, "Eid al-Fitr", "national", "muslim"), (5, 17, "Eid al-Adha", "national", "muslim"),
           (6, 7, "Muharram", "national", "muslim"), (4, 15, "Ram Navami", "national", "hindu"),
           (4, 19, "Mahavir Jayanti", "national", "jain"), (5, 20, "Buddha Purnima", "optional", "buddhist"),
           (8, 14, "Milad-un-Nabi", "national", "muslim"), (7, 18, "Guru Purnima", "optional", "hindu"),
           (8, 17, "Raksha Bandhan", "optional", "hindu"), (8, 24, "Janmashtami", "national", "hindu"),
           (9, 5, "Ganesh Chaturthi", "national", "hindu"), (9, 13, "Onam", "optional", "hindu"),
           (10, 9, "Dussehra", "national", "hindu"), (10, 29, "Diwali", "national", "hindu"),
           (11, 13, "Guru Nanak Jayanti", "national", "sikh")],
    2028: [(3, 10, "Maha Shivaratri", "national", "hindu"), (3, 11, "Holi", "national", "hindu"),
           (1, 28, "Eid al-Fitr", "national", "muslim"), (4, 5, "Eid al-Adha", "national", "muslim"),
           (4, 26, "Muharram", "national", "muslim"), (4, 2, "Ram Navami", "national", "hindu"),
           (4, 7, "Mahavir Jayanti", "national", "jain"), (5, 8, "Buddha Purnima", "optional", "buddhist"),
           (8, 2, "Milad-un-Nabi", "national", "muslim"), (7, 6, "Guru Purnima", "optional", "hindu"),
           (8, 5, "Raksha Bandhan", "optional", "hindu"), (8, 12, "Janmashtami", "national", "hindu"),
           (8, 22, "Ganesh Chaturthi", "national", "hindu"), (8, 31, "Onam", "optional", "hindu"),
           (9, 26, "Dussehra", "national", "hindu"), (10, 16, "Diwali", "national", "hindu"),
           (11, 1, "Guru Nanak Jayanti", "national", "sikh"), (12, 17, "Eid al-Fitr", "national", "muslim")],
    2029: [(2, 27, "Maha Shivaratri", "national", "hindu"), (3, 30, "Holi", "national", "hindu"),
           (12, 6, "Eid al-Fitr", "national", "muslim"), (3, 25, "Eid al-Adha", "national", "muslim"),
           (4, 15, "Muharram", "national", "muslim"), (4, 22, "Ram Navami", "national", "hindu"),
           (4, 26, "Mahavir Jayanti", "national", "jain"), (5, 27, "Buddha Purnima", "optional", "buddhist"),
           (7, 22, "Milad-un-Nabi", "national", "muslim"), (7, 25, "Guru Purnima", "optional", "hindu"),
           (8, 24, "Raksha Bandhan", "optional", "hindu"), (8, 31, "Janmashtami", "national", "hindu"),
           (9, 10, "Ganesh Chaturthi", "national", "hindu"), (9, 20, "Onam", "optional", "hindu"),
           (10, 15, "Dussehra", "national", "hindu"), (11, 4, "Diwali", "national", "hindu"),
           (11, 20, "Guru Nanak Jayanti", "national", "sikh")],
    2030: [(2, 16, "Maha Shivaratri", "national", "hindu"), (3, 19, "Holi", "national", "hindu"),
           (11, 26, "Eid al-Fitr", "national", "muslim"), (3, 14, "Eid al-Adha", "national", "muslim"),
           (4, 4, "Muharram", "national", "muslim"), (4, 11, "Ram Navami", "national", "hindu"),
           (4, 16, "Mahavir Jayanti", "national", "jain"), (5, 16, "Buddha Purnima", "optional", "buddhist"),
           (7, 12, "Milad-un-Nabi", "national", "muslim"), (7, 14, "Guru Purnima", "optional", "hindu"),
           (8, 13, "Raksha Bandhan", "optional", "hindu"), (8, 20, "Janmashtami", "national", "hindu"),
           (8, 30, "Ganesh Chaturthi", "national", "hindu"), (9, 9, "Onam", "optional", "hindu"),
           (10, 5, "Dussehra", "national", "hindu"), (10, 24, "Diwali", "national", "hindu"),
           (11, 8, "Guru Nanak Jayanti", "national", "sikh")],
}


def good_friday(year):
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    easter = date(year, month, day)
    return easter - timedelta(days=2)


CATEGORY_COLORS = {
    "hindu":      {"bg": "#3a1f15", "fg": "#ffab91", "label": "Hindu"},
    "muslim":     {"bg": "#0f2a30", "fg": "#80deea", "label": "Muslim"},
    "christian":  {"bg": "#2a1530", "fg": "#ce93d8", "label": "Christian"},
    "sikh":       {"bg": "#332a10", "fg": "#ffe082", "label": "Sikh"},
    "buddhist":   {"bg": "#331f0a", "fg": "#ffb74d", "label": "Buddhist"},
    "jain":       {"bg": "#1f2a15", "fg": "#c5e1a5", "label": "Jain"},
    "government": {"bg": "#102a1a", "fg": "#69f0ae", "label": "Government"},
}

EVENT_TYPES = {
    "event":    {"icon": "📌", "label": "Event", "color": "#9c6dff"},
    "birthday": {"icon": "🎂", "label": "Birthday", "color": "#ff6b9d"},
    "exam":     {"icon": "📝", "label": "Exam", "color": "#ff5252"},
    "note":     {"icon": "📋", "label": "Note", "color": "#4fc3f7"},
}

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]


def build_holidays(year):
    """Returns {iso_date_str: {name, type, religion}}"""
    items = {}
    for m, d, name, htype, religion in FIXED_HOLIDAYS:
        try:
            items[date(year, m, d).isoformat()] = {"name": name, "type": htype, "religion": religion}
        except ValueError:
            pass
    gf = good_friday(year)
    items.setdefault(gf.isoformat(), {"name": "Good Friday", "type": "national", "religion": "christian"})
    for m, d, name, htype, religion in LUNAR_HOLIDAYS.get(year, []):
        try:
            key = date(year, m, d).isoformat()
            if key not in items or items[key]["type"] != "national":
                items[key] = {"name": name, "type": htype, "religion": religion}
        except ValueError:
            pass
    return items


# ───────────────────────── Routes ─────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/meta")
def api_meta():
    return jsonify({
        "category_colors": CATEGORY_COLORS,
        "event_types": EVENT_TYPES,
        "month_names": MONTH_NAMES,
        "today": date.today().isoformat(),
    })


@app.route("/api/holidays/<int:year>")
def api_holidays(year):
    return jsonify(build_holidays(year))


@app.route("/api/events", methods=["GET"])
def api_events_list():
    return jsonify(load_events())


@app.route("/api/events", methods=["POST"])
def api_events_create():
    events = load_events()
    payload = request.get_json(force=True)
    ev = {
        "id": str(uuid.uuid4()),
        "date": payload["date"],
        "type": payload.get("type", "event"),
        "title": payload["title"].strip(),
        "desc": payload.get("desc", "").strip(),
        "time": payload.get("time", "").strip(),
        "repeatYearly": bool(payload.get("repeatYearly", False)),
    }
    if not ev["title"]:
        return jsonify({"error": "Title is required"}), 400
    events.append(ev)
    save_events(events)
    return jsonify(ev), 201


@app.route("/api/events/<ev_id>", methods=["PUT"])
def api_events_update(ev_id):
    events = load_events()
    payload = request.get_json(force=True)
    found = False
    for e in events:
        if e["id"] == ev_id:
            e["date"] = payload.get("date", e["date"])
            e["type"] = payload.get("type", e["type"])
            e["title"] = payload.get("title", e["title"]).strip()
            e["desc"] = payload.get("desc", e.get("desc", "")).strip()
            e["time"] = payload.get("time", e.get("time", "")).strip()
            e["repeatYearly"] = bool(payload.get("repeatYearly", e.get("repeatYearly", False)))
            found = True
            break
    if not found:
        return jsonify({"error": "Not found"}), 404
    save_events(events)
    return jsonify({"ok": True})


@app.route("/api/events/<ev_id>", methods=["DELETE"])
def api_events_delete(ev_id):
    events = load_events()
    events = [e for e in events if e["id"] != ev_id]
    save_events(events)
    return jsonify({"ok": True})


if __name__ == "__main__":
    # host="0.0.0.0" makes it reachable from other devices on your network
    app.run(host="0.0.0.0", port=5000, debug=True)