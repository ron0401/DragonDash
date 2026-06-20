#!/usr/bin/env python3
"""Dragon Dash server: static files + a shared global leaderboard API."""
import json, os, re, threading, mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
SCORES = os.path.join(ROOT, "scores.json")
LOCK = threading.Lock()
MAX_STORE, TOP = 100, 10
PORT = 4001

mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("application/javascript", ".js")

def load_scores():
    try:
        with open(SCORES, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_scores(s):
    tmp = SCORES + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False)
    os.replace(tmp, SCORES)

def clean_name(n):
    n = re.sub(r"[\x00-\x1f\x7f]", "", str(n)).strip()
    return n[:12] or "名無し"

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/api/scores":
            with LOCK:
                s = load_scores()
            return self._json(200, {"scores": s[:TOP]})
        return self.serve_static(p)

    def do_POST(self):
        p = urlparse(self.path).path
        if p != "/api/scores":
            return self._json(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length", "0") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            data = {}
        name = clean_name(data.get("name", ""))
        try:
            dist = int(float(data.get("distance", 0)))
        except Exception:
            dist = 0
        dist = max(0, min(dist, 10**9))
        with LOCK:
            s = load_scores()
            entry = {"name": name, "distance": dist}
            s.append(entry)
            s.sort(key=lambda x: -x["distance"])
            s = s[:MAX_STORE]
            save_scores(s)
            rank = next((i + 1 for i, e in enumerate(s) if e is entry), None)
        return self._json(200, {"ok": True, "rank": rank, "scores": s[:TOP]})

    def serve_static(self, p):
        if p in ("", "/"):
            p = "/index.html"
        fp = os.path.normpath(os.path.join(ROOT, p.lstrip("/")))
        if not (fp == ROOT or fp.startswith(ROOT + os.sep)):
            return self._json(403, {"error": "forbidden"})
        if not os.path.isfile(fp):
            return self._json(404, {"error": "not found"})
        ctype = mimetypes.guess_type(fp)[0] or "application/octet-stream"
        try:
            with open(fp, "rb") as f:
                body = f.read()
        except Exception:
            return self._json(500, {"error": "read error"})
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if p.startswith("/api"):
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    print(f"Dragon Dash server on 0.0.0.0:{PORT} (root={ROOT})")
    srv.serve_forever()
