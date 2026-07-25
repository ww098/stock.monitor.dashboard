document.addEventListener('DOMContentLoaded', () => {
    let marketData = null;

    // 1. 切換「管理觀察名單」面板顯示與隱藏
    const toggleBtn = document.getElementById('toggle-panel');
    const mgmtPanel = document.getElementById('management-panel');
    if (toggleBtn && mgmtPanel) {
        toggleBtn.addEventListener('click', () => {
            mgmtPanel.style.display = mgmtPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    // 2. 重新載入按鈕
    const reloadBtn = document.getElementById('reload');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => loadData());
    }

    // 3. 載入市場資料
    loadData();

    function loadData() {
        fetch('data/market_data.json?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                marketData = data;
                
                // 更新時間
                const asOfEl = document.getElementById('as-of');
                if (asOfEl) {
                    asOfEl.innerText = data.as_of ? `資料更新時間：${data.as_of}` : '資料已載入';
                }

                renderSummary(data);
                renderRanking(data);
            })
            .catch(err => {
                console.error('載入資料發生錯誤:', err);
                const asOfEl = document.getElementById('as-of');
                if (asOfEl) asOfEl.innerText = '載入資料失敗或尚無資料';
            });
    }

    // 4. 渲染本週摘要卡片 (本週最強、最弱、監測板塊數量)
    function renderSummary(data) {
        if (!data.groups || data.groups.length === 0) return;

        document.getElementById('coverage').innerText = `${data.groups.length} 個`;

        const groupsWithAvg = data.groups.map(g => {
            const avg = g.stocks.length > 0 
                ? g.stocks.reduce((acc, s) => acc + (s.week_return || 0), 0) / g.stocks.length 
                : 0;
            return { name: g.name, avg };
        });

        groupsWithAvg.sort((a, b) => b.avg - a.avg);
        const strongest = groupsWithAvg[0];
        const weakest = groupsWithAvg[groupsWithAvg.length - 1];

        const strongestEl = document.getElementById('strongest');
        const weakestEl = document.getElementById('weakest');

        if (strongestEl) strongestEl.innerText = `${strongest.name} (${strongest.avg > 0 ? '+' : ''}${strongest.avg.toFixed(2)}%)`;
        if (weakestEl) weakestEl.innerText = `${weakest.name} (${weakest.avg > 0 ? '+' : ''}${weakest.avg.toFixed(2)}%)`;
    }

    // 5. 渲染板塊列表
    function renderRanking(data) {
        const container = document.getElementById('ranking');
        container.innerHTML = '';

        if (!data.groups || data.groups.length === 0) {
            container.innerHTML = '<p style="color:var(--muted); padding:10px;">目前尚無監測資料，請執行爬蟲程式。</p>';
            return;
        }

        data.groups.forEach((group, idx) => {
            const avgReturn = group.stocks.length > 0
                ? group.stocks.reduce((acc, s) => acc + (s.week_return || 0), 0) / group.stocks.length
                : 0;
            const formattedReturn = (avgReturn > 0 ? '+' : '') + avgReturn.toFixed(2) + '%';
            const isPositive = avgReturn >= 0;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rank-row';
            btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');

            btn.innerHTML = `
                <span>${group.name}</span>
                <div class="bar-track">
                    <div class="bar ${isPositive ? 'positive' : 'negative'}" style="width: ${Math.min(Math.abs(avgReturn) * 10, 100)}%;"></div>
                </div>
                <span class="return ${isPositive ? 'up' : 'down'}">${formattedReturn}</span>
            `;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.rank-row').forEach(b => b.setAttribute('aria-pressed', 'false'));
                btn.setAttribute('aria-pressed', 'true');
                renderDetails(group);
            });

            container.appendChild(btn);
        });

        // 預設展開第一個板塊的詳細內容
        renderDetails(data.groups[0]);
    }

    // 6. 渲染選定板塊的成分股與柱狀圖
    function renderDetails(group) {
        document.getElementById('selected-title').innerText = group.name;

        const avgReturn = group.stocks.length > 0
            ? group.stocks.reduce((acc, s) => acc + (s.week_return || 0), 0) / group.stocks.length
            : 0;

        const returnEl = document.getElementById('selected-return');
        if (returnEl) {
            returnEl.innerText = (avgReturn > 0 ? '+' : '') + avgReturn.toFixed(2) + '%';
            returnEl.style.color = avgReturn >= 0 ? 'var(--red)' : 'var(--green)';
        }

        // 渲染個股比較柱狀圖
        const trendContainer = document.getElementById('trend');
        trendContainer.innerHTML = '';
        
        group.stocks.forEach(s => {
            const col = document.createElement('div');
            col.className = 'trend-column';
            const isPos = s.week_return >= 0;
            const barHeight = Math.max(Math.min(Math.abs(s.week_return) * 12, 180), 8);

            col.innerHTML = `
                <div class="trend-bar ${isPos ? 'positive' : 'negative'}" style="height: ${barHeight}px;"></div>
                <span>${s.name}</span>
            `;
            trendContainer.appendChild(col);
        });

        // 渲染成分股清單
        const holdingsContainer = document.getElementById('holdings');
        holdingsContainer.innerHTML = '';

        group.stocks.forEach(stock => {
            const isPositive = stock.week_return >= 0;
            const div = document.createElement('div');
            div.className = 'holding';
            div.innerHTML = `
                <div>
                    <div>${stock.name}</div>
                    <small>${stock.code}</small>
                </div>
                <div class="return" style="color: ${isPositive ? 'var(--red)' : 'var(--green)'};">
                    ${isPositive ? '+' : ''}${stock.week_return}%
                </div>
            `;
            holdingsContainer.appendChild(div);
        });
    }
});
