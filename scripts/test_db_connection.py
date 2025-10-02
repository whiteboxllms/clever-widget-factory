import os
from dotenv import load_dotenv
import psycopg2

load_dotenv('.env.db')

USER = os.getenv('user')
PASSWORD = os.getenv('password')
HOST = os.getenv('host')
HOSTADDR = os.getenv('hostaddr')  # optional; set to IPv6 to force v6
PORT = os.getenv('port', '5432')
DBNAME = os.getenv('dbname', 'postgres')

conn_kwargs = {
    'user': USER,
    'password': PASSWORD,
    'host': HOST,
    'port': PORT,
    'dbname': DBNAME,
    'sslmode': 'require',
}

# If hostaddr is provided, pass it to libpq to force a specific IP (e.g. IPv6)
if HOSTADDR:
    conn_kwargs['hostaddr'] = HOSTADDR

try:
    conn = psycopg2.connect(**conn_kwargs)
    print('Connection successful!')
    with conn.cursor() as cur:
        cur.execute('SELECT NOW();')
        print('Current Time:', cur.fetchone())
finally:
    try:
        conn.close()
        print('Connection closed.')
    except Exception:
        pass
