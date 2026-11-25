"""Import bounded Indian metro slices from the official FSQ OS Places Iceberg catalog."""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

import duckdb


ROOT = Path(__file__).resolve().parents[1]
PORTAL = "https://places.foursquare.com/dataset/OS%20Places/details"
RECEIPTS = ROOT / "data" / "local-business" / "foursquare-latest.json"
METROS = {
    "Mumbai": (72.805, 19.00, 72.985, 19.28),
    "Pune": (73.74, 18.43, 73.99, 18.65),
    "Bengaluru": (77.46, 12.84, 77.72, 13.11),
    "Hyderabad": (78.34, 17.30, 78.62, 17.53),
    "Kolkata": (88.24, 22.45, 88.49, 22.67),
    "Delhi": (77.07, 28.51, 77.365, 28.77),
    "Chennai": (80.13, 12.97, 80.34, 13.18),
}
CATEGORY = r"\b(dentist|dental clinic|clinic|restaurant|cafe|bakery|salon|barber|spa|boutique|gym|fitness|law firm|accountant|veterinarian|interior designer|auto repair|photography)\b"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def setting(key, path=ROOT / ".env.external"):
    if key in os.environ:
        return os.environ[key].strip()
    if not path.is_file():
        return ""
    for line in reversed(path.read_text(encoding="utf-8-sig").splitlines()):
        name, separator, value = line.partition("=")
        if separator and name.strip() == key:
            return value.strip().strip('"\'')
    return ""


def clean(text, maximum):
    return re.sub(r"[\x00-\x1f\x7f]", " ", text or "").strip()[:maximum] or None


