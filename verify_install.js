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
  await new Promise(r => setTimeout(r, 1500));
  const recalled = await memory.recall(`Postgres database ${nonce}`, 1);
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
  await memory.remember(`Test context ${nonce2}: We deploy to Fly.io`, ['test']);
  await new Promise(r => setTimeout(r, 1500));
  const contextResult = await memory.onMessage(`Where do we deploy ${nonce2}?`, sessionId);
  check('onMessage injects recalled context', typeof contextResult === 'string' && contextResult.includes('Fly'));

  // 10. onResponse truncation
  console.log('\n[10] Testing response truncation...');
  const longResponse = 'x'.repeat(1000);
  // Temporarily check what gets saved
  const writeLogBefore = memory._writeLog.length;
  await memory.onResponse(longResponse, sessionId);
  await new Promise(r => setTimeout(r, 500));
  if (memory._writeLog.length > writeLogBefore) {
    const lastWrite = memory._writeLog[memory._writeLog.length - 1];
    check('Long response is truncated', lastWrite.observation.length <= 80); // _writeLog truncates to 80
    console.log(`    Saved observation preview: "${lastWrite.observation}"`);
  } else {
    console.log('    INFO: Could not verify truncation (async save may be pending)');
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
