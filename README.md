# Facebook AI Slop Detector
**Build entirely with antigravity cli(I vibecoded it)**

***Inspired by some post on x.com(Couldn't find it)**

A Chrome Extension (Manifest V3) that monitors your Facebook feed in real-time and detects **AI Slop** using **Jev** (TypeSafe AI's System One decision model).

Posts are evaluated as you scroll and flagged based on confidence score:

| Confidence | Visual Indicator |
| :--- | :--- |
| **< 60%** | **Clean** (No overlay, untouched) |
| **60% - 70%** | **Subtle Amber Banner** on top of post |
| **70% - 80%** | **Prominent Orange Banner** with higher alert |
| **> 80%** | **Red Rubber Stamp Impact Animation** (`AI SLOP`) with click-to-toggle blur |

---

## Getting Started

### 1. Requirements
* Node.js (v18+)
* A **Jev API Key** from [TypeSafe AI](https://typesafe.ai)

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
JEV_API_KEY=your_typesafe_jev_api_key_here
```
*(Alternatively, you can leave it empty and enter your API key directly in the extension popup.)*

### 3. Build Extension
```bash
# Build the extension into the dist/ directory
npm run build

# Or run in watch mode for development
npm run watch
```

### 4. Load into Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** (top-left)
4. Select the `dist/` directory inside this repository:
   ```
   facebook ai slop detector/dist
   ```
5. Open [Facebook](https://www.facebook.com) and browse your feed!

---

## Tests

Run the automated test suite:
```bash
npm test
```

---

## Project Structure

```
.
├── .env                      # API credentials (ignored by git)
├── .gitignore                # Protects .env and build files
├── package.json              # NPM scripts (build, watch, test)
├── build.js                  # Injects .env and bundles src/ into dist/
├── create_icons.js           # Generates extension PNG icons
├── test/
│   └── extension.test.js     # Automated unit tests
└── src/
    ├── manifest.json         # Chrome Extension Manifest V3 configuration
    ├── config.js             # Default settings and threshold levels
    ├── background/
    │   └── background.js     # Service worker: API queue, cache, and stats
    ├── content/
    │   ├── content.js        # DOM observer, text extraction, and UI injection
    │   └── content.css       # Styles for banners and rubber stamp animation
    ├── popup/
    │   ├── popup.html        # Extension popup dashboard
    │   ├── popup.css         # Popup styles
    │   └── popup.js          # Popup logic (stats, API key update, cache reset)
    └── icons/                # Extension icon assets (16x16, 48x48, 128x128)
```

---

## License

MIT
