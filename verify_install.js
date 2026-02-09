const NovyxMemory = require('./index');

async function testLifecycle() {
  console.log("🔄 Initializing Novyx Memory Middleware...");
  const memory = new NovyxMemory();
  
  const testSessionId = `test-session-${Date.now()}`;
  const testMessage = "Test message from OpenClaw self-install verification. Do you remember the car negotiation?";

  console.log(`\n📤 Sending User Message: "${testMessage}"`);
  
  // 1. Simulate Incoming Message (Should recall context + save message)
  console.log("   Querying recall...");
  const context = await memory.onMessage(testMessage, testSessionId);
  
  console.log(`\n📥 RECALLED CONTEXT (${context.length} items):`);
  context.forEach((mem, i) => console.log(`   [${i+1}] ${(mem.observation || mem.text || '').substring(0, 100)}...`));

  if (context.length === 0) console.log("   (No previous context found for this unique session, as expected for a fresh ID)");

  // 2. Simulate Agent Response
  const responseText = "I confirmed the memory installation. The system is active.";
  console.log(`\n📤 Saving Agent Response: "${responseText}"`);
  await memory.onResponse(responseText, testSessionId);

  // 3. Verify Persistence (Wait a moment for async save then recall explicitly)
  console.log("\n🕵️ Verifying Persistence (Read-after-Write)...");
  // Allow a tiny delay for async save to propagate if needed, though await onResponse isn't usually blocking
  // We'll query for the exact string we just saved
  const verify = await memory.recall("openclaw self-install verification", 1);
  
  if (verify.length > 0 && verify[0].text.includes("Test message")) {
    console.log("✅ SUCCESS: Found the saved message in Novyx!");
    console.log(`   Recalled: "${verify[0].text}"`);
  } else {
    console.log("❌ FAILURE: Could not recall the just-saved message.");
    console.log("   Debug Recall:", verify);
  }
}

testLifecycle().catch(console.error);
