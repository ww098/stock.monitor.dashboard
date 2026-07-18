
document.addEventListener('DOMContentLoaded', () => {
    fetch('data/market_data.json')
        .then(res => res.json())
        .then(data => {
            renderRanking(data);
            renderHotStocks(data);
        })
        .catch(err => console.error('Error loading data:', err));
});

function renderRanking(data) {
    const container = document.getElementById('ranking');
    container.innerHTML = '';
    data.groups.forEach(group => {
        const div = document.createElement('div');
        div.className = 'ranking-row';
        div.innerHTML = `<span>${group.name}</span><button onclick="viewGroup('${group.name}')">查看</button>`;
        container.appendChild(div);
    });
}

function renderHotStocks(data) {
    const container = document.getElementById('hot-stocks');
    // 簡單範例：抓取所有股票中漲幅前三名
    let allStocks = [];
    data.groups.forEach(g => allStocks.push(...g.stocks));
    allStocks.sort((a, b) => b.week_return - a.week_return);
    
    container.innerHTML = allStocks.slice(0, 3).map(s => `
        <article>
            <span>${s.name}</span>
            <strong>${s.week_return}%</strong>
        </article>
    `).join('');
}

function viewGroup(name) {
    alert('查看板塊: ' + name);
}
