#!/usr/bin/env python3
"""
diagnose_and_reseed.py
======================
1. Diagnoses why seeded responses don't appear in exports
   (question FK was SET_NULL when questions were deleted/regenerated).
2. Cleans up orphaned responses (null question FK).
3. Re-seeds fresh respondents+responses linked to the project's CURRENT questions.

Usage
-----
  cd backend
  python diagnose_and_reseed.py                        # interactive project picker
  python diagnose_and_reseed.py --project-id <uuid>    # skip picker
  python diagnose_and_reseed.py --project-id <uuid> --count 50
  python diagnose_and_reseed.py --project-id <uuid> --diagnose-only
  python diagnose_and_reseed.py --project-id <uuid> --clean-only
"""

import argparse
import random
import time
from datetime import datetime, timedelta

import requests

BASE_URL      = "http://127.0.0.1:8000"
DEFAULT_COUNT = 200

RESPONDENT_TYPES = [
    "farmers", "aggregators_lbcs", "processors",
    "input_suppliers", "retailers_food_vendors", "government",
]
COMMODITIES = ["cocoa", "maize", "palm_oil", "groundnut", "honey"]
COUNTRIES   = ["Ghana", "Ivory Coast", "Nigeria", "Cameroon"]

FIRST_NAMES = [
    "Kwame","Ama","Kofi","Abena","Yaw","Akosua","Kwesi","Efua","Kojo","Adwoa",
    "James","Mary","Robert","Linda","William","Barbara","David","Jennifer","Michael","Patricia",
    "Carlos","Maria","Juan","Ana","Pedro","Sofia","Luis","Isabella","Miguel","Carmen",
    "Modou","Fatou","Mamadou","Aissatou","Cheikh","Mariama","Ibrahima","Kadiatou",
]
LAST_NAMES = [
    "Asante","Mensah","Osei","Darko","Boateng","Owusu","Ampah","Sarpong","Frimpong",
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Martinez","Davis","Lopez",
    "Diallo","Bah","Barry","Kouyate","Traore","Keita","Toure","Coulibaly",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def login(session, username, password):
    # Send as 'email' if it looks like an email address, otherwise 'username'
    field = "email" if "@" in username else "username"
    r = session.post(f"{BASE_URL}/api/auth/login/",
                     json={field: username, "password": password})
    r.raise_for_status()
    token = r.json().get("token")
    if not token:
        raise RuntimeError(f"Login failed: {r.json()}")
    return token


def list_projects(session, headers):
    r = session.get(f"{BASE_URL}/api/projects/projects/", headers=headers)
    r.raise_for_status()
    data = r.json()
    return data.get("results", data) if isinstance(data, dict) else data


def get_questions(session, headers, project_id):
    all_qs, url = [], f"{BASE_URL}/api/forms/questions/?project_id={project_id}&page_size=200"
    while url:
        r = session.get(url, headers=headers)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and "results" in data:
            all_qs.extend(data["results"])
            url = data.get("next")
        else:
            all_qs.extend(data if isinstance(data, list) else [])
            url = None
    return all_qs


def get_respondents_page(session, headers, project_id, page=1, page_size=100):
    r = session.get(
        f"{BASE_URL}/api/responses/respondents/",
        params={"project_id": project_id, "page": page, "page_size": page_size},
        headers=headers
    )
    r.raise_for_status()
    return r.json()


def get_all_respondents(session, headers, project_id):
    respondents, page = [], 1
    while True:
        data = get_respondents_page(session, headers, project_id, page=page, page_size=100)
        results = data.get("results", data) if isinstance(data, dict) else data
        if not results:
            break
        respondents.extend(results)
        total = data.get("total", data.get("count", len(respondents))) if isinstance(data, dict) else len(respondents)
        if len(respondents) >= total:
            break
        page += 1
    return respondents


def get_responses_for_respondent(session, headers, respondent_id):
    r = session.get(
        f"{BASE_URL}/api/responses/respondents/{respondent_id}/responses/",
        headers=headers
    )
    if r.status_code != 200:
        return []
    data = r.json()
    return data.get("responses", [])


def generate_response_value(question):
    rt      = question.get("response_type", "text_short")
    options = question.get("options", [])
    if rt == "choice_single"   and options: return random.choice(options)
    if rt == "choice_multiple" and options:
        k = random.randint(1, min(3, len(options)))
        return ", ".join(random.sample(options, k))
    if rt in ("scale_rating", "numeric_integer"): return str(random.randint(1, 5))
    if rt == "numeric_decimal":  return f"{random.uniform(1, 100):.2f}"
    if rt == "text_long":        return "Sample long-text response for testing."
    return "Sample answer"


def create_respondent(session, headers, project_id, index):
    rtype     = random.choice(RESPONDENT_TYPES)
    commodity = random.choice(COMMODITIES)
    country   = random.choice(COUNTRIES)
    name      = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

    payload = {
        "respondent_id": f"SEED_{datetime.now().strftime('%Y%m%d%H%M')}_{index:04d}",
        "project":           project_id,
        "name":              name,
        "respondent_type":   rtype,
        "commodity":         commodity,
        "country":           country,
        "completion_status": "completed",
        "consent_given":     True,
        "is_anonymous":      False,
    }
    r = session.post(f"{BASE_URL}/api/v1/respondents/", json=payload, headers=headers)
    if r.status_code not in (200, 201):
        print(f"  ⚠  Respondent creation failed ({r.status_code}): {r.text[:200]}")
        return None
    return r.json()


def create_responses(session, headers, project_id, respondent_uuid, questions):
    successes = 0
    for q in questions:
        payload = {
            "project":        project_id,
            "question":       q["id"],
            "respondent":     respondent_uuid,
            "response_value": generate_response_value(q),
        }
        r = session.post(f"{BASE_URL}/api/v1/responses/", json=payload, headers=headers)
        if r.status_code in (200, 201):
            successes += 1
    return successes


# ── Stages ────────────────────────────────────────────────────────────────────

def diagnose(session, headers, project_id):
    print("\n── DIAGNOSIS ──────────────────────────────────────────────────")

    # Questions
    questions = get_questions(session, headers, project_id)
    print(f"  Questions in project   : {len(questions)}")
    if not questions:
        print("  ⚠  No questions found — responses cannot be linked to any question.")
        print("     You must create questions in the Form Builder first.")

    # Respondents
    respondents = get_all_respondents(session, headers, project_id)
    print(f"  Respondents            : {len(respondents)}")

    # Sample a few respondents and count null-question responses
    orphaned_total   = 0
    linked_total     = 0
    respondents_checked = 0
    sample = respondents[:20]   # check first 20 to keep it fast

    for resp in sample:
        rid = resp["id"]
        responses = get_responses_for_respondent(session, headers, rid)
        for r in responses:
            if r.get("question") is None:
                orphaned_total += 1
            else:
                linked_total += 1
        respondents_checked += 1

    if respondents_checked:
        print(f"\n  Sampled {respondents_checked} respondents for response-level diagnosis:")
        print(f"    Responses with live question FK : {linked_total}")
        print(f"    Responses with NULL question FK : {orphaned_total}  ← these are invisible in exports")

    if orphaned_total > 0 and linked_total == 0:
        print("\n  ✖  ROOT CAUSE CONFIRMED: all responses have question=NULL.")
        print("     The questions were deleted/regenerated after seeding.")
        print("     → Run this script without --diagnose-only to clean up and re-seed.")
    elif orphaned_total > 0:
        print("\n  ⚠  Partial orphaning: some responses lost their question FK.")
    else:
        print("\n  ✔  Response links look healthy (sampled respondents).")

    print("──────────────────────────────────────────────────────────────")
    return questions, respondents


def clean_seeded_respondents(session, headers, project_id, respondents):
    """Delete SEED_* respondents that have zero live-question responses."""
    print("\n── CLEANUP ────────────────────────────────────────────────────")
    seeded = [r for r in respondents if r.get("respondent_id", "").startswith("SEED_")]
    print(f"  Found {len(seeded)} SEED_* respondents to remove...")

    deleted = 0
    for resp in seeded:
        rid = resp["id"]
        r = session.delete(
            f"{BASE_URL}/api/responses/respondents/{rid}/",
            headers=headers
        )
        if r.status_code in (200, 204):
            deleted += 1
        else:
            print(f"  ⚠  Could not delete {resp['respondent_id']} ({r.status_code})")

    print(f"  Deleted {deleted}/{len(seeded)} seeded respondents.")
    print("──────────────────────────────────────────────────────────────")


def reseed(session, headers, project_id, count, questions):
    print(f"\n── RESEED ({count} respondents) ────────────────────────────────────")

    if not questions:
        print("  ⚠  No questions found — respondents will be created with 0 responses.")
        print("     Create questions in the Form Builder first, then re-run.")
        print("──────────────────────────────────────────────────────────────")
        return

    ok, total_resp = 0, 0
    for i in range(1, count + 1):
        respondent = create_respondent(session, headers, project_id, i)
        if not respondent:
            continue
        ok += 1
        resp_count = create_responses(session, headers, project_id, respondent["id"], questions)
        total_resp += resp_count
        print(f"  [{i:>3}/{count}] ✅ {respondent.get('name', respondent['respondent_id']):<30}  "
              f"{resp_count} responses  ({respondent['respondent_type']} / {respondent['commodity']})")
        if i % 10 == 0:
            time.sleep(0.2)

    print(f"\n  Done. Created {ok}/{count} respondents, {total_resp} total responses.")
    print("──────────────────────────────────────────────────────────────")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Diagnose and re-seed test data")
    parser.add_argument("--username",      default="admin@admin.com", help="Backend username or email")
    parser.add_argument("--password",      default="@143Ct341#",      help="Backend password")
    parser.add_argument("--project-id",    default=None)
    parser.add_argument("--count",         type=int, default=DEFAULT_COUNT)
    parser.add_argument("--diagnose-only", action="store_true",
                        help="Only run diagnosis, do not modify any data")
    parser.add_argument("--clean-only",    action="store_true",
                        help="Only delete SEED_* respondents, do not re-seed")
    args = parser.parse_args()

    session = requests.Session()
    try:
        session.get(BASE_URL + "/", timeout=5)
        print(f"✅ Server reachable at {BASE_URL}")
    except Exception:
        print(f"❌ Cannot reach {BASE_URL} — is Django running?")
        return

    print(f"🔑 Logging in as '{args.username}'...")
    token   = login(session, args.username, args.password)
    headers = {"Authorization": f"Token {token}"}
    print("✅ Logged in")

    # Project selection
    project_id = args.project_id
    if not project_id:
        projects = list_projects(session, headers)
        if not projects:
            print("❌ No projects found.")
            return
        print("\nAvailable projects:")
        for i, p in enumerate(projects):
            print(f"  [{i+1}] {p['name']}  (id: {p['id']})")
        choice = input("\nEnter project number: ").strip()
        try:
            project_id = projects[int(choice) - 1]["id"]
        except (ValueError, IndexError):
            print("❌ Invalid choice.")
            return

    print(f"\n📂 Project ID: {project_id}")

    questions, respondents = diagnose(session, headers, project_id)

    if args.diagnose_only:
        return

    if not args.clean_only:
        confirm = input(
            f"\nThis will DELETE all SEED_* respondents and re-create {args.count} new ones.\n"
            f"Proceed? [y/N] "
        ).strip().lower()
        if confirm != "y":
            print("Aborted.")
            return

    clean_seeded_respondents(session, headers, project_id, respondents)

    if not args.clean_only:
        reseed(session, headers, project_id, args.count, questions)
        print("\n🎉 Re-seed complete! Refresh the Responses screen to see the new data.")
        print("   All new respondents have live question FKs → they will appear in exports.")


if __name__ == "__main__":
    main()
