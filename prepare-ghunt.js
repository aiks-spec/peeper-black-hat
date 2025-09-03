/*
 Prepares GHunt config for non-interactive use.
 Reads:
   - GHUNT_TOKEN        (raw OAuth token string)
   - GHUNT_COOKIES_B64  (base64-encoded JSON of cookies)
 Writes to:
   - ~/.config/ghunt/tokens.json   { "o_auth_token": "..." }
   - ~/.config/ghunt/cookies.json  (decoded JSON)
*/
const fs = require('fs');
const os = require('os');
const path = require('path');

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
}

function writeFileSafe(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch (e) {
    console.error(`Failed writing ${filePath}:`, e.message);
    return false;
  }
}

(function main() {
  try {
    const token = process.env.GHUNT_TOKEN || process.env.GHUNT_OAUTH_TOKEN || '';
    const cookiesB64 = process.env.GHUNT_COOKIES_B64 || '';

    const home = process.env.HOME || os.homedir() || process.cwd();
    const cfgDir = path.join(home, '.config', 'ghunt');
    ensureDir(cfgDir);

    let wroteSomething = false;

    if (token && token.trim()) {
      const tokensJson = { o_auth_token: token.trim() };
      if (writeFileSafe(path.join(cfgDir, 'tokens.json'), JSON.stringify(tokensJson, null, 2))) {
        wroteSomething = true;
        console.log('GHunt tokens.json prepared');
      }
    }

    if (cookiesB64 && cookiesB64.trim()) {
      try {
        const decoded = Buffer.from(cookiesB64.trim(), 'base64').toString('utf8');
        // Validate JSON
        JSON.parse(decoded);
        if (writeFileSafe(path.join(cfgDir, 'cookies.json'), decoded)) {
          wroteSomething = true;
          console.log('GHunt cookies.json prepared');
        }
      } catch (e) {
        console.error('Invalid GHUNT_COOKIES_B64 (not valid base64 JSON):', e.message);
      }
    }

    if (!wroteSomething) {
      console.log('No GHunt credentials found in env; skipping config preparation');
    }
  } catch (e) {
    console.error('prepare-ghunt error:', e.message);
  }
})();
