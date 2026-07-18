#!/usr/bin/env python3
from __future__ import annotations
import json, sys
from datetime import datetime
from pathlib import Path
from statistics import mean
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
WATCHLIST = ROOT / "data" / "watchlist.json"
OUTPUT = ROOT / "data" / "market_data.json"
API = "https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date={date}&stockNo={code}"

def fetch_history(code: str) -> list[dict]:
    date = datetime.now().strftime("%Y%m01")
    req = Request(API.format(date=date, code=code), headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=20) as res:
        payload = json.load(res)
    if payload.get("stat") != "OK": raise RuntimeError(code)
    rows = []
    for row in payload.get("data", []):
        try:
            rows.append({
                "date": row[0],
                "open": float(row[1].replace(",", "")),
                "close": float(row[6].replace(",", ""))
            })
        except: continue
    return rows

def pct(s, e): return round((e / s - 1) * 100, 2)

def summarize(stock):
    rows = fetch_history(stock["code"])
    latest = rows[-1]
    baseline = rows[max(0, len(rows) - 5)]
    return {**stock, "open": latest["open"], "close": latest["close"], "week_return": pct(baseline["close"], latest["close"])}

def main():
    watchlist = json.loads(WATCHLIST.read_text(encoding="utf-8"))
    groups = []
    for g in watchlist["groups"]:
        stocks = [summarize(s) for s in g["stocks"]]
        groups.append({"name": g["name"], "stocks": stocks})
    OUTPUT.write_text(json.dumps({"groups": groups, "generated_at": datetime.now().isoformat()}, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__": sys.exit(main())
