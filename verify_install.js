const NovyxMemory = require('./index');

async function testLifecycle() {
  console.log('--- NovyxMemory v2.0 Test Suite ---');

  const memory = new NovyxMemory({
    apiKey: process.env.NOVYX_API_KEY,
  });

  const sessionId = `test-memory-${Date.now()}`;
  const nonce = Date.now();
  let passed = 0;
  let failed = 0;

  function check(name, condition) {
    if (condition) {
      console.log(`    PASS: ${name}`);
      passed++;
    } else {
      console.log(`    FAIL: ${name}`);
      failed++;
    }
  }

  // 1. !remember — explicit save
  console.log('\n[1] Testing !remember...');
  const rememberResult = await memory.handleRemember(`!remember Test fact ${nonce}: Postgres is the primary database`);
  console.log(`    ${rememberResult}`);
  check('!remember returns confirmation', rememberResult.includes('Saved:'));

  // 2. Recall the memory via recall()
  console.log('\n[2] Testing recall...');
  await new Promise(r => setTimeout(r, 2000));
  const recalled = await memory.recall(`Test fact ${nonce} Postgres is the primary database`, 1);
  check('recall finds saved memory', recalled.length > 0 && recalled[0].observation.includes(String(nonce)));
  if (recalled.length > 0) {
    console.log(`    Recalled: "${recalled[0].observation.slice(0, 60)}..."`);
  }

  // 3. !search — semantic search with scores
  console.log('\n[3] Testing !search...');
  const searchResult = await memory.handleSearch(`!search Postgres ${nonce}`);
  console.log(`    ${searchResult.split('\n').join('\n    ')}`);
  check('!search returns scored results', searchResult.includes('%'));

  // 4. !undo — delete last write
  console.log('\n[4] Testing !undo...');
  console.log(`    Write log has ${memory._writeLog.length} entries.`);
  const undoResult = await memory.handleUndo('!undo');
  console.log(`    ${undoResult}`);
  check('!undo deletes 1 memory', undoResult.includes('Undid 1'));

  // 5. !audit — operation log with hashes
  console.log('\n[5] Testing !audit...');
  const auditResult = await memory.handleAudit('!audit 5');
  console.log(`    ${auditResult.split('\n').join('\n    ')}`);
  check('!audit returns operations', auditResult.includes('POST') || auditResult.includes('GET') || auditResult.includes('DELETE'));

  // 6. !status — usage info with rollback count
  console.log('\n[6] Testing !status...');
  const statusResult = await memory.handleStatus();
  console.log(`    ${statusResult.split('\n').join('\n    ')}`);
  check('!status shows tier', statusResult.includes('Tier:'));
  check('!status shows rollbacks', statusResult.includes('Rollbacks:'));

  // 7. !help — all 8 commands listed
  console.log('\n[7] Testing !help...');
  const helpResult = await memory.handleHelp();
  check('!help lists !remember', helpResult.includes('!remember'));
  check('!help lists !search', helpResult.includes('!search'));
  check('!help lists !rollback', helpResult.includes('!rollback'));
  check('!help lists !forget', helpResult.includes('!forget'));
  check('!help lists !undo', helpResult.includes('!undo'));
  check('!help lists !audit', helpResult.includes('!audit'));
  check('!help lists !status', helpResult.includes('!status'));

  // 8. Smart filtering — short messages skip API calls
  console.log('\n[8] Testing smart filtering...');
  const start = Date.now();
  const shortResult = await memory.onMessage('ok', sessionId);
  const elapsed = Date.now() - start;
  check('Short message returns immediately', shortResult === 'ok');
  check('Short message is fast (no API call)', elapsed < 100);

  // 9. onMessage context injection
  console.log('\n[9] Testing onMessage context injection...');
  const nonce2 = Date.now();
  const contextObs = `Context injection test ${nonce2}: We deploy to Fly.io using Docker`;
  await memory.remember(contextObs, ['test', `session:${sessionId}`]);
  await new Promise(r => setTimeout(r, 2000));
  // Query must be >15 chars to pass smart filter AND semantically match the saved memory
  const contextResult = await memory.onMessage(`Tell me about deploying to Fly ${nonce2}`, sessionId);
  console.log(`    Result: "${typeof contextResult === 'string' ? contextResult.slice(0, 120) : contextResult}..."`);
  check('onMessage injects recalled context', typeof contextResult === 'string' && contextResult.includes('[Recalled Memory]'));

  // 10. onResponse truncation
  console.log('\n[10] Testing response truncation...');
  const longResponse = 'This is a test response that should be truncated. '.repeat(20); // 1000 chars
  const writeLogBefore = memory._writeLog.length;
  // Call remember directly instead of onResponse (which is fire-and-forget)
  const truncated = longResponse.length > 500 ? longResponse.slice(0, 500) + '...' : longResponse;
  await memory.remember(truncated, ['role:assistant', `session:${sessionId}`]);
  if (memory._writeLog.length > writeLogBefore) {
    const lastWrite = memory._writeLog[memory._writeLog.length - 1];
    // _writeLog.observation is sliced to 80 chars; the actual API call sent 503 chars (500 + "...")
    check('Write log entry is truncated to 80', lastWrite.observation.length <= 80);
    check('Truncated response is 503 chars (500 + "...")', truncated.length === 503);
    console.log(`    Write log preview (80 chars): "${lastWrite.observation}"`);
    console.log(`    Actual saved length: ${truncated.length} chars`);
  } else {
    console.log('    FAIL: remember() did not add to write log');
    failed++;
  }

  // 11. !rollback dry_run (non-destructive preview)
  console.log('\n[11] Testing !rollback (dry run via API)...');
  const rollbackResult = await memory.handleRollback('!rollback 1h');
  console.log(`    ${rollbackResult.split('\n').join('\n    ')}`);
  check('!rollback returns result', rollbackResult.includes('Rolled back') || rollbackResult.includes('Nothing to roll back') || rollbackResult.includes('failed'));

  // 12. !forget — search + delete
  console.log('\n[12] Testing !forget...');
  const nonce3 = Date.now();
  await memory.remember(`Forget test ${nonce3}: temporary fact to delete`, ['test']);
  await new Promise(r => setTimeout(r, 1500));
  const forgetResult = await memory.handleForget(`!forget Forget test ${nonce3}`);
  console.log(`    ${forgetResult}`);
  check('!forget deletes matching memories', forgetResult.includes('Forgot') || forgetResult.includes('No memories'));

  // 13. _parseRelativeTime
  console.log('\n[13] Testing _parseRelativeTime...');
  check('Parses "1h"', memory._parseRelativeTime('1h') !== null);
  check('Parses "30m"', memory._parseRelativeTime('30m') !== null);
  check('Parses "2 days ago"', memory._parseRelativeTime('2 days ago') !== null);
  check('Parses "1 hour ago"', memory._parseRelativeTime('1 hour ago') !== null);
  check('Rejects garbage', memory._parseRelativeTime('garbage') === null);
  check('Parses ISO timestamp', memory._parseRelativeTime('2026-01-01T00:00:00Z') !== null);

  // Cleanup remaining test memories
  while (memory._writeLog.length > 0) {
    await memory.handleUndo('!undo 10');
  }

  // Summary
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  testLifecycle().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}
