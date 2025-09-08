#!/usr/bin/env python3
"""
Verifica della coerenza tra il numero di citazioni presenti nei paper (PDF
della cartella `approaches/`) e il numero di elementi in `citations` dentro
`public/data/sti-survey.json`. Genera un report testuale ed, opzionalmente,
aggiorna il JSON con esiti di verifica e allinea la lunghezza di `citations`.

Funzionamento in sintesi
- Mappa ogni voce del JSON a un PDF (`approaches/<id>.pdf`). Se il nome non
  coincide esattamente, tenta un fuzzy‑match basato su anno/cognome/slug.
- Estrae il testo dal PDF (PyPDF2/pypdf e, opzionalmente, pdfminer.six) con tre
  modalità di scansione: `auto`, `tail` (ultime N pagine) o `full` (tutto il PDF).
- Individua il blocco "References/Bibliography" e conta le citazioni usando più
  segnali: ancore esplicite ([n], "n.", "n)"), punti elenco, segmentazione in
  voci, presenza di anni/marker bibliografici, e coerenza della numerazione.
  In casi complessi usa una stima conservativa (es. `labels_unique_contig`).
- Se abilitato `--online`, interroga Crossref per `reference-count` (via DOI o
  ricerca per titolo) come ulteriore riscontro.
- Confronta `len(citations)` del JSON con il conteggio migliore disponibile
  (priorità: PDF → online) e scrive nel report solo i mismatch/irrisolti.
  Puoi facoltativamente usare lookup online Crossref per confrontare il conteggio.

Formato ID
- Regex: ^\d{4}_[a-z][a-z0-9]+_[a-z0-9][a-z0-9-]+$
  Esempio: `2025_cremaschi_steellm`. Il controllo segnala incoerenze tra anno
  e `firstAuthor` nel JSON.

Opzioni principali (CLI)
- `--scan-mode {auto,tail,full}` (default: full): strategia di scansione PDF.
  In `auto` prova la coda e, se debole, ricade su full. Con `--last-pages 0`
  equivale a full.
- `--extractor {tutti,auto,pypdf,pdfminer,pdftotext}` (default: tutti):
  seleziona l’estrattore testo. "tutti/auto" prova in cascata i disponibili
  (PyPDF → pdfminer → pdftotext).
- `--only-id ID` (ripetibile): limita l’analisi a specifici articoli.
- Le citazioni estratte vengono sempre salvate in `reports/extracted_citations.json`,
  mappate per ID dell’articolo senza modificare `sti-survey.json`.
- `--online [--crossref-mailto EMAIL]`: abilita lookup Crossref.
 

Esempi
- Report su tutti i paper, strategia automatica:
  python3 scripts/verify_citations.py
- Uso di Crossref con email di contatto:
  python3 scripts/verify_citations.py --online --crossref-mailto nome@dominio.it
- Più ID specifici:
  python3 scripts/verify_citations.py --only-id 2025_cremaschi_steellm --only-id 2024_zhang_tablellama
- Le citazioni estratte sono salvate automaticamente in
  `reports/extracted_citations.json` (per gli ID selezionati o tutti se non
  filtrati).

Formato delle citazioni nel JSON
- Ogni elemento di `citations` è un oggetto `{ "ref": string, "title": string }`.
- `ref`: contiene l’ID del paper se presente in `sti-survey.json` o come PDF in
  `approaches/` (mappato per DOI/titolo/filename). Se non mappabile, resta "".
- `title`: contiene solo il titolo del lavoro, preso dal JSON quando `ref` è
  noto, altrimenti estratto dal PDF con heuristics che rimuovono autori/venue.
  Il file `reports/extracted_citations.json` è un oggetto con chiavi gli ID e
  valori la lista di citazioni nel formato sopra. In questo file, `title`
  contiene l’intera citazione così come estratta dal PDF; `ref` è valorizzato
  solo quando il mapping trova un ID noto.

Aggiornamento contatore in sti-survey
- Lo script aggiorna anche `public/data/sti-survey.json` inserendo/aggiornando
  il campo opzionale `extractedCitationsCount` per ciascun articolo processato,
  impostandolo al numero di citazioni estratte.

Dipendenze
- Obbligatorie: PyPDF2 (o pypdf)
- Opzionali consigliate: pdfminer.six (estrazione robusta), requests (Crossref),
  pdftotext (Poppler) per layout complessi.
  pip install PyPDF2 pdfminer.six requests
  macOS: brew install poppler — Ubuntu/Debian: apt-get install poppler-utils

Limiti noti
- PDF con layout estremamente complessi o referenze senza heading esplicito
  possono richiedere `--scan-mode full` e `--extractor pdfminer`.
"""
import argparse
import subprocess
import shutil
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Tuple
import difflib
from functools import lru_cache

try:
    # PyPDF2 (aka pypdf) for fast extraction
    from PyPDF2 import PdfReader
except Exception as e:
    PdfReader = None  # type: ignore

try:
    # pdfminer.six for robust, layout-aware extraction
    from pdfminer.high_level import extract_text as pdfminer_extract_text  # type: ignore
except Exception:
    pdfminer_extract_text = None  # type: ignore

try:
    import requests
except Exception:
    requests = None  # type: ignore


@dataclass
class Counts:
    json: Optional[int]
    pdf: Optional[int]
    online: Optional[int]
    note: str = ""


