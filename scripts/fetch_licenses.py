#!/usr/bin/env python3
import json
import os
import re
import sys
from typing import Optional
from urllib.parse import urlparse
import requests


GITHUB_API = "https://api.github.com"


def parse_github_repo(url: str):
    try:
        u = urlparse(url)
        if u.netloc not in {"github.com", "www.github.com"}:
            return None
        # Path: /owner/repo[/...]
        parts = [p for p in u.path.split("/") if p]
        if len(parts) < 2:
            return None
        owner, repo = parts[0], parts[1]
        # Strip .git suffix
        if repo.endswith(".git"):
            repo = repo[:-4]
        return owner, repo
    except Exception:
        return None


def github_get(path: str, token: Optional[str]):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "sti-survey-license-fetcher"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = requests.get(GITHUB_API + path, headers=headers, timeout=20)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def fetch_github_license(owner: str, repo: str, token: Optional[str]):
    # Try the dedicated license endpoint first
    data = github_get(f"/repos/{owner}/{repo}/license", token)
    if data and isinstance(data, dict):
        lic = data.get("license") or {}
        name = lic.get("name")
        spdx = lic.get("spdx_id")
        if name and name != "NOASSERTION":
            return name
        # Fallback to repo object
    repo_obj = github_get(f"/repos/{owner}/{repo}", token)
    if repo_obj and isinstance(repo_obj, dict):
        lic = repo_obj.get("license") or {}
        name = lic.get("name")
        if name and name != "NOASSERTION":
            return name
    return None


def is_probably_repo(url: str) -> bool:
    if not url:
        return False
    u = url.lower()
    return any(host in u for host in ["github.com", "bitbucket.org", "gitlab.com"]) and not u.endswith((".pdf", ".zip"))


def main():
    path = "public/data/sti-survey.json"
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    updates = []
    for i, entry in enumerate(data):
        code = entry.get("code") or ""
        if not is_probably_repo(code):
            continue
        gh = parse_github_repo(code)
        if not gh:
            continue
        owner, repo = gh
        try:
            lic_name = fetch_github_license(owner, repo, token)
        except requests.HTTPError as e:
            # Skip on API errors (e.g., rate limit)
            lic_name = None
        except requests.RequestException:
            lic_name = None
        if lic_name:
            old = entry.get("license")
            if old != lic_name:
                entry["license"] = lic_name
                updates.append({
                    "index": i,
                    "id": entry.get("id"),
                    "repo": f"{owner}/{repo}",
                    "old": old,
                    "new": lic_name,
                })

    if updates:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

    # Print a summary report to stdout
    print(json.dumps({
        "updated": len(updates),
        "changes": updates
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
