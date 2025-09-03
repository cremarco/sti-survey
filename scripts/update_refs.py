#!/usr/bin/env python3
"""
Script to update all ref fields in sti-survey.json to follow the new format:
YYYY_surname_first-word-of-title
"""

import json
import re
import sys
from pathlib import Path

def extract_year_and_author(ref):
    """Extract year and author from old format ref"""
    # Pattern: surnameYYYYword or surnameYYYYword-word
    match = re.match(r'^([a-zA-Z]+)(\d{4})(.+)$', ref)
    if match:
        surname, year, title_part = match.groups()
        # Clean up title part - take first word, remove special chars
        first_word = re.sub(r'[^a-zA-Z0-9]', '', title_part.split('-')[0])
        return f"{year}_{surname}_{first_word}"
    return ref

def update_refs_in_file(file_path):
    """Update all ref fields in the JSON file"""
    
    # Read the JSON file
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Track changes
    changes = 0
    
    # Update refs in citations
    for entry in data:
        if 'citations' in entry:
            for citation in entry['citations']:
                if 'ref' in citation and citation['ref']:
                    old_ref = citation['ref']
                    new_ref = extract_year_and_author(old_ref)
                    if new_ref != old_ref:
                        citation['ref'] = new_ref
                        changes += 1
                        print(f"Updated ref: {old_ref} -> {new_ref}")
    
    # Write back to file
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    
    print(f"\nTotal refs updated: {changes}")
    return changes

def main():
    # Path to the JSON file (relative to scripts directory)
    json_file = Path("../public/data/sti-survey.json")
    
    if not json_file.exists():
        print(f"Error: {json_file} not found")
        sys.exit(1)
    
    print(f"Updating refs in {json_file}...")
    
    try:
        changes = update_refs_in_file(json_file)
        print(f"Successfully updated {changes} refs")
    except Exception as e:
        print(f"Error updating file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
