document.addEventListener('DOMContentLoaded', () => {
    fetch('data/market_data.json')
        .then(res => res.json())
        .then(data => {
            renderSummary(data);
            renderRanking(data);
            
            // 如果有資料，預設自動顯示第一個板塊的成分股細節
            if (data.groups && data.groups.length > 0) {
                renderDetails(data.groups[0]);
            }
        })
        .catch(err => console.error('載入資料發生錯誤:', err));
});

function renderSummary(data) {
    // 這裡可以加入你計算最強/最弱板塊的邏輯，先以簡單資料示意
    document.getElementById('coverage').innerText = data.groups.length + " 個板塊";
    document.getElementById('strongest').innerText = "資料計算中";
    document.getElementById('weakest').innerText = "資料計算中";
}

function renderRanking(data) {
    const container = document.getElementById('ranking');
    container.innerHTML = '';
    
    data.groups.forEach(group => {
        // 計算該板塊內所有股票的平均週報酬率
        const avgReturn = group.stocks.reduce((acc, s) => acc + s.week_return, 0) / group.stocks.length;
        const formattedReturn = avgReturn.toFixed(2);
        const isPositive = avgReturn >= 0;

        // 建立符合你 CSS 樣式的按鈕列
        const btn = document.createElement('button');
        btn.className = 'rank-row';
        btn.onclick = () => renderDetails(group); // 點擊時呼叫渲染細節的函式
        
        btn.innerHTML = `
            <span>${group.name}</span>
            <div class="bar-track">
                <div class="bar ${isPositive ? 'positive' : 'negative'}" style="width: ${Math.min(Math.abs(avgReturn) * 5, 100)}%;"></div>
            </div>
            <span class="return ${isPositive ? 'up' : 'down'}">${formattedReturn}%</span>
        `;
        
        container.appendChild(btn);
    });
}

function renderDetails(group) {
    // 更新右側面板標題
    document.getElementById('selected-title').innerText = group.name;
    
    // 渲染右下角的成分股清單
    const holdingsContainer = document.getElementById('holdings');
    holdingsContainer.innerHTML = '';
    
    group.stocks.forEach(stock => {
        const isPositive = stock.week_return >= 0;
        
        const div = document.createElement('div');
        div.className = 'holding'; // 對應 style.css 裡的 .holding
        
        div.innerHTML = `
            <div>
                <div>${stock.name}</div>
                <small>${stock.code}</small>
            </div>
            <div class="return ${isPositive ? 'up' : 'down'}">${stock.week_return}%</div>
        `;
        
        holdingsContainer.appendChild(div);
    });
}
