#!/usr/bin/env python3
"""
seed_200_responses.py
=====================
Injects 200 completed respondents with randomised responses into a project
so you can stress-test the ResponsesScreen pagination.

Usage
-----
  cd backend
  python seed_200_responses.py                       # picks project interactively
  python seed_200_responses.py --project-id <uuid>   # skip project picker
  python seed_200_responses.py --count 50            # inject only 50 (default 200)
  python seed_200_responses.py --username foo --password bar
"""

import argparse
import random
import time
from datetime import datetime, timedelta

import requests

# ── Configuration ────────────────────────────────────────────────────────────
BASE_URL    = "http://127.0.0.1:8000"
DEFAULT_COUNT = 200

# Respondent types that exist in the backend Respondent model
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

def rand_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def rand_date(days_back=180):
    """Random datetime within the last N days."""
    offset = random.randint(0, days_back * 86400)
    return (datetime.now() - timedelta(seconds=offset)).isoformat()


def generate_response_value(question):
    """Generate a plausible response_value for a question."""
    rt = question.get("response_type", "text_short")
    options = question.get("options", [])

    if rt == "choice_single" and options:
        return random.choice(options)
    if rt == "choice_multiple" and options:
        k = random.randint(1, min(3, len(options)))
        return ", ".join(random.sample(options, k))
    if rt in ("scale_rating", "numeric_integer"):
        return str(random.randint(1, 5))
    if rt == "numeric_decimal":
        return f"{random.uniform(1, 100):.2f}"
    if rt == "text_long":
        return "This is a sample long-text response for pagination testing."
    # default: short text
    return "Sample answer"


# ── API helpers ───────────────────────────────────────────────────────────────

def login(session, username, password):
    field = "email" if "@" in username else "username"
    r = session.post(f"{BASE_URL}/api/auth/login/", json={field: username, "password": password})
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
    """Fetch up to 1 000 questions for the project."""
    all_qs = []
    url = f"{BASE_URL}/api/forms/questions/?project_id={project_id}&page_size=200"
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


def create_respondent(session, headers, project_id, index, total):
    name = rand_name()
    rtype = random.choice(RESPONDENT_TYPES)
    commodity = random.choice(COMMODITIES)
    country = random.choice(COUNTRIES)

    payload = {
        "respondent_id": f"SEED_{datetime.now().strftime('%Y%m%d%H%M')}_{index:04d}",
        "project": project_id,
        "name": name,
        "respondent_type": rtype,
        "commodity": commodity,
        "country": country,
        "completion_status": "completed",
        "consent_given": True,
        "is_anonymous": False,
        "demographics": {
            "age": random.randint(20, 65),
            "gender": random.choice(["Male", "Female"]),
        },
        "location_data": {
            "latitude": 5.56 + random.uniform(-2, 2),
            "longitude": -0.21 + random.uniform(-2, 2),
            "location_name": country,
            "accuracy": round(random.uniform(5, 50), 1),
        },
    }

    r = session.post(f"{BASE_URL}/api/v1/respondents/", json=payload, headers=headers)
    if r.status_code not in (200, 201):
        print(f"  ⚠  Respondent creation failed ({r.status_code}): {r.text[:200]}")
        return None
    return r.json()


def create_responses(session, headers, project_id, respondent_uuid, questions):
    """Submit one response per question for this respondent (bulk where possible)."""
    successes = 0
    for q in questions:
        payload = {
            "project": project_id,
            "question": q["id"],
            "respondent": respondent_uuid,
            "response_value": generate_response_value(q),
        }
        r = session.post(f"{BASE_URL}/api/v1/responses/", json=payload, headers=headers)
        if r.status_code in (200, 201):
            successes += 1
        # 409 = already exists (unique_together), silently skip
    return successes


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed test respondents for pagination testing")
    parser.add_argument("--username",   default="admin@admin.com", help="Backend username or email")
    parser.add_argument("--password",   default="@143Ct341#",      help="Backend password")
    parser.add_argument("--project-id", default=None,            help="Project UUID (skip picker)")
    parser.add_argument("--count",      type=int, default=DEFAULT_COUNT,
                        help=f"Number of respondents to create (default {DEFAULT_COUNT})")
    args = parser.parse_args()

    session = requests.Session()

    # ── Check server ──
    try:
        session.get(BASE_URL + "/", timeout=5)
        print(f"✅ Server reachable at {BASE_URL}")
    except Exception:
        print(f"❌ Cannot reach {BASE_URL} — is the Django server running?")
        return

    # ── Login ──
    print(f"🔑 Logging in as {args.username}...")
    token = login(session, args.username, args.password)
    headers = {"Authorization": f"Token {token}"}
    print("✅ Logged in")

    # ── Pick project ──
    project_id = args.project_id
    if not project_id:
        projects = list_projects(session, headers)
        if not projects:
            print("❌ No projects found for this user.")
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

    # ── Fetch questions ──
    print("📋 Fetching questions...")
    questions = get_questions(session, headers, project_id)
    print(f"   Found {len(questions)} questions")
    if not questions:
        print("⚠  No questions found — respondents will be created with 0 responses.")

    # ── Seed respondents ──
    count = args.count
    print(f"\n🚀 Creating {count} respondents...\n{'─'*60}")

    ok_respondents = 0
    total_responses = 0

    for i in range(1, count + 1):
        respondent = create_respondent(session, headers, project_id, i, count)
        if not respondent:
            continue

        respondent_uuid = respondent["id"]
        name            = respondent.get("name", respondent.get("respondent_id", "?"))
        ok_respondents += 1

        resp_count = 0
        if questions:
            resp_count = create_responses(session, headers, project_id, respondent_uuid, questions)
            total_responses += resp_count

        print(f"  [{i:>3}/{count}] ✅ {name:<30}  {resp_count} responses")

        # Brief pause every 10 to avoid hammering the server
        if i % 10 == 0:
            time.sleep(0.3)

    print(f"\n{'='*60}")
    print(f"🎉 Done!")
    print(f"   Respondents created : {ok_respondents}/{count}")
    print(f"   Total responses     : {total_responses}")
    print(f"   Questions per resp  : {len(questions)}")
    print(f"\nRefresh the Responses screen in the app to see the data.")


if __name__ == "__main__":
    main()
