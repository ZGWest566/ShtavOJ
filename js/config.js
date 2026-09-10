// ============================================================
//  赤石 OJ 配置
//  改这里，别的别动。
// ============================================================

// JSONBlob URL — 在 jsonblob.com 创建空 JSON 后替换
const BLOB_URL = 'https://jsonblob.com/01a08b71-c319-71e9-abb3-30b9497b23af/json';

// CORS 代理 — 用来转发 Wandbox 请求
// 备选：'https://api.allorigins.win/raw?url='
// 备选：'https://corsproxy.io/?'
const PROXY = 'https://api.allorigins.win/raw?url=';

// Wandbox API
const WANDBOX_API = 'https://wandbox.org/api/compile.json';

// 编译器映射 — 前端选项 → Wandbox compiler 名
const COMPILERS = {
    cpp: 'gcc-13.2.0',
    c: 'gcc-13.2.0-c',
    python: 'cpython-3.12.0',
    java: 'openjdk-21.0.2',
    node: 'nodejs-20.10.0',
    rust: 'rust-1.75.0',
};

// 语言显示名
const LANG_NAMES = {
    cpp: 'C++ (GCC 13.2)',
    c: 'C (GCC 13.2)',
    python: 'Python 3.12',
    java: 'Java 21',
    node: 'Node.js 20',
    rust: 'Rust 1.75',
};

// 评测超时 (ms) — Wandbox 不返回时间，用这个兜底
const JUDGE_TIMEOUT = 30000;