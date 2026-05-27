import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def list_projects_and_counts(username="admin@admin.com", password="@143Ct341#"):
    # Login
    s = requests.Session()
    field = "email" if "@" in username else "username"
    r = s.post(f"{BASE_URL}/api/auth/login/", json={field: username, "password": password})
    r.raise_for_status()
    token = r.json()['token']
    headers = {'Authorization': f'Token {token}'}

    # List projects
    r = s.get(f"{BASE_URL}/api/projects/projects/", headers=headers)
    projects = r.json()
    if 'results' in projects: projects = projects['results']

    print(f"Found {len(projects)} projects:")
    for p in projects:
        pid = p['id']
        name = p['name']
        
        # Get count
        cr = s.get(f"{BASE_URL}/api/responses/respondents/?project_id={pid}&page_size=1", headers=headers)
        count = 0
        if cr.status_code == 200:
            d = cr.json()
            count = d.get('total', d.get('count', 0))
        
        print(f"  - {name} ({pid}): {count} respondents")

if __name__ == "__main__":
    list_projects_and_counts()
