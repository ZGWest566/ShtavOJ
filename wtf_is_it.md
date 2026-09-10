# Shtav OJ 完整实现方案

> 一个没有服务器、没有数据库、没有沙箱、没有后端的在线评测系统。  
> 数据库是剪贴板，评测机是 Wandbox，比对由前端完成，部署在 GitHub Pages。  
> 它能跑。至于为什么能跑，不要问。

---

## 1. 项目概述

**Shtav OJ** 是一个纯前端的在线评测系统。所有逻辑运行在用户浏览器中，数据存储在第三方 JSON 服务，代码评测通过公共 CORS 代理调用 Wandbox API，输出比对完全由前端 JavaScript 完成。整个项目可以部署在 GitHub Pages 上，零服务器、零运维、零成本。

**核心原则：**
- 没有自己的后端，所有请求由用户浏览器直接发出。
- 数据库借用第三方 JSON 存储（JSONBlob）。
- 评测借用 Wandbox 的编译运行能力。
- 比对逻辑在前端实现。
- 用户身份使用自定义用户名或 Codeforces handle，无认证。

---

## 2. 技术选型

| 层 | 选型 | 说明 |
|---|---|---|
| 前端框架 | 原生 HTML + CSS + JavaScript（可选 Vue3 CDN） | 简单直接，无需构建工具 |
| 数据库 | JSONBlob | 免费、支持 CORS、RESTful JSON 存储 |
| 评测机 | Wandbox API | 公开在线编译服务，支持多语言 |
| CORS 代理 | allorigins / corsproxy.io / 自建 Cloudflare Worker | 解决 Wandbox 无 CORS 问题 |
| 部署 | GitHub Pages | 纯静态托管 |
| 代码编辑器 | CodeMirror 或 Monaco Editor（可选） | 提升体验，也可用 textarea |

---

## 3. 系统架构

```
┌─────────────────────────────────────────────┐
│  GitHub Pages (纯静态前端)                    │
│  ├── index.html        题目列表/排名/讨论区    │
│  ├── problem.html      题目详情 + 代码编辑     │
│  ├── app.js            核心逻辑               │
│  └── style.css         样式                   │
└─────────────────────────────────────────────┘
         │                          │
         │ fetch                    │ fetch
         ▼                          ▼
┌─────────────────┐      ┌──────────────────────┐
│  JSONBlob       │      │  CORS 代理            │
│  (共享数据库)    │      │  (allorigins 等)      │
│  - problems     │      └──────────────────────┘
│  - submissions  │                │
│  - users        │                ▼
│  - threads      │      ┌──────────────────────┐
└─────────────────┘      │  Wandbox API          │
                         │  (编译 + 运行)         │
                         └──────────────────────┘
                                  │
                                  ▼
                         返回 program_output
                                  │
                         前端比对 → 写入 JSONBlob
```

---

## 4. 数据存储设计（JSONBlob）

### 4.1 创建 Blob

