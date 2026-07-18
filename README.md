# 台股產業趨勢儀表板

這是一個支援自動排程與本機管理的台股觀察儀表板。

## 功能介紹

1. **GitHub Pages 自動更新**：搭配 GitHub Actions，每週一到五下午 3:30（收盤後）自動抓取最新台股資料並發布。
2. **本機新增股票功能**：透過啟動本機伺服器 (`server.py`)，可直接在網頁上填寫表單新增股票至 `watchlist.json`，並自動觸發更新。

## 如何在本機（自己電腦）使用與管理名單

1. 請先確保電腦有安裝 Python 3。
2. 安裝必要的套件 (Flask)：
   ```bash
   pip install -r requirements.txt
   ```
3. 啟動本機伺服器：
   ```bash
   python3 server.py
   ```
4. 開啟瀏覽器進入 `http://localhost:8000`。
5. 點擊右上角**「管理名單」**按鈕，即可輸入要新增的產業、股票代碼與名稱。送出後會自動寫入設定檔並爬取最新資料。

## 如何上傳至 GitHub 並啟用自動更新

1. 將整個資料夾 (包含 `.github` 資料夾) 初始化為 Git 儲存庫並推送到你的 GitHub Repository。
2. 進入 GitHub Repository 的 **Settings -> Pages**，將 Source 選擇為 `Deploy from a branch`，Branch 選擇 `main` (或 `master`) 的 `/(root)`，儲存。
3. Github Actions 已經設定好（`.github/workflows/auto-update.yml`）。每天下午自動抓取後，會自動 Commit 更新 `data/market_data.json`，GitHub Pages 就會即時呈現最新數字！

*注意：在 GitHub Pages 上預覽時，由於只有靜態檔案，「管理名單」新增股票的功能無法使用。若要加新股票，請在本機執行 `server.py` 新增完後，再將變更的 `watchlist.json` Push 到 GitHub。*
