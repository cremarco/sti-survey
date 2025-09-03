#!/usr/bin/env python3
"""
Comprehensive script to rename all PDF files in the approaches folder.
Final format: YYYY_surname_first-word-of-title.pdf

Improvements:
- Adds --dry-run to preview changes without renaming files
- Adds --only-nonstandard to process only files not matching the pattern
- Improves author and year extraction using PDF metadata and better text heuristics
- Clearer summary with reasoned skips
"""

import os
import json
import re
import argparse
from pathlib import Path
from typing import Optional, Tuple
import PyPDF2

def extract_title_from_text(text, max_lines=20):
    """
    Extract title from PDF text content.
    """
    lines = text.split('\n')
    
    for i, line in enumerate(lines[:max_lines]):
        line = line.strip()
        if not line:
            continue
            
        # Skip common non-title elements
        if any(skip in line.lower() for skip in [
            'abstract', 'introduction', 'keywords', 'author', 'university',
            'department', 'email', '@', 'www.', 'http', 'doi:', 'arxiv:',
            'proceedings', 'conference', 'workshop', 'journal'
        ]):
            continue
            
        # Normalize ALL CAPS titles to Title Case for detection
        candidate = line.title() if line.isupper() else line
        # Title characteristics
        if (len(candidate) > 10 and 
            not re.match(r'^[\d\s\-\.]+$', candidate) and
            not candidate.startswith('(') and
            not candidate.startswith('[')):
            
            title = re.sub(r'\s+', ' ', candidate).strip()
            return title
    
    return "Title not found"

def extract_title_from_metadata(reader: PyPDF2.PdfReader) -> Optional[str]:
    meta = getattr(reader, 'metadata', None)
    if not meta:
        return None
    title = meta.get('/Title') if isinstance(meta, dict) else getattr(meta, 'title', None)
    if title:
        # Normalize whitespace
        return re.sub(r"\s+", " ", str(title)).strip()
    return None

