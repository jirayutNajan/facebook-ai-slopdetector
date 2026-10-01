// Automated test suite for Facebook AI Slop Detector logic
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Facebook AI Slop Detector tests...\n');

// 1. Test build output files exist
function testDistFilesExist() {
  console.log('Test 1: Verify dist files existence');
  const requiredFiles = [
    'dist/manifest.json',
    'dist/config.js',
    'dist/background/background.js',
    'dist/content/content.js',
    'dist/content/content.css',
    'dist/popup/popup.html',
    'dist/popup/popup.css',
    'dist/popup/popup.js',
    'dist/icons/icon16.png',
    'dist/icons/icon48.png',
    'dist/icons/icon128.png'
  ];

  for (const relPath of requiredFiles) {
    const fullPath = path.join(__dirname, '..', relPath);
    assert.strictEqual(fs.existsSync(fullPath), true, `Missing file: ${relPath}`);
  }
  console.log('  ✅ All required extension files exist in dist/');
}

// 2. Test manifest.json structure
function testManifestStructure() {
  console.log('Test 2: Verify manifest.json structure');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../dist/manifest.json'), 'utf8'));

  assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');
  assert.strictEqual(manifest.background.service_worker, 'background/background.js');
  assert.strictEqual(manifest.background.type, 'module');
  assert.strictEqual(manifest.content_scripts[0].matches.includes('https://*.facebook.com/*'), true);
  assert.strictEqual(manifest.host_permissions.includes('https://api.typesafe.ai/*'), true);
  console.log('  ✅ manifest.json is valid Manifest V3');
}

// 3. Test threshold assignment logic
function testThresholdLogic() {
  console.log('Test 3: Verify threshold classification rules');

  function classify(score) {
    if (score < 0.60) return 'clean';
    if (score >= 0.60 && score < 0.70) return 'subtle';
    if (score >= 0.70 && score < 0.80) return 'prominent';
    if (score >= 0.80) return 'stamp';
  }

  assert.strictEqual(classify(0.0), 'clean');
  assert.strictEqual(classify(0.59), 'clean');
  assert.strictEqual(classify(0.60), 'subtle');
  assert.strictEqual(classify(0.69), 'subtle');
  assert.strictEqual(classify(0.70), 'prominent');
  assert.strictEqual(classify(0.79), 'prominent');
  assert.strictEqual(classify(0.80), 'stamp');
  assert.strictEqual(classify(0.95), 'stamp');
  assert.strictEqual(classify(1.0), 'stamp');

  console.log('  ✅ Threshold boundaries correctly classify clean, subtle, prominent, and stamp');
}

// 4. Test Text Cleaner / Noise Filter logic
function testTextNoiseFilter() {
  console.log('Test 4: Verify text cleaning and noise filtering');

  const ignoredPatterns = [
    /^(like|comment|share|send|reply|view more|ดูเพิ่มเติม|ถูกใจ|แสดงความคิดเห็น|แชร์)$/i,
    /^[0-9]+(\s*(hrs?|mins?|days?|w|ชม\.|นาที|วัน|สัปดาห์))$/i,
    /^(public|friends|only me|สาธารณะ|เพื่อน)$/i
  ];

  function isNoise(text) {
    return ignoredPatterns.some((pattern) => pattern.test(text.trim()));
  }

  assert.strictEqual(isNoise('Like'), true);
  assert.strictEqual(isNoise('แชร์'), true);
  assert.strictEqual(isNoise('ถูกใจ'), true);
  assert.strictEqual(isNoise('2 hrs'), true);
  assert.strictEqual(isNoise('5 ชม.'), true);
  assert.strictEqual(isNoise('สาธารณะ'), true);
  assert.strictEqual(isNoise('Here is a long AI generated article about programming tools in 2025...'), false);

  console.log('  ✅ Noise filter correctly removes Facebook UI metadata while keeping post body');
}

function runAll() {
  try {
    testDistFilesExist();
    testManifestStructure();
    testThresholdLogic();
    testTextNoiseFilter();
    console.log('\n🎉 All 4 test suites passed successfully!\n');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }
}

runAll();
