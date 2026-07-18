import json, subprocess
from pathlib import Path
from flask import Flask, request, jsonify

app = Flask(__name__, static_folder=".")
WATCHLIST = Path("data/watchlist.json")

@app.route("/api/delete-stock", methods=["POST"])
def delete_stock():
    data = request.json
    code = data.get("code")
    with open(WATCHLIST, "r+", encoding="utf-8") as f:
        data = json.load(f)
        for g in data["groups"]:
            g["stocks"] = [s for s in g["stocks"] if s["code"] != code]
        f.seek(0); json.dump(data, f, ensure_ascii=False, indent=2); f.truncate()
    subprocess.run(["python3", "scripts/update_market_data.py"])
    return jsonify({"status": "ok"})

if __name__ == "__main__": app.run(port=8000)
