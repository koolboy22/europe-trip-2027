from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
from datetime import datetime

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FEEDBACK_FILE = os.path.join(BASE_DIR, "feedback.json")

INITIAL_DATA = {
    "votes": {
        "budget": {"1800": ["Jacky"], "1600": []},
        "flight": {"cost_effective": ["Jacky"], "direct_lh": [], "direct_kr": []},
        "dolomites_transport": {"van_9": ["Jacky"], "two_cars": [], "public": []},
        "munich_dinner": {"augustiner": ["Jacky"], "spatenhaus": []},
        "dolomites_dinner": {"tubladel": ["Jacky"], "mauriz": []},
        "vienna_dinner": {"plachutta": ["Jacky"], "figlmuller": []},
        "prague_dinner": {"lokal": ["Jacky"], "kantyna": []}
    },
    "comments": [
        {
            "id": 1,
            "author": "Jacky",
            "target": "전체 일정",
            "rating": "👍 좋아요",
            "text": "2027년 10월 유럽 동창 여행 초안입니다! 각 일차별 일정과 맛집·예산 보시고 자유롭게 의견 남겨주세요.",
            "createdAt": "2026-11-09 22:45"
        }
    ]
}

if not os.path.exists(FEEDBACK_FILE):
    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        json.dump(INITIAL_DATA, f, ensure_ascii=False, indent=2)


class TripRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/feedback":
            try:
                with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = INITIAL_DATA
            self._send_json(data)
        else:
            super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        payload = json.loads(raw)

        try:
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = INITIAL_DATA

        if self.path == "/api/comment":
            comment = {
                "id": int(datetime.now().timestamp() * 1000),
                "author": payload.get("author", "동창").strip() or "동창",
                "target": payload.get("target", "전체 일정"),
                "rating": payload.get("rating", "👍 좋아요"),
                "text": payload.get("text", "").strip(),
                "createdAt": datetime.now().strftime("%Y-%m-%d %H:%M")
            }
            if comment["text"]:
                data["comments"].insert(0, comment)
                with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            self._send_json(data)

        elif self.path == "/api/vote":
            topic = payload.get("topic")
            option = payload.get("option")
            voter = payload.get("voter", "동창").strip() or "동창"
            if topic in data["votes"] and option in data["votes"][topic]:
                # Remove voter from all options in this topic first (single choice per topic)
                for opt_key, voters in data["votes"][topic].items():
                    if voter in voters:
                        voters.remove(voter)
                data["votes"][topic][option].append(voter)
                with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            self._send_json(data)

        elif self.path == "/api/delete-comment":
            cid = payload.get("id")
            data["comments"] = [c for c in data["comments"] if c.get("id") != cid]
            with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._send_json(data)
        else:
            self._send_json({"error": "Not found"}, 404)


if __name__ == "__main__":
    print(f"🌍 2027 유럽 동창 여행 대시보드 서버 시작: http://localhost:{PORT}")
    server = HTTPServer(("0.0.0.0", PORT), TripRequestHandler)
    server.serve_forever()