def load_json(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


ID_REGEX = re.compile(r"^(?P<year>\d{4})_(?P<surname>[a-z][a-z0-9]+)_(?P<slug>[a-z0-9][a-z0-9-]+)$")


def validate_id_format(paper_id: str, entry: Dict[str, Any]) -> Tuple[bool, str]:
    m = ID_REGEX.match(paper_id)
    if not m:
        return False, "id_format_invalid"
    # Cross-check year with JSON if available
    id_year = int(m.group("year"))
    json_year = entry.get("year")
    if isinstance(json_year, int) and json_year != id_year:
        return False, f"year_mismatch(id={id_year}, json={json_year})"
    # Cross-check surname with firstAuthor if available
    surname = m.group("surname")
    fa = entry.get("firstAuthor") or ""
    fa_norm = re.sub(r"[^a-z0-9]", "", (fa or "").split(" ")[0].lower())
    if fa_norm and surname != fa_norm:
        return False, f"surname_mismatch(id={surname}, firstAuthor={fa_norm})"
    return True, "ok"


def _list_pdfs(approaches_dir: str) -> List[str]:
    try:
        return [f for f in os.listdir(approaches_dir) if f.lower().endswith(".pdf")]
    except FileNotFoundError:
        return []


def _best_pdf_match(approaches_dir: str, paper_id: str, entry: Dict[str, Any]) -> Optional[str]:
    # If exact exists, use it
    exact = os.path.join(approaches_dir, f"{paper_id}.pdf")
    if os.path.exists(exact):
        return exact

    # Fuzzy match: prefer same year and author/slug token overlap
    m = ID_REGEX.match(paper_id)
    year = entry.get("year") if isinstance(entry.get("year"), int) else (int(m.group("year")) if m else None)
    surname = None
    slug_tokens: List[str] = []
    if m:
        surname = m.group("surname")
        slug_tokens = re.split(r"[-_]", m.group("slug"))

    candidates = _list_pdfs(approaches_dir)
    best_score = -1
    best_file: Optional[str] = None
    for fname in candidates:
        base = fname[:-4]  # strip .pdf
        score = 0
        # Year match
        if year is not None and base.startswith(f"{year}_"):
            score += 3
        # Surname presence
        if surname and re.search(fr"\b{re.escape(surname)}\b", base):
            score += 2
        # Slug token presence
        token_hits = sum(1 for t in slug_tokens if t and t in base)
        score += min(2, token_hits)  # cap
        # Prefer shorter distance (rough proxy: length difference)
        score -= abs(len(base) - len(paper_id)) * 0.01
        if score > best_score:
            best_score = score
            best_file = fname

    # Require a minimum score to avoid spurious matches
    if best_file and best_score >= 3:
        return os.path.join(approaches_dir, best_file)
    return None


def pdf_path_for_id(approaches_dir: str, paper_id: str, entry: Dict[str, Any]) -> Tuple[Optional[str], str]:
    exact = os.path.join(approaches_dir, f"{paper_id}.pdf")
    if os.path.exists(exact):
        return exact, "exact"
    fuzzy = _best_pdf_match(approaches_dir, paper_id, entry)
    if fuzzy:
        return fuzzy, f"fuzzy:{os.path.basename(fuzzy)}"
    return None, "not_found"


# Removed: ensure_pdf_filename utility (no longer renaming/symlinking PDFs)


def _normalize_text(text: str) -> str:
    # Normalize line endings, spaces and soft hyphens
    text = re.sub(r"\r\n?|\u00ad", "\n", text)
    text = re.sub(r"\u00a0", " ", text)
    # Heal hyphenation across line breaks: 'exam-\nple' -> 'example'
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    # Remove excessive indentation spaces but preserve newlines
    text = re.sub(r"[ \t]+", " ", text)
    # Collapse huge blank blocks
    text = re.sub(r"\n\s+\n", "\n\n", text)
    return text


def _insert_segment_newlines(text: str) -> str:
    # Insert synthetic newlines before common reference labels to help regexes
    text = re.sub(r"(?<!\n)(\s*\[\s*\d{1,3}\s*\]\s+)", r"\n\1", text)
    text = re.sub(r"(?<!\n)(\s*\d{1,3}\s*[\.)]\s+)", r"\n\1", text)
    text = re.sub(r"(?<!\n)(\s*[•\-–]\s+)", r"\n\1", text)
    return text


def _extract_text_last_pages(reader: "PdfReader", last_pages: int) -> str:
    num_pages = len(reader.pages)
    start = max(0, num_pages - max(1, last_pages))
    texts: List[str] = []
    for i in range(start, num_pages):
        try:
            page = reader.pages[i]
            text = page.extract_text() or ""
        except Exception:
            text = ""
        texts.append(text)
    text = _normalize_text("\n".join(texts))
    text = _insert_segment_newlines(text)
    return text


def _find_references_block(text: str) -> Tuple[str, bool]:
    # Try to cut from the last occurrence of a references heading to the end
    headings = [
        r"\bREFERENCES\b",
        r"\bReferences\b",
        r"\bBibliography\b",
        r"\bBIBLIOGRAPHY\b",
        r"\bReference\b",
        r"\bWorks Cited\b",
        r"\bREFERENCES AND NOTES\b",
        r"\bReferences and Notes\b",
    ]
    tails = [
        r"\bACKNOWLEDGMENTS?\b",
        r"\bAppendix\b",
        r"\bAPPENDIX\b",
        r"\bSupplementary\b",
        r"\bSUPPLEMENTARY\b",
        r"\bBIOGRAPH(Y|IES)\b",
        r"\bAUTHORS?\b",
        r"\bIndex\b",
    ]

    last_pos = -1
    for h in headings:
        for m in re.finditer(h, text, flags=re.IGNORECASE):
            last_pos = max(last_pos, m.start())
    if last_pos >= 0:
        blk = text[last_pos:]
        # Stop at the next tail heading if present
        tail_pos = len(blk)
        for t in tails:
            m2 = re.search(t, blk, flags=re.IGNORECASE)
            if m2:
                tail_pos = min(tail_pos, m2.start())
        return blk[:tail_pos], True
    # If no explicit heading, just take the last ~20k chars (heuristic)
    return text[-30000:], False


# Global helpers to segment a references block into individual entries
def _anchor_iter_global(block_text: str):
    anchor_re = re.compile(r"(^|\n)\s*(\[(?P<b>\d{1,3})\]|(?P<n>\d{1,3})[\.)])\s+", flags=re.MULTILINE)
    for m in anchor_re.finditer(block_text):
        num = m.group('b') or m.group('n')
        try:
            n = int(num)
        except Exception:
            n = -1
        yield (m.start(), m.group(2), n)


def _segment_references(block_text: str) -> List[Tuple[int, int, str, int]]:
    anchors = list(_anchor_iter_global(block_text))
    segs: List[Tuple[int, int, str, int]] = []
    if not anchors:
        return segs
    for i, (pos, label, num) in enumerate(anchors):
        end = anchors[i + 1][0] if i + 1 < len(anchors) else len(block_text)
        txt = block_text[pos:end]
        segs.append((pos, end, txt.strip(), num))
    return segs


def _count_entries_in_block(block: str) -> Tuple[int, str]:
    # Helpers for more precise counting
    def _anchor_iter(block_text: str):
        anchor_re = re.compile(r"(^|\n)\s*(\[(?P<b>\d{1,3})\]|(?P<n>\d{1,3})[\.)])\s+", flags=re.MULTILINE)
        for m in anchor_re.finditer(block_text):
            num = m.group('b') or m.group('n')
            try:
                n = int(num)
            except Exception:
                n = -1
            yield (m.start(), m.group(2), n)

    def _segment_references(block_text: str) -> List[Tuple[int, int, str, int]]:
        anchors = list(_anchor_iter(block_text))
        segs: List[Tuple[int, int, str, int]] = []
        if not anchors:
            return segs
        for i, (pos, label, num) in enumerate(anchors):
            end = anchors[i + 1][0] if i + 1 < len(anchors) else len(block_text)
            txt = block_text[pos:end]
            segs.append((pos, end, txt.strip(), num))
        return segs

    def _looks_like_reference(text_line: str) -> bool:
        txt = text_line.strip()
        if len(txt) < 40:
            return False
        # must contain a plausible year
        if not re.search(r"(19|20)\d{2}", txt):
            return False
        # bibliographic markers
        markers = [
            r"\bdoi\b", r"10\.\d{4,9}/", r"\barXiv\b", r"\bProc\.?\b",
            r"\bProceedings\b", r"\bJournal\b", r"\bConference\b", r"\bACM\b",
            r"\bIEEE\b", r"\bSpringer\b", r"\bElsevier\b", r"\bWiley\b",
            r"\bCEUR\b", r"\bLNCS\b", r"\bvol\.?\b", r"\bno\.?\b", r"\bpp\.?\b",
            r"\bIn:\b",
        ]
        if any(re.search(p, txt, flags=re.IGNORECASE) for p in markers):
            return True
        # Author-like pattern
        if re.search(r"^[\s\[\d\).-]*[A-Z][A-Za-z\-']+(,\s*[A-Z]\.)", txt):
            return True
        if re.search(r"^[\s\[\d\).-]*[A-Z]\.[\s-]*[A-Z][A-Za-z\-']+", txt):
            return True
        return False

    # Prepare a line-broken version for regexes anchored at line starts
    # Ensure each reference is likely on a new line
    lines = block

    # Patterns for common numbering styles
    pat_sq = re.compile(r"(?:^|\n)\s*\[\s*\d{1,3}\s*\]\s+")  # [1]
    pat_dot = re.compile(r"(?:^|\n)\s*\d{1,3}\s*[\.)]\s+")  # 1. or 1)
    pat_bullet = re.compile(r"(?:^|\n)\s*[•\-–]\s+")  # bullets
    pat_year = re.compile(r"(?:^|\n)\s*[A-Z][^\n]{2,200}?\(?(19|20)\d{2}\)?[\.,]")  # Author (2019).
    pat_doi = re.compile(r"(?:^|\n).*?doi\s*[: ]\s*10\.[^\s]+", re.IGNORECASE)
    doi_capture = re.compile(r"10\.[0-9]{4,9}/[^\s)\]};,]+", re.IGNORECASE)
    pat_sq_any = re.compile(r"\[(\d{1,3})\]")  # bracket numbers anywhere

    c_sq = len(pat_sq.findall(lines))
    c_dot = len(pat_dot.findall(lines))
    c_bullet = len(pat_bullet.findall(lines))
    # Unique bracket labels anywhere in block (helps when newlines are lost)
    uniq_labels = set(int(x) for x in pat_sq_any.findall(block))
    uniq_labels = {n for n in uniq_labels if 0 < n < 1000}
    c_labels_unique = len(uniq_labels)

    # To avoid overcounting years mentioned in text, split into paragraphs and count plausible refs
    paras = [p.strip() for p in re.split(r"\n{2,}", lines) if p.strip()]
    c_paras = 0
    for p in paras:
        # paragraph must be reasonably long and contain a year and either a journal/conference token or a doi
        if len(p) >= 50 and pat_year.search(p):
            if re.search(r"\b(doi:|vol\.|no\.|pp\.|Proc\.|Journal|Conference|ACM|IEEE|Springer)\b", p, flags=re.IGNORECASE):
                c_paras += 1
            elif pat_doi.search(p):
                c_paras += 1

    # Author-at-line-start anchors (fallback for author-year styles, Lastname, F.)
    author_line = re.compile(
        r"(?:^|\n)\s*[A-Z][A-Za-z\-']+(?:\s[A-Z][A-Za-z\-']+)*,\s*(?:[A-Z](?:\.[\s-]?))+.*?(19|20)\d{2}",
        flags=re.MULTILINE,
    )
    c_author_start = len(list(author_line.finditer(lines)))

    # Firstname Lastname, ... style at line start (common in some ACL/LLM bibs)
    author_fname_line = re.compile(
        r"(?:^|\n)\s*[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+)+\s*,",
        flags=re.UNICODE,
    )
    author_fname_matches = list(author_fname_line.finditer(lines))
    c_author_fname_start = len(author_fname_matches)
    # Cluster consecutive author-firstname anchors by distance to approximate reference groups
    c_author_clusters = 0
    if author_fname_matches:
        positions = [m.start() for m in author_fname_matches]
        dists = [positions[i] - positions[i - 1] for i in range(1, len(positions))]
        if dists:
            sd = sorted(dists)
            p25 = sd[int(0.25 * (len(sd) - 1))]
            p75 = sd[int(0.75 * (len(sd) - 1))]
            iqr = max(1, p75 - p25)
            thr = max(200, p75 + 0.5 * iqr)
        else:
            thr = 300
        c_author_clusters = 1
        for d in dists:
            if d > thr:
                c_author_clusters += 1

    # Corporate/organization + year like: "Google. 2015. ..."
    corp_year = re.compile(r"(?:^|\n)\s*[A-Z][A-Za-z0-9 .&/\-]{2,40}\.?\s*(19|20)\d{2}\.")
    c_corp_year = len(list(corp_year.finditer(lines)))

    # Year-leading line heuristic: count lines where a publication year appears early and is followed by a period.
    year_lead = re.compile(r"(?:^|\n)\s*[^\n]{0,300}?(19|20)\d{2}[a-z]?\.", flags=re.MULTILINE)
    c_year_lead = len(list(year_lead.finditer(lines)))

    # Unique DOIs
    dois = set(m.group(0) for m in doi_capture.finditer(block))
    c_dois_unique = len(dois)

    # Segmentation by anchors and validation of each segment
    segs = _segment_references(block)
    valid_segs = [s for s in segs if _looks_like_reference(s[2])]

    # Contiguity heuristic for anchors we segmented
    nums = [n for (_, _, _, n) in valid_segs if n > 0]
    contig_ratio = 0.0
    if nums:
        uniq_sorted = sorted(set(nums))
        expected_range = uniq_sorted[-1] - uniq_sorted[0] + 1 if uniq_sorted else 0
        if expected_range > 0:
            contig_ratio = len(uniq_sorted) / expected_range
    # Contiguity for all bracket labels seen anywhere
    contig_all = 0.0
    if uniq_labels:
        uniq_sorted_all = sorted(uniq_labels)
        expected_range_all = uniq_sorted_all[-1] - uniq_sorted_all[0] + 1
        if expected_range_all > 0:
            contig_all = len(uniq_labels) / expected_range_all

    seg_count = len(valid_segs)

    # Boundary-based estimate: count transitions where a line ending with '.' is followed by an author-like line
    lines_list = block.splitlines()
    author_line_start = re.compile(r"^\s*[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+)+\s*,", re.UNICODE)
    c_boundaries = 0
    for i in range(len(lines_list) - 1):
        if lines_list[i].rstrip().endswith('.') and author_line_start.search(lines_list[i + 1]):
            c_boundaries += 1
    c_by_boundaries = c_boundaries + 1 if c_boundaries > 0 else 0

    # Heuristic selection: prefer segmented if consistent; else prefer author_start or DOIs; else fallback to numbered/square, with caps
    candidates = [
        ("segmented", seg_count),
        ("square", c_sq),
        ("numbered", c_dot),
        ("bullet", c_bullet),
        ("labels_unique", c_labels_unique),
        ("paragraph", c_paras),
        ("author_start", c_author_start),
        ("author_fname_start", c_author_fname_start),
        ("corp_year", c_corp_year),
        ("dois_unique", c_dois_unique),
        ("author_clusters", c_author_clusters),
        ("boundaries", c_by_boundaries),
        ("year_lead", c_year_lead),
    ]
    chosen_label, chosen = max(candidates, key=lambda x: x[1])

    if seg_count >= 5 and (contig_ratio >= 0.5 or c_sq > 0):
        # Prefer segmented, but if it's far below unique bracket labels, trust labels
        if c_labels_unique >= 5 and seg_count < int(0.7 * c_labels_unique) and contig_all >= 0.6:
            chosen_label, chosen = "labels_unique_contig", c_labels_unique
        else:
            chosen_label, chosen = "segmented", seg_count
    else:
        # If no good anchors, try author_start or DOIs
        if c_author_start >= 5 and c_author_start >= chosen * 0.8:
            chosen_label, chosen = "author_start", c_author_start
        elif c_author_fname_start >= 5:
            # Prefer clustered estimate if reasonable; else raw author-first count
            if c_author_clusters >= 5 and (c_author_clusters >= chosen * 0.7 or c_author_clusters <= 300):
                chosen_label, chosen = "author_clusters", c_author_clusters
            else:
                chosen_label, chosen = "author_fname_start", c_author_fname_start
        elif c_corp_year >= 3 and c_corp_year >= chosen * 0.7:
            chosen_label, chosen = "corp_year", c_corp_year
        elif c_dois_unique >= 5 and c_dois_unique >= chosen * 0.8:
            chosen_label, chosen = "dois_unique", c_dois_unique
        elif 5 <= c_year_lead <= 300 and c_year_lead >= max(chosen, c_author_fname_start) * 0.8:
            chosen_label, chosen = "year_lead", c_year_lead
        elif c_by_boundaries >= 5 and c_by_boundaries >= chosen * 0.7:
            chosen_label, chosen = "boundaries", c_by_boundaries
        else:
            if c_labels_unique and chosen > int(c_labels_unique * 1.1):
                chosen = c_labels_unique
                chosen_label = f"{chosen_label}->labels_unique_cap"

    reason = (
        f"pattern={chosen_label} counts={{segmented:{seg_count}, square:{c_sq}, numbered:{c_dot}, "
        f"bullet:{c_bullet}, labels_unique:{c_labels_unique}, paragraph:{c_paras}, author_start:{c_author_start}, author_fname_start:{c_author_fname_start}, corp_year:{c_corp_year}, dois_unique:{c_dois_unique}, author_clusters:{c_author_clusters}, boundaries:{c_by_boundaries}, year_lead:{c_year_lead}}} "
        f"contig={contig_ratio:.2f} contig_all={contig_all:.2f}"
    )
    return chosen, reason


def _extract_text_full(reader: "PdfReader") -> str:
    texts: List[str] = []
    for i in range(len(reader.pages)):
        try:
            text = reader.pages[i].extract_text() or ""
        except Exception:
            text = ""
        texts.append(text)
    text = _normalize_text("\n".join(texts))
    text = _insert_segment_newlines(text)
    return text


def _extract_text_pdfminer(pdf_path: str) -> Optional[str]:
    if pdfminer_extract_text is None:
        return None
    try:
        text = pdfminer_extract_text(pdf_path)
        if not text:
            return None
        text = _normalize_text(text)
        text = _insert_segment_newlines(text)
        return text
    except Exception:
        return None

def _extract_text_pdftotext(pdf_path: str) -> Optional[str]:
    """Use Poppler's pdftotext if available. Install: macOS `brew install poppler`,
    Ubuntu/Debian `apt-get install poppler-utils`. Returns normalized text or None.
    """
    if shutil.which("pdftotext") is None:
        return None
    try:
        proc = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", pdf_path, "-"],
                              capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            return None
        text = proc.stdout
        if not text:
            return None
        text = _normalize_text(text)
        text = _insert_segment_newlines(text)
        return text
    except Exception:
        return None


_EXTRACT_CACHE: Dict[Tuple[str, str, int, str], Dict[str, Any]] = {}


def _get_pdf_text_and_count(pdf_path: str, last_pages: int, scan_mode: str, extractor: str) -> Tuple[Optional[str], str, int, str]:
    """Return (text, mode_label, count, reason). Uses a small cache and tries extractors progressively.
    """
    key = (os.path.abspath(pdf_path), scan_mode, int(last_pages), extractor)
    cached = _EXTRACT_CACHE.get(key)
    if cached is not None:
        return cached["text"], cached["mode"], cached["count"], cached["reason"]

    texts: List[Tuple[str, Optional[str]]] = []  # (label, text)
    labels_tried: List[str] = []

    def add_text(label: str, text: Optional[str]):
        labels_tried.append(label)
        if text:
            texts.append((label, text))

    # pypdf
    try:
        if PdfReader is not None:
            reader = PdfReader(pdf_path)
            if scan_mode == "full" or last_pages <= 0:
                add_text("pypdf-full", _extract_text_full(reader))
            elif scan_mode == "tail":
                add_text("pypdf-tail", _extract_text_last_pages(reader, last_pages))
            else:
                add_text("pypdf-auto-tail", _extract_text_last_pages(reader, last_pages))
                add_text("pypdf-auto-full", _extract_text_full(reader))
    except Exception:
        pass

    # pdfminer
    if extractor in ("auto", "tutti", "pdfminer") and pdfminer_extract_text is not None:
        add_text("pdfminer-full", _extract_text_pdfminer(pdf_path))

    # pdftotext
    if extractor in ("auto", "tutti", "pdftotext") and shutil.which("pdftotext") is not None:
        add_text("pdftotext-full", _extract_text_pdftotext(pdf_path))

    # Choose best by computed reference count
    best_label = "none"
    best_text: Optional[str] = None
    best_count = 0
    best_reason = "no_result"
    for label, text in texts:
        try:
            block, found = _find_references_block(text)
            count, reason = _count_entries_in_block(block)
            # mild preference to 'found' blocks
            score = count + (1 if found else 0)
            if score > best_count:
                best_label = label
                best_text = text
                best_count = count
                best_reason = f"{('found' if found else 'heuristic')} {reason}"
            # Early exit if clearly good
            if found and count >= 10:
                break
        except Exception:
            continue

    _EXTRACT_CACHE[key] = {"text": best_text, "mode": best_label, "count": best_count, "reason": best_reason}
    return best_text, best_label, best_count, best_reason


def ref_count_from_pdf(pdf_path: str, last_pages: int = 8, scan_mode: str = "auto", extractor: str = "auto") -> Tuple[Optional[int], str]:
    try:
        text, mode_used, count, reason = _get_pdf_text_and_count(pdf_path, last_pages, scan_mode, extractor)
        note = (f"ok:{mode_used}: {reason}" if (text and count > 0) else f"zero_count:{mode_used}: {reason}")
        return (count if count >= 0 else None), note
    except Exception as e:
        return None, f"parse_fail: {e}"


def normalize_doi(doi: str) -> str:
    if not doi:
        return ""
    doi = doi.strip()
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.IGNORECASE)
    return doi


