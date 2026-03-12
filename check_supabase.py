import os
import requests
from dotenv import load_dotenv

load_dotenv('d:\\Hackthon Adhi\\.env')

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY')

# Login to get JWT
res = requests.post(
    f"{url}/auth/v1/token?grant_type=password",
    headers={"apikey": key, "Content-Type": "application/json"},
    json={"email": "admin1@gmail.com", "password": "Admin@123"}
)

if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

token = res.json().get("access_token")
print("Logged in!")

headers = {
    'apikey': key,
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Query users_tasks
res = requests.get(f"{url}/rest/v1/users_tasks?select=*", headers=headers)
print("users_tasks:", res.status_code, res.text)

# Query task_steps
res2 = requests.get(f"{url}/rest/v1/task_steps?select=*", headers=headers)
print("task_steps:", res2.status_code, res2.text)
