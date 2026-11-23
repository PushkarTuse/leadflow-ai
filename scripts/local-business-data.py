"""Resolve locations offline and read a geographically bounded Overture sample."""
import hashlib
import io
import json
import math
import re
import sys
import unicodedata
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

CACHE = Path("data/local-business/geonames")
DUMP = "https://download.geonames.org/export/dump/"
METROS = ["Mumbai", "Pune", "Bengaluru", "Hyderabad", "Kolkata", "Delhi", "Chennai"]
PLACE_TYPES = re.compile(
    r"dentist|dental|orthodon|clinic|physio|salon|barber|bakery|fitness|gym|"
    r"restaurant|cafe|hotel|accountant|lawyer|veterinar|plumber|electrician|"
    r"pet_groom|auto_repair|spa|photograph|interior_design"
)


def normal(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold()) if c.isalnum())


def load_dump(name, max_bytes):
    path = CACHE / name
    if path.exists():
        return path.read_bytes()
    CACHE.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(DUMP + name, timeout=35) as response:
        data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError("GeoNames file exceeded download limit")
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(data)
    temporary.replace(path)
    return data


def locations(query):
    countries = {}
    for line in load_dump("countryInfo.txt", 1_000_000).decode("utf-8").splitlines():
        if line.startswith("#") or not line:
            continue
        row = line.split("\t")
        for name in (row[0], row[1], row[4]):
            countries[normal(name)] = row[0]
    countries.update({"uk": "GB", "greatbritain": "GB", "usa": "US"})

    if query == "india-metros":
        terms = [(name, "IN") for name in METROS]
        country_only = None
    else:
        city, _, country = query.partition(",")
        country_only = countries.get(normal(city)) if not country else None
        region = countries.get(normal(country)) if country else None
        if country and not region:
            raise ValueError("Country qualifier not found")
        terms = [] if country_only else [(city, region)]

    with zipfile.ZipFile(io.BytesIO(load_dump("cities500.zip", 32_000_000))) as archive:
        with archive.open("cities500.txt") as source:
            rows = []
            for raw in source:
                row = raw.decode("utf-8").rstrip("\n").split("\t")
                if country_only and row[8] != country_only:
                    continue
                if terms:
                    names = {normal(row[1]), normal(row[2])}
                    exact = [index for index, (name, code) in enumerate(terms)
                             if (not code or code == row[8]) and normal(name) in names]
                    matched = exact or [index for index, (name, code) in enumerate(terms)
                                        if (not code or code == row[8])
                                        and any(normal(alias) == normal(name) for alias in row[3].split(","))]
                    for index in matched:
                        rows.append((index, int(row[14]), row))
                else:
                    rows.append((0, int(row[14]), row))

    selected = []
    for index in range(len(terms) or 1):
        hits = sorted([item for item in rows if item[0] == index], key=lambda item: item[1], reverse=True)
        for _, _, row in hits:
            lat, lng = float(row[4]), float(row[5])
            if not terms and any(abs(lat - city["lat"]) < .18 and abs(lng - city["lng"]) < .18 for city in selected):
                continue
            selected.append({"city": terms[index][0] if len(terms) > 1 else row[1],
                             "country": row[8], "lat": lat, "lng": lng})
            if terms or len(selected) == 3:
                break
    if not selected:
        raise ValueError("City or country not found in the GeoNames catalog")
    return selected, bool(country_only)


def overture(place, target):
    from overturemaps.core import get_latest_release, record_batch_reader
    release = get_latest_release()
    lat, lng = place["lat"], place["lng"]
    radius = .08
    width = min(.7, radius / max(.1, math.cos(math.radians(lat))))
    bounds = (max(-180, lng - width), max(-90, lat - radius),
              min(180, lng + width), min(90, lat + radius))
    reader = record_batch_reader("place", bounds, release, connect_timeout=10, request_timeout=30)
    rows = []
    names = set()
    if reader is None:
        raise RuntimeError("Overture reader unavailable")
    with reader:
        for batch in reader:
            fields = [key for key in ("id", "names", "basic_category", "categories", "taxonomy",
                                      "confidence", "operating_status", "addresses", "websites", "phones", "emails")
                      if key in batch.schema.names]
            for record in batch.select(fields).to_pylist():
                name = (record.get("names") or {}).get("primary")
                category = record.get("basic_category") or (record.get("categories") or {}).get("primary") or ""
                if not name or not PLACE_TYPES.search(category) or (record.get("confidence") or 0) < .6:
                    continue
                if record.get("operating_status") in ("permanently_closed", "temporarily_closed"):
                    continue
                address = (record.get("addresses") or [{}])[0]
                if address.get("country") and address["country"] != place["country"]:
                    continue
                key = (normal(name), address.get("freeform") or "")
                if key in names:
                    continue
                names.add(key)
                fields = {}
                for column, label, pattern in (
                    ("websites", "website", r"https?://[^\s]+"),
                    ("phones", "phone", r"\+?[\d() .-]{6,40}"),
                    ("emails", "email", r"[^\s@]+@[^\s@]+\.[^\s@]+"),
                ):
                    value = next((item for item in record.get(column) or [] if re.fullmatch(pattern, item)), None)
                    if value:
                        fields[label] = value
                rows.append({"source_id": record["id"], "name": name, "title": category.replace("_", " "),
                             "address": address.get("freeform"), "city": place["city"], "country": place["country"],
                             **fields})
                if len(rows) >= target:
                    break
            if len(rows) >= target:
                break
    records = json.dumps(rows, sort_keys=True, ensure_ascii=True)
    return {"manifest": {"source": "overture", "release_id": release,
            "source_url": "https://docs.overturemaps.org/guides/places/",
            "license_id": "Overture Places (see release attribution)",
            "attribution": "Overture Maps Foundation and Places contributors",
            "input_sha256": hashlib.sha256(records.encode()).hexdigest(),
            "retrieved_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}, "rows": rows}


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        if request["action"] == "resolve":
            places, sampled = locations(request["location"])
            result = {"locations": places, "countrySample": sampled}
        else:
            result = overture(request["place"], request["target"])
        print(json.dumps(result, ensure_ascii=True))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
