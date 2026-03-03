import json
import sys
import urllib.request

# Test recherche
req = urllib.request.Request(
    'http://localhost:2333/v4/loadtracks?identifier=ytmsearch%3Abob+omb+battlefield',
    headers={'Authorization': 'youshallnotpass'}
)
with urllib.request.urlopen(req) as r:
    d = json.load(r)

track = d['data'][0]
info = track['info']
encoded = track['encoded']
print(f"FOUND: {info['title']} | {info['uri']}")
print(f"ENCODED: {encoded[:40]}...")

# Test playback direct via l'URI trouvée
uri = info['uri']
req2 = urllib.request.Request(
    f"http://localhost:2333/v4/loadtracks?identifier={urllib.parse.quote(uri)}",
    headers={'Authorization': 'youshallnotpass'}
)

import urllib.parse

req2 = urllib.request.Request(
    f"http://localhost:2333/v4/loadtracks?identifier={urllib.parse.quote(uri)}",
    headers={'Authorization': 'youshallnotpass'}
)
with urllib.request.urlopen(req2) as r:
    d2 = json.load(r)

print(f"PLAYBACK loadType: {d2.get('loadType')}")
if d2.get('loadType') == 'error':
    # Extrait les clients qui ont échoué
    cause = d2['data'].get('causeStackTrace', '')
    for line in cause.split('\n'):
        if 'Client [' in line or 'failed:' in line.lower():
            print(line.strip())
