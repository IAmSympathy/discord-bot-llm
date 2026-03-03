import json

r = json.load(open("/tmp/lv.json"))
print(r["tag_name"])
for a in r["assets"]:
    if a["name"].endswith(".jar"):
        print(a["browser_download_url"])
