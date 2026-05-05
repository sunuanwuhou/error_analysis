import urllib.request

url = "http://127.0.0.1:8080/new/xingce/workspace"
html = urllib.request.urlopen(url, timeout=10).read().decode("utf-8", "ignore")
print(html[:300])
print("has_vue_mount", '<div id="app"></div>' in html)
print("has_old_sidebar", "sidebarHomeBtn" in html)
print("has_legacy_manifest", "legacy-app.bundle.manifest.json" in html)
