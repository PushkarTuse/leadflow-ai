"""Stream one permitted regional OSM PBF into the local Worker as ODbL observations."""
import argparse
import hashlib
import heapq
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import re
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

import osmium


CATEGORIES = {
    "amenity": {"dentist", "clinic", "restaurant", "cafe", "veterinary"},
    "shop": {"bakery", "hairdresser", "beauty", "car_repair", "clothes"},
    "leisure": {"fitness_centre"},
    "office": {"lawyer", "accountant", "estate_agent"},
}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def value(text, length):
    return re.sub(r"[\x00-\x1f\x7f]", " ", text or "").strip()[:length] or None


class BusinessNodes:
    def __init__(self, args):
        self.args = args
        self.rows = []
        self.ranked = []

    def node(self, node):
        if not node.location.valid():
            return
        west, south, east, north = self.args.bbox
        lat, lng = node.location.lat, node.location.lon
        if not west <= lng <= east or not south <= lat <= north:
            return
        tags = node.tags
        name = value(tags.get("name"), 500)
        category = next((tags.get(key) for key, choices in CATEGORIES.items() if tags.get(key) in choices), None)
        if not name or not category or tags.get("disused") == "yes" or tags.get("closed") == "yes":
            return
        site = value(tags.get("contact:website") or tags.get("website"), 1500)
        try:
            parsed = urlsplit(site or "")
            if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password:
                site = None
        except ValueError:
            site = None
        email = value(tags.get("contact:email") or tags.get("email"), 320)
        if email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            email = None
        source_id = f"node/{node.id}"
        row = {
            "source_id": source_id, "name": name, "title": category.replace("_", " "), "city": self.args.city,
            "country": self.args.country, "website": site, "email": email,
            "phone": value(tags.get("contact:phone") or tags.get("phone"), 175),
            "address": value(", ".join(v for key in ("addr:housenumber", "addr:street", "addr:suburb", "addr:postcode") if (v := tags.get(key))), 1000),
            "url": f"https://www.openstreetmap.org/{source_id}", "location": {"lat": lat, "lng": lng},
            "tags": [f"{key}={item}"[:100] for key in ("brand", "brand:wikidata", "operator") if (item := value(tags.get(key), 100))],
        }
        if not self.args.prioritize_identifiable:
            self.rows.append(row)
            return
        # These publisher fields are collection hints. Enrichment verifies the business and contact separately.
        hints = 3 * bool(row["website"]) + 2 * bool(row["phone"]) + bool(row["email"]) + bool(row["address"])
        entry = (hints, -node.id, row)
        if len(self.ranked) < self.args.limit:
            heapq.heappush(self.ranked, entry)
        elif entry[:2] > self.ranked[0][:2]:
            heapq.heapreplace(self.ranked, entry)


def main():
    parse = argparse.ArgumentParser(description=__doc__)
    parse.add_argument("file", type=Path)
    parse.add_argument("--source-url", required=True)
    parse.add_argument("--release", required=True)
    parse.add_argument("--city", required=True)
    parse.add_argument("--country", default="IN")
    parse.add_argument("--bbox", required=True, nargs=4, type=float, metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    parse.add_argument("--limit", type=int, default=80)
    parse.add_argument("--prioritize-identifiable", action="store_true",
                       help="prefer records with public website, telephone, email, or address hints")
    args = parse.parse_args()
    west, south, east, north = args.bbox
    if not -180 <= west < east <= 180 or not -90 <= south < north <= 90 or not 1 <= args.limit <= 500:
        parse.error("invalid bounding box or limit (1–500)")
    origin = os.getenv("EXTERNAL_LEADS_API_ORIGIN", "http://127.0.0.1:8787")
    if not re.fullmatch(r"http://127\.0\.0\.1:[1-9]\d{0,4}", origin) or int(origin.rsplit(":", 1)[1]) > 65535:
        parse.error("the Worker must be on loopback")
    token = os.getenv("EXTERNAL_LEADS_API_TOKEN")
    if not token:
        private_config = Path(__file__).resolve().parents[2] / "leadflow-leads" / ".dev.vars"
        line = next((line for line in private_config.read_text(encoding="utf-8-sig").splitlines() if line.startswith("API_TOKEN=")), "")
        token = line.partition("=")[2].strip().strip('"\'')
    if not token:
        parse.error("Local Worker bearer token missing")
    with args.file.open("rb") as source:
        digest = hashlib.file_digest(source, "sha256").hexdigest()
    business = BusinessNodes(args)
    category_tags = [(key, category) for key, categories in CATEGORIES.items() for category in categories]
    nodes = osmium.FileProcessor(str(args.file), osmium.osm.NODE).with_filter(osmium.filter.TagFilter(*category_tags))
    for node in nodes:
        business.node(node)
        if not args.prioritize_identifiable and len(business.rows) >= args.limit:
            break
    rows = [row for _, _, row in sorted(business.ranked, reverse=True)] if args.prioritize_identifiable else business.rows
    if not rows:
        raise SystemExit("No named business nodes matched the city bounds and categories")
    manifest = {"source": "osm", "release_id": args.release, "input_sha256": digest, "source_url": args.source_url,
                "license_id": "ODbL-1.0", "attribution": "© OpenStreetMap contributors, https://www.openstreetmap.org/copyright",
                "retrieved_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    request = Request(origin + "/import/osm", data=json.dumps({"leads": rows, "manifest": manifest}).encode(),
                      headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="POST")
    with build_opener(ProxyHandler({}), NoRedirect).open(request, timeout=35) as response:
        result = json.load(response)
    print(json.dumps({key: result[key] for key in ("source", "received", "fetched", "inserted", "duplicates", "rejected")}))


if __name__ == "__main__":
    main()
