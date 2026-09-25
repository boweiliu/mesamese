#!/usr/bin/env python3
# Tiny log sink for the Mesa spike. The extension POSTs log entries here; we
# append them (dedup by seq) to live.log in this folder so the assistant can read it.
import http.server, json, os, sys, threading

HERE = os.path.dirname(os.path.abspath(__file__))
LOGFILE = os.path.join(HERE, 'live.log')
PORT = 8787

seen = set()
lock = threading.Lock()

class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        self.send_response(200); self._cors()
        self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps({'ok': True, 'port': PORT, 'logfile': LOGFILE}).encode())

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(length)
        try:
            payload = json.loads(data or b'{}')
        except Exception:
            payload = {}
        entries = payload.get('entries', [])
        appended = 0
        with lock:
            with open(LOGFILE, 'a') as f:
                for e in entries:
                    eid = e.get('id') or e.get('seq')
                    if eid is not None:
                        if eid in seen:
                            continue
                        seen.add(eid)
                    f.write(json.dumps(e) + '\n')
                    appended += 1
        self.send_response(200); self._cors()
        self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps({'appended': appended}).encode())

    def log_message(self, *a):
        pass  # quiet

class TS(http.server.ThreadingHTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    # fresh log each run
    open(LOGFILE, 'w').close()
    httpd = TS(('127.0.0.1', PORT), H)
    print(f'[mesa-log] listening on http://127.0.0.1:{PORT} -> {LOGFILE}', flush=True)
    httpd.serve_forever()