def normalize(record, city):
    source_id = record["fsq_place_id"]
    name = clean(record["name"], 500)
    if not name or not isinstance(source_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{6,120}", source_id):
        return None
    website = clean(record["website"], 2000)
    try:
        url = urlsplit(website or "")
        if url.scheme not in {"https", "http"} or not url.hostname or url.username or url.password:
            website = None
    except ValueError:
        website = None
    email = clean(record["email"], 320)
    if email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        email = None
    labels = [clean(label, 120) for label in record["fsq_category_labels"] or []]
    title = next((label.rsplit(" > ", 1)[-1] for label in labels if label and re.search(CATEGORY, label, re.I)), None)
    return {"source_id": source_id, "name": name, "city": city, "country": "IN", "title": title,
            "address": clean(record["address"], 1000), "website": website, "email": email,
            "phone": clean(record["tel"], 200), "url": f"https://foursquare.com/placemakers/review-place/{source_id}",
            "location": {"lat": record["latitude"], "lng": record["longitude"]}}


def query_metro(db, city, limit):
    west, south, east, north = METROS[city]
    cursor = db.execute("""
        SELECT fsq_place_id, name, latitude, longitude, address, website, email, tel, fsq_category_labels,
               TRY_CAST(date_refreshed AS DATE) AS date_refreshed
        FROM places.datasets.places_os
        WHERE country = 'IN' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
          AND NULLIF(TRIM(date_closed), '') IS NULL AND TRY_CAST(date_refreshed AS DATE) >= CURRENT_DATE - INTERVAL '365 days'
          AND name IS NOT NULL
          AND regexp_matches(array_to_string(fsq_category_labels, ' '), ?, 'i')
        ORDER BY ((website IS NOT NULL)::INT + (email IS NOT NULL)::INT + (tel IS NOT NULL)::INT) DESC,
                 date_refreshed DESC, fsq_place_id
        LIMIT ?
    """, [south, north, west, east, CATEGORY, limit])
    names = [item[0] for item in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def import_metro(opener, worker, worker_key, city, records):
    rows = [row for record in records if (row := normalize(record, city)) is not None]
    if not rows:
        return {"city": city, "raw": len(records), "normalized": 0, "inserted": 0, "duplicates": 0, "rejected": 0}
    packed = json.dumps(rows, ensure_ascii=False, sort_keys=True).encode()
    digest = hashlib.sha256(packed).hexdigest()
    last_refresh = max(record["date_refreshed"] for record in records if record["date_refreshed"] is not None)
    manifest = {"source": "fsq_os", "release_id": f"fsq-os-slice-{last_refresh}-{digest[:12]}", "input_sha256": digest,
                "source_url": PORTAL, "license_id": "Apache-2.0", "attribution": "Foursquare Places Open Source Data, Foursquare Labs, Inc.",
                "retrieved_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    request = Request(worker + "/import/fsq_os", method="POST",
                      data=json.dumps({"leads": rows, "manifest": manifest}, ensure_ascii=False).encode(),
                      headers={"Content-Type": "application/json", "Authorization": f"Bearer {worker_key}"})
    with opener.open(request, timeout=90) as response:
        result = json.load(response)
    return {"city": city, "raw": len(records), "normalized": len(rows), "release": manifest["release_id"],
            **{field: result[field] for field in ("inserted", "duplicates", "rejected")}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("city", nargs="+", choices=[*METROS, "all"])
    parser.add_argument("--limit", type=int, default=50, choices=range(1, 151), metavar="1-150")
    parser.add_argument("--repeat-check", action="store_true", help="verify local import idempotence without querying again")
    args = parser.parse_args()
    portal_key = setting("FOURSQUARE_ICEBERG_TOKEN")
    worker_key = setting("EXTERNAL_LEADS_API_TOKEN") or setting("API_TOKEN", ROOT.parent / "leadflow-leads" / ".dev.vars")
    worker = setting("EXTERNAL_LEADS_API_ORIGIN") or "http://127.0.0.1:8787"
    if not re.fullmatch(r"[!-~]{20,5000}", portal_key):
        parser.error("Set FOURSQUARE_ICEBERG_TOKEN from the Places Portal in .env.external")
    if not worker_key or not re.fullmatch(r"http://127\.0\.0\.1:[1-9]\d{0,4}", worker) or int(worker.rsplit(":", 1)[1]) > 65535:
        parser.error("A local Worker origin and bearer token are required")
    opener = build_opener(ProxyHandler({}), NoRedirect)
    try:
        receipts = json.loads(RECEIPTS.read_text(encoding="utf-8")) if RECEIPTS.exists() else {}
        with duckdb.connect(config={"threads": "2", "memory_limit": "2GB"}) as db:
            db.execute("INSTALL httpfs; LOAD httpfs; INSTALL iceberg; LOAD iceberg;")
            db.execute("SET http_timeout=25; SET http_retries=1;")
            db.execute("CREATE SECRET fsq_iceberg (TYPE ICEBERG, TOKEN '" + portal_key.replace("'", "''") + "')")
            db.execute("ATTACH 'places' AS places (TYPE ICEBERG, SECRET fsq_iceberg, ENDPOINT 'https://catalog.h3-hub.foursquare.com/iceberg')")
            db.execute("DESCRIBE places.datasets.places_os")
            print(json.dumps({"catalog": "authenticated", "dataset": "places.datasets.places_os"}), flush=True)
            for city in METROS if "all" in args.city else dict.fromkeys(args.city):
                records = query_metro(db, city, args.limit)
                result = import_metro(opener, worker, worker_key, city, records)
                receipts[city] = {**result, "imported_at": datetime.now(timezone.utc).isoformat()}
                RECEIPTS.parent.mkdir(parents=True, exist_ok=True)
                temporary = RECEIPTS.with_suffix(f".{os.getpid()}.tmp")
                temporary.write_text(json.dumps(receipts), encoding="utf-8")
                temporary.replace(RECEIPTS)
                print(json.dumps(result), flush=True)
                if args.repeat_check and records:
                    repeat = import_metro(opener, worker, worker_key, city, records)
                    print(json.dumps({"repeat": True, **repeat}), flush=True)
                    if repeat["inserted"] or repeat["rejected"]:
                        raise RuntimeError("Repeated Foursquare slice failed the idempotency check")
    except Exception as error:
        failure = str(error).replace(portal_key, "<redacted>").replace(worker_key, "<redacted>")
        failure = re.sub(r"https?://\S+", "<url>", failure)
        raise SystemExit(f"{type(error).__name__}: {failure[:300]}") from None


if __name__ == "__main__":
    main()