def get_first_word_of_title(title):
    """
    Extract the first meaningful word from the title.
    """
    if not title or title == "Title not found":
        return "untitled"
    
    # Clean title and split into words
    clean_title = re.sub(r'[^\w\s]', ' ', title)
    words = clean_title.split()
    
    # Find first meaningful word (not articles, prepositions, etc.)
    skip_words = {'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
    
    for word in words:
        word_lower = word.lower()
        if word_lower not in skip_words and len(word_lower) > 2:
            return word_lower
    
    # If no meaningful word found, use first word
    return words[0].lower() if words else "untitled"

def extract_year_from_text(text):
    """
    Extract year from PDF text content.
    """
    # Look for year in the entire text
    year_match = re.search(r'\b(19|20)\d{2}\b', text)
    if year_match:
        year = int(year_match.group(0))
        if 1900 <= year <= 2030:  # Reasonable year range
            return year
    return None

def extract_year_from_metadata(reader: PyPDF2.PdfReader) -> Optional[int]:
    meta = getattr(reader, 'metadata', None)
    if not meta:
        return None
    # Common keys: /CreationDate, /ModDate in format D:YYYYMMDD...
    for key in ('/CreationDate', '/ModDate'):
        raw = meta.get(key) if isinstance(meta, dict) else getattr(meta, key.replace('/', '').lower(), None)
        if not raw:
            continue
        m = re.search(r"(19|20)\d{2}", str(raw))
        if m:
            year = int(m.group(0))
            if 1900 <= year <= 2030:
                return year
    return None

def _extract_surname(name_str: str):
    """
    Extract a probable surname from a name string.
    Handles patterns like:
    - "Surname, First Middle"
    - "First Middle Surname"
    - "First Surname and Second Surname"
    """
    if not name_str:
        return None
    # Remove emails and contents in parentheses
    name = re.sub(r"\(.+?\)", " ", name_str)
    name = re.sub(r"<.+?>", " ", name)
    name = re.sub(r"\S+@\S+", " ", name)
    # Remove common titles
    name = re.sub(r"\b(dr|prof|professor|mr|mrs|ms)\.?:?\b", " ", name, flags=re.I)
    # If comma-separated (Surname, First ...), take the left part
    if "," in name:
        left = name.split(",")[0].strip()
        tokens = [t for t in re.split(r"\s+", left) if t]
        if tokens:
            last = tokens[-1]
            if last.lower() in {"jr", "sr", "ii", "iii", "iv", "v"} and len(tokens) >= 2:
                return tokens[-2]
            return last
    # If joined with 'and', take the first author's segment
    primary = re.split(r"\band\b", name, flags=re.I)[0].strip()
    tokens = [t for t in re.split(r"\s+", primary) if t]
    # Prefer the last token that looks like a surname (Capitalized, len>=3)
    for tok in reversed(tokens):
        if re.match(r"^[A-Z][a-zA-Z\-']{2,}$", tok):
            return tok
    return tokens[-1] if tokens else None

def extract_author_from_text(text, max_lines=40):
    """
    Extract first author's surname from PDF text content using heuristics.
    Prioritize cues like ORCID brackets and typical author line patterns.
    """
    lines = text.split('\n')

    def looks_like_author_line(s: str) -> bool:
        s_low = s.lower()
        if not s or len(s.split()) < 2:
            return False
        bad = ['abstract', 'introduction', 'keywords', 'university', 'department',
               'email', '@', 'www.', 'http', 'doi:', 'arxiv:', 'proceedings',
               'conference', 'workshop', 'journal']
        if any(b in s_low for b in bad):
            return False
        return True

    banned_tokens = {
        'table', 'tables', 'web', 'semantic', 'annotation', 'annotations', 'knowledge', 'csv',
        'labels', 'queries', 'seman', 'websemantics', 'futuregenerationcomputersystems', 'station',
        'adog', 'facts', 'archetype', 'tcn', 'gbmt', 'infogather', 'mantistable', 'colnet',
        'columns', 'citation', 'reca', 'tabel', 'entitymatching', 'dagobah', 'torchictab', 'santos',
        'keplerasi', 'tablellama', 'startransformers', 'semtex', 'lexma', 'linkingpark', 'mtab',
        'jentab', 'turl', 'magic'
    }

    # 1) ORCID-style pattern (names followed by [0000-....])
    # Allow optional numeric footnote between name and bracket (e.g., Korini1[0000-...])
    orcid_name_pat = re.compile(r"([A-Z][a-zA-Z\-']+\s+[A-Z][a-zA-Z\-']+)\s*\d{0,2}\s*\[\d{4}[\d\-−–]+\]")
    for i, line in enumerate(lines[:max_lines]):
        line = line.strip()
        if not looks_like_author_line(line):
            continue
        m = orcid_name_pat.search(line)
        if m:
            surname = _extract_surname(m.group(1))
            if surname and surname.lower() not in banned_tokens:
                return surname

    # 2) Lines with multiple names separated by 'and' or commas
    sep_pat = re.compile(r"\band\b|,\s+")
    # Allow optional trailing footnote digits on tokens
    name_pat = re.compile(r"([A-Z][a-zA-Z\-']+\d?\s+[A-Z][a-zA-Z\-']+\d?)")
    for i, line in enumerate(lines[:max_lines]):
        line = line.strip()
        if not looks_like_author_line(line):
            continue
        parts = [p.strip() for p in sep_pat.split(line) if p.strip()]
        for p in parts:
            nm = name_pat.search(p)
            if nm:
                surname = _extract_surname(nm.group(1))
                if surname and surname.lower() not in banned_tokens:
                    return surname

    # 3) Fallback: first capitalized sequence at start of line
    for i, line in enumerate(lines[:max_lines]):
        line = line.strip()
        if not looks_like_author_line(line):
            continue
        candidate_line = line.title() if line.isupper() else line
        author_match = re.search(r"^([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+)*)", candidate_line)
        if author_match:
            surname = _extract_surname(author_match.group(1).strip())
            if surname and len(surname) > 1 and surname.lower() not in banned_tokens:
                return surname

    # 4) 'et al.' indicator
    for i, line in enumerate(lines[:max_lines]):
        line = line.strip()
        if 'et al.' in line.lower():
            before = re.split(r"et al\.", line, flags=re.I)[0].strip()
            surname = _extract_surname(before)
            if surname and surname.lower() not in banned_tokens:
                return surname

    return "unknown"

def parse_year_from_filename(filename: str):
    """Extract a 4-digit year prefix from common filename patterns like 'YYYY_...'"""
    m = re.match(r'^(\d{4})[ _\-]', filename)
    if m:
        year = int(m.group(1))
        if 1900 <= year <= 2030:
            return year
    return None

def parse_standard_filename(filename):
    """
    Parse standard format: [YYYY] Author Venue.pdf
    """
    # Pattern 1: [YYYY] Author.pdf
    match1 = re.match(r'\[(\d{4})\]\s+([A-Za-z]+)\.pdf', filename)
    if match1:
        return int(match1.group(1)), match1.group(2)
    
    # Pattern 2: [YYYY] Author Venue.pdf (with spaces in venue)
    match2 = re.match(r'\[(\d{4})\]\s+([A-Za-z]+)\s+(.+)\.pdf', filename)
    if match2:
        return int(match2.group(1)), match2.group(2)
    
    # Pattern 3: [YYYY] Author-Venue.pdf
    match3 = re.match(r'\[(\d{4})\]\s+([A-Za-z]+)-(.+)\.pdf', filename)
    if match3:
        return int(match3.group(1)), match3.group(2)
    
    return None, None

def is_already_renamed(filename):
    """
    Check if filename already follows the standard format.
    Format: YYYY_surname_first-word-of-title.pdf
    """
    # More flexible pattern to catch various valid formats
    # Matches: YYYY_surname_anything.pdf
    # The surname can contain letters, numbers, and special characters
    pattern = r'^\d{4}_[a-zA-Z0-9_-]+_.*\.pdf$'
    return re.match(pattern, filename) is not None

def extract_author_from_metadata(reader: PyPDF2.PdfReader) -> Optional[str]:
    meta = getattr(reader, 'metadata', None)
    if not meta:
        return None
    val = meta.get('/Author') if isinstance(meta, dict) else getattr(meta, 'author', None)
    if not val:
        return None
    # Sometimes metadata contains multiple authors; take the first token pair
    s = str(val).strip()
    # Remove emails and brackets
    s = re.sub(r"\(.+?\)", " ", s)
    s = re.sub(r"<.+?>", " ", s)
    s = re.sub(r"\S+@\S+", " ", s)
    tokens = s.split(',')[0].strip()
    surname = _extract_surname(tokens)
    return surname

def clean_author_name(author):
    """
    Clean and validate author name for filename.
    """
    if not author or author == "unknown":
        return "unknown"
    
    # Remove special characters and extra spaces
    clean_author = re.sub(r'[^\w\s]', '', author)
    clean_author = re.sub(r'\s+', ' ', clean_author).strip()
    
    # Take first word (surname)
    words = clean_author.split()
    if words:
        return words[0].lower()
    
    return "unknown"

def create_new_filename(year, author, first_word, approaches_dir, current_name: Optional[str] = None):
    """
    Create a new filename and handle duplicates.
    """
    # Clean author name
    clean_author = clean_author_name(author)
    
    new_filename = f"{year}_{clean_author}_{first_word}.pdf"
    new_filename = re.sub(r'[^\w\-\.]', '_', new_filename)
    new_path = approaches_dir / new_filename

    # If the computed name is exactly the current one, do not force suffixes
    if current_name and new_filename == current_name:
        return new_filename
    
    if new_path.exists():
        counter = 1
        while new_path.exists():
            # If the existing path is the same file as current, no change needed
            if current_name and new_path.name == current_name:
                break
            new_filename = f"{year}_{clean_author}_{first_word}_{counter}.pdf"
            new_filename = re.sub(r'[^\w\-\.]', '_', new_filename)
            new_path = approaches_dir / new_filename
            counter += 1
    
    return new_filename

def _determine_year_author_title(filename: str, reader: PyPDF2.PdfReader, first_page_text: str) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    """
    Decide on year, author, and title using multiple strategies.
    """
    # Title from text (first) then metadata
    title = extract_title_from_text(first_page_text) or None
    if not title or title == 'Title not found':
        meta_title = extract_title_from_metadata(reader)
        if meta_title:
            title = meta_title

    # Year: filename [YYYY], filename prefix, metadata, then text
    year, author_from_std = parse_standard_filename(filename)
    if not year:
        year = parse_year_from_filename(filename)
    if not year:
        year = extract_year_from_metadata(reader)
    if not year:
        # Try more pages to find a year
        combined = first_page_text
        try:
            for i in range(1, min(3, len(reader.pages))):
                t = reader.pages[i].extract_text() or ''
                combined += "\n" + t
        except Exception:
            pass
        year = extract_year_from_text(combined)

    # Author: standard name from filename, then metadata, then text
    author = author_from_std
    if not author:
        author = extract_author_from_metadata(reader)
    if not author:
        author = extract_author_from_text(first_page_text)

    return year, author, title

def force_rename_all_papers(dry_run: bool = False, only_nonstandard: bool = False):
    """
    Force rename ALL PDF files to standard format, even if already renamed.
    This ensures consistent naming across all PDFs.
    """
    approaches_dir = Path("approaches")
    
    if not approaches_dir.exists():
        print("Error: approaches folder not found!")
        return
    
    # Get all PDF files
    all_pdfs = list(approaches_dir.glob("*.pdf"))
    
    if not all_pdfs:
        print("No PDF files found in approaches folder!")
        return
    
    print(f"Found {len(all_pdfs)} PDF files to process...")
    print("FORCING RENAME of ALL files to standard format...")
    print("This will ensure consistent naming across all PDFs!")
    
    successful_renames = []
    errors = []
    skipped = []
    skip_reasons = {}
    
    for i, pdf_file in enumerate(all_pdfs, 1):
        filename = pdf_file.name
        print(f"Processing {i}/{len(all_pdfs)}: {filename}")

        if only_nonstandard and is_already_renamed(filename):
            skipped.append(filename)
            skip_reasons.setdefault('already_standard', 0)
            skip_reasons['already_standard'] += 1
            print(f"  Skipping {filename}: already in standard format")
            continue
        
        # Force rename ALL files, even if they appear to be in standard format
        # This ensures consistent naming across all PDFs
        print(f"  Processing {filename} for renaming...")
        
        try:
            # Extract text from PDF
            with open(pdf_file, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                if len(pdf_reader.pages) == 0:
                    print(f"  Skipping {filename}: no pages")
                    skipped.append(filename)
                    continue
                
                # Extract text from first page
                first_page = pdf_reader.pages[0]
                text = first_page.extract_text() or ""

                # Determine fields using combined strategies
                year, author, title = _determine_year_author_title(filename, pdf_reader, text)
                
                # Check if we have all required information
                if not year:
                    print(f"  Skipping {filename}: cannot extract year")
                    skipped.append(filename)
                    skip_reasons.setdefault('missing_year', 0)
                    skip_reasons['missing_year'] += 1
                    continue
                
                if not author or author == "unknown":
                    print(f"  Skipping {filename}: cannot extract author")
                    skipped.append(filename)
                    skip_reasons.setdefault('missing_author', 0)
                    skip_reasons['missing_author'] += 1
                    continue
                
                # Get first word of title
                first_word = get_first_word_of_title(title)
                
                # Create new filename
                new_filename = create_new_filename(year, author, first_word, approaches_dir, current_name=filename)

                if dry_run:
                    print(f"  DRY-RUN ✓ {filename} → {new_filename}")
                else:
                    # Rename the file
                    pdf_file.rename(approaches_dir / new_filename)
                
                successful_renames.append({
                    "old": filename,
                    "new": new_filename,
                    "year": year,
                    "author": author,
                    "title": title,
                    "first_word": first_word
                })
                
                if not dry_run:
                    print(f"  ✓ {filename} → {new_filename}")
                
        except Exception as e:
            error_msg = f"Error processing {filename}: {e}"
            print(f"  ✗ {error_msg}")
            errors.append(error_msg)
    
    # Summary
    print(f"\n{'='*80}")
    print(f"FORCE RENAMING SUMMARY")
    print(f"{'='*80}")
    print(f"Total PDFs found: {len(all_pdfs)}")
    action_word = "Would rename" if dry_run else "Successfully renamed"
    print(f"{action_word}: {len(successful_renames)}")
    print(f"Skipped: {len(skipped)}")
    print(f"Errors: {len(errors)}")
    if skip_reasons:
        print("Skip reasons:")
        for k, v in skip_reasons.items():
            print(f"  - {k}: {v}")
    
    if successful_renames:
        print(f"\nRenames completed:")
        for i, rename in enumerate(successful_renames):
            print(f"{i+1}. {rename['old']} → {rename['new']}")
            print(f"   Title: {rename['title']}")
            print(f"   Year: {rename['year']}, Author: {rename['author']}")
            print(f"   First word: {rename['first_word']}")
            print()
    
    if skipped:
        print(f"\nSkipped files (already renamed):")
        for skip in skipped:
            print(f"• {skip}")
    
    if errors:
        print(f"\nErrors encountered:")
        for error in errors:
            print(f"• {error}")
    
    # Save comprehensive log
    log_file = approaches_dir / ("comprehensive_rename_log.dry.json" if dry_run else "comprehensive_rename_log.json")
    log_data = {
        "total_pdfs": len(all_pdfs),
        "successful_renames": len(successful_renames),
        "skipped": len(skipped),
        "errors": len(errors),
        "renames": successful_renames,
        "skipped_files": skipped,
        "error_details": errors,
        "dry_run": dry_run,
        "only_nonstandard": only_nonstandard,
        "skip_reasons": skip_reasons
    }
    
    with open(log_file, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, indent=2, ensure_ascii=False)
    
    print(f"\nComprehensive log saved to: {log_file}")
    
    # Final verification
    print(f"\n{'='*80}")
    print(f"FINAL VERIFICATION")
    print(f"{'='*80}")
    
    final_pdfs = list(approaches_dir.glob("*.pdf"))
    standard_pdfs = [f for f in final_pdfs if is_already_renamed(f.name)]
    non_standard_pdfs = [f for f in final_pdfs if not is_already_renamed(f.name)]
    
    print(f"Total PDFs after renaming: {len(final_pdfs)}")
    print(f"PDFs with standard format: {len(standard_pdfs)}")
    print(f"PDFs with non-standard format: {len(non_standard_pdfs)}")
    
    if non_standard_pdfs:
        print(f"\nRemaining non-standard PDFs:")
        for pdf in non_standard_pdfs:
            print(f"• {pdf.name}")
    else:
        print(f"\n🎉 SUCCESS! All PDFs now follow the standard format!")
    
    # Additional verification: check for consistent naming
    print(f"\n{'='*80}")
    print(f"CONSISTENCY CHECK")
    print(f"{'='*80}")
    
    # Check if all PDFs follow the exact same naming pattern
    all_follow_pattern = all(is_already_renamed(f.name) for f in final_pdfs)
    if all_follow_pattern:
        print("✅ All PDFs follow consistent naming pattern!")
        print("✅ Naming format: YYYY_surname_first-word-of-title.pdf")
    else:
        print("⚠️  Some PDFs may not follow the exact naming pattern")
        print("Consider running the script again to ensure consistency")

def main():
    parser = argparse.ArgumentParser(description="Rename PDFs to YYYY_surname_firstword.pdf")
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without renaming files')
    parser.add_argument('--only-nonstandard', action='store_true', help='Process only files not already matching the pattern')
    args = parser.parse_args()

    force_rename_all_papers(dry_run=args.dry_run, only_nonstandard=args.only_nonstandard)

if __name__ == "__main__":
    main()
