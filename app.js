document.addEventListener('DOMContentLoaded', () => {
    let marketData = null;

    // ============================================================
    // 1. 管理觀察名單面板
    // ============================================================

    const toggleBtn = document.getElementById('toggle-panel');
    const mgmtPanel = document.getElementById('management-panel');

    if (toggleBtn && mgmtPanel) {
        toggleBtn.addEventListener('click', () => {
            const isHidden =
                mgmtPanel.style.display === 'none' ||
                getComputedStyle(mgmtPanel).display === 'none';

            mgmtPanel.style.display = isHidden ? 'block' : 'none';
        });
    }


    // ============================================================
    // 2. 重新載入
    // ============================================================

    const reloadBtn = document.getElementById('reload');

    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            loadData();
        });
    }


    // ============================================================
    // 3. 初始載入
    // ============================================================

    loadData();


    // ============================================================
    // 4. 載入 market_data.json
    // ============================================================

    function loadData() {

        const asOfEl = document.getElementById('as-of');

        if (asOfEl) {
            asOfEl.innerText = '正在載入市場資料…';
        }

        fetch('data/market_data.json?t=' + Date.now(), {
            cache: 'no-store'
        })
            .then(res => {

                if (!res.ok) {
                    throw new Error(
                        `HTTP ${res.status}`
                    );
                }

                return res.json();
            })

            .then(data => {

                marketData = data;

                console.log('市場資料載入成功:', data);

                // ------------------------------------------------
                // 相容不同版本的 Python 輸出格式
                // ------------------------------------------------

                const updateTime =
                    data.as_of ||
                    data.generated_at ||
                    null;

                if (asOfEl) {

                    if (updateTime) {

                        const date = new Date(updateTime);

                        if (!isNaN(date.getTime())) {

                            asOfEl.innerText =
                                `資料更新時間：${date.toLocaleString('zh-TW')}`;

                        } else {

                            asOfEl.innerText =
                                `資料更新時間：${updateTime}`;
                        }

                    } else {

                        asOfEl.innerText =
                            '資料已載入';
                    }
                }


                // ------------------------------------------------
                // 檢查 groups
                // ------------------------------------------------

                if (!Array.isArray(data.groups)) {

                    throw new Error(
                        'market_data.json 缺少 groups'
                    );
                }


                renderSummary(data);
                renderRanking(data);

            })

            .catch(err => {

                console.error(
                    '載入資料發生錯誤:',
                    err
                );

                if (asOfEl) {

                    asOfEl.innerText =
                        '載入資料失敗或尚無資料';
                }

                const ranking =
                    document.getElementById('ranking');

                if (ranking) {

                    ranking.innerHTML = `
                        <p style="
                            color:var(--muted);
                            padding:10px;
                        ">
                            無法載入市場資料。
                            <br>
                            請確認 market_data.json 是否存在。
                        </p>
                    `;
                }
            });
    }


    // ============================================================
    // 5. 取得有效股票
    // ============================================================

    function getValidStocks(group) {

        if (!group || !Array.isArray(group.stocks)) {
            return [];
        }

        return group.stocks.filter(stock => {

            return (
                stock &&
                typeof stock.week_return === 'number' &&
                Number.isFinite(stock.week_return)
            );
        });
    }


    // ============================================================
    // 6. 計算板塊平均漲跌
    // ============================================================

    function getGroupAverage(group) {

        const stocks = getValidStocks(group);

        if (stocks.length === 0) {
            return null;
        }

        const total = stocks.reduce(
            (sum, stock) =>
                sum + stock.week_return,
            0
        );

        return total / stocks.length;
    }


    // ============================================================
    // 7. 格式化百分比
    // ============================================================

    function formatPercent(value) {

        if (
            value === null ||
            value === undefined ||
            !Number.isFinite(value)
        ) {
            return '—';
        }

        return (
            (value > 0 ? '+' : '') +
            value.toFixed(2) +
            '%'
        );
    }


    // ============================================================
    // 8. 渲染本週摘要
    // ============================================================

    function renderSummary(data) {

        const groups = Array.isArray(data.groups)
            ? data.groups
            : [];

        if (groups.length === 0) {

            return;
        }


        // --------------------------------------------------------
        // 板塊數量
        // --------------------------------------------------------

        const coverage =
            document.getElementById('coverage');

        if (coverage) {

            coverage.innerText =
                `${groups.length} 個`;
        }


        // --------------------------------------------------------
        // 計算各板塊平均
        // --------------------------------------------------------

        const groupsWithAvg = groups
            .map(group => {

                return {
                    name: group.name,
                    avg: getGroupAverage(group)
                };

            })
            .filter(group => group.avg !== null);


        // 沒有任何有效資料
        if (groupsWithAvg.length === 0) {

            const strongest =
                document.getElementById('strongest');

            const weakest =
                document.getElementById('weakest');

            if (strongest) {
                strongest.innerText = '—';
            }

            if (weakest) {
                weakest.innerText = '—';
            }

            return;
        }


        // --------------------------------------------------------
        // 排序
        // --------------------------------------------------------

        groupsWithAvg.sort(
            (a, b) => b.avg - a.avg
        );


        const strongest =
            groupsWithAvg[0];

        const weakest =
            groupsWithAvg[
                groupsWithAvg.length - 1
            ];


        // --------------------------------------------------------
        // 最強
        // --------------------------------------------------------

        const strongestEl =
            document.getElementById('strongest');

        if (strongestEl) {

            strongestEl.innerText =
                `${strongest.name} (${formatPercent(strongest.avg)})`;
        }


        // --------------------------------------------------------
        // 最弱
        // --------------------------------------------------------

        const weakestEl =
            document.getElementById('weakest');

        if (weakestEl) {

            weakestEl.innerText =
                `${weakest.name} (${formatPercent(weakest.avg)})`;
        }
    }


    // ============================================================
    // 9. 渲染板塊排行
    // ============================================================

    function renderRanking(data) {

        const container =
            document.getElementById('ranking');

        if (!container) {
            return;
        }

        container.innerHTML = '';


        const groups =
            Array.isArray(data.groups)
                ? data.groups
                : [];


        if (groups.length === 0) {

            container.innerHTML = `
                <p style="
                    color:var(--muted);
                    padding:10px;
                ">
                    目前尚無監測資料。
                </p>
            `;

            return;
        }


        // --------------------------------------------------------
        // 計算平均值並排序
        // --------------------------------------------------------

        const rankedGroups = groups
            .map(group => {

                return {
                    group,
                    avg: getGroupAverage(group)
                };

            })
            .sort((a, b) => {

                if (a.avg === null) return 1;
                if (b.avg === null) return -1;

                return b.avg - a.avg;
            });


        // --------------------------------------------------------
        // 生成排行
        // --------------------------------------------------------

        rankedGroups.forEach((item, idx) => {

            const group = item.group;
            const avgReturn = item.avg;

            const hasData =
                avgReturn !== null;

            const isPositive =
                hasData && avgReturn >= 0;

            const formattedReturn =
                hasData
                    ? formatPercent(avgReturn)
                    : '—';


            const btn =
                document.createElement('button');

            btn.type = 'button';
            btn.className = 'rank-row';

            btn.setAttribute(
                'aria-pressed',
                idx === 0
                    ? 'true'
                    : 'false'
            );


            // ----------------------------------------------------
            // 柱狀圖寬度
            // ----------------------------------------------------

            const barWidth =
                hasData
                    ? Math.min(
                        Math.abs(avgReturn) * 10,
                        100
                    )
                    : 0;


            btn.innerHTML = `
                <span>${group.name}</span>

                <div class="bar-track">
                    <div
                        class="bar ${
                            isPositive
                                ? 'positive'
                                : 'negative'
                        }"
                        style="
                            width:${barWidth}%;
                        "
                    ></div>
                </div>

                <span class="return ${
                    hasData
                        ? (
                            isPositive
                                ? 'up'
                                : 'down'
                        )
                        : ''
                }">
                    ${formattedReturn}
                </span>
            `;


            // ----------------------------------------------------
            // 點擊
            // ----------------------------------------------------

            btn.addEventListener(
                'click',
                () => {

                    document
                        .querySelectorAll('.rank-row')
                        .forEach(b => {

                            b.setAttribute(
                                'aria-pressed',
                                'false'
                            );
                        });


                    btn.setAttribute(
                        'aria-pressed',
                        'true'
                    );


                    renderDetails(group);
                }
            );


            container.appendChild(btn);
        });


        // --------------------------------------------------------
        // 預設顯示第一個
        // --------------------------------------------------------

        renderDetails(
            rankedGroups[0].group
        );
    }


    // ============================================================
    // 10. 渲染板塊詳細資料
    // ============================================================

    function renderDetails(group) {

        if (!group) {
            return;
        }


        // --------------------------------------------------------
        // 標題
        // --------------------------------------------------------

        const title =
            document.getElementById(
                'selected-title'
            );

        if (title) {

            title.innerText =
                group.name || '未分類';
        }


        // --------------------------------------------------------
        // 平均漲跌
        // --------------------------------------------------------

        const avgReturn =
            getGroupAverage(group);


        const returnEl =
            document.getElementById(
                'selected-return'
            );


        if (returnEl) {

            returnEl.innerText =
                formatPercent(avgReturn);


            if (avgReturn === null) {

                returnEl.style.color =
                    'var(--muted)';

            } else {

                returnEl.style.color =
                    avgReturn >= 0
                        ? 'var(--red)'
                        : 'var(--green)';
            }
        }


        // --------------------------------------------------------
        // 股票資料
        // --------------------------------------------------------

        const stocks =
            Array.isArray(group.stocks)
                ? group.stocks
                : [];


        // ========================================================
        // 個股比較柱狀圖
        // ========================================================

        const trendContainer =
            document.getElementById('trend');


        if (trendContainer) {

            trendContainer.innerHTML = '';


            stocks.forEach(stock => {

                const hasData =
                    typeof stock.week_return === 'number' &&
                    Number.isFinite(
                        stock.week_return
                    );


                const value =
                    hasData
                        ? stock.week_return
                        : 0;


                const isPos =
                    hasData && value >= 0;


                const barHeight =
                    hasData
                        ? Math.max(
                            Math.min(
                                Math.abs(value) * 12,
                                180
                            ),
                            8
                        )
                        : 8;


                const col =
                    document.createElement('div');

                col.className =
                    'trend-column';


                col.innerHTML = `
                    <div
                        class="trend-bar ${
                            hasData
                                ? (
                                    isPos
                                        ? 'positive'
                                        : 'negative'
                                )
                                : ''
                        }"
                        style="
                            height:${barHeight}px;
                            opacity:${
                                hasData
                                    ? '1'
                                    : '0.25'
                            };
                        "
                    ></div>

                    <span>
                        ${stock.name || stock.code}
                    </span>
                `;


                trendContainer.appendChild(col);
            });
        }


        // ========================================================
        // 成分股清單
        // ========================================================

        const holdingsContainer =
            document.getElementById(
                'holdings'
            );


        if (!holdingsContainer) {
            return;
        }


        holdingsContainer.innerHTML = '';


        stocks.forEach(stock => {

            const hasData =
                typeof stock.week_return === 'number' &&
                Number.isFinite(
                    stock.week_return
                );


            const isPositive =
                hasData &&
                stock.week_return >= 0;


            const div =
                document.createElement('div');

            div.className =
                'holding';


            // ----------------------------------------------------
            // 正常資料
            // ----------------------------------------------------

            if (hasData) {

                div.innerHTML = `
                    <div>
                        <div>
                            ${stock.name || stock.code}
                        </div>

                        <small>
                            ${stock.code}
                            ${
                                stock.market
                                    ? ` · ${stock.market}`
                                    : ''
                            }
                        </small>
                    </div>

                    <div
                        class="return"
                        style="
                            color:${
                                isPositive
                                    ? 'var(--red)'
                                    : 'var(--green)'
                            };
                        "
                    >
                        ${formatPercent(
                            stock.week_return
                        )}
                    </div>
                `;

            }

            // ----------------------------------------------------
            // 資料失敗
            // ----------------------------------------------------

            else {

                div.innerHTML = `
                    <div>
                        <div>
                            ${stock.name || stock.code}
                        </div>

                        <small>
                            ${stock.code}
                            · 資料暫缺
                        </small>
                    </div>

                    <div
                        class="return"
                        style="
                            color:var(--muted);
                        "
                    >
                        —
                    </div>
                `;
            }


            holdingsContainer.appendChild(div);
        });
    }

});