在 [jsonblob.com](https://jsonblob.com) 创建一个空 JSON，获得一个固定的 Blob ID。前端所有读写都针对这个 Blob。

**示例 Blob URL：**
```
https://jsonblob.com/api/jsonBlob/1234567890123456789
```

### 4.2 数据结构

```json
{
  "users": {
    "alice": {
      "handle": "alice_cf",
      "createdAt": 1700000000000
    }
  },
  "problems": {
    "1001": {
      "id": "1001",
      "title": "A+B Problem",
      "statement": "输入两个整数，输出它们的和。",
      "timeLimitMs": 1000,
      "memoryLimitMb": 256,
      "testcases": [
        { "input": "1 2\n", "expected": "3\n" },
        { "input": "100 200\n", "expected": "300\n" }
      ]
    }
  },
  "submissions": [
    {
      "id": "sub_1700000000000",
      "user": "alice",
      "problemId": "1001",
      "language": "cpp",
      "code": "#include <iostream>...",
      "status": "finished",
      "verdict": "AC",
      "passed": 2,
      "total": 2,
      "timeMs": 15,
      "createdAt": 1700000000000
    }
  ],
  "threads": [
    {
      "id": "thread_1700000000000",
      "title": "如何评价这个 OJ",
      "posts": [
        {
          "user": "bob",
          "content": "太抽象了",
          "createdAt": 1700000000000
        }
      ]
    }
  ],
  "_version": 1
}
```

### 4.3 读写封装

```js
const BLOB_URL = 'https://jsonblob.com/api/jsonBlob/你的ID';

async function readBlob() {
  const res = await fetch(BLOB_URL);
  if (!res.ok) throw new Error('读取数据库失败');
  return await res.json();
}

async function writeBlob(data) {
  const res = await fetch(BLOB_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('写入数据库失败');
  return await res.json();
}

// 带版本号的安全更新（减少并发覆盖）
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
      // 重试
    }
  }
  throw new Error('并发冲突，更新失败');
}
```

---

## 5. 评测流程（Wandbox + CORS 代理）

### 5.1 Wandbox API 说明

**获取编译器列表：**
```
GET https://wandbox.org/api/list.json
```

**编译并运行：**
```
POST https://wandbox.org/api/compile.json
Content-Type: application/json
```

请求体：
```json
{
  "compiler": "gcc-13.2.0",
  "code": "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}",
  "stdin": "1 2\n",
  "options": "warning,gnu++2b",
  "compiler-option-raw": "",
  "runtime-option-raw": ""
}
```

响应关键字段：
- `status`: 退出码（0 表示正常）
- `signal`: 信号
- `compiler_error`: 编译错误信息
- `program_output`: 程序标准输出
- `program_error`: 程序标准错误

### 5.2 CORS 代理配置

Wandbox 不支持 CORS，必须通过代理转发。推荐使用 **allorigins** 或 **corsproxy.io**。

```js
const WANDBOX_API = 'https://wandbox.org/api/compile.json';
const PROXY = 'https://api.allorigins.win/raw?url=';

async function runOnWandbox(code, stdin, compiler = 'gcc-13.2.0') {
  const body = {
    compiler,
    code,
    stdin,
    options: 'warning,gnu++2b',
    'compiler-option-raw': '',
    'runtime-option-raw': ''
  };

  const res = await fetch(PROXY + encodeURIComponent(WANDBOX_API), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error('Wandbox 请求失败');
  return await res.json();
}
```

**备选代理：**
- `https://corsproxy.io/?` + encodeURIComponent(url)
- 自建 Cloudflare Worker（代码见附录）

### 5.3 输出比对

```js
function normalizeOutput(s) {
  return s
    .replace(/\r\n/g, '\n')       // 统一换行
    .replace(/[ \t]+$/gm, '')      // 去除行尾空格
    .replace(/\n+$/, '');          // 去除末尾多余换行
}

function compareOutput(actual, expected) {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
```

### 5.4 完整判题函数

```js
async function judgeSubmission(submissionId) {
  const blob = await readBlob();
  const sub = blob.submissions.find(s => s.id === submissionId);
  if (!sub) throw new Error('提交不存在');

  const problem = blob.problems[sub.problemId];
  if (!problem) throw new Error('题目不存在');

  // 更新状态为 judging
  sub.status = 'judging';
  await writeBlob(blob);

  const results = [];
  let compileError = null;

  for (const tc of problem.testcases) {
    try {
      const output = await runOnWandbox(sub.code, tc.input, sub.language);

      if (output.compiler_error) {
        compileError = output.compiler_error;
        break;
      }

      if (output.status !== 0) {
        results.push({ verdict: 'RE', stderr: output.program_error });
        break;
      }

      const passed = compareOutput(output.program_output, tc.expected);
      results.push({ verdict: passed ? 'AC' : 'WA', actual: output.program_output });

      if (!passed) break; // ACM 赛制，遇到第一个失败就停
    } catch (e) {
      results.push({ verdict: 'SE', error: e.message });
      break;
    }
  }

  // 写回结果
  const blob2 = await readBlob();
  const sub2 = blob2.submissions.find(s => s.id === submissionId);

  if (compileError) {
    sub2.status = 'finished';
    sub2.verdict = 'CE';
    sub2.message = compileError;
  } else {
    const allPassed = results.length === problem.testcases.length &&
                      results.every(r => r.verdict === 'AC');
    sub2.status = 'finished';
    sub2.verdict = allPassed ? 'AC' : (results[results.length - 1]?.verdict || 'WA');
    sub2.passed = results.filter(r => r.verdict === 'AC').length;
    sub2.total = problem.testcases.length;
    sub2.message = results.map(r => r.verdict).join(',');
  }

  await writeBlob(blob2);
  return sub2;
}
```

---

## 6. 前端页面与功能

### 6.1 页面结构

| 页面 | 功能 |
|---|---|
| `index.html` | 题目列表、排名、讨论区入口 |
| `problem.html?id=xxx` | 题目详情、代码编辑、提交、结果展示 |
| `thread.html?id=xxx` | 讨论区帖子详情 |
| `rank.html` | 完整排名 |

为简化，也可以做成单页应用（SPA），用 hash 路由。但纯静态多页面更容易维护。

### 6.2 核心交互

- 用户首次访问输入用户名（存储在 localStorage）。
- 题目列表从 JSONBlob 读取并渲染。
- 点击题目进入详情页，显示题面、代码编辑器（textarea 或 CodeMirror）。
- 点击“提交”：
  1. 生成提交记录写入 JSONBlob（状态 `pending`）。
  2. 调用 `judgeSubmission` 进行评测。
  3. 评测完成后刷新页面显示结果。
- 排名根据 submissions 中 verdict 为 AC 的去重题目数计算。
- 讨论区：发帖、回帖，直接读写 JSONBlob。

---

## 7. 核心模块实现

### 7.1 用户管理

```js
function getCurrentUser() {
  return localStorage.getItem('oj_username') || null;
}

function setCurrentUser(name) {
  localStorage.setItem('oj_username', name);
}
```

### 7.2 提交代码

```js
async function submitCode(problemId, language, code) {
  const user = getCurrentUser();
  if (!user) throw new Error('请先设置用户名');

  const subId = 'sub_' + Date.now();
  await safeUpdate(blob => {
    blob.submissions.push({
      id: subId,
      user,
      problemId,
      language,
      code,
      status: 'pending',
      verdict: null,
      createdAt: Date.now()
    });
  });

  // 异步评测
  judgeSubmission(subId).catch(console.error);

  return subId;
}
```

### 7.3 排名计算

```js
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
```

### 7.4 讨论区

```js
async function createThread(title, content) {
  const user = getCurrentUser();
  await safeUpdate(blob => {
    blob.threads = blob.threads || [];
    blob.threads.push({
      id: 'thread_' + Date.now(),
      title,
      posts: [{ user, content, createdAt: Date.now() }]
    });
  });
}

async function replyThread(threadId, content) {
  const user = getCurrentUser();
  await safeUpdate(blob => {
    const thread = blob.threads.find(t => t.id === threadId);
    if (thread) {
      thread.posts.push({ user, content, createdAt: Date.now() });
    }
  });
}
```

---

## 8. 文件结构

```
abstract-oj/
├── index.html          # 首页：题目列表、排名、讨论区
├── problem.html        # 题目详情 + 代码编辑 + 提交
├── thread.html         # 讨论区帖子
├── rank.html           # 完整排名
├── css/
│   └── style.css
├── js/
│   ├── config.js       # BLOB_URL、代理地址、编译器映射
│   ├── db.js           # readBlob / writeBlob / safeUpdate
│   ├── wandbox.js      # runOnWandbox / compareOutput
│   ├── judge.js        # judgeSubmission
│   ├── user.js         # 用户管理
│   ├── rank.js         # 排名计算
│   └── thread.js       # 讨论区逻辑
└── README.md
```

---

## 9. 部署指南

1. Fork 或新建 GitHub 仓库。
2. 在 [jsonblob.com](https://jsonblob.com) 创建空 JSON，复制 Blob URL。
3. 修改 `js/config.js` 中的 `BLOB_URL`。
4. 将代码推送到 GitHub 仓库。
5. 在仓库 Settings → Pages 中选择分支（如 `main`）和根目录。
6. 访问 `https://你的用户名.github.io/仓库名/`。
7. 首次使用输入用户名，开始刷题。

---

## 10. 已知限制与“赤石”特性

| 问题 | 后果 | 抽象解法 |
|---|---|---|
| JSONBlob 数据可能被清理 | 数据丢失 | 接受，反正是玩具 |
| 并发写入覆盖 | 提交记录丢失 | 版本号重试，或接受 |
| CORS 代理随时挂 | 无法评测 | 换代理，或自建 Worker |
| Wandbox 不返回时间/内存 | 无法精确 TLE/MLE | 只用 Promise.race 做超时 |
| 用户无认证 | 可冒充他人 | 前端不验证，靠自觉 |
| 前端代码公开 | 无秘密 | 本来就没有秘密 |
| 评测依赖第三方 | 服务不可用则 OJ 瘫痪 | 接受 |

**赤石科技，能跑就行。**

---

## 11. README 建议

```markdown
# 赤石 OJ

> 零后端的在线评测系统。数据库是剪贴板，评测机是 Wandbox，部署在 GitHub Pages。它能跑，但不要问为什么。

## 架构

GitHub Pages (前端) → JSONBlob (数据库)  
                  → CORS 代理 → Wandbox (编译运行)  
                  → 前端比对 → 写回 JSONBlob

## 快速开始

1. 在 jsonblob.com 创建空 JSON，获取 Blob URL
2. 修改 `js/config.js` 中的 `BLOB_URL`
3. 开启 GitHub Pages
4. 打开页面，输入用户名，开始赤石

## 已知问题

- 数据可能丢失
- 提交可能被覆盖
- 代理可能失效
- 评测可能失败
- 用户可能被封号
- 项目可能随时停止维护

以上均为预期行为。

## License

MIT。随便用，出事别找我。
```

---

## 附录：Cloudflare Worker 代理代码

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url', { status: 400 });

    const modified = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });

    const res = await fetch(modified);
    const newHeaders = new Headers(res.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(res.body, { status: res.status, headers: newHeaders });
  }
};
```

部署后，将 `PROXY` 改为 `https://你的worker.workers.dev/?url=`。

---

**方案结束。**  
