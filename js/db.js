// ============================================================
//  数据库操作 — 读写 JSONBlob
//  并发？覆盖？不存在的。
// ============================================================

async function readBlob() {
    const res = await fetch(BLOB_URL);
    if (!res.ok) throw new Error('读取数据库失败: ' + res.status);
    return await res.json();
}

async function writeBlob(data) {
    const res = await fetch(BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('写入数据库失败: ' + res.status);
    return await res.json();
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