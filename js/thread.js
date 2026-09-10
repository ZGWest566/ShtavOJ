// ============================================================
//  讨论区 — 贴吧青春版
// ============================================================

async function createThread(title, content) {
    const user = requireUser();
    await safeUpdate(blob => {
        ensureBlobStructure(blob);
        blob.threads.push({
            id: 'thread_' + Date.now(),
            title,
            posts: [{ user, content, createdAt: Date.now() }]
        });
    });
}

async function replyThread(threadId, content) {
    const user = requireUser();
    await safeUpdate(blob => {
        ensureBlobStructure(blob);
        const thread = blob.threads.find(t => t.id === threadId);
        if (thread) {
            thread.posts.push({ user, content, createdAt: Date.now() });
        }
    });
}

function renderThreads(threads) {
    const container = document.getElementById('threads-list');
    if (!container) return;

    if (!threads || threads.length === 0) {
        container.innerHTML = '<div class="empty">暂无讨论，来说点什么吧</div>';
        return;
    }

    container.innerHTML = threads
        .sort((a, b) => (b.posts[b.posts.length - 1]?.createdAt || 0)
            - (a.posts[a.posts.length - 1]?.createdAt || 0))
        .slice(0, 20)
        .map(t => {
            const lastPost = t.posts[t.posts.length - 1];
            const time = lastPost ? formatTime(lastPost.createdAt) : '';
            return `
            <div class="thread-item">
                <a href="thread.html?id=${t.id}" class="thread-title">${escapeHtml(t.title)}</a>
                <div class="thread-meta">
                    <span>${t.posts.length} 回复</span>
                    <span>${time}</span>
                </div>
            </div>
        `;
        }).join('');
}

function renderThreadDetail(thread) {
    const container = document.getElementById('thread-detail');
    if (!container) return;

    document.getElementById('thread-title-display').textContent = thread.title;

    container.innerHTML = thread.posts.map((p, i) => `
        <div class="post">
            <div class="post-header">
                <span class="post-user">${escapeHtml(p.user)}</span>
                <span class="post-time">${formatTime(p.createdAt)}</span>
                <span class="post-num">#${i + 1}</span>
            </div>
            <div class="post-content">${escapeHtml(p.content)}</div>
        </div>
    `).join('');
}

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}