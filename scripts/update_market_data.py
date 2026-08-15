#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


# ============================================================
# 基本設定
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

WATCHLIST = ROOT / "data" / "watchlist.json"
OUTPUT = ROOT / "data" / "market_data.json"

TWSE_API = (
    "https://www.twse.com.tw/exchangeReport/"
    "STOCK_DAY?response=json&date={date}&stockNo={code}"
)

TPEX_API = (
    "https://www.tpex.org.tw/www/zh-tw/afterTrading/"
    "tradingStock?date={date}&code={code}&response=json"
)


# ============================================================
# 工具函式
# ============================================================

def clean_number(value):
    """
    把 API 回傳的數字字串轉成 float。

    例如：
    "2,395.00" -> 2395.0
    "—"        -> None
    "--"       -> None
    ""
             -> None
    """

    if value is None:
        return None

    text = str(value).strip()

    if text in {"", "-", "--", "—", "N/A", "null"}:
        return None

    text = text.replace(",", "")

    try:
        return float(text)
    except ValueError:
        return None


def pct(start, end):
    """
    計算報酬率。
    """

    if start is None or end is None:
        return None

    if start == 0:
        return None

    return round((end / start - 1) * 100, 2)


def http_json(url, retries=3):
    """
    取得 JSON。

    API 偶爾會 timeout / 403 / 暫時性錯誤，
    所以最多重試 3 次。
    """

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 "
            "(KHTML, like Gecko) "
            "Chrome/146.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json,text/plain,*/*",
    }

    last_error = None

    for attempt in range(1, retries + 1):

        try:
            req = Request(url, headers=headers)

            with urlopen(req, timeout=30) as response:
                return json.load(response)

        except Exception as exc:
            last_error = exc

            print(
                f"API request failed "
                f"(attempt {attempt}/{retries}): {url}"
            )
            print(f"Error: {exc}")

            if attempt < retries:
                time.sleep(2 * attempt)

    raise RuntimeError(
        f"API request failed after {retries} attempts: "
        f"{last_error}"
    )


# ============================================================
# 日期
# ============================================================

def month_candidates():
    """
    取得目前月份以及前一個月份。

    例如現在是 2026/08：
    20260801
    20260701

    這樣如果剛好在月底 / 月初或遇到 API 問題，
    可以往前找資料。
    """

    now = datetime.now()

    current = now.replace(day=1)

    if current.month == 1:
        previous = current.replace(
            year=current.year - 1,
            month=12
        )
    else:
        previous = current.replace(
            month=current.month - 1
        )

    return [
        current.strftime("%Y%m01"),
        previous.strftime("%Y%m01"),
    ]


def tpex_month_candidates():
    """
    TPEx 使用 YYYY/MM/01 格式。
    """

    now = datetime.now()

    current = now.replace(day=1)

    if current.month == 1:
        previous = current.replace(
            year=current.year - 1,
            month=12
        )
    else:
        previous = current.replace(
            month=current.month - 1
        )

    return [
        current.strftime("%Y/%m/01"),
        previous.strftime("%Y/%m/01"),
    ]


# ============================================================
# TWSE
# ============================================================

def fetch_twse_history(code):
    """
    抓取 TWSE 上市股票歷史資料。
    """

    errors = []

    for date in month_candidates():

        url = TWSE_API.format(
            date=date,
            code=code
        )

        try:
            payload = http_json(url)

            if payload.get("stat") != "OK":
                errors.append(
                    f"TWSE {date}: stat={payload.get('stat')}"
                )
                continue

            rows = []

            for row in payload.get("data", []):

                if len(row) < 7:
                    continue

                open_price = clean_number(row[3])
                close_price = clean_number(row[6])

                if open_price is None or close_price is None:
                    continue

                rows.append({
                    "date": row[0],
                    "open": open_price,
                    "close": close_price,
                })

            if rows:
                return rows

            errors.append(
                f"TWSE {date}: no valid rows"
            )

        except Exception as exc:
            errors.append(
                f"TWSE {date}: {exc}"
            )

    raise RuntimeError(
        f"TWSE failed for {code}: "
        + " | ".join(errors)
    )


# ============================================================
# TPEx
# ============================================================

def fetch_tpex_history(code):
    """
    抓取 TPEx / OTC 上櫃股票歷史資料。
    """

    errors = []

    for date in tpex_month_candidates():

        url = TPEX_API.format(
            date=date,
            code=code
        )

        try:
            payload = http_json(url)

            if str(payload.get("stat", "")).lower() != "ok":
                errors.append(
                    f"TPEx {date}: stat={payload.get('stat')}"
                )
                continue

            tables = payload.get("tables", [])

            if not tables:
                errors.append(
                    f"TPEx {date}: no tables"
                )
                continue

            data_rows = tables[0].get("data", [])

            rows = []

            for row in data_rows:

                if len(row) < 7:
                    continue

                # TPEx 通常格式：
                #
                # 日期
                # 成交股數
                # 成交金額
                # 開盤
                # 最高
                # 最低
                # 收盤
                #

                open_price = clean_number(row[3])
                close_price = clean_number(row[6])

                if open_price is None or close_price is None:
                    continue

                rows.append({
                    "date": row[0],
                    "open": open_price,
                    "close": close_price,
                })

            if rows:
                return rows

            errors.append(
                f"TPEx {date}: no valid rows"
            )

        except Exception as exc:
            errors.append(
                f"TPEx {date}: {exc}"
            )

    raise RuntimeError(
        f"TPEx failed for {code}: "
        + " | ".join(errors)
    )


