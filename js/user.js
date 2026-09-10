// ============================================================
//  用户管理 — localStorage 就是你的身份
// ============================================================

function getCurrentUser() {
    return localStorage.getItem('oj_username') || null;
}

function setCurrentUser(name) {
    localStorage.setItem('oj_username', name.trim());
}

function requireUser() {
    const user = getCurrentUser();
    if (!user) {
        showLoginModal();
        throw new Error('请先设置用户名');
    }
    return user;
}

function showLoginModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <h2>你是谁？</h2>
            <p>输入一个名字，反正是你自己说的，没人验证。</p>
            <input id="login-input" type="text" placeholder="用户名" value="${getCurrentUser() || ''}" autofocus>
            <div class="modal-actions">
                <button id="login-confirm" class="btn btn-primary">确认</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#login-input');
    const confirm = overlay.querySelector('#login-confirm');

    function doLogin() {
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        setCurrentUser(name);
        overlay.remove();
        updateUserDisplay();
        window.location.reload();
    }

    confirm.addEventListener('click', doLogin);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function updateUserDisplay() {
    const el = document.getElementById('current-user');
    if (el) {
        const user = getCurrentUser();
        el.innerHTML = user
            ? `<span class="user-tag">${escapeHtml(user)}</span>`
            : `<button class="btn btn-sm" onclick="showLoginModal()">登录</button>`;
    }
}