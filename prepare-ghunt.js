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
      // Try reading uploaded files from repo
      const projectRoot = process.cwd();
      const candidates = [
        // tools/ghunt/ tokens/cookies
        { tokens: ['tools', 'ghunt', 'tokens.json'], cookies: ['tools', 'ghunt', 'cookies.json'] },
        // root-level fallback
        { tokens: ['ghunt_tokens.json'], cookies: ['ghunt_cookies.json'] },
        // plain token text + cookies json
        { tokensTxt: ['tools', 'ghunt', 'token.txt'], cookies: ['tools', 'ghunt', 'cookies.json'] },
      ];

      for (const entry of candidates) {
        try {
          let used = false;
          if (entry.tokens) {
            const tPath = require('path').join(projectRoot, ...entry.tokens);
            if (fs.existsSync(tPath)) {
              const raw = fs.readFileSync(tPath, 'utf8');
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed.o_auth_token === 'string' && parsed.o_auth_token.trim()) {
                if (writeFileSafe(path.join(cfgDir, 'tokens.json'), JSON.stringify({ o_auth_token: parsed.o_auth_token.trim() }, null, 2))) {
                  used = true;
                  wroteSomething = true;
                  console.log('GHunt tokens.json copied from repository');
                }
              }
            }
          }
          if (!used && entry.tokensTxt) {
            const tTxtPath = require('path').join(projectRoot, ...entry.tokensTxt);
            if (fs.existsSync(tTxtPath)) {
              const rawTxt = fs.readFileSync(tTxtPath, 'utf8').trim();
              if (rawTxt) {
                if (writeFileSafe(path.join(cfgDir, 'tokens.json'), JSON.stringify({ o_auth_token: rawTxt }, null, 2))) {
                  wroteSomething = true;
                  console.log('GHunt token.txt converted to tokens.json');
                }
              }
            }
          }
          if (entry.cookies) {
            const cPath = require('path').join(projectRoot, ...entry.cookies);
            if (fs.existsSync(cPath)) {
              const rawC = fs.readFileSync(cPath, 'utf8');
              try {
                JSON.parse(rawC);
                if (writeFileSafe(path.join(cfgDir, 'cookies.json'), rawC)) {
                  wroteSomething = true;
                  console.log('GHunt cookies.json copied from repository');
                }
              } catch (e) {
                console.error('GHunt cookies.json in repo is not valid JSON:', e.message);
              }
            }
          }
          if (wroteSomething) break;
        } catch {}
      }

      if (!wroteSomething) {
        console.log('No GHunt credentials found in env or repository; skipping config preparation');
      }
    }
  } catch (e) {
    console.error('prepare-ghunt error:', e.message);
  }
})();
