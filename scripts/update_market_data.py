#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


# ============================================================
# 路徑
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

WATCHLIST = ROOT / "data" / "watchlist.json"
OUTPUT = ROOT / "data" / "market_data.json"


# ============================================================
# API
# ============================================================

TWSE_API = (
    "https://www.twse.com.tw/exchangeReport/"
    "STOCK_DAY?response=json&date={date}&stockNo={code}"
)

TPEX_API = (
    "https://www.tpex.org.tw/www/zh-tw/afterTrading/"
    "tradingStock?date={date}&code={code}&response=json"
)


# ============================================================
# 基本工具
# ============================================================

def clean_number(value):
    """
    把:
        1,234.50
        1234.50
        -
    轉成 float
    """
    if value is None:
        return None

    value = str(value).strip()

    if value in ("", "-", "--"):
        return None

    try:
        return float(value.replace(",", ""))
    except ValueError:
        return None


def pct(start, end):
    if start in (None, 0) or end is None:
        return None

    return round((end / start - 1) * 100, 2)


def http_json(url, retries=3):
    """
    HTTP JSON 請求，失敗自動重試
    """

    last_error = None

    for attempt in range(1, retries + 1):

        try:
            req = Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/json,text/plain,*/*",
                },
            )

            with urlopen(req, timeout=20) as res:
                return json.load(res)

        except (HTTPError, URLError, TimeoutError, Exception) as e:

            last_error = e

            print(
                f"    ⚠️ API失敗 "
                f"(第 {attempt}/{retries} 次): {e}"
            )

            if attempt < retries:
                time.sleep(1.5 * attempt)

    raise RuntimeError(str(last_error))


# ============================================================
# TWSE 上市
# ============================================================

def fetch_twse_history(code: str) -> list[dict]:

    date = datetime.now().strftime("%Y%m01")

    url = TWSE_API.format(
        date=date,
        code=code
    )

    payload = http_json(url)

    if payload.get("stat") != "OK":
        raise RuntimeError(
            f"TWSE 無法取得 {code}"
        )

    rows = []

    for row in payload.get("data", []):

        if len(row) < 7:
            continue

        try:

            open_price = clean_number(row[3])
            close_price = clean_number(row[6])

            if open_price is None or close_price is None:
                continue

            rows.append({
                "date": row[0],
                "open": open_price,
                "close": close_price
            })

        except Exception:
            continue

    if not rows:
        raise RuntimeError(
            f"TWSE {code} 沒有有效交易資料"
        )

    return rows


# ============================================================
# TPEx 上櫃
# ============================================================

def fetch_tpex_history(code: str) -> list[dict]:

    date = datetime.now().strftime("%Y/%m/01")

    url = TPEX_API.format(
        date=date,
        code=code
    )

    payload = http_json(url)

    if str(payload.get("stat", "")).lower() not in ("ok", "success"):
        raise RuntimeError(
            f"TPEx 無法取得 {code}"
        )

    tables = payload.get("tables", [])

    if not tables:
        raise RuntimeError(
            f"TPEx {code} 沒有資料"
        )

    rows = []

    # TPEx 的資料放在 tables[0]["data"]
    data = tables[0].get("data", [])

    for row in data:

        if len(row) < 7:
            continue

        try:

            open_price = clean_number(row[3])
            close_price = clean_number(row[6])

            if open_price is None or close_price is None:
                continue

            rows.append({
                "date": row[0],
                "open": open_price,
                "close": close_price
            })

        except Exception:
            continue

    if not rows:
        raise RuntimeError(
            f"TPEx {code} 沒有有效交易資料"
        )

    return rows


# ============================================================
# 自動判斷市場
# ============================================================

def fetch_history(code: str):

    """
    先嘗試 TWSE。
    TWSE 找不到，再嘗試 TPEx。

    這樣 watchlist.json 不需要另外寫 market。
    """

    # --------------------------------------------------------
    # 先抓上市
    # --------------------------------------------------------

    try:

        rows = fetch_twse_history(code)

        return rows, "TWSE"

    except Exception as twse_error:

        print(
            f"    ↪ {code} TWSE 無資料，改抓 TPEx"
        )

    # --------------------------------------------------------
    # 再抓上櫃
    # --------------------------------------------------------

    try:

        rows = fetch_tpex_history(code)

        return rows, "TPEx"

    except Exception as tpex_error:

        raise RuntimeError(
            f"{code} TWSE / TPEx 都無法取得資料"
        )


# ============================================================
# 個股摘要
# ============================================================

def summarize(stock):

    code = stock["code"]
    name = stock["name"]

    try:

        rows, market = fetch_history(code)

        # 最新交易日
        latest = rows[-1]

        # ----------------------------------------------------
        # 5個交易日前
        #
        # 例如:
        # rows[-6] = 5個交易日前
        # rows[-1] = 最新一天
        # ----------------------------------------------------

        if len(rows) >= 6:
            baseline = rows[-6]
        else:
            baseline = rows[0]

        week_return = pct(
            baseline["close"],
            latest["close"]
        )

        return {
            **stock,

            "market": market,

            "open": latest["open"],
            "close": latest["close"],

            "week_return": week_return,

            "latest_date": latest["date"],

            "status": "ok"
        }

    except Exception as e:

        print(
            f"    ❌ {code} {name}: {e}"
        )

        return {
            **stock,

            "market": None,

            "open": None,
            "close": None,

            "week_return": None,

            "latest_date": None,

            "status": "error",

            "error": str(e)
        }


# ============================================================
# 主程式
# ============================================================

def main():

    print("=" * 60)
    print("📈 台股市場資料更新")
    print("=" * 60)

    # --------------------------------------------------------
    # 讀取 watchlist
    # --------------------------------------------------------

    if not WATCHLIST.exists():

        print(
            f"❌ 找不到 watchlist.json:\n{WATCHLIST}"
        )

        return 1

    try:

        watchlist = json.loads(
            WATCHLIST.read_text(
                encoding="utf-8"
            )
        )

    except Exception as e:

        print(
            f"❌ watchlist.json JSON 格式錯誤: {e}"
        )

        return 1

    # --------------------------------------------------------
    # 更新所有分類
    # --------------------------------------------------------

    groups = []

    total = 0
    success = 0
    failed = 0

    for g in watchlist.get("groups", []):

        group_name = g.get(
            "name",
            "未分類"
        )

        print()
        print(f"📂 {group_name}")

        stocks = []

        for stock in g.get("stocks", []):

            total += 1

            print(
                f"  🔎 {stock['code']} "
                f"{stock['name']}"
            )

            result = summarize(stock)

            if result["status"] == "ok":
                success += 1
            else:
                failed += 1

            stocks.append(result)

            # 避免連續大量請求
            time.sleep(0.2)

        groups.append({
            "name": group_name,
            "stocks": stocks
        })

    # --------------------------------------------------------
    # 輸出
    # --------------------------------------------------------

    output = {
        "generated_at": datetime.now().isoformat(),
        "total_stocks": total,
        "success": success,
        "failed": failed,
        "groups": groups
    }

    OUTPUT.write_text(
        json.dumps(
            output,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    # --------------------------------------------------------
    # 結果
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("✅ 市場資料更新完成")
    print("=" * 60)

    print(f"股票總數 : {total}")
    print(f"成功     : {success}")
    print(f"失敗     : {failed}")

    print()
    print(f"輸出檔案:")
    print(OUTPUT)

    if failed > 0:

        print()
        print(
            "⚠️ 有部分股票無法取得資料，"
            "但 market_data.json 已正常產生。"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
