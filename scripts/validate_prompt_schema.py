#!/usr/bin/env python3
"""
Validate public/data/sti-survey.json against the prompt.md constraints.

Checks performed (non-exhaustive, but practical):
- id format: YYYY_surname_first-word-of-title (lowercase)
- id.year == year; id.surname matches firstAuthor (case-insensitive)
- authors[0] surname equals firstAuthor
- venue.type in {conference,journal,workshop}; acronym is string
- techniqueTags subset of allowed set
- mainMethod.type in {hybrid,supervised,unsupervised}; supervision only if supervised
- revision.type in {fully automated, semi automated, none}
- domain.domain in {dependent, independent}; if dependent -> domain.type non-empty
- inputs.tableSources entries in allowed set; typeOfTable string
- doi starts with https://doi.org/
- checkedByAi is True
- checkedByAuthor is a string (per prompt)
- citations[*].ref is slug or empty string
- Cross-field: supportTasks fields only filled if respective coreTasks true
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any

DATA_PATH = Path("public/data/sti-survey.json")

ALLOWED_TECH_TAGS = {"rule-based", "SVM", "CRF", "clustering", "embeddings", "ontology-driven", "transformer"}
ALLOWED_VENUE_TYPES = {"conference", "journal", "workshop"}
ALLOWED_MM_TYPES = {"hybrid", "supervised", "unsupervised"}
ALLOWED_REV_TYPES = {"fully automated", "semi automated", "none"}
ALLOWED_DOMAIN = {"dependent", "independent"}
ALLOWED_SOURCES = {"web", "pdf", "spreadsheet", "relational", "scientific", "wiki", "gov-open-data"}

slug_re = re.compile(r"^(\d{4})_([a-z0-9]+)_([a-z0-9][a-z0-9-]*)$")
doi_re = re.compile(r"^https://doi\.org/.+", re.I)


def surname_of(full_name: str) -> str:
    parts = [p for p in re.split(r"\s+", full_name.strip()) if p]
    return parts[-1] if parts else ""


def validate_entry(e: Dict[str, Any], idx: int) -> List[str]:
    issues: List[str] = []

    # id format and coherence
    idv = e.get("id", "")
    m = slug_re.match(idv)
    if not m:
        issues.append("id: invalid slug format")
    else:
        year_s, surname_slug, first_word = m.groups()
        # year match
        if isinstance(e.get("year"), int):
            if str(e["year"]) != year_s:
                issues.append("id/year: mismatch")
        else:
            issues.append("year: not an integer")
        # firstAuthor match
        fa = e.get("firstAuthor", "")
        if not fa:
            issues.append("firstAuthor: missing")
        else:
            if fa.lower() != surname_slug:
                issues.append("id/firstAuthor: surname mismatch")

    # authors coherence
    authors = e.get("authors")
    if not isinstance(authors, list) or not authors:
        issues.append("authors: missing or empty")
    else:
        fa = e.get("firstAuthor", "")
        if fa and surname_of(authors[0]).lower() != fa.lower():
            issues.append("authors[0]/firstAuthor: mismatch")

    # venue
    venue = e.get("venue", {})
    vtype = venue.get("type")
    if vtype not in ALLOWED_VENUE_TYPES:
        issues.append("venue.type: invalid")
    if not isinstance(venue.get("acronym", ""), str):
        issues.append("venue.acronym: invalid type")

    # techniqueTags
    tags = e.get("techniqueTags", [])
    if not isinstance(tags, list) or not set(tags).issubset(ALLOWED_TECH_TAGS):
        issues.append("techniqueTags: contains invalid tag(s)")

    # mainMethod
    mm = e.get("mainMethod", {})
    mm_type = mm.get("type")
    if mm_type not in ALLOWED_MM_TYPES:
        issues.append("mainMethod.type: invalid")
    if mm_type != "supervised" and "supervision" in mm:
        issues.append("mainMethod.supervision: present but not supervised")

    # revision
    rev = e.get("revision", {})
    if rev.get("type") not in ALLOWED_REV_TYPES:
        issues.append("revision.type: invalid")

    # domain
    dom = e.get("domain", {})
    domd = dom.get("domain")
    if domd not in ALLOWED_DOMAIN:
        issues.append("domain.domain: invalid")
    if domd == "dependent" and not dom.get("type"):
        issues.append("domain.type: empty while dependent")

    # inputs
    inputs = e.get("inputs", {})
    if not isinstance(inputs.get("typeOfTable", ""), str):
        issues.append("inputs.typeOfTable: invalid type")
    srcs = inputs.get("tableSources", [])
    if not isinstance(srcs, list) or not set(srcs).issubset(ALLOWED_SOURCES):
        issues.append("inputs.tableSources: invalid values")

    # doi
    doi = e.get("doi", "")
    if doi and not doi_re.match(doi):
        issues.append("doi: not canonical https://doi.org/")

    # checks
    if e.get("checkedByAi") is not True:
        issues.append("checkedByAi: must be true")
    # prompt requires checkedByAuthor as empty string
    if not isinstance(e.get("checkedByAuthor", ""), str):
        issues.append("checkedByAuthor: must be empty string per prompt")

    # citations
    cits = e.get("citations", [])
    if not isinstance(cits, list) or not cits:
        issues.append("citations: missing or empty")
    else:
        for j, c in enumerate(cits):
            ref = c.get("ref", "")
            if ref != "" and not slug_re.match(ref):
                issues.append(f"citations[{j}].ref: invalid slug")

    # cross-field supportTasks vs coreTasks
    ct = e.get("coreTasks", {})
    st = e.get("supportTasks", {})
    if isinstance(st, dict) and isinstance(ct, dict):
        if not ct.get("cta", False) and st.get("typeAnnotation", ""):
            issues.append("supportTasks.typeAnnotation present but cta=false")
        if not ct.get("cpa", False) and st.get("predicateAnnotation", ""):
            issues.append("supportTasks.predicateAnnotation present but cpa=false")
        el = st.get("entityLinking", {}) if isinstance(st.get("entityLinking"), dict) else {}
        if not ct.get("cea", False) and any(el.get(k, "") for k in ("description", "candidateGeneration", "entityDisambiguation")):
            issues.append("supportTasks.entityLinking filled but cea=false")
        if not ct.get("cnea", False) and st.get("nilAnnotation", ""):
            issues.append("supportTasks.nilAnnotation present but cnea=false")

    return issues


def main():
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("Expected a list of entries")
        raise SystemExit(2)

    total = len(data)
    problems = 0
    per_entry_issues = []

    for idx, e in enumerate(data):
        issues = validate_entry(e, idx)
        if issues:
            problems += 1
            per_entry_issues.append((idx, e.get("id", "<no id>"), issues))

    print(f"Checked entries: {total}")
    print(f"Entries with issues: {problems}")
    to_show = per_entry_issues[:20]
    for idx, idv, issues in to_show:
        print(f"- [{idx}] {idv}")
        for it in issues:
            print(f"  * {it}")

    if problems > 20:
        print(f"... and {problems - 20} more with issues")

    # Exit non-zero if issues found
    raise SystemExit(1 if problems else 0)


if __name__ == "__main__":
    main()

