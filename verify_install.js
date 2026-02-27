const NovyxMemory = require('./index');

async function testLifecycle() {
  console.log('--- NovyxMemory v2 Test Suite ---');

  const memory = new NovyxMemory({
    apiKey: process.env.NOVYX_API_KEY
  });

  const sessionId = `test-memory-${Date.now()}`;

  // 1. Save a memory via remember()
  console.log('\n[1] Saving a memory...');
  const nonce = Date.now();
  const testObs = `NovyxMemory test ${nonce}: Project Atlas uses Postgres and Redis`;
  const saved = await memory.remember(testObs, ['test', `session:${sessionId}`]);
  if (saved) {
    const savedId = saved.uuid || saved.id;
    console.log(`    Saved: ${savedId}`);
  } else {
    console.log('    FAILED to save.');
    return;
  }

  // 2. Recall the memory
  console.log('\n[2] Recalling...');
  await new Promise(r => setTimeout(r, 1500));
  const recalled = await memory.recall(`Project Atlas ${nonce}`, 1);
  if (recalled.length > 0 && recalled[0].observation.includes(String(nonce))) {
    console.log(`    Recalled: "${recalled[0].observation.slice(0, 60)}..."`);
    console.log('    SUCCESS: Memory persisted and recalled.');
  } else {
    console.log('    FAILED: Could not recall saved memory.');
  }

  // 3. Test !undo (should delete the memory we just saved)
  console.log('\n[3] Testing !undo...');
  console.log(`    Write log has ${memory._writeLog.length} entries.`);
  const undoResult = await memory.handleUndo('!undo', sessionId);
  console.log(`    ${undoResult}`);
  if (undoResult.includes('Undid 1')) {
    console.log('    SUCCESS: Undo deleted 1 memory.');
  } else {
    console.log('    FAILED: Undo did not work as expected.');
  }

  // 4. Test !audit
  console.log('\n[4] Testing !audit...');
  const auditResult = await memory.handleAudit('!audit 5', sessionId);
  console.log(`    ${auditResult.split('\n').join('\n    ')}`);
  if (auditResult.includes('POST') || auditResult.includes('GET')) {
    console.log('    SUCCESS: Audit returned operations.');
  } else {
    console.log('    WARNING: Audit returned no entries (may be expected on fresh key).');
  }

  // 5. Test !status
  console.log('\n[5] Testing !status...');
  const statusResult = await memory.handleStatus('!status', sessionId);
  console.log(`    ${statusResult.split('\n').join('\n    ')}`);
  if (statusResult.includes('Tier:') && statusResult.includes('Memories:')) {
    console.log('    SUCCESS: Status returned usage info.');
  } else {
    console.log('    FAILED: Status did not return expected fields.');
  }

  // 6. Test onMessage context injection
  console.log('\n[6] Testing onMessage (auto-recall + auto-save)...');
  const nonce2 = Date.now();
  await memory.remember(`Test context ${nonce2}: We deploy to Fly.io`, ['test']);
  await new Promise(r => setTimeout(r, 1500));
  const contextResult = await memory.onMessage(`Where do we deploy ${nonce2}?`, sessionId);
  if (typeof contextResult === 'string' && contextResult.includes('Fly')) {
    console.log('    SUCCESS: onMessage injected recalled context.');
  } else {
    console.log('    INFO: onMessage returned without context (may need more memories for match).');
  }

  // Cleanup the last test memory
  await memory.handleUndo('!undo 2', sessionId);

  console.log('\n--- All tests complete ---');
}

if (require.main === module) {
  testLifecycle().catch(console.error);
}
