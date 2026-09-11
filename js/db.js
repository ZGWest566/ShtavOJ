// ============================================================
//  数据库操作 — localStorage 为主，JSONBlob 可选
//  JSONBlob 挂了，先用 localStorage，反正是赤石，能跑就行
// ============================================================

const STORAGE_KEY = 'shtavoj_db';
const USE_REMOTE = false; // JSONBlob 挂了，先关掉，改 true 切回去

const DEFAULT_BLOB = {
    users: {},
    problems: {},
    submissions: [],
    threads: [],
    _version: 1
};

function loadLocal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function saveLocal(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function readBlob() {
    if (USE_REMOTE) {
        const res = await fetch(BLOB_URL);
        if (!res.ok) throw new Error('读取远程数据库失败: HTTP ' + res.status);
        const text = await res.text();
        if (!text || text.trim() === '') return JSON.parse(JSON.stringify(DEFAULT_BLOB));
        try { return JSON.parse(text); } catch (e) {
            throw new Error('远程数据库返回的不是合法 JSON');
        }
    }

    let data = loadLocal();
    if (!data) {
        data = JSON.parse(JSON.stringify(DEFAULT_BLOB));
        saveLocal(data);
    }
    return data;
}

async function writeBlob(data) {
    if (USE_REMOTE) {
        const res = await fetch(BLOB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('写入远程数据库失败: HTTP ' + res.status);
        const text = await res.text();
        if (!text || text.trim() === '') return data;
        try { return JSON.parse(text); } catch (e) { return data; }
    }

    saveLocal(data);
    return data;
}

async function initBlob() {
    if (USE_REMOTE) {
        const res = await fetch(BLOB_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(DEFAULT_BLOB)
        });
        if (!res.ok) throw new Error('初始化远程数据库失败: HTTP ' + res.status);
        return DEFAULT_BLOB;
    }

    saveLocal(DEFAULT_BLOB);
    return DEFAULT_BLOB;
}

async function safeUpdate(mutator) {
    for (let i = 0; i < 5; i++) {
        const data = await readBlob();
        const oldVersion = data._version || 0;
        mutator(data);
        data._version = oldVersion + 1;
        try {
            await writeBlob(data);
            return data;
        } catch (e) {
            console.warn('并发冲突，重试 ' + (i + 1) + '/5', e);
        }
    }
    throw new Error('并发冲突，更新失败（已重试5次）');
}

function ensureBlobStructure(data) {
    data.users = data.users || {};
    data.problems = data.problems || {};
    data.submissions = data.submissions || [];
    data.threads = data.threads || [];
    return data;
}