def ref_count_from_crossref(doi: Optional[str], title: Optional[str], year: Optional[int], mailto: Optional[str] = None, timeout: int = 15) -> Tuple[Optional[int], str]:
    if requests is None:
        return None, "requests not available"
    headers = {"User-Agent": f"sti-survey/verify-citations (+{mailto or 'mailto:anonymous@example.com'})"}
    base = "https://api.crossref.org"
    try:
        if doi:
            doi_n = normalize_doi(doi)
            url = f"{base}/works/{doi_n}"
            params = {"mailto": mailto} if mailto else {}
            r = requests.get(url, params=params, headers=headers, timeout=timeout)
            if r.status_code == 200:
                data = r.json()
                rc = data.get("message", {}).get("reference-count")
                if isinstance(rc, int):
                    return rc, "crossref_by_doi"
        # fallback by title search
        if title:
            params = {
                "query.title": title,
                "rows": 1,
                "select": "DOI,reference-count,title,author,issued",
            }
            if mailto:
                params["mailto"] = mailto
            r = requests.get(f"{base}/works", params=params, headers=headers, timeout=timeout)
            if r.status_code == 200:
                data = r.json()
                items = data.get("message", {}).get("items", [])
                if items:
                    rc = items[0].get("reference-count")
                    if isinstance(rc, int):
                        return rc, "crossref_by_title"
        return None, "crossref_not_found"
    except Exception as e:
        return None, f"crossref_error: {e}"


