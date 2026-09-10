// ============================================================
//  Wandbox API — 编译运行，CORS 代理转发
// ============================================================

function normalizeOutput(s) {
    if (!s) return '';
    return s
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n+$/, '');
}

function compareOutput(actual, expected) {
    return normalizeOutput(actual) === normalizeOutput(expected);
}

async function runOnWandbox(code, stdin, compiler) {
    const body = {
        compiler,
        code,
        stdin: stdin || '',
        options: compiler.startsWith('gcc') ? 'warning,gnu++2b' : '',
        'compiler-option-raw': '',
        'runtime-option-raw': ''
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT);

    try {
        const res = await fetch(PROXY + encodeURIComponent(WANDBOX_API), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        if (!res.ok) throw new Error('Wandbox 请求失败: ' + res.status);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}