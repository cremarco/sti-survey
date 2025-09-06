#!/usr/bin/env python3
"""
Verify and complete DOIs in the STI survey dataset by querying Crossref.

Usage:
  python3 scripts/verify_dois.py [--write] [--limit N]

By default, runs in dry-run mode and prints a summary. Use --write to update
public/data/sti-survey.json in place (a time-stamped backup is created).

Notes:
  - Keeps DOI values in the dataset as full URLs (https://doi.org/...).
  - Verifies existing DOIs via Crossref and updates if clearly incorrect.
  - Fills missing DOIs by best-match title search with year/author checks.
"""

from __future__ import annotations

import argparse
import difflib
import io
import json
import os
import re
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    # Use stdlib to avoid external deps
    from urllib.parse import urlencode, quote
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
except Exception as e:
    print(f"Failed to import urllib: {e}", file=sys.stderr)
    sys.exit(1)


DATA_PATH = os.path.join("public", "data", "sti-survey.json")


def read_json(path: str) -> List[Dict[str, Any]]:
    with io.open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: str, data: Any) -> None:
    with io.open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")


def backup_file(path: str) -> str:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{path}.bak-{ts}"
    with io.open(path, "r", encoding="utf-8") as src, io.open(backup_path, "w", encoding="utf-8") as dst:
        dst.write(src.read())
    return backup_path


def normalize_title(s: str) -> str:
    s = s.lower()
    # Remove punctuation (keep word chars and whitespace) and collapse spaces
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def doi_to_url(doi: str) -> str:
    doi = doi.strip()
    if doi.startswith("http://") or doi.startswith("https://"):
        return re.sub(r"^https?://(dx\.)?doi\.org/", "https://doi.org/", doi)
    return f"https://doi.org/{doi}"


def url_to_doi(url: str) -> str:
    url = url.strip()
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", url)


def http_get_json(url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 15) -> Optional[Dict[str, Any]]:
    req = Request(url, headers=headers or {"User-Agent": "sti-doi-verifier/1.0 (+https://example.org)"})
    try:
        with urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return None
            data = resp.read()
            return json.loads(data.decode("utf-8"))
    except HTTPError as e:
        if e.code == 404:
            return None
        return None
    except URLError:
        return None


def doi_resolves(doi: str, timeout: int = 15) -> bool:
    """Return True if the DOI resolves via doi.org (any 2xx/3xx)."""
    url = doi_to_url(doi)
    try:
        req = Request(url, headers={"User-Agent": "sti-doi-verifier/1.0"})
        # We don't need the body; a request is enough to see status
        with urlopen(req, timeout=timeout) as resp:
            return 200 <= resp.status < 400
    except HTTPError as e:
        return 200 <= e.code < 400
    except URLError:
        return False


def crossref_get_by_doi(doi: str) -> Optional[Dict[str, Any]]:
    doi = url_to_doi(doi)
    url = f"https://api.crossref.org/works/{quote(doi)}"
    return http_get_json(url)


def extract_year(msg: Dict[str, Any]) -> Optional[int]:
    parts = (
        msg.get("issued") or msg.get("published") or msg.get("published-print") or msg.get("created")
    )
    if isinstance(parts, dict):
        dp = parts.get("\n        date-parts") or parts.get("date-parts")
        if isinstance(dp, list) and dp and isinstance(dp[0], list) and dp[0]:
            y = dp[0][0]
            if isinstance(y, int):
                return y
    return None


def authors_lastnames_from_crossref(msg: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    for a in msg.get("author", []) or []:
        name = a.get("family") or a.get("name") or ""
        if not name:
            # Compose from given/family if available
            given = a.get("given") or ""
            family = a.get("family") or ""
            name = f"{given} {family}".strip()
        if name:
            out.append(name.split()[-1].lower())
    return out


def authors_lastnames(authors: List[str]) -> List[str]:
    out = []
    for s in authors or []:
        if not s:
            continue
        out.append(s.split()[-1].lower())
    return out


def similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b).ratio()


def crossref_search_best(title: str, year: Optional[int], first_author_last: Optional[str]) -> Optional[Tuple[str, Dict[str, Any], float]]:
    if not title:
        return None
    params = {
        "query.title": title,
        "rows": 10,
        "select": "DOI,title,author,issued,container-title,type",
        # weight title more than container
        "sort": "score",
        "order": "desc",
    }
    url = f"https://api.crossref.org/works?{urlencode(params)}"
    data = http_get_json(url)
    if not data or "message" not in data or "items" not in data["message"]:
        return None

    norm_title = normalize_title(title)
    best: Optional[Tuple[str, Dict[str, Any], float]] = None
    for it in data["message"]["items"]:
        cand_titles = it.get("title") or []
        if not cand_titles:
            continue
        cand_title = cand_titles[0]
        score = similarity(norm_title, normalize_title(cand_title))

        # Year proximity bonus
        cand_year = extract_year(it)
        if year is not None and cand_year is not None and abs(cand_year - year) <= 1:
            score += 0.05

        # First author match bonus
        if first_author_last:
            cr_authors = authors_lastnames_from_crossref(it)
            if any(first_author_last == ln for ln in cr_authors):
                score += 0.05

        if best is None or score > best[2]:
            doi = it.get("DOI")
            if doi:
                best = (doi, it, score)

    return best


def verify_existing_doi(entry: Dict[str, Any], verbose: bool = False) -> Tuple[bool, Optional[str], str]:
    """
    Returns (ok, corrected_doi, note)
    - ok: True if DOI verified as matching metadata
    - corrected_doi: a DOI string to replace (full URL) if we think existing is wrong
    - note: diagnostic string
    """
    doi_url = entry.get("doi")
    if not doi_url:
        return (False, None, "missing")

    res = crossref_get_by_doi(doi_url)
    if not res or "message" not in res:
        # Not in Crossref. If the DOI resolves via doi.org (e.g., DataCite/Zenodo), accept it.
        if doi_resolves(doi_url):
            return (True, None, "verified via doi.org resolver (non-Crossref DOI)")
        # Otherwise try to find a better one by search
        best = crossref_search_best(entry.get("title", ""), entry.get("year"), (entry.get("firstAuthor") or "").split()[-1].lower() if entry.get("firstAuthor") else None)
        if best:
            return (False, doi_to_url(best[0]), "unresolvable → replacing with search best match")
        return (False, None, "unresolvable")

    msg = res["message"]
    cr_title = (msg.get("title") or [""])[0]
    cr_year = extract_year(msg)
    cr_authors = authors_lastnames_from_crossref(msg)

    ratio = similarity(normalize_title(entry.get("title", "")), normalize_title(cr_title))
    year_ok = (entry.get("year") is None) or (cr_year is None) or abs(int(entry.get("year")) - cr_year) <= 1
    first_author = (entry.get("firstAuthor") or "").split()[-1].lower() if entry.get("firstAuthor") else None
    author_ok = (first_author is None) or (first_author in cr_authors)

    if ratio >= 0.85 and year_ok and author_ok:
        return (True, None, f"verified (title≈{ratio:.2f}{', year' if year_ok else ''}{', author' if author_ok else ''})")

    # Try a search to see if there's a better match
    best = crossref_search_best(entry.get("title", ""), entry.get("year"), first_author)
    if best and best[2] >= max(0.84, ratio + 0.10):
        return (False, doi_to_url(best[0]), f"mismatch (title≈{ratio:.2f}) → replacing with better match (score={best[2]:.2f})")
    # If extremely weak match, clear the DOI
    if ratio < 0.60 or not year_ok or not author_ok:
        return (False, "", f"clearing mismatched DOI (title≈{ratio:.2f}{', year!' if not year_ok else ''}{', author!' if not author_ok else ''})")

    return (True, None, f"verified weakly (title≈{ratio:.2f})")


def process(entries: List[Dict[str, Any]], limit: Optional[int] = None) -> Tuple[List[Dict[str, Any]], List[str]]:
    changes: List[str] = []
    updated: List[Dict[str, Any]] = []

    count = 0
    for entry in entries:
        if limit is not None and count >= limit:
            updated.append(entry)
            continue

        entry_id = entry.get("id") or entry.get("title", "<no-title>")
        title = entry.get("title") or ""
        year = entry.get("year")
        authors = entry.get("authors") or []
        first_author_last = authors_lastnames(authors)[:1]
        first_author_last = first_author_last[0] if first_author_last else (entry.get("firstAuthor") or "").split()[-1].lower() if entry.get("firstAuthor") else None

        doi_url = entry.get("doi")
        if doi_url:
            ok, corrected, note = verify_existing_doi(entry)
            if ok:
                changes.append(f"{entry_id}: DOI ok — {note}")
            else:
                if corrected is not None and corrected != doi_url:
                    old = doi_url
                    entry["doi"] = corrected
                    if corrected == "":
                        changes.append(f"{entry_id}: DOI cleared ({note})")
                    else:
                        changes.append(f"{entry_id}: DOI updated {old} → {corrected} ({note})")
                else:
                    changes.append(f"{entry_id}: DOI unresolved ({note})")
        else:
            # Missing DOI: search
            best = crossref_search_best(title, year, first_author_last)
            if best and best[2] >= 0.84:
                doi = doi_to_url(best[0])
                entry["doi"] = doi
                changes.append(f"{entry_id}: DOI added {doi} (score={best[2]:.2f})")
            elif best and best[2] >= 0.78 and year is not None:
                # Relax threshold a bit if year matches
                cr_year = extract_year(best[1])
                if cr_year is not None and abs(cr_year - year) <= 1:
                    doi = doi_to_url(best[0])
                    entry["doi"] = doi
                    changes.append(f"{entry_id}: DOI added {doi} (score={best[2]:.2f}, year≈)")
                else:
                    changes.append(f"{entry_id}: candidate below threshold (score={best[2]:.2f})")
            else:
                changes.append(f"{entry_id}: DOI not found")

        updated.append(entry)
        count += 1
        time.sleep(0.25)  # be polite to API

    return updated, changes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="Write changes back to dataset")
    ap.add_argument("--limit", type=int, default=None, help="Only process first N entries")
    args = ap.parse_args()

    if not os.path.exists(DATA_PATH):
        print(f"Dataset not found: {DATA_PATH}", file=sys.stderr)
        return 2

    entries = read_json(DATA_PATH)
    updated, changes = process(entries, limit=args.limit)

    print("\n".join(changes))

    if args.write:
        backup = backup_file(DATA_PATH)
        write_json(DATA_PATH, updated)
        print(f"\nUpdated file written to {DATA_PATH} (backup: {backup})")
    else:
        print("\nDry-run complete. Use --write to persist changes.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