# ---- Reference extraction and ID mapping ----

def _normalize_title(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _extract_reference_segments(text: str) -> List[str]:
    block, _found = _find_references_block(text)
    # Prefer anchor-based segmentation
    segs = []
    for _pos, _end, seg_text, _num in _segment_references(block):
        if len(seg_text) >= 40:
            segs.append(seg_text)
    if len(segs) >= 5:
        return segs
    # Fallback: boundary-based splitting
    lines = [ln.rstrip() for ln in block.splitlines()]
    cur: List[str] = []
    chunks: List[str] = []
    for i, ln in enumerate(lines):
        cur.append(ln)
        # boundary if line ends with period and next starts like author
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if ln.endswith('.') and re.search(r"^\s*[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(\s[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+)+\s*,", nxt):
            chunk = " ".join(cur).strip()
            if len(chunk) >= 40:
                chunks.append(chunk)
            cur = []
    if cur:
        chunk = " ".join(cur).strip()
        if len(chunk) >= 40:
            chunks.append(chunk)
    return chunks


def _parse_reference(seg: str) -> Dict[str, Any]:
    # Clean leading list markers
    seg_clean = re.sub(r"^\s*(?:\[\s*\d{1,3}\s*\]|\d{1,3}[\.)])\s*", "", seg.strip())
    # Try DOI first
    mdoi = re.search(r"10\.[0-9]{4,9}/[^\s)\]};,]+", seg_clean, flags=re.IGNORECASE)
    doi = mdoi.group(0) if mdoi else None
    # Year
    myear = re.search(r"(19|20)\d{2}[a-z]?", seg_clean)
    year = None
    year_pos = None
    if myear:
        try:
            year = int(myear.group(0)[:4])
        except Exception:
            year = None
        year_pos = myear.start()
    # First author surname heuristic: look before year
    first_author = None
    head = seg_clean[:year_pos] if year_pos is not None else seg_clean[:120]
    # Patterns: "Lastname, F." or "Firstname Lastname,"
    m1 = re.search(r"([A-Z][A-Za-z'’-]+)\s*,\s*[A-Z]", head)
    if m1:
        first_author = m1.group(1)
    else:
        m2 = re.search(r"(?:^|\s)([A-Z][A-Za-z'’-]+)\s*,", head)
        if m2:
            first_author = m2.group(1)
        else:
            m3 = re.match(r"\s*(?:[A-Z][A-Za-z'’-]+\s+)*(?P<s>[A-Z][A-Za-z'’-]+)\s*[,\.]", head)
            if m3:
                first_author = m3.group('s')
    # Title heuristic: choose the best sentence after year not starting with venue markers
    title = None
    tail = seg_clean[myear.end():] if myear else seg_clean
    parts = [p.strip() for p in tail.split('.') if p.strip()]
    venue_markers = re.compile(r"^(Proceedings|In\s|arXiv|ACM|IEEE|Springer|Journal|Volume|Vol\.|No\.|pp\.|https?://)", re.IGNORECASE)
    for p in parts:
        if len(p) < 6:
            continue
        if venue_markers.search(p):
            continue
        title = p
        break
    return {"raw": seg, "doi": doi, "year": year, "title": title, "firstAuthor": first_author}


def _title_only_from_segment(seg: str) -> str:
    # Keep only the likely title portion after the year and before venue markers
    s = re.sub(r"\s+", " ", seg.strip())
    # Drop leading list numbering like [12] or 12. or 12)
    s = re.sub(r"^\s*(?:\[\s*\d{1,3}\s*\]|\d{1,3}[\.)])\s*", "", s)
    # Drop leading year fragments like 2022. or 022.
    s = re.sub(r"^\s*(?:\d{3,4}[a-z]?\.)\s*", "", s)
    # Try colon-based title (e.g., "Jentab: Matching tabular data ...")
    mcolon = re.search(r"([A-Z][A-Za-z0-9'’\- ]{3,100}:\s+[^\.]{5,200})", s)
    if mcolon:
        cand = mcolon.group(1)
        cand = re.sub(r"\s+", " ", cand).strip()
        return cand.strip(" \t\n\r\f\v\"'()[]{}.;:")
    # remove leading authors up to year.
    m = re.search(r"(19|20)\d{2}[a-z]?\.?\s*", s)
    s2 = s[m.end():] if m else s
    # cut at venue/marker tokens
    stops = [
        r"\bIn\b",
        r"\bProceedings\b",
        r"\bProc\.?\b",
        r"\bJournal\b",
        r"\bACM\b",
        r"\bIEEE\b",
        r"\bSpringer\b",
        r"\bElsevier\b",
        r"\barXiv\b",
        r"https?://",
        r"\bdoi\b",
        r"\bvol\.?\b",
        r"\bno\.?\b",
        r"\bpp\.?\b",
    ]
    cut = None
    for p in stops:
        m2 = re.search(p, s2, flags=re.IGNORECASE)
        if m2:
            cut = m2.start() if cut is None else min(cut, m2.start())
    if cut is not None:
        s2 = s2[:cut]
    # split at the first full stop if it remains very long
    if len(s2) > 200 and "." in s2:
        s2 = s2.split(".", 1)[0]
    # Trim trailing numeric/venue artifacts
    s2 = re.sub(r"\s*,?\s*\d{1,4}(?:\s*,\s*\d{1,4})*$", "", s2)
    s2 = s2.strip(" \t\n\r\f\v\"'()[]{}.;:")
    return s2


def _tokenize_title(s: str) -> List[str]:
    s = _normalize_title(s)
    toks = [t for t in s.split() if len(t) >= 4]
    return toks


def _build_catalog(entries: List[Dict[str, Any]], approaches_dir: str) -> Dict[str, Any]:
    by_doi: Dict[str, str] = {}
    by_title: Dict[str, str] = {}
    title_by_id: Dict[str, str] = {}
    by_year_titles: Dict[int, List[Tuple[str, List[str]]]] = {}
    ids_set = set()
    for e in entries:
        pid = e.get("id")
        if not pid:
            continue
        ids_set.add(pid)
        if isinstance(e.get("title"), str):
            title_by_id[pid] = e["title"]
            try:
                y = int(e.get("year")) if e.get("year") is not None else None
            except Exception:
                y = None
            toks = _tokenize_title(e["title"])
            if isinstance(y, int):
                by_year_titles.setdefault(y, []).append((pid, toks))
        doi = e.get("doi") or ""
        if doi:
            by_doi[normalize_doi(doi)] = pid
        title = e.get("title") or ""
        if title:
            by_title[_normalize_title(title)] = pid
    # Also index available PDF basenames in approaches (id pattern)
    try:
        for f in os.listdir(approaches_dir):
            if f.lower().endswith('.pdf'):
                ids_set.add(f[:-4])
    except Exception:
        pass
    return {"by_doi": by_doi, "by_title": by_title, "ids": ids_set, "title_by_id": title_by_id, "by_year_titles": by_year_titles}


def _guess_id_from_approaches(ref: Dict[str, Any], approaches_dir: str) -> Optional[str]:
    year = ref.get("year")
    fa = ref.get("firstAuthor")
    tit = ref.get("title") or ""
    tokens = [t for t in re.split(r"\W+", _normalize_title(tit)) if len(t) >= 4][:6]
    if not (year and fa):
        return None
    surname = re.sub(r"[^a-z0-9]", "", (fa or "").lower())
    prefix = f"{year}_{surname}_"
    try:
        candidates = [f[:-4] for f in os.listdir(approaches_dir) if f.lower().endswith('.pdf') and f.startswith(prefix)]
    except Exception:
        candidates = []
    if not candidates:
        return None
    best = None
    best_score = 0
    for cid in candidates:
        score = 0
        for t in tokens:
            if t in cid:
                score += 1
        if score > best_score:
            best_score = score
            best = cid
    if best and best_score >= 2:
        return best
    return None


def _map_ref_to_id(ref: Dict[str, Any], catalog: Dict[str, Any], approaches_dir: str) -> Optional[str]:
    doi = ref.get("doi")
    if doi:
        doi_n = normalize_doi(doi)
        pid = catalog["by_doi"].get(doi_n)
        if pid:
            return pid
    title = ref.get("title")
    if title:
        norm = _normalize_title(title)
        pid = catalog["by_title"].get(norm)
        if pid:
            return pid
        # Fuzzy by year-restricted token Jaccard
        toks_ref = set(_tokenize_title(title))
        year = ref.get("year")
        candidates = []
        if isinstance(year, int) and year in catalog.get("by_year_titles", {}):
            candidates = catalog["by_year_titles"][year]
        else:
            # fall back to all titles
            candidates = [(pid2, _tokenize_title(t)) for pid2, t in catalog.get("title_by_id", {}).items()]
        best_id = None
        best_score = 0.0
        for cid, toks in candidates:
            s = set(toks)
            if not s or not toks_ref:
                continue
            inter = len(s & toks_ref)
            union = len(s | toks_ref)
            jac = inter / union if union else 0.0
            # require minimum overlap
            if inter >= 3 and jac > best_score:
                best_score = jac
                best_id = cid
        if best_id and best_score >= 0.4:
            return best_id
        # Secondary: difflib ratio on normalized strings
        best = None
        best_r = 0.0
        for cid, t in catalog.get("title_by_id", {}).items():
            r = difflib.SequenceMatcher(a=norm, b=_normalize_title(t)).ratio()
            if r > best_r:
                best = cid
                best_r = r
        if best and best_r >= 0.72:
            return best
    # Guess from approaches filenames if not found via JSON
    gid = _guess_id_from_approaches(ref, approaches_dir)
    if gid:
        return gid
    return None


def extract_and_map_citations_for_entry(entry: Dict[str, Any], approaches_dir: str, last_pages: int, scan_mode: str, extractor: str, catalog: Dict[str, Any], content_mode: str = "full") -> List[Dict[str, Any]]:
    paper_id = entry.get("id")
    pdf_path, _how = pdf_path_for_id(approaches_dir, paper_id, entry)
    if not pdf_path:
        return []
    # Get text via the same pipeline used for counting
    pc, note = ref_count_from_pdf(pdf_path, last_pages=last_pages, scan_mode=scan_mode, extractor=extractor)
    # We need full text; reuse internal extractors more directly by calling again with full mode and capturing text
    # Simpler: try to reconstruct text with our extractors; prefer full
    text = None
    # Try pypdf full
    try:
        if PdfReader is not None:
            reader = PdfReader(pdf_path)
            text = _extract_text_full(reader)
    except Exception:
        text = None
    # pdfminer
    if (text is None or len(text) < 1000) and pdfminer_extract_text is not None:
        t2 = _extract_text_pdfminer(pdf_path)
        if t2 and len(t2) > (len(text) if text else 0):
            text = t2
    # pdftotext
    if (text is None or len(text) < 1000):
        t3 = _extract_text_pdftotext(pdf_path)
        if t3 and len(t3) > (len(text) if text else 0):
            text = t3
    if not text:
        return []
    segs = _extract_reference_segments(text)
    results: List[Dict[str, Any]] = []
    for seg in segs:
        info = _parse_reference(seg)
        pid = _map_ref_to_id(info, catalog, approaches_dir)
        # Choose content: either full citation string or title-only
        if content_mode == "full":
            title = re.sub(r"\s+", " ", (seg or "").strip())
        else:
            # title-only mode: prefer canonical JSON title when ID is known
            if pid and pid in catalog.get("title_by_id", {}):
                title = catalog["title_by_id"][pid]
            else:
                title = info.get("title") or _title_only_from_segment(info.get("raw", ""))
        results.append({
            "ref": pid or "",
            "title": title,
        })
    return results


def compare_counts(entry: Dict[str, Any], approaches_dir: str, last_pages: int, online: bool, crossref_mailto: Optional[str], scan_mode: str = "auto", extractor: str = "auto") -> Counts:
    paper_id = entry.get("id", "")
    json_citations = entry.get("citations", [])
    json_count = len(json_citations) if isinstance(json_citations, list) else None

    pdf_count: Optional[int] = None
    notes: List[str] = []

    # ID validation
    valid_id, id_note = validate_id_format(paper_id, entry)
    if not valid_id:
        notes.append(f"id:{id_note}")

    pdf_path, how = pdf_path_for_id(approaches_dir, paper_id, entry)
    if pdf_path:
        pdf_count, note = ref_count_from_pdf(pdf_path, last_pages=last_pages, scan_mode=scan_mode, extractor=extractor)
        if note:
            notes.append(f"pdf:{how}:{note}")
    else:
        notes.append("pdf_missing")

    online_count: Optional[int] = None
    if online:
        doi = entry.get("doi")
        title = entry.get("title")
        year = entry.get("year")
        online_count, onote = ref_count_from_crossref(doi, title, year, mailto=crossref_mailto)
        notes.append(f"online:{onote}")

    return Counts(json=json_count, pdf=pdf_count, online=online_count, note="; ".join(notes))


def build_report(entries: List[Dict[str, Any]], approaches_dir: str, last_pages: int, online: bool, crossref_mailto: Optional[str], scan_mode: str = "auto", extractor: str = "auto") -> Tuple[str, int, int, int, int]:
    lines: List[str] = []
    lines.append("Citation count mismatches (JSON vs PDF/Online)\n")
    lines.append("Only mismatches or unresolved entries are listed.\n")
    lines.append("")

    processed = 0
    mismatches = 0
    missing_pdf = 0
    parse_fail = 0

    for entry in entries:
        processed += 1
        counts = compare_counts(entry, approaches_dir, last_pages, online, crossref_mailto, scan_mode=scan_mode, extractor=extractor)
        paper_id = entry.get("id", "?")
        title = entry.get("title", "?")

        json_c = counts.json
        pdf_c = counts.pdf
        online_c = counts.online

        # Determine the best available paper-side count for comparison
        available_counts = [("pdf", pdf_c), ("online", online_c)]
        best_label, best_count = None, None
        for lbl, val in available_counts:
            if isinstance(val, int) and val >= 0:
                best_label, best_count = lbl, val
                break

        if best_count is None:
            # unresolved
            reason = counts.note
            if "pdf_missing" in reason:
                missing_pdf += 1
            else:
                parse_fail += 1
            lines.append(f"- {paper_id} | {title}\n  json={json_c} pdf={pdf_c} online={online_c} -> unresolved ({reason})")
            continue

        # Compare
        if json_c != best_count:
            mismatches += 1
            lines.append(
                f"- {paper_id} | {title}\n  json={json_c} vs {best_label}={best_count} (note: {counts.note})"
            )

    # Summary
    lines.append("")
    lines.append(f"Processed: {processed}")
    lines.append(f"Mismatches: {mismatches}")
    lines.append(f"Missing PDFs: {missing_pdf}")
    lines.append(f"Parse/Lookup failures: {parse_fail}")
    return "\n".join(lines) + "\n", processed, mismatches, missing_pdf, parse_fail


def annotate_json(entries: List[Dict[str, Any]], approaches_dir: str, last_pages: int, online: bool, crossref_mailto: Optional[str], scan_mode: str = "auto", extractor: str = "auto") -> Tuple[List[Dict[str, Any]], int, int]:
    """Returns modified entries plus counts of annotated and mismatched items."""
    modified = 0
    mismatches = 0
    new_entries: List[Dict[str, Any]] = []
    for entry in entries:
        counts = compare_counts(entry, approaches_dir, last_pages, online, crossref_mailto, scan_mode=scan_mode, extractor=extractor)
        paper_id = entry.get("id", "")

        # Build annotation object
        best = None
        best_src = None
        for lbl, val in [("pdf", counts.pdf), ("online", counts.online)]:
            if isinstance(val, int):
                best = val
                best_src = lbl
                break

        ann = {
            "json": counts.json,
            "pdf": counts.pdf,
            "online": counts.online,
            "best": best,
            "source": best_src,
            "note": counts.note,
        }

        # Attach under a dedicated key
        if entry.get("citationCountVerified") != ann:
            e2 = dict(entry)
            e2["citationCountVerified"] = ann
            # Add id validation info if needed
            valid_id, id_note = validate_id_format(paper_id, entry)
            if not valid_id:
                e2.setdefault("idValidation", {})
                e2["idValidation"] = {"valid": False, "note": id_note}
            new_entries.append(e2)
            modified += 1
        else:
            new_entries.append(entry)

        if isinstance(counts.json, int) and isinstance(best, int) and counts.json != best:
            mismatches += 1

    return new_entries, modified, mismatches


# Removed: sync_citations support (no automatic resizing of citations arrays)


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify citations count: JSON vs paper (PDF/online)")
    ap.add_argument("--json", dest="json_path", default="public/data/sti-survey.json", help="Path to sti-survey.json")
    ap.add_argument("--approaches-dir", dest="approaches_dir", default="approaches", help="Directory containing paper PDFs named <id>.pdf")
    ap.add_argument("--report", dest="report_path", default="reports/citation_mismatches.txt", help="Output report path")
    ap.add_argument("--last-pages", dest="last_pages", type=int, default=8, help="Number of last PDF pages to scan for references")
    ap.add_argument("--online", dest="online", action="store_true", help="Use Crossref online lookup as fallback")
    ap.add_argument("--crossref-mailto", dest="crossref_mailto", default=None, help="Contact email for Crossref queries (recommended)")
    # Removed option: --update-json, --extract-citations (script no longer modifies sti-survey.json)
    ap.add_argument("--scan-mode", dest="scan_mode", choices=["auto", "tail", "full"], default="full", help="PDF scanning strategy: auto (tail then full fallback), tail (only last pages), full (entire PDF)")
    ap.add_argument("--extractor", dest="extractor", choices=["tutti", "auto", "pypdf", "pdfminer", "pdftotext"], default="tutti", help="PDF text extractor to use: 'tutti/auto' tries PyPDF then pdfminer/pdftotext; specify to force one")
    ap.add_argument("--only-id", dest="only_id", action="append", help="Process only entries with the given id (can be repeated)")
    # Removed options: --sync-citations/--truncate, --ensure-pdf-filenames, --extracted-json, --extracted-known-only

    args = ap.parse_args()

    try:
        entries = load_json(args.json_path)
    except Exception as e:
        print(f"Failed to read JSON: {e}", file=sys.stderr)
        return 2

    # Keep a copy of all entries for global catalogs/mapping
    all_entries = list(entries)

    # Filter by IDs if requested (via --only-id)
    wanted: set = set(args.only_id or [])

    if wanted:
        entries = [e for e in entries if e.get("id") in wanted]

    # Ensure report directory exists
    os.makedirs(os.path.dirname(args.report_path), exist_ok=True)

    # Normalize extractor alias
    effective_extractor = args.extractor
    if effective_extractor == "tutti":
        effective_extractor = "auto"

    report, processed, mismatches, missing_pdf, parse_fail = build_report(
        entries=entries,
        approaches_dir=args.approaches_dir,
        last_pages=args.last_pages,
        online=args.online,
        crossref_mailto=args.crossref_mailto,
        scan_mode=args.scan_mode,
        extractor=effective_extractor,
    )

    with open(args.report_path, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"Wrote report to {args.report_path}")
    print(f"Processed={processed} mismatches={mismatches} missing_pdfs={missing_pdf} parse_failures={parse_fail}")

    # Always save extracted citations into reports/extracted_citations.json
    catalog = _build_catalog(all_entries, args.approaches_dir)
    extracted: Dict[str, List[Dict[str, Any]]] = {}
    saved = 0
    for e in entries:
        pid = e.get("id")
        if not pid:
            continue
        cits = extract_and_map_citations_for_entry(
            e,
            args.approaches_dir,
            last_pages=args.last_pages,
            scan_mode=args.scan_mode,
            extractor=effective_extractor,
            catalog=catalog,
            content_mode="full",
        )
        extracted[pid] = cits or []
        if cits:
            saved += 1
    try:
        out_path = os.path.join("reports", "extracted_citations.json")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(extracted, f, ensure_ascii=False, indent=4)
        print(f"Wrote extracted citations for {saved}/{len(entries)} entries to {out_path}")
    except Exception as e:
        print(f"Failed to write extracted JSON: {e}", file=sys.stderr)
        return 3

    # Update sti-survey.json with extractedCitationsCount for processed entries
    try:
        counts_by_id = {pid: len(cits) for pid, cits in extracted.items()}
        original = load_json(args.json_path)
        updated = []
        updated_count = 0
        for obj in original:
            pid = obj.get("id")
            if pid in counts_by_id:
                if obj.get("extractedCitationsCount") != counts_by_id[pid]:
                    obj = dict(obj)
                    obj["extractedCitationsCount"] = counts_by_id[pid]
                    updated_count += 1
            updated.append(obj)
        if updated != original:
            with open(args.json_path, "w", encoding="utf-8") as f:
                json.dump(updated, f, ensure_ascii=False, indent=4)
            print(f"Updated extractedCitationsCount for {updated_count} entries in {args.json_path}")
        else:
            print("No changes to extractedCitationsCount needed")
    except Exception as e:
        print(f"Failed to update extractedCitationsCount: {e}", file=sys.stderr)
        return 3

    # No modifications to sti-survey.json; only extracted citations are written

    return 0


if __name__ == "__main__":
    sys.exit(main())
