import requests
import json

BASE_URL = "http://127.0.0.1:8000"
PROJECT_ID = "2c12d504-179c-493b-940e-2881f6d1bf79" # Test In Admin Account (seeded data)

def test_pagination():
    # Login
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login/", json={"username": "admin@admin.com", "password": "adminadmin"})
    if r.status_code != 200:
        print("Login failed")
        return
    token = r.json()['token']
    headers = {'Authorization': f'Token {token}'}

    # Fetch respondents page 1
    url = f"{BASE_URL}/api/responses/respondents/?project_id={PROJECT_ID}&page=1&page_size=20"
    print(f"Fetching: {url}")
    r = s.get(url, headers=headers)
    
    if r.status_code != 200:
        print(f"Failed: {r.status_code}")
        print(r.text)
        return

    data = r.json()
    print("\nKeys in response:", list(data.keys()))
    if 'links' in data:
        print("Keys in 'links':", list(data['links'].keys()))
    if 'total' in data:
        print("Total count:", data['total'])
    
    # Verify my assumption
    if 'total' in data and 'links' in data and 'next' in data['links']:
        print("\n✅ Confirmed CustomPagination structure (total + links.next)")
    elif 'count' in data and 'next' in data:
        print("\n⚠️ Found Standard DRF structure (count + next)")
    else:
        print("\n❌ Unknown structure")

if __name__ == "__main__":
    test_pagination()