# ============================================================
# 自動判斷 TWSE / TPEx
# ============================================================

def fetch_history(code):
    """
    先嘗試 TWSE。
    如果失敗，再嘗試 TPEx。
    """

    try:
        rows = fetch_twse_history(code)

        return rows, "TWSE"

    except Exception as twse_error:

        print(
            f"[{code}] TWSE failed, trying TPEx..."
        )
        print(f"TWSE error: {twse_error}")

    try:
        rows = fetch_tpex_history(code)

        return rows, "TPEx"

    except Exception as tpex_error:

        raise RuntimeError(
            f"{code} unavailable on both TWSE and TPEx.\n"
            f"TWSE: {twse_error}\n"
            f"TPEx: {tpex_error}"
        )


# ============================================================
# 個股整理
# ============================================================

def summarize(stock):
    """
    抓取單一股票並計算：

    - 最新開盤
    - 最新收盤
    - 最近一週報酬率
    """

    code = str(stock["code"])

    rows, market = fetch_history(code)

    if not rows:
        raise RuntimeError(
            f"{code}: no market data"
        )

    # 最新一筆交易日
    latest = rows[-1]

    # 最近 5 個交易日報酬
    #
    # 如果要算「一週」：
    # 最新日 vs 5 個交易日前
    #
    # 所以需要 rows[-6]
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

        "status": "ok",
    }


# ============================================================
# 主程式
# ============================================================

def main():

    print("=" * 60)
    print("Taiwan Market Data Updater")
    print("=" * 60)

    print(f"Watchlist: {WATCHLIST}")
    print(f"Output:    {OUTPUT}")

    # --------------------------------------------------------
    # 讀取 watchlist
    # --------------------------------------------------------

    if not WATCHLIST.exists():
        raise FileNotFoundError(
            f"Watchlist not found: {WATCHLIST}"
        )

    watchlist = json.loads(
        WATCHLIST.read_text(
            encoding="utf-8"
        )
    )

    groups = []

    total_stocks = 0
    success_count = 0
    failed_count = 0

    # --------------------------------------------------------
    # 更新所有板塊
    # --------------------------------------------------------

    for group in watchlist.get("groups", []):

        group_name = group.get(
            "name",
            "未命名板塊"
        )

        print()
        print("-" * 60)
        print(f"Updating group: {group_name}")
        print("-" * 60)

        stocks = []

        for stock in group.get("stocks", []):

            total_stocks += 1

            code = str(stock.get("code", ""))
            name = stock.get("name", code)

            print(
                f"Updating {code} {name}..."
            )

            try:

                result = summarize(stock)

                stocks.append(result)

                success_count += 1

                print(
                    f"  OK: "
                    f"{result['market']} "
                    f"close={result['close']} "
                    f"week={result['week_return']}%"
                )

            except Exception as exc:

                failed_count += 1

                print(
                    f"  FAILED: {code} {name}"
                )
                print(
                    f"  Error: {exc}"
                )

                # 即使這支股票失敗，
                # 仍然把它寫入 JSON，
                # 避免整個板塊消失。
                stocks.append({
                    **stock,

                    "market": None,
                    "open": None,
                    "close": None,
                    "week_return": None,
                    "latest_date": None,

                    "status": "error",
                    "error": str(exc),
                })

            # 避免連續大量請求
            time.sleep(0.3)

        groups.append({
            "name": group_name,
            "stocks": stocks,
        })

    # --------------------------------------------------------
    # 產生輸出資料
    # --------------------------------------------------------

    now = datetime.now().isoformat()

    output_data = {
        "groups": groups,

        # 前端 app.js 使用
        "as_of": now,

        # 保留原本欄位
        "generated_at": now,

        "total_stocks": total_stocks,
        "success": success_count,
        "failed": failed_count,
    }

    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    OUTPUT.write_text(
        json.dumps(
            output_data,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("Update completed")
    print("=" * 60)

    print(f"Total:   {total_stocks}")
    print(f"Success: {success_count}")
    print(f"Failed:  {failed_count}")
    print(f"Output:  {OUTPUT}")
    print(f"As of:   {now}")
    print("=" * 60)

    # 非零失敗不讓 GitHub Actions 整個掛掉
    #
    # 因為即使少數股票失敗，
    # 其他股票仍然應該正常更新。
    return 0


if __name__ == "__main__":
    sys.exit(main())
