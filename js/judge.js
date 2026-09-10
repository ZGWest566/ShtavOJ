// ============================================================
//  判题逻辑 — 跑测试点，比对输出，写回结果
// ============================================================

async function judgeSubmission(submissionId) {
    const blob = await readBlob();
    ensureBlobStructure(blob);

    const sub = blob.submissions.find(s => s.id === submissionId);
    if (!sub) throw new Error('提交不存在');

    const problem = blob.problems[sub.problemId];
    if (!problem) throw new Error('题目不存在');

    sub.status = 'judging';
    sub.verdict = null;
    await writeBlob(blob);

    const compiler = COMPILERS[sub.language] || COMPILERS.cpp;
    const results = [];
    let compileError = null;
    let totalTime = 0;

    for (const tc of problem.testcases) {
        try {
            const output = await runOnWandbox(sub.code, tc.input, compiler);

            if (output.compiler_error) {
                compileError = output.compiler_error;
                break;
            }

            if (output.status !== 0) {
                results.push({
                    verdict: 'RE',
                    stderr: (output.program_error || '').substring(0, 500)
                });
                break;
            }

            totalTime += (output.time || 0);
            const passed = compareOutput(output.program_output || '', tc.expected);
            results.push({
                verdict: passed ? 'AC' : 'WA',
                actual: (output.program_output || '').substring(0, 500)
            });

            if (!passed) break;
        } catch (e) {
            if (e.name === 'AbortError') {
                results.push({ verdict: 'TLE', error: '评测超时' });
            } else {
                results.push({ verdict: 'SE', error: e.message });
            }
            break;
        }
    }

    const blob2 = await readBlob();
    ensureBlobStructure(blob2);
    const sub2 = blob2.submissions.find(s => s.id === submissionId);
    if (!sub2) return;

    if (compileError) {
        sub2.status = 'finished';
        sub2.verdict = 'CE';
        sub2.message = compileError.substring(0, 1000);
    } else {
        const allPassed = results.length === problem.testcases.length
            && results.every(r => r.verdict === 'AC');
        sub2.status = 'finished';
        sub2.verdict = allPassed ? 'AC' : (results[results.length - 1]?.verdict || 'WA');
        sub2.passed = results.filter(r => r.verdict === 'AC').length;
        sub2.total = problem.testcases.length;
        sub2.timeMs = totalTime;
        sub2.results = results;
        sub2.message = results.map(r => r.verdict).join(' → ');
    }

    await writeBlob(blob2);
    return sub2;
}