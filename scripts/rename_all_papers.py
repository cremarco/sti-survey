#!/usr/bin/env python3
"""
Comprehensive script to rename all PDF files in the approaches folder.
Handles all possible filename formats and extracts information directly from PDF content.
Final format: YYYY_surname_first-word-of-title.pdf
"""

import os
import json
import re
from pathlib import Path
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
    Extract first author's surname from PDF text content.
    """
    lines = text.split('\n')
    
    for i, line in enumerate(lines[:max_lines]):
        line = line.strip()
        if not line:
            continue
        
        # Skip lines that are clearly not author lines
        if any(skip in line.lower() for skip in [
            'abstract', 'introduction', 'keywords', 'university',
            'department', 'email', '@', 'www.', 'http', 'doi:', 'arxiv:',
            'proceedings', 'conference', 'workshop', 'journal'
        ]):
            continue
        
        # Normalize ALL CAPS name lines to Title Case for matching
        candidate_line = line.title() if line.isupper() else line

        # Pattern: explicit names at line start
        author_match = re.search(r'^([A-Z][a-zA-Z\-\']+(?:\s+[A-Z][a-zA-Z\-\']+)*)', candidate_line)
        if author_match:
            surname = _extract_surname(author_match.group(1).strip())
            if surname and len(surname) > 1:
                return surname

        # Pattern: contains "et al." which often indicates author list
        if 'et al.' in candidate_line.lower():
            before_et_al = re.split(r'et al\.', candidate_line, flags=re.I)[0].strip()
            surname = _extract_surname(before_et_al)
            if surname:
                return surname

        # Pattern: lines with email addresses (often contain author names)
        if '@' in candidate_line and '.' in candidate_line:
            # Try the part before the email
            m = re.search(r'^([A-Z][a-zA-Z\-\']+(?:\s+[A-Z][a-zA-Z\-\']+)*)', candidate_line)
            if m:
                surname = _extract_surname(m.group(1).strip())
                if surname:
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

def create_new_filename(year, author, first_word, approaches_dir):
    """
    Create a new filename and handle duplicates.
    """
    # Clean author name
    clean_author = clean_author_name(author)
    
    new_filename = f"{year}_{clean_author}_{first_word}.pdf"
    new_filename = re.sub(r'[^\w\-\.]', '_', new_filename)
    new_path = approaches_dir / new_filename
    
    if new_path.exists():
        counter = 1
        while new_path.exists():
            new_filename = f"{year}_{clean_author}_{first_word}_{counter}.pdf"
            new_filename = re.sub(r'[^\w\-\.]', '_', new_filename)
            new_path = approaches_dir / new_filename
            counter += 1
    
    return new_filename

def force_rename_all_papers():
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
    
    for i, pdf_file in enumerate(all_pdfs, 1):
        filename = pdf_file.name
        print(f"Processing {i}/{len(all_pdfs)}: {filename}")
        
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
                
                # Extract title
                title = extract_title_from_text(text)
                
                # Try to extract year and author
                year = None
                author = None
                
                # First, try to parse from filename if it's in standard format
                if filename.startswith('['):
                    year, author = parse_standard_filename(filename)
                
                # If not found in filename, fallback to year in filename prefix
                if not year:
                    year = parse_year_from_filename(filename)
                # If still not found, extract from PDF content
                if not year:
                    year = extract_year_from_text(text)
                
                if not author:
                    author = extract_author_from_text(text)
                
                # Check if we have all required information
                if not year:
                    print(f"  Skipping {filename}: cannot extract year")
                    skipped.append(filename)
                    continue
                
                if not author or author == "unknown":
                    print(f"  Skipping {filename}: cannot extract author")
                    skipped.append(filename)
                    continue
                
                # Get first word of title
                first_word = get_first_word_of_title(title)
                
                # Create new filename
                new_filename = create_new_filename(year, author, first_word, approaches_dir)
                
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
    print(f"Successfully renamed: {len(successful_renames)}")
    print(f"Skipped (already in standard format): {len(skipped)}")
    print(f"Errors: {len(errors)}")
    
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
    log_file = approaches_dir / "comprehensive_rename_log.json"
    log_data = {
        "total_pdfs": len(all_pdfs),
        "successful_renames": len(successful_renames),
        "skipped": len(skipped),
        "errors": len(errors),
        "renames": successful_renames,
        "skipped_files": skipped,
        "error_details": errors
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

if __name__ == "__main__":
    force_rename_all_papers()
