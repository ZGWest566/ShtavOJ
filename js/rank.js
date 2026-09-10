// ============================================================
//  排名计算 — AC 去重，按解题数排序
// ============================================================

function calculateRanking(submissions) {
    const solved = {};
    for (const s of submissions) {
        if (s.verdict === 'AC') {
            solved[s.user] = solved[s.user] || new Set();
            solved[s.user].add(s.problemId);
        }
    }
    return Object.entries(solved)
        .map(([user, set]) => ({ user, count: set.size }))
        .sort((a, b) => b.count - a.count);
}

function renderRanking(ranking) {
    const container = document.getElementById('ranking-list');
    if (!container) return;

    if (ranking.length === 0) {
        container.innerHTML = '<div class="empty">暂无排名数据</div>';
        return;
    }

    container.innerHTML = ranking.map((r, i) => {
        let medal = '';
        if (i === 0) medal = '🥇';
        else if (i === 1) medal = '🥈';
        else if (i === 2) medal = '🥉';
        return `
            <div class="rank-item">
                <span class="rank-num">${medal || (i + 1)}</span>
                <span class="rank-user">${escapeHtml(r.user)}</span>
                <span class="rank-count">${r.count} 题</span>
            </div>
        `;
    }).join('');
}