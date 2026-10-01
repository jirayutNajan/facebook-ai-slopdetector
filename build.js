// Build script for Facebook AI Slop Detector Chrome Extension
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ENV_FILE = path.join(ROOT_DIR, '.env');

// Helper to parse .env file
function loadEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

// Recursive directory copy
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build() {
  console.log('📦 Building Facebook AI Slop Detector Extension...');

  const env = loadEnv();
  const apiKey = env.JEV_API_KEY || '';

  if (!apiKey) {
    console.warn('⚠️ Warning: JEV_API_KEY not found in .env. Extension will require manual key in popup.');
  } else {
    console.log('🔑 Injected JEV_API_KEY from .env successfully.');
  }

  // Ensure clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  // Copy all assets & source files
  copyDirSync(SRC_DIR, DIST_DIR);

  // Inject API key into dist/config.js
  const configDistPath = path.join(DIST_DIR, 'config.js');
  if (fs.existsSync(configDistPath)) {
    let configContent = fs.readFileSync(configDistPath, 'utf8');
    configContent = configContent.replace('__JEV_API_KEY_PLACEHOLDER__', apiKey);
    fs.writeFileSync(configDistPath, configContent, 'utf8');
  }

  console.log('✅ Build completed successfully into dist/');
  console.log('👉 To load in Chrome:');
  console.log('   1. Open chrome://extensions/');
  console.log('   2. Enable "Developer mode" (top right toggle)');
  console.log('   3. Click "Load unpacked" and select the folder:');
  console.log(`      ${DIST_DIR}`);
}

// Watch mode support
if (process.argv.includes('--watch')) {
  build();
  console.log('👀 Watching src/ for changes...');
  fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    console.log(`🔄 Change detected in ${filename}. Rebuilding...`);
    build();
  });
} else {
  build();
}
