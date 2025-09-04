require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const DatabaseManager = require('./database');
const path = require('path');
const cron = require('node-cron');
const cheerio = require('cheerio');
const { exec, execFile, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const https = require('https');
const os = require('os');

// File cleanup system for publishing
const cleanupQueue = new Map(); // Track files to cleanup

// Ensure temp directory exists for Linux/Render
// Temp directory handling disabled per user request (keep files persistent)
const tempDir = path.join(process.cwd(), 'temp');
const localBinDir = path.join(process.cwd(), 'bin');
if (!fs.existsSync(localBinDir)) {
    try { fs.mkdirSync(localBinDir, { recursive: true }); } catch {}
}

// Simple Python tool availability check for Render environment
async function commandExists(cmd) {
    try { 
        await execAsync(`which ${cmd}`); 
        return true; 
    } catch { 
        return false; 
    }
}

async function ensurePythonReady() {
    // Check for virtual environment first (preferred) - Linux path
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3');
    const venvPythonAlt = path.join(process.cwd(), 'venv', 'bin', 'python');
    
    if (fs.existsSync(venvPython)) {
        console.log('✅ Using virtual environment Python:', venvPython);
        return venvPython;
    }
    
    if (fs.existsSync(venvPythonAlt)) {
        console.log('✅ Using virtual environment Python (alt):', venvPythonAlt);
        return venvPythonAlt;
    }
    
    // Check for Windows virtual environment (for local development)
    const venvPythonWin = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPythonWin)) {
        console.log('✅ Using virtual environment Python (Windows):', venvPythonWin);
        return venvPythonWin;
    }
    
    // Check if we're in a virtual environment via environment variable
    if (process.env.VIRTUAL_ENV) {
        const venvPythonEnv = path.join(process.env.VIRTUAL_ENV, 'bin', 'python3');
        const venvPythonEnvAlt = path.join(process.env.VIRTUAL_ENV, 'bin', 'python');
        
        if (fs.existsSync(venvPythonEnv)) {
            console.log('✅ Using activated virtual environment Python:', venvPythonEnv);
            return venvPythonEnv;
        }
        
        if (fs.existsSync(venvPythonEnvAlt)) {
            console.log('✅ Using activated virtual environment Python (alt):', venvPythonEnvAlt);
            return venvPythonEnvAlt;
        }
    }
    
    // Fallback to system Python
    if (await commandExists('python3')) {
        console.log('⚠️ Using system Python3 (virtual environment not found)');
        console.log('💡 Virtual environment should be created during Render build process');
        return 'python3';
    }
    if (await commandExists('python')) {
        console.log('⚠️ Using system Python (virtual environment not found)');
        console.log('💡 Virtual environment should be created during Render build process');
        return 'python';
    }
    
    console.log('❌ No Python found in system or virtual environment');
    console.log('💡 Virtual environment should be created during Render build process');
    return null;
}

async function ensurePhoneInfogaInstalled() {
    try {
        // In Render environment, phoneinfoga should be pre-installed in /usr/local/bin
        await execAsync('which phoneinfoga');
        console.log('✅ PhoneInfoga found in system PATH');
        return 'phoneinfoga';
        } catch (error) {
        console.log('❌ PhoneInfoga not found in PATH:', error.message);
        // Try direct path
        if (fs.existsSync('/usr/local/bin/phoneinfoga')) {
            console.log('✅ PhoneInfoga found at /usr/local/bin/phoneinfoga');
            return '/usr/local/bin/phoneinfoga';
        }
        return null;
    }
}

// Removed external runtime installers; tools are preinstalled in system python via requirements.txt

// GHunt auto-login at startup (non-interactive: selects option 1)
async function runGhuntAutoLogin() {
    try {
        const py = await ensurePythonReady();
        if (!py) {
            console.log('❌ Python not available, skipping GHunt auto-login');
            return;
        }
        console.log('🔐 GHunt auto-login: starting');
        const child = spawn(py, ['-m', 'ghunt', 'login'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
        });
        let out = '';
        let err = '';
        const writeChoice = () => {
            try { child.stdin.write('1\n'); child.stdin.end(); } catch {}
        };
        // Write selection after short delay in case prompt not captured
        const t = setTimeout(writeChoice, 1200);
        child.stdout.on('data', (d) => {
            const s = d.toString();
            out += s;
            if (/\b(\[?\s*1\s*\]?|Press 1|Choose.*1)/i.test(s)) {
                writeChoice();
            }
        });
        child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('close', (code) => {
            clearTimeout(t);
            if (code === 0) console.log('✅ GHunt auto-login completed');
            else console.log('⚠️ GHunt auto-login exited with code', code);
        });
        child.on('error', (e) => {
            clearTimeout(t);
            console.log('❌ GHunt auto-login error:', e.message);
        });
    } catch (e) {
        console.log('❌ GHunt auto-login setup failed:', e.message);
    }
}

function scheduleFileCleanup(filePath, delayMs = 30 * 60 * 1000) { // disabled
    console.log(`⏳ Auto-cleanup disabled, keeping file: ${filePath}`);
}

// Cleanup on shutdown: keep files (no deletions), just close DB
process.on('SIGINT', async () => {
    console.log('\n🧹 Shutdown: keeping temp files (auto-delete disabled). Closing DB...');
    await dbManager.cleanup();
    process.exit(0);
});

// Linux/Render PATH handling
try {
    console.log('🌐 Running on Linux/Render platform');
    
    // Add common Python paths for Linux/Render
        const linuxPaths = [
            '/usr/local/bin',
            '/usr/bin',
            '/bin',
            '/opt/python/bin',
            '/home/render/.local/bin',
            '/root/.local/bin',
            '/usr/local/lib/python3.11/bin',
            '/usr/local/lib/python3.10/bin',
            '/usr/local/lib/python3.9/bin'
        ];
        
        const existingPath = process.env.PATH || '';
        const newPaths = linuxPaths.filter(p => fs.existsSync(p));
        
        if (newPaths.length > 0) {
        process.env.PATH = `${newPaths.join(':')}:${existingPath}`;
            console.log('✅ Added Linux Python paths to PATH');
        }
        
    // Set environment variables for Python tools and prevent shell issues
        process.env.PYTHONUNBUFFERED = '1';
        process.env.PYTHONIOENCODING = 'utf-8';
    process.env.PYTHONUTF8 = '1';
    process.env.LC_ALL = 'C.UTF-8';
    process.env.LANG = 'C.UTF-8';
    process.env.LANGUAGE = 'C.UTF-8';
    process.env.TERM = 'dumb';
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '0';
    process.env.ANSI_COLORS_DISABLED = '1';
    process.env.CLICOLOR = '0';
    process.env.CLICOLOR_FORCE = '0';
    delete process.env.BASH_ENV;
    delete process.env.ENV;
} catch (error) {
    console.log('⚠️ PATH expansion failed, using default:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Production-ready configuration
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

if (isProduction) {
    console.log('🚀 Running in PRODUCTION mode');
    // Disable detailed logging in production
    console.log = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('🔍')) return;
        process.stdout.write(args.join(' ') + '\n');
    };
} else {
    console.log('🔧 Running in DEVELOPMENT mode');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const dbManager = new DatabaseManager();

// Auto-cleanup disabled per user request
// cron.schedule('*/5 * * * *', async () => {});

// Debug environment variables
console.log('🔍 Environment Variables Debug:');
console.log('   - NODE_ENV:', process.env.NODE_ENV);
console.log('   - DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'Not set');
console.log('   - PORT:', process.env.PORT);
console.log('   - All env keys containing DB:', Object.keys(process.env).filter(k => k.toLowerCase().includes('db')));

// Initialize database connection
initializeGhuntDirect();
dbManager.connect().then(async (connected) => {
    if (connected) {
        console.log('✅ Database connection established');
        
        if (process.env.NODE_ENV === 'production' && process.env.RESET_COUNTS === 'true') {
            try {
                console.log('🔄 Resetting counts for production deployment...');
                await dbManager.resetCounts();
                console.log('✅ Counts reset successfully');
            } catch (error) {
                console.error('❌ Failed to reset counts:', error.message);
            }
        }
        
        // Remove any previous ghunt auto-login usage
        // GHunt is initialized via token/cookies above
    } else {
        console.log('⚠️ Database connection failed, continuing with fallback mode');
        console.log('📝 Note: Some features may be limited without database connection');
    }
}).catch((error) => {
    console.error('❌ Database initialization error:', error.message);
    console.log('⚠️ Continuing without database connection');
});

// Visitor tracking middleware - count only real page views with debounce per IP
const recentVisitorByIp = new Map();
// Make debounce configurable; default to 0ms so visitor count changes on refresh
const VISITOR_DEBOUNCE_MS = parseInt(process.env.VISITOR_DEBOUNCE_MS || '0', 10);
app.use((req, res, next) => {
    try {
        // Count only GET requests to pages (exclude API & static assets)
        const isPage = req.method === 'GET' && !req.path.startsWith('/api/');
        if (!isPage) return next();

        // Get real client IP
        const ips = [
            req.headers['x-forwarded-for']?.split(',')[0]?.trim(),
            req.headers['cf-connecting-ip'],
            req.headers['x-real-ip'],
            req.socket?.remoteAddress,
            req.connection?.remoteAddress
        ].filter(Boolean);
        const ip = ips[0] || 'unknown';
        const last = recentVisitorByIp.get(ip) || 0;
        const now = Date.now();
        if (now - last < VISITOR_DEBOUNCE_MS) return next();
        recentVisitorByIp.set(ip, now);

        const userAgent = req.get('User-Agent') || 'Unknown';
        dbManager.insertVisitor(ip, userAgent).then((success) => {
            if (success) console.log('✅ Visitor tracked:', ips.join(', '));
            else console.log('⚠️ Visitor tracking failed (database may not be connected)');
        }).catch(() => {});
    } catch {}
    next();
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lightweight OSINT lookup endpoint (PhoneInfoga + Phone-Number-API + optional breaches)
// Usage: GET /lookup?phone=+19998887777
app.get('/lookup', async (req, res) => {
    try {
        const phone = String(req.query.phone || '').trim();
        if (!phone) return res.status(400).json({ error: 'Missing phone parameter' });

        const [infoga, phoneApi, leaks] = await Promise.all([
            queryPhoneInfoga(phone).catch(() => null),
            fetchPhoneNumberApiJSON(phone).catch(() => null),
            fetchBreaches(phone).catch(() => null)
        ]);

        const formatted = phoneApi?.formatInternational || phoneApi?.formatE164 || null;
        const result = {
            phone,
            carrier: infoga?.carrier || phoneApi?.carrier || null,
            country: infoga?.country || phoneApi?.country || null,
            line_type: infoga?.type || phoneApi?.numberType || null,
            formatted: formatted || null,
            possible_name_sources: infoga?.names || [],
            leak_sources: leaks?.sources || []
        };

        // Log search
        try {
            await dbManager.insertSearch(phone, 'lookup', result);
        } catch (error) {
            console.log('⚠️ Search logging failed:', error.message);
        }
        return res.json(result);
    } catch (err) {
        console.error('Lookup error:', err.message);
        return res.status(500).json({ error: 'Lookup failed' });
    }
});

// Unified OSINT lookup endpoint (modular, no unofficial scrapers)
// GET /lookup?phone=+1234567890
app.get('/lookup', async (req, res) => {
    const phone = String(req.query.phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    try {
        const [infoga, pna, leaks] = await Promise.all([
            fetchFromPhoneInfoga(phone).catch(() => null),
            fetchFromPhoneNumberApi(phone).catch(() => null),
            fetchFromLeaksApis(phone).catch(() => null)
        ]);

        const response = {
            phone,
            carrier: infoga?.carrier || pna?.carrier || null,
            country: infoga?.basic?.country || pna?.country || null,
            line_type: infoga?.basic?.type || pna?.numberType || null,
            formatted: pna?.formatInternational || pna?.formatE164 || null,
            possible_name_sources: Array.isArray(infoga?.metadata?.names)
                ? infoga.metadata.names
                : [],
            leak_sources: leaks?.sources || []
        };

        return res.json(response);
    } catch (err) {
        console.error('Lookup error:', err.message);
        return res.status(500).json({ error: 'Lookup failed' });
    }
});

// Aggregate OSINT endpoint
app.post('/api/aggregate', async (req, res) => {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ success: false, error: 'Missing query' });
    }

    const trimmed = query.trim();
    const qtype = detectQueryType(trimmed);

    // Log search
    try {
        await dbManager.insertSearch(trimmed, qtype, null);
    } catch (error) {
        console.log('⚠️ Search logging failed:', error.message);
    }
    try {
        const tasks = [];

        // Local tools - run only if available; do not fail the whole request
        if (qtype === 'phone') {
            tasks.push(runToolIfAvailable('phoneinfoga', ['scan', '-n', trimmed], parsePhoneInfoga));
            tasks.push(scrapePhoneNumberApiHtml(trimmed));
            // Also try social media search with phone number
            const phoneUsername = trimmed.replace(/[^a-zA-Z0-9+]/g, '');
            tasks.push(runToolIfAvailable('sherlock', [phoneUsername, '--print-found', '--no-color'], parseSherlock));
                         tasks.push(runToolIfAvailable('maigret', [phoneUsername, '--no-color'], parseMaigretSimple));
        }
        if (qtype === 'email') {
            tasks.push(runToolIfAvailable('holehe', [trimmed, '-C', '--no-color'], parseHolehe));
            tasks.push(runToolIfAvailable('ghunt', ['email', trimmed], (stdout, stderr) => {
                if (stdout && stdout.trim()) {
                    const ghuntData = parseGHuntFromText(stdout);
                    if (ghuntData) {
                        return parseGHuntSimple(ghuntData);
                    }
                            }
                            return null;
            }));
            // Sherlock and Maigret now work with email input
            tasks.push(runToolIfAvailable('sherlock', [trimmed, '--print-found', '--no-color'], parseSherlock));
            tasks.push(runToolIfAvailable('maigret', [trimmed, '--no-color'], parseMaigretSimple));
        }
        if (qtype === 'username') {
            // Sherlock and Maigret now require email input, skip for username queries
            // Consider treating username as email if it contains @ symbol
            if (trimmed.includes('@')) {
            tasks.push(runToolIfAvailable('sherlock', [trimmed, '--print-found', '--no-color'], parseSherlock));
                         tasks.push(runToolIfAvailable('maigret', [trimmed, '--no-color'], parseMaigretSimple));
            }
        }

        const results = await Promise.all(tasks.map(p => p.catch(() => null)));

        const aggregated = mergeAggregatedResults({ qtype, query: trimmed }, results.filter(Boolean));

        return res.json({ success: true, data: aggregated });
    } catch (err) {
        console.error('Aggregate error:', err.message);
        return res.status(500).json({ success: false, error: 'Aggregation failed', details: err.message });
    }
});

// Email lookup endpoint (CUFinder + GHunt + Holehe + Sherlock + Maigret) - Linux/Render optimized
app.post('/api/email-lookup', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid email address' 
            });
        }
        
        // Log search and get search ID for tracking
        let searchId = null;
        try {
            searchId = await dbManager.insertSearch(email, 'email', null);
        } catch (error) {
            console.log('⚠️ Search logging failed:', error.message);
        }
        console.log(`🔍 Starting email lookup for: ${email}`);
        
        // Collect data from all available sources
        const results = {
            email: email,
            basic: {},
            social: [],
            leaks: [],
            google: null,
            metadata: {}
        };
        
        // 1. CUFinder API (primary source)
        try {
            console.log('📡 Fetching from CUFinder...');
            const urls = [
                `https://api.cufinder.io/v1/email/${encodeURIComponent(email)}`,
                `https://api.cufinder.com/v1/email/${encodeURIComponent(email)}`
            ];
            let cuf = null;
            for (const u of urls) {
                try {
                    const r = await axios.get(u, {
                        headers: {
                            'Authorization': `Bearer ${process.env.CUFINDER_API_KEY || 'demo'}`,
                            'User-Agent': 'OSINT-Lookup-Engine/1.0',
                            'Accept': 'application/json'
                        },
                        timeout: 15000
                    });
                    if (r && r.data) { cuf = r.data; break; }
                } catch {}
            }
            if (cuf) {
                console.log('✅ CUFinder data received');
                // Extract person data from various possible structures
                const person = cuf.person || cuf.data || cuf.result || cuf;
                if (person) {
                    results.basic.name = person.full_name || person.name || person.fullName ||
                        (person.first_name && person.last_name ? `${person.first_name} ${person.last_name}`.trim() : null);
                    results.basic.company = person.company || person.organization || person.org || person.employer;
                    results.basic.position = person.position || person.job_title || person.title || person.role;
                    results.basic.domain = person.domain || person.company_domain || person.website ||
                        (email.includes('@') ? email.split('@')[1] : null);
                    results.basic.confidence = person.confidence || cuf.confidence || person.score || person.likelihood;
                                         // Extract social profiles, normalize to clean URLs only
                     const rawSocial = person.social_profiles || person.social || person.links || [];
                     const normalized = Array.isArray(rawSocial) ? rawSocial
                         .map(s => {
                             if (typeof s === 'string') {
                                 // Clean the URL by removing any platform prefixes
                                 const cleanUrl = s.replace(/^[^h]*https?:\/\//i, 'https://');
                                 return { url: cleanUrl };
                             }
                             if (s && typeof s === 'object') {
                                 const url = s.url || s.link || s.profile || s.href;
                                 if (!url) return null;
                                 // Clean the URL by removing any platform prefixes
                                 const cleanUrl = url.replace(/^[^h]*https?:\/\//i, 'https://');
                                 return { url: cleanUrl };
                             }
                             return null;
                         })
                         .filter(Boolean) : [];
                     if (normalized.length) results.social = [...results.social, ...normalized];
                    results.metadata.cufinder = cuf;
                }
            } else {
                console.log('❌ CUFinder returned no data');
            }
        } catch (error) {
            console.log('❌ CUFinder failed:', error.message);
        }
        
                                                                      // 2. GHunt (Google account OSINT) - Direct Python module execution
         try {
             console.log('🔍 Running GHunt with Python module...');
             
             const ghuntData = await runToolIfAvailable('ghunt', ['email', email], (stdout, stderr) => {
                 try {
                     // Try to parse the output directly
                     if (stdout && stdout.trim()) {
                         const ghuntData = parseGHuntFromText(stdout);
                         if (ghuntData) {
                             return parseGHuntSimple(ghuntData);
                         }
                     }
                     return null;
                     } catch (parseError) {
                     console.log('❌ GHunt parsing error:', parseError.message);
                     return null;
                 }
             });
             
             if (ghuntData && Object.keys(ghuntData).length > 0) {
                 results.google = ghuntData;
                 
                 // Extract additional info from GHunt
                 if (ghuntData.name && !results.basic.name) {
                     results.basic.name = ghuntData.name;
                 }
                 if (ghuntData.picture && !results.metadata.picture) {
                     results.metadata.picture = ghuntData.picture;
                 }
             } else {
                 console.log('❌ GHunt extracted no useful data');
             }
        } catch (error) {
            console.log('❌ GHunt failed:', error.message);
        }
        
                 // 3. Holehe (email breach checker)
         try {
             console.log('🔍 Running Holehe...');
             const holeheResult = await runToolIfAvailable('holehe', [email, '-C', '--no-color'], async (stdout, stderr) => {
                // Wait a bit for the CSV file to be written
                await new Promise(resolve => setTimeout(resolve, 8000));
                
                                 // Check if CSV file was created and schedule cleanup
                 const csvFiles = fs.readdirSync('.').filter(f => f.startsWith('holehe_') && f.endsWith('_results.csv'));
                 console.log('🔍 Holehe CSV files found after execution:', csvFiles);
                 
                 // Schedule cleanup for all CSV files
                 csvFiles.forEach(csvFile => {
                     scheduleFileCleanup(csvFile);
                 });
                 
                 return parseHolehe(stdout, stderr);
            });
            
            if (holeheResult) {
                console.log('✅ Holehe data received:', JSON.stringify(holeheResult).substring(0, 200) + '...');
                
                // Extract breaches and registrations
                if (holeheResult.leaks && Array.isArray(holeheResult.breaches)) {
                    results.leaks = holeheResult.breaches;
                    console.log('✅ Found breaches:', results.leaks.length);
                }
                
                // Extract social media registrations
                if (holeheResult.social && Array.isArray(holeheResult.social)) {
                    results.social = [...new Set([...results.social, ...holeheResult.social])];
                    console.log('✅ Found social profiles:', results.social.length);
                }
                
                results.metadata.holehe = holeheResult;
            } else {
                console.log('❌ Holehe returned no data');
            }
        } catch (error) {
            console.log('❌ Holehe failed:', error.message);
        }
        
                 // 4. Sherlock (email search across social media) + Specific Platform Checks
         try {
             console.log('🔍 Running Sherlock...');
             console.log('🔍 Using email for Sherlock:', email);
             
             // First run Sherlock for general search
             const sherlockResult = await runToolIfAvailable('sherlock', [email, '--print-found', '--no-color'], (stdout) => {
                console.log('🔍 Sherlock raw output length:', stdout.length);
                console.log('🔍 Sherlock raw output preview:', stdout.substring(0, 300) + '...');
                try {
                    // Sherlock outputs found profiles line by line
                    const lines = stdout.split('\n').filter(line => line.trim() && line.includes('http'));
                    console.log('🔍 Sherlock found lines with URLs:', lines.length);
                                         const result = lines.map(line => {
                         const match = line.match(/\[([^\]]+)\]\s*(.+)/);
                         if (match) {
                             // Clean the URL by removing any platform prefixes
                             const cleanUrl = match[2].trim().replace(/^[^h]*https?:\/\//i, 'https://');
                             return { url: cleanUrl };
                         }
                         // Clean the URL by removing any platform prefixes
                         const cleanUrl = line.trim().replace(/^[^h]*https?:\/\//i, 'https://');
                         return { url: cleanUrl };
                     });
                    console.log('🔍 Sherlock parsed result:', result);
                    return result;
                } catch (e) {
                    console.log('❌ Sherlock parsing error:', e.message);
                    return null;
                }
            });
            
                         if (sherlockResult && Array.isArray(sherlockResult)) {
                 console.log('✅ Sherlock data received, count:', sherlockResult.length);
                 results.social = [...new Set([...results.social, ...sherlockResult])];
             } else {
                 console.log('❌ Sherlock returned no valid data');
             }
             
             // Add specific platform checks for popular sites
             console.log('🔍 Running specific platform checks...');
             const specificPlatforms = [
                 'instagram', 'facebook', 'twitter', 'linkedin', 'tinder', 'bumble', 
                 'okcupid', 'hinge', 'pinterest', 'tiktok', 'snapchat', 'reddit',
                 'github', 'youtube', 'twitch', 'discord', 'telegram', 'whatsapp'
             ];
             
             const specificResults = await runToolIfAvailable('sherlock', [email, '--print-found', '--site', specificPlatforms.join(',')], (stdout) => {
                 try {
                     const lines = stdout.split('\n').filter(line => line.trim() && line.includes('http'));
                     return lines.map(line => {
                         const match = line.match(/\[([^\]]+)\]\s*(.+)/);
                         if (match) {
                             const cleanUrl = match[2].trim().replace(/^[^h]*https?:\/\//i, 'https://');
                             return { url: cleanUrl };
                         }
                         const cleanUrl = line.trim().replace(/^[^h]*https?:\/\//i, 'https://');
                         return { url: cleanUrl };
                     });
                 } catch (e) {
                     console.log('❌ Specific platform parsing error:', e.message);
                     return [];
                 }
             });
             
             if (specificResults && Array.isArray(specificResults)) {
                 console.log('✅ Specific platform checks completed, found:', specificResults.length);
                 results.social = [...new Set([...results.social, ...specificResults])];
             }
        } catch (error) {
            console.log('❌ Sherlock failed:', error.message);
        }
        
        // 5. Maigret (extended Sherlock sources)
        try {
            console.log('🔍 Running Maigret...');
            console.log('🔍 Using email for Maigret:', email);
            const maigretResult = await runToolIfAvailable('maigret', [email, '--no-color'], parseMaigretSimple);
            
            if (maigretResult && maigretResult.socialProfiles) {
                console.log('✅ Maigret data received, social profiles:', maigretResult.socialProfiles.length);
                
                // Add Maigret social profiles to results
                const maigretProfiles = maigretResult.socialProfiles.map(url => ({ url }));
                results.social = [...new Set([...results.social, ...maigretProfiles])];
                
                results.metadata.maigret = maigretResult;
            } else {
                console.log('❌ Maigret returned no valid data');
            }
            
            // Debug: Log current social profiles
            console.log('🔍 Total social profiles after Maigret:', results.social.length);
            console.log('🔍 Social profiles:', results.social.slice(0, 5)); // Show first 5
        } catch (error) {
            console.log('❌ Maigret failed:', error.message);
        }
        
        // Clean and structure final result
        const finalResult = {
            email: email,
            name: results.basic.name || 'Unknown',
            company: results.basic.company || 'Unknown',
            position: results.basic.position || 'Unknown',
            domain: results.basic.domain || 'Unknown',
            confidence: results.basic.confidence || 'Unknown',
            socialProfiles: results.social.length > 0 ? results.social : [],
            breaches: results.leaks.length > 0 ? results.leaks : [],
            google: results.google,
            metadata: results.metadata,
            timestamp: new Date().toISOString()
        };
        
        // Store final results in database
        try {
        if (searchId) {
            await dbManager.insertSearch(email, 'email', finalResult);
            console.log(`💾 Results stored in database with ID: ${searchId}`);
            
            // Track any temporary files created during the search
            const tempFiles = [
                path.join(tempDir, `ghunt_${Date.now()}.json`),
                path.join(tempDir, `holehe_${Date.now()}_results.csv`),
                path.join(tempDir, `sherlock_${Date.now()}.json`),
                path.join(tempDir, `maigret_${Date.now()}.json`)
            ];
            
            for (const tempFile of tempFiles) {
                if (fs.existsSync(tempFile)) {
                    await dbManager.insertTempFile(searchId, tempFile);
                    console.log(`📁 Tracking temp file: ${tempFile}`);
                }
            }
            }
        } catch (error) {
            console.log('⚠️ Result storage failed:', error.message);
        }
        
        console.log('✅ Email lookup completed successfully');
        console.log('📊 Final result summary:');
        console.log('  - Name:', finalResult.name);
        console.log('  - Company:', finalResult.company);
        console.log('  - Social profiles:', finalResult.socialProfiles.length);
        console.log('  - Breaches:', finalResult.breaches.length);
        console.log('  - Google data:', finalResult.google ? 'Yes' : 'No');
        console.log('  - Metadata keys:', Object.keys(finalResult.metadata));
        console.log('🔍 Final result structure:', JSON.stringify(finalResult, null, 2).substring(0, 1000) + '...');
        
        res.json({ success: true, data: finalResult });
        
    } catch (error) {
        console.error('❌ Email lookup error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve email information',
            details: error.message 
        });
    }
});

// Phone lookup endpoint (PhoneInfoga + phone-number-api.com + Sherlock + Maigret) - Linux/Render optimized
app.post('/api/phone-lookup', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid phone number' 
            });
        }
        
        // Log search and get search ID for tracking
        let searchId = null;
        try {
            searchId = await dbManager.insertSearch(phone, 'phone', null);
        } catch (error) {
            console.log('⚠️ Search logging failed:', error.message);
        }
        console.log(`🔍 Starting phone lookup for: ${phone}`);
        
        // Collect data from all available sources
        const results = {
            phone: phone,
            basic: {},
            social: [],
            leaks: [],
            metadata: {}
        };
        
                 // 1. PhoneInfoga (primary phone OSINT tool) - LINUX/RENDER NATIVE APPROACH
        try {
            console.log('📱 Running PhoneInfoga...');
            let infoga = null;
            
                         // Method 1: Try native PhoneInfoga first (most reliable on Linux/Render)
            // Native PhoneInfoga only (Docker removed)
            try {
                console.log('🔍 Attempting PhoneInfoga (native)...');
                    infoga = await runToolIfAvailable('phoneinfoga', ['scan', '-n', phone, '--no-color'], parsePhoneInfoga);
                if (infoga) console.log('✅ PhoneInfoga native execution successful');
            } catch (nativeError) {
                console.log('❌ PhoneInfoga native failed:', nativeError.message);
            }
            
            // Docker path removed entirely
            
            // Method 3: Try CLI helper as last resort
            if (!infoga) {
                try {
                    console.log('🔍 Attempting PhoneInfoga with CLI helper...');
                    const cli = await fetchFromPhoneInfoga(phone);
                    if (cli) {
                        infoga = cli;
                        console.log('✅ PhoneInfoga CLI helper successful');
                    }
                } catch (cliError) {
                    console.log('❌ PhoneInfoga CLI helper failed:', cliError.message);
                }
            }
            if (infoga) {
                if (infoga.basic) {
                    results.basic = { ...infoga.basic, ...results.basic };
                }
                if (infoga.carrier && !results.basic.carrier) results.basic.carrier = infoga.carrier;
                if (infoga.owner && !results.basic.owner) results.basic.owner = infoga.owner;
                results.metadata = { ...results.metadata, ...infoga.metadata };
            } else {
                console.log('❌ PhoneInfoga produced no data');
            }
        } catch (error) {
            console.log('❌ PhoneInfoga not available');
        }
        
        // 2. phone-number-api.com (carrier and formatting info)
        try {
            console.log('🌐 Fetching from phone-number-api.com...');
            const phoneApiResult = await scrapePhoneNumberApiHtml(phone);
            
            if (phoneApiResult && phoneApiResult.phoneApi) {
                console.log('✅ phone-number-api.com data received');
                const pna = phoneApiResult.phoneApi;
                
                // Fill in missing basic info
                if (!results.basic.carrier && pna.carrier) {
                    results.basic.carrier = pna.carrier;
                }
                if (!results.basic.country && pna.country) {
                    results.basic.country = pna.country;
                }
                if (!results.basic.type && pna.type) {
                    results.basic.type = pna.type;
                }
                if (pna.validity !== undefined && pna.validity !== null) {
                    results.basic.valid = pna.validity;
                }
                
                // Extract additional metadata
                if (pna.metadata) {
                    results.metadata.phoneApi = pna.metadata;
                }
            }
        } catch (error) {
            console.log('❌ phone-number-api.com failed:', error.message);
        }
        
                 // 3. Sherlock - SKIP for phone numbers (now requires email input)
        console.log('⏭️ Skipping Sherlock for phone number (now requires email input)');
        
        // 4. Maigret - SKIP for phone numbers (now requires email input)
        console.log('⏭️ Skipping Maigret for phone number (now requires email input)');
        
        // 5. Holehe (phone breach checker) - SKIP for phone numbers, only works with emails
        console.log('⏭️ Skipping Holehe for phone number (only works with emails)');
        
        // Clean and structure final result
        const finalResult = {
            phone: phone,
            owner: results.basic.owner || 'Unknown',
            email: results.basic.email || 'Unknown',
            carrier: results.basic.carrier || 'Unknown',
            location: results.basic.location || 'Unknown',
            lineType: results.basic.type || 'Unknown',
            country: results.basic.country || 'Unknown',
            valid: typeof results.basic.valid === 'boolean' ? results.basic.valid : 'Unknown',
            international: results.basic.international || results.basic.e164 || 'Unknown',
            local: results.basic.local || 'Unknown',
            socialMedia: results.social.length > 0 ? results.social : [],
            breaches: results.leaks.length > 0 ? results.leaks : [],
            metadata: results.metadata,
            timestamp: new Date().toISOString()
        };
        
        console.log('📊 Final phone lookup result:');
        console.log('  - Phone:', finalResult.phone);
        console.log('  - Country:', finalResult.country);
        console.log('  - Carrier:', finalResult.carrier);
        console.log('  - Line Type:', finalResult.lineType);
        console.log('  - International:', finalResult.international);
        console.log('  - Local:', finalResult.local);
        console.log('  - Social Media:', finalResult.socialMedia.length);
        console.log('  - Metadata keys:', Object.keys(finalResult.metadata));
        
        // Store final results in database
        try {
        if (searchId) {
            await dbManager.insertSearch(phone, 'phone', finalResult);
            console.log(`💾 Phone results stored in database with ID: ${searchId}`);
            
            // Track any temporary files created during the search
            const tempFiles = [
                path.join(tempDir, `phoneinfoga_${Date.now()}.json`),
                path.join(tempDir, `sherlock_${Date.now()}.json`),
                path.join(tempDir, `maigret_${Date.now()}.json`)
            ];
            
            for (const tempFile of tempFiles) {
                if (fs.existsSync(tempFile)) {
                    await dbManager.insertTempFile(searchId, tempFile);
                    console.log(`📁 Tracking temp file: ${tempFile}`);
                }
            }
            }
        } catch (error) {
            console.log('⚠️ Result storage failed:', error.message);
        }
        
        console.log('✅ Phone lookup completed successfully');
        res.json({ success: true, data: finalResult });
        
    } catch (error) {
        console.error('❌ Phone lookup error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve phone information',
            details: error.message 
        });
    }
});

// IP lookup endpoint
app.post('/api/ip-lookup', async (req, res) => {
    try {
        const { ip } = req.body;
        
        // Log search and get search ID for tracking
        let searchId = null;
        try {
            searchId = await dbManager.insertSearch(ip, 'ip', null);
        } catch (error) {
            console.log('⚠️ Search logging failed:', error.message);
        }
        // IP Geolocation API (use token if available)
        const token = process.env.IPINFO_TOKEN ? `?token=${process.env.IPINFO_TOKEN}` : '';
        const ipResponse = await axios.get(`https://ipinfo.io/${ip}/json${token}`, {
            headers: {
                'User-Agent': 'OSINT-Lookup-Engine/1.0'
            }
        });
        
        const ipData = ipResponse.data;
        
        const result = {
            ip: ip,
            city: ipData.city || 'Unknown',
            region: ipData.region || 'Unknown',
            country: ipData.country || 'Unknown',
            isp: ipData.org || 'Unknown',
            timezone: ipData.timezone || 'Unknown',
            coordinates: ipData.loc || 'Unknown',
            abuseContact: ipData.abuse || 'Unknown',
            organization: ipData.org || 'Unknown',
            timestamp: new Date().toISOString()
        };
        
        // Store final results in database
        try {
        if (searchId) {
            await dbManager.insertSearch(ip, 'ip', result);
            console.log(`💾 IP results stored in database with ID: ${searchId}`);
            
            // Track any temporary files created during the search
            const tempFiles = [
                path.join(tempDir, `ipinfo_${Date.now()}.json`)
            ];
            
            for (const tempFile of tempFiles) {
                if (fs.existsSync(tempFile)) {
                    await dbManager.insertTempFile(searchId, tempFile);
                    console.log(`📁 Tracking temp file: ${tempFile}`);
                }
            }
            }
        } catch (error) {
            console.log('⚠️ Result storage failed:', error.message);
        }
        
        res.json({ success: true, data: result });
        
    } catch (error) {
        console.error('IP lookup error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to retrieve IP information',
            details: error.message 
        });
    }
});

// Stats endpoint - FIXED FOR LINUX/RENDER
app.get('/api/stats', async (req, res) => {
    try {
        const visitorStats = await dbManager.getVisitorStats();
        const searchCount = await dbManager.getSearchCount();
        
        res.json({
            visitors_today: visitorStats.visitors_today,
            total_visitors: visitorStats.total_visitors,
            hits_today: visitorStats.hits_today,
            total_hits: visitorStats.total_hits,
            searches: searchCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.log('❌ Stats error:', error.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Tool test endpoint to verify OSINT tools are working
app.get('/api/test-tools', async (req, res) => {
    const results = {};
    
    // Test each tool
    const tools = ['sherlock', 'holehe', 'maigret', 'ghunt'];
    
    for (const tool of tools) {
        try {
            console.log(`🧪 Testing tool: ${tool}`);
            const resolved = await resolveToolCommand(tool);
            results[tool] = {
                resolved: resolved,
                available: !!resolved.command
            };
            
            if (resolved.command) {
                // Try a simple help command
                try {
                    const { stdout, stderr } = await execFileAsync(resolved.command, 
                        resolved.viaPython 
                            ? (resolved.viaPython.startsWith('-m ') 
                                ? ['-m', resolved.viaPython.replace('-m ', ''), '--help']
                                : resolved.viaPython.startsWith('-m')
                                ? [resolved.viaPython, '--help']
                                : [resolved.viaPython, '--help'])
                            : ['--help'], 
                        { timeout: 10000 }
                    );
                    results[tool].helpTest = {
                        success: true,
                        stdoutLength: stdout?.length || 0,
                        stderrLength: stderr?.length || 0
                    };
                } catch (helpError) {
                    results[tool].helpTest = {
                        success: false,
                        error: helpError.message
                    };
                }
            }
        } catch (error) {
            results[tool] = {
                resolved: null,
                available: false,
                error: error.message
            };
        }
    }
    
    res.json({
        success: true,
        tools: results,
        pythonVersion: process.env.PYTHON_VERSION || 'unknown',
        nodeVersion: process.version
    });
});

// Search history endpoint
app.get('/api/search-history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const searchHistory = await dbManager.getSearchHistory(limit);
        
        res.json({
            success: true,
            data: searchHistory,
            query: req.query,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.log('❌ Search history error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to retrieve search history',
            details: error.message 
        });
    }
});

// Reset counts endpoint (for production deployment)
app.post('/api/reset-counts', async (req, res) => {
    try {
        const success = await dbManager.resetCounts();
        
        if (success) {
            res.json({
                success: true,
                message: 'All visitor and search counts have been reset to zero',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to reset counts'
            });
        }
    } catch (error) {
        console.log('❌ Reset counts error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to reset counts',
            details: error.message 
        });
    }
});

// Manual cleanup endpoint
app.post('/api/cleanup-files', async (req, res) => {
    try {
        const deletedFiles = await dbManager.cleanupExpiredFiles();
        
        res.json({
            success: true,
            message: `Cleaned up ${deletedFiles.length} expired files`,
            deletedFiles: deletedFiles,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.log('❌ Manual cleanup error:', error.message);
        res.status(500).json({ 
            success: false,
            error: 'Failed to cleanup files',
            details: error.message 
        });
    }
});

// Holehe CSV download endpoint
app.get('/api/download-holehe-csv', (req, res) => {
    try {
        // Find the most recent Holehe CSV file
        const csvFiles = fs.readdirSync('.').filter(f => f.includes('holehe_') && f.includes('_results.csv'));
        
        if (csvFiles.length === 0) {
            return res.status(404).json({ error: 'No Holehe CSV files found' });
        }
        
        // Get the newest file
        const newestFile = csvFiles.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
        const filePath = path.join(process.cwd(), newestFile);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${newestFile}"`);
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Error downloading Holehe CSV:', error);
        res.status(500).json({ error: 'Failed to download CSV file' });
    }
});

// Helper functions
function parseGHuntFromText(text) {
    try {
        // GHunt outputs information in a structured text format
        // Extract key information from the text output
        const result = {};
        
        // Extract name
        const nameMatch = text.match(/Name:\s*(.+)/i);
        if (nameMatch) result.name = nameMatch[1].trim();
        
        // Extract email
        const emailMatch = text.match(/Email:\s*(.+)/i);
        if (emailMatch) result.email = emailMatch[1].trim();
        
        // Extract picture URL
        const pictureMatch = text.match(/Picture:\s*(https?:\/\/[^\s]+)/i);
        if (pictureMatch) result.picture = pictureMatch[1].trim();
        
        // Extract services
        const servicesMatch = text.match(/Services:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i);
        if (servicesMatch) {
            const services = servicesMatch[1].split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('Services:'))
                .map(line => line.replace(/^[-*]\s*/, ''));
            result.services = services;
        }
        
        // Extract additional info
        const infoMatch = text.match(/Additional Info:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i);
        if (infoMatch) {
            result.additionalInfo = infoMatch[1].trim();
        }
        
        return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
        console.log('❌ GHunt text parsing failed:', error.message);
        return null;
    }
}

function detectQueryType(value) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const normalizedPhone = value.replace(/[\s\-\(\)]/g, '');
    const isPhone = /^\+?[1-9][\d]{5,15}$/.test(normalizedPhone);
    if (isEmail) return 'email';
    if (isPhone) return 'phone';
    return 'username';
}

async function isCommandAvailable(cmd) {
    try {
        // Linux/Render: use 'which' command
        await execAsync(`which ${cmd}`);
            return true;
        } catch {
            return false;
        }
    }

// Dynamic command templates for tools with placeholders (native Python execution)
const toolTemplates = {
    sherlock: {
        command: 'python3',
        args: ['-m', 'sherlock', '<email>'],
        placeholder: '<email>'
    },
    maigret: {
        command: 'python3',
        args: ['-m', 'maigret', '<email>'],
        placeholder: '<email>'
    },
    holehe: {
        command: 'python3',
        args: ['-m', 'holehe', '<email>'],
        placeholder: '<email>'
    },
    phoneinfoga: {
        command: 'python3',
        args: ['-m', 'phoneinfoga', 'scan', '--number', '<phone_number>'],
        placeholder: '<phone_number>'
    }
};

// Extend resolver to map to tool templates for these tools
async function resolveToolCommand(cmd) {
    console.log(`🔍 Resolving tool command for: ${cmd}`);
    
    // Template-driven tools (native Python execution)
    if (toolTemplates[cmd]) {
        const py = await ensurePythonReady();
        if (py) {
            // Use virtual environment Python if available
            const templateArgs = toolTemplates[cmd].args.map(arg => 
                arg === toolTemplates[cmd].command ? py : arg
            );
            return { 
                command: py, 
                viaTemplate: true, 
                templateArgs: templateArgs, 
                placeholder: toolTemplates[cmd].placeholder 
            };
        } else {
            // Fallback to original template
            return { 
                command: toolTemplates[cmd].command, 
                viaTemplate: true, 
                templateArgs: toolTemplates[cmd].args, 
                placeholder: toolTemplates[cmd].placeholder 
            };
        }
    }

    // GHunt via python module
    if (cmd === 'ghunt') {
        const py = await ensurePythonReady();
        if (py) {
        console.log(`🔍 Using Python module execution for ${cmd}: ${py} -m ${cmd}`);
        return { command: py, viaPython: cmd };
        } else {
            console.log(`❌ Python not available for ${cmd}, trying direct command`);
            return { command: 'python3', viaPython: cmd };
        }
    }

    // Fallback to direct availability
    const ok = await isCommandAvailable(cmd);
    console.log(`🔍 Direct command availability for ${cmd}: ${ok}`);
        if (ok) return { command: cmd, viaPython: false };
        
    // Final fallback
    console.log(`🔍 Using final fallback for ${cmd}: python3 -m ${cmd}`);
    return { command: 'python3', viaPython: cmd };
}

// Update runToolIfAvailable to handle docker inputs
async function runToolIfAvailable(cmd, args, parseFn) {
    console.log(`🔧 Running tool: ${cmd} with args:`, args);
    const resolved = await resolveToolCommand(cmd);
    console.log(`🔍 Tool resolution result:`, resolved);
    if (!resolved.command) {
        console.log(`❌ Tool ${cmd} not available`);
        return null;
    }
    
    // Template execution branch (native Python)
    if (resolved.viaTemplate) {
        const userInput = args[0] || '';
        if (!userInput) {
            console.log(`❌ No user input provided for ${cmd}`);
            return null;
        }
        // Replace placeholder with user input, then add remaining arguments
        const templateArgs = resolved.templateArgs.map((a) => typeof a === 'string' && resolved.placeholder ? a.replace(resolved.placeholder, userInput) : a);
        const allArgs = [...templateArgs, ...args.slice(1)]; // Add all additional arguments after the first one
        
        console.log(`🔧 Executing: ${resolved.command} ${allArgs.join(' ')}`);
        try {
            const { stdout, stderr } = await execFileAsync(resolved.command, allArgs, {
                timeout: 300000,
                maxBuffer: 1024 * 1024 * 20,
                env: { ...process.env, PYTHONUNBUFFERED: '1', NO_COLOR: '1' },
                encoding: 'utf8'
            });
            const parsed = parseFn(stdout, stderr);
            if (parsed && typeof parsed === 'object') parsed.__source = cmd;
            return parsed;
        } catch (err) {
            console.log(`❌ Template tool ${cmd} failed:`, err.message);
            return null;
        }
    }

    // Python module/direct execution (existing logic)
    const spawnCmd = resolved.command;
    let spawnArgs;
    if (resolved.viaPython) {
        if (resolved.viaPython.startsWith('-m ')) {
            const moduleName = resolved.viaPython.replace('-m ', '');
            spawnArgs = ['-m', moduleName, ...args];
        } else if (resolved.viaPython.startsWith('-m')) {
            const moduleName = resolved.viaPython.replace('-m', '');
            spawnArgs = ['-m', moduleName, ...args];
        } else {
            spawnArgs = ['-m', resolved.viaPython, ...args];
        }
    } else {
        spawnArgs = args;
    }
    try {
        const { stdout, stderr } = await execFileAsync(spawnCmd, spawnArgs, {
            timeout: 180000,
            maxBuffer: 1024 * 1024 * 20,
            env: { ...process.env, PYTHONUNBUFFERED: '1', NO_COLOR: '1' },
            encoding: 'utf8'
        });
        const parsed = parseFn(stdout, stderr);
        if (parsed && typeof parsed === 'object') parsed.__source = cmd;
        return parsed;
    } catch (err) {
        console.log(`❌ Tool ${cmd} failed:`, err.message);
        return null;
    }
}

// Use GHunt smart runner in email-lookup
// Replace previous ghunt module call
// In the GHunt section of /api/email-lookup, replace with:
// const ghuntOutput = await runGhuntEmailSmart(email);
// const ghuntData = parseGHuntFromText(ghuntOutput);

// PhoneInfoga Docker helper removed (Docker not used)

// -- Modular helpers for /lookup --
async function queryPhoneInfoga(phone) {
    try {
        const bin = await ensurePhoneInfogaInstalled();
        const { stdout } = await execFileAsync(bin, ['scan', '-n', phone, '--no-color'], { timeout: 120000, maxBuffer: 1024 * 1024 * 10 });
        return parsePhoneInfoga(stdout);
    } catch {
        return null;
    }
}

async function fetchPhoneNumberApiJSON(phone) {
    const normalized = String(phone).replace(/[\s\-\(\)]/g, '');
    const candidates = [
        `https://demo.phone-number-api.com/json/?number=${encodeURIComponent(normalized)}`,
        `https://phone-number-api.com/json/?number=${encodeURIComponent(normalized)}`
    ];
    for (const url of candidates) {
        try {
            const r = await axios.get(url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (r.status === 200 && typeof r.data === 'object') return r.data;
        } catch {}
    }
    // Fallback to existing HTML parser for formatting fields if JSON not available
    const htmlParsed = await scrapePhoneNumberApiHtml(phone);
    if (htmlParsed?.phoneApi) {
        return {
            carrier: htmlParsed.phoneApi.carrier,
            country: htmlParsed.phoneApi.country,
            numberType: htmlParsed.phoneApi.type,
            formatInternational: htmlParsed.phoneApi.metadata?.formatInternational,
            formatE164: htmlParsed.phoneApi.metadata?.formatE164
        };
    }
    return null;
}

async function fetchBreaches(phone) {
    const sources = [];
    // Dehashed (optional)
    if (process.env.DEHASHED_EMAIL && process.env.DEHASHED_API_KEY) {
        try {
            const url = `https://api.dehashed.com/search?query=${encodeURIComponent(phone)}`;
            const auth = Buffer.from(`${process.env.DEHASHED_EMAIL}:${process.env.DEHASHED_API_KEY}`).toString('base64');
            const r = await axios.get(url, { headers: { Authorization: `Basic ${auth}` }, timeout: 12000 });
            if (r.status === 200 && r.data && ((r.data.entries && r.data.entries.length) || r.data.total)) {
                sources.push('dehashed');
            }
        } catch {}
    }
    return { sources };
}

// ========== Modular source: PhoneInfoga ==========
async function fetchFromPhoneInfoga(phone) {
    try {
        const bin = await ensurePhoneInfogaInstalled();
        const { stdout } = await execFileAsync(bin, ['scan', '-n', phone, '--no-color'], { timeout: 120000, maxBuffer: 1024 * 1024 * 10 });
        return parsePhoneInfoga(stdout);
    } catch {
        return null;
    }
}

// ========== Modular source: Phone-Number-API.com (public JSON) ==========
async function fetchFromPhoneNumberApi(phone) {
    const normalized = phone.replace(/[\s\-\(\)]/g, '');
    const jsonCandidates = [
        `https://demo.phone-number-api.com/json/?number=${encodeURIComponent(normalized)}`,
        `https://phone-number-api.com/json/?number=${encodeURIComponent(normalized)}`
    ];
    for (const url of jsonCandidates) {
        try {
            const r = await axios.get(url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (r.status === 200 && r.data && typeof r.data === 'object') {
                const d = r.data;
                return {
                    carrier: d.carrier || null,
                    country: d.country || d.countryName || null,
                    numberType: d.numberType || null,
                    formatInternational: d.formatInternational || null,
                    formatE164: d.formatE164 || null
                };
            }
        } catch {}
    }
    return null;
}

// ========== Modular source: Leaks APIs (optional) ==========
async function fetchFromLeaksApis(phone) {
    const sources = [];
    // Dehashed (requires creds): https://www.dehashed.com/
    if (process.env.DEHASHED_EMAIL && process.env.DEHASHED_KEY) {
        try {
            const auth = Buffer.from(`${process.env.DEHASHED_EMAIL}:${process.env.DEHASHED_KEY}`).toString('base64');
            const q = encodeURIComponent(`phone:"${phone}"`);
            const r = await axios.get(`https://api.dehashed.com/search?query=${q}`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                timeout: 12000
            });
            if (r.status === 200 && r.data && (r.data.entries?.length || 0) > 0) {
                sources.push({ provider: 'dehashed', count: r.data.entries.length });
            }
        } catch {}
    }
    // HaveIBeenPwned primarily supports emails; skip unless you map phone->email externally.
    return { sources };
}

function parseSherlock(stdout) {
     // Sherlock --print-found lists lines with found URLs
     const urls = stdout.split(/\r?\n/).filter(l => /https?:\/\//i.test(l))
         .map(url => {
             // Clean the URL by removing any platform prefixes
             return url.replace(/^[^h]*https?:\/\//i, 'https://');
         });
     return { socialProfiles: urls };
 }

function parseMaigret(stdout) {
    console.log('🔍 Maigret parsing input length:', stdout?.length || 0);
    
    // Clean the output by removing progress bars and control characters
    let cleanOutput = stdout;
    
    // Remove progress bar lines and control characters
    cleanOutput = cleanOutput.replace(/\r/g, ''); // Remove carriage returns
    cleanOutput = cleanOutput.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ''); // Remove ANSI escape codes
    cleanOutput = cleanOutput.replace(/Searching \|.*?\|.*?\[.*?\] in.*?\n/g, ''); // Remove progress bars
    cleanOutput = cleanOutput.replace(/\[-].*?\n/g, ''); // Remove info lines
    cleanOutput = cleanOutput.replace(/\[!].*?\n/g, ''); // Remove warning lines
    cleanOutput = cleanOutput.replace(/\[*].*?\n/g, ''); // Remove info lines
    
    console.log('🔍 Maigret cleaned output preview:', cleanOutput.substring(0, 500) || 'empty');
    
    // Try JSON first; fallback to URL extraction
    try {
        // Handle ndjson format (newline-delimited JSON)
        if (cleanOutput.includes('\n')) {
            const lines = cleanOutput.split('\n').filter(line => line.trim());
            const results = [];

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data && data.sites) {
                        const urls = Object.values(data.sites).map(s => s.url).filter(Boolean);
                        results.push(...urls);
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                    continue;
                }
            }

            if (results.length > 0) {
                console.log('✅ Maigret found URLs (ndjson):', results.length);
                return { socialProfiles: results };
            }
        }

        // Try single JSON object
        const data = JSON.parse(cleanOutput);
        const urls = Object.values(data?.sites || {}).map(s => s.url).filter(Boolean);
        console.log('✅ Maigret found URLs (single JSON):', urls.length);
        return { socialProfiles: urls };
    } catch (e) {
        console.log('🔍 Maigret JSON parsing failed, trying URL extraction:', e.message);
        // Fallback: extract URLs from text
        const urls = cleanOutput.split(/\r?\n/).filter(l => /https?:\/\//i.test(l));
        console.log('✅ Maigret found URLs (text extraction):', urls.length);
        return { socialProfiles: urls };
    }
}

function parseMaigretSimple(stdout) {
     console.log('🔍 Maigret Simple parsing input length:', stdout?.length || 0);
     
     // Clean the output by removing progress bars and control characters
     let cleanOutput = stdout;
     
     // Remove progress bar lines and control characters
     cleanOutput = cleanOutput.replace(/\r/g, ''); // Remove carriage returns
     cleanOutput = cleanOutput.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ''); // Remove ANSI escape codes
     cleanOutput = cleanOutput.replace(/Searching \|.*?\|.*?\[.*?\] in.*?\n/g, ''); // Remove progress bars
     cleanOutput = cleanOutput.replace(/\[-].*?\n/g, ''); // Remove info lines
     cleanOutput = cleanOutput.replace(/\[!].*?\n/g, ''); // Remove warning lines
     cleanOutput = cleanOutput.replace(/\[*].*?\n/g, ''); // Remove info lines
     
     console.log('🔍 Maigret Simple cleaned output preview:', cleanOutput.substring(0, 500) || 'empty');
     
     // Extract URLs from the cleaned output and clean them
     const urls = cleanOutput.split(/\r?\n/).filter(l => /https?:\/\//i.test(l))
         .map(url => {
             // Clean the URL by removing any platform prefixes
             return url.replace(/^[^h]*https?:\/\//i, 'https://');
         });
     console.log('✅ Maigret Simple found URLs:', urls.length);
     return { socialProfiles: urls };
 }

function parseHolehe(stdout) {
    console.log('🔍 Holehe parsing input length:', stdout?.length || 0);
    console.log('🔍 Holehe raw output preview:', stdout?.substring(0, 500) || 'empty');
    
    // Parse CSV using header mapping for robustness
    try {
        const csvFiles = fs.readdirSync('.').filter(f => f.startsWith('holehe_') && f.endsWith('_results.csv'));
        console.log('🔍 Found Holehe CSV files:', csvFiles);
        
        if (csvFiles.length) {
            const newestFile = csvFiles.sort((a,b)=>fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
            console.log('🔍 Using newest CSV file:', newestFile);
            
            const csv = fs.readFileSync(newestFile, 'utf8');
            const lines = csv.split(/\r?\n/).filter(Boolean);
            console.log('🔍 CSV lines count:', lines.length);
            
            if (lines.length < 2) {
                console.log('❌ CSV file has insufficient data');
                return null;
            }
            
            const header = lines[0].split(',').map(h => h.trim().toLowerCase());
            console.log('🔍 CSV header:', header);
            
            const nameIdx = header.indexOf('name');
            const existsIdx = header.indexOf('exists');
            
            if (nameIdx === -1 || existsIdx === -1) {
                console.log('❌ CSV header missing required columns');
                return null;
            }
            
            const out = [];
            
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                const site = (cols[nameIdx] || '').trim();
                const existsVal = (cols[existsIdx] || '').trim().toLowerCase();
                const exists = existsVal === 'true' || existsVal === '[+]' || existsVal === 'yes';
                if (site && exists) out.push({ site, exists: true });
            }
            
            console.log('✅ Holehe found breaches from CSV:', out.length);
            return { leaks: out };
        }
    } catch (e) {
        console.log('❌ Holehe CSV parsing failed:', e.message);
    }
    // Fallbacks
    try {
        const arr = JSON.parse(stdout);
        const found = arr.filter(x => x?.exists === true);
        return { leaks: found.map(x => ({ site: x.site, exists: true })) };
    } catch {
        // Parse stdout for lines like: "[+] service: exists"
        try {
            const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
            const out = [];
            lines.forEach(line => {
                if (/\[\+\]/.test(line)) {
                    const m = line.match(/\[\+\]\s*([^:]+)\s*:?.*/);
                    const site = m ? m[1].trim() : null;
                    if (site) out.push({ site, exists: true });
                }
            });
            if (out.length) return { leaks: out };
        } catch {}
        return null;
    }
}

function parseGHuntSimple(data) {
    console.log('🔍 GHunt simple parser - input data type:', typeof data);
    console.log('🔍 GHunt simple parser - input keys:', Object.keys(data || {}));
    
    // Initialize result object
    let result = {
        name: null,
        picture: null,
        email: null,
        google_id: null,
        profile_id: null,
        services: [],
        metadata: { ghunt: data }
    };
    
    try {
        // Method 1: Try to extract from PROFILE_CONTAINER structure
        if (data.PROFILE_CONTAINER && data.PROFILE_CONTAINER.profile) {
            console.log('🔍 Found PROFILE_CONTAINER structure');
            const profile = data.PROFILE_CONTAINER.profile;
            
            result.name = profile.name || profile.displayName || profile.fullName || null;
            result.picture = profile.picture || profile.profilePicture || profile.photo || null;
            result.email = profile.email || profile.primaryEmail || null;
            result.google_id = profile.personId || profile.id || profile.googleId || null;
            result.profile_id = profile.profileId || profile.id || null;
            
            console.log('🔍 Extracted from PROFILE_CONTAINER:', {
                name: result.name,
                picture: result.picture ? 'found' : 'not found',
                email: result.email,
                google_id: result.google_id,
                profile_id: result.profile_id
            });
        }
        
        // Method 2: Try to extract from SERVICES_CONTAINER structure
        if (data.SERVICES_CONTAINER && data.SERVICES_CONTAINER.services) {
            console.log('🔍 Found SERVICES_CONTAINER structure');
            result.services = data.SERVICES_CONTAINER.services || [];
            console.log('🔍 Extracted services count:', result.services.length);
        }
        
        // Method 3: Try direct properties (fallback)
        if (!result.name) {
            result.name = data.name || data.full_name || data.display_name || data.displayName || null;
        }
        if (!result.picture) {
            result.picture = data.picture || data.profile_picture || data.profilePicture || data.photo || null;
        }
        if (!result.email) {
            result.email = data.email || data.primaryEmail || null;
        }
        if (!result.google_id) {
            result.google_id = data.google_id || data.id || data.personId || null;
        }
        if (!result.profile_id) {
            result.profile_id = data.profile_id || data.profileId || data.id || null;
        }
        if (!result.services.length) {
            result.services = data.services || data.connected_services || data.connectedServices || [];
        }
        
        // Method 4: Try nested structures
        if (!result.name && data.profile) {
            result.name = data.profile.name || data.profile.displayName || null;
            result.picture = data.profile.picture || data.profile.profilePicture || null;
            result.email = data.profile.email || null;
        }
        
        // Clean up null/undefined values
        Object.keys(result).forEach(key => {
            if (result[key] === null || result[key] === undefined || result[key] === '') {
                delete result[key];
            }
        });
        
        console.log('🔍 Final GHunt result:', result);
        return result;
        
    } catch (error) {
        console.log('❌ GHunt simple parser error:', error.message);
        return null;
    }
}

function parseGHunt(stdout) {
    try {
        const data = JSON.parse(stdout);
        return { metadata: { ghunt: data } };
    } catch {
        return null;
    }
}

function parsePhoneInfoga(stdout) {
    try {
        // First try JSON parsing (in case it's available)
        try {
            const data = JSON.parse(stdout);
            const names = Array.isArray(data?.associated_people)
                ? data.associated_people.map(p => p?.name).filter(Boolean)
                : [];
            const owner = names.length ? names[0] : (data?.name || null);
            return {
                basic: {
                    number: data?.number || data?.input || null,
                    international: data?.international || null,
                    country: data?.country?.name || data?.region || null,
                    location: data?.location || null,
                    valid: data?.valid ?? null,
                    type: data?.line_type || data?.type || null
                },
                carrier: data?.carrier || null,
                owner: owner || null,
                metadata: { phoneinfoga: data, associated_people: names }
            };
        } catch {}
        
        // Parse text output format
        const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
        const result = {
            basic: {},
            carrier: null,
            owner: null,
            metadata: { phoneinfoga: { raw_output: lines } }
        };
        
        console.log('🔍 PhoneInfoga parsing lines:', lines.length);
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            console.log('🔍 Processing line:', trimmed);
            
            // Extract carrier info - try multiple patterns
            if (trimmed.toLowerCase().includes('carrier') || trimmed.toLowerCase().includes('network') || trimmed.toLowerCase().includes('provider')) {
                const match = trimmed.match(/[:=]\s*(.+)/i) || trimmed.match(/\s+(.+)$/i);
                if (match) {
                    const carrier = match[1].trim();
                    // Don't set if it's just "providers:" or similar
                    if (carrier && !carrier.endsWith(':') && carrier.length > 2) {
                        result.carrier = carrier;
                        console.log('✅ Found carrier:', result.carrier);
                    }
                }
            }
            
            // Extract country info
            if (trimmed.toLowerCase().includes('country') || trimmed.toLowerCase().includes('region') || trimmed.toLowerCase().includes('nation')) {
                const match = trimmed.match(/[:=]\s*(.+)/i) || trimmed.match(/\s+(.+)$/i);
                if (match) {
                    result.basic.country = match[1].trim();
                    console.log('✅ Found country:', result.basic.country);
                }
            }
            
            // Extract line type
            if (trimmed.toLowerCase().includes('type') || trimmed.toLowerCase().includes('line type') || trimmed.toLowerCase().includes('linetype')) {
                const match = trimmed.match(/[:=]\s*(.+)/i) || trimmed.match(/\s+(.+)$/i);
                if (match) {
                    result.basic.type = match[1].trim();
                    console.log('✅ Found type:', result.basic.type);
                }
            }
            
            // Extract location
            if (trimmed.toLowerCase().includes('location') || trimmed.toLowerCase().includes('city') || trimmed.toLowerCase().includes('area')) {
                const match = trimmed.match(/[:=]\s*(.+)/i) || trimmed.match(/\s+(.+)$/i);
                if (match) {
                    result.basic.location = match[1].trim();
                    console.log('✅ Found location:', result.basic.location);
                }
            }
            
            // Extract validity
            if (trimmed.toLowerCase().includes('valid')) {
                const match = trimmed.match(/[:=]\s*(.+)/i) || trimmed.match(/\s+(.+)$/i);
                if (match) {
                    const validStr = match[1].trim().toLowerCase();
                    result.basic.valid = validStr === 'true' || validStr === 'yes' || validStr === 'valid';
                    console.log('✅ Found validity:', result.basic.valid);
                }
            }
            
            // Extract phone number info - but only actual phone numbers, not URLs
            if ((trimmed.toLowerCase().includes('number') || trimmed.toLowerCase().includes('phone')) && !trimmed.includes('http')) {
                const match = trimmed.match(/[:=]\s*(.+)/i) || trimmed.match(/\s+(.+)$/i);
                if (match) {
                    const value = match[1].trim();
                    // Only set if it looks like a phone number
                    if (/^[\d\s\+\-\(\)]+$/.test(value)) {
                        result.basic.number = value;
                        console.log('✅ Found number:', result.basic.number);
                    }
                }
            }
            
            // Extract E164 format specifically
            if (trimmed.includes('E164:') || trimmed.includes('E164')) {
                const match = trimmed.match(/E164:\s*(.+)/i);
                if (match) {
                    result.basic.e164 = match[1].trim();
                    console.log('✅ Found E164:', result.basic.e164);
                }
            }
            
            // Extract International format
            if (trimmed.includes('International:') || trimmed.includes('International')) {
                const match = trimmed.match(/International:\s*(.+)/i);
                if (match) {
                    result.basic.international = match[1].trim();
                    console.log('✅ Found International:', result.basic.international);
                }
            }
            
            // Extract Local format
            if (trimmed.includes('Local:') || trimmed.includes('Local')) {
                const match = trimmed.match(/Local:\s*(.+)/i);
                if (match) {
                    result.basic.local = match[1].trim();
                    console.log('✅ Found Local:', result.basic.local);
                }
            }
        }
        
        // If we didn't find much info, try to extract from the full text
        if (!result.carrier && !result.basic.country) {
            console.log('🔍 Trying alternative text extraction...');
            const fullText = lines.join(' ').toLowerCase();
            
            // Try to find carrier in the full text
            const carrierMatch = fullText.match(/(?:carrier|network|provider)\s*[:=]?\s*([a-zA-Z0-9\s&]+?)(?:\s|$|\.|,)/i);
            if (carrierMatch && !result.carrier) {
                result.carrier = carrierMatch[1].trim();
                console.log('✅ Found carrier (alt):', result.carrier);
            }
            
            // Try to find country in the full text
            const countryMatch = fullText.match(/(?:country|region|nation)\s*[:=]?\s*([a-zA-Z0-9\s]+?)(?:\s|$|\.|,)/i);
            if (countryMatch && !result.basic.country) {
                result.basic.country = countryMatch[1].trim();
                console.log('✅ Found country (alt):', result.basic.country);
            }
            
            // Try to find line type in the full text
            const typeMatch = fullText.match(/(?:line\s*type|type|linetype)\s*[:=]?\s*([a-zA-Z0-9\s]+?)(?:\s|$|\.|,)/i);
            if (typeMatch && !result.basic.type) {
                result.basic.type = typeMatch[1].trim();
                console.log('✅ Found type (alt):', result.basic.type);
            }
        }
        
        console.log('🔍 Final PhoneInfoga result:', result);
        return result;
    } catch (error) {
        console.log('❌ PhoneInfoga parsing error:', error.message);
        return null;
    }
}

async function scrapePhoneNumberApiHtml(phone) {
    try {
        const normalized = phone.replace(/[\s\-\(\)]/g, '');
        // Attempt 0: unofficial public JSON endpoint exposed on site
        try {
            const jsonCandidates = [
                `https://demo.phone-number-api.com/json/?number=${encodeURIComponent(normalized)}`,
                `https://phone-number-api.com/json/?number=${encodeURIComponent(normalized)}`
            ];
            for (const ju of jsonCandidates) {
                try {
                    const jr = await axios.get(ju, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                    if (jr.status === 200 && typeof jr.data === 'object' && jr.data) {
                        const d = jr.data;
                        const carrier = d.carrier || null;
                        const country = d.country || d.countryName || null;
                        const validity = typeof d.numberValid === 'boolean' ? d.numberValid : (d.status || null);
                        const type = d.numberType || null;
                        const metadata = {
                            continent: d.continent,
                            continentCode: d.continentCode,
                            region: d.region,
                            regionName: d.regionName,
                            city: d.city,
                            zip: d.zip,
                            timezone: d.timezone,
                            offset: d.offset,
                            currency: d.currency,
                            formatE164: d.formatE164,
                            formatNational: d.formatNational,
                            formatInternational: d.formatInternational
                        };
                        return { phoneApi: { carrier, country, validity, type, metadata } };
                    }
                } catch {}
            }
        } catch {}
        const urlCandidates = [
            `https://phone-number-api.com/${encodeURIComponent(normalized)}`,
            `https://phone-number-api.com/number/${encodeURIComponent(normalized)}`,
            `https://phone-number-api.com/search?q=${encodeURIComponent(normalized)}`,
            `https://phone-number-api.com/lookup/${encodeURIComponent(normalized)}`,
            `https://phone-number-api.com/en/number/${encodeURIComponent(normalized)}`,
            `https://phone-number-api.com/validate?number=${encodeURIComponent(normalized)}`
        ];
        let html = '';
        for (const u of urlCandidates) {
            try {
                const resp = await axios.get(u, {
                    timeout: 12000,
                    maxRedirects: 3,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Referer': 'https://phone-number-api.com/'
                    }
                });
                if (resp.status === 200 && typeof resp.data === 'string' && resp.data.length > 200) {
                    html = resp.data;
                    break;
                }
            } catch {}
        }
        if (!html) return null;
        const $ = cheerio.load(html);

        // Try to parse JSON blob often present in a <pre> element
        try {
            const preText = $('pre').first().text().trim();
            if (preText && preText.includes('{')) {
                let jsonText = preText;
                // If preText contains extra leading/trailing chars, try to isolate first JSON object
                const m = preText.match(/\{[\s\S]*\}/);
                if (m) jsonText = m[0];
                const d = JSON.parse(jsonText);
                const carrier = d.carrier || null;
                const country = d.country || d.countryName || null;
                const validity = typeof d.numberValid === 'boolean' ? d.numberValid : (d.status || null);
                const type = d.numberType || null;
                const metadata = {
                    continent: d.continent,
                    continentCode: d.continentCode,
                    region: d.region,
                    regionName: d.regionName,
                    city: d.city,
                    zip: d.zip,
                    timezone: d.timezone,
                    offset: d.offset,
                    currency: d.currency,
                    formatE164: d.formatE164,
                    formatNational: d.formatNational,
                    formatInternational: d.formatInternational
                };
                return { phoneApi: { carrier, country, validity, type, metadata } };
            }
        } catch {}

        // Parse tables and definition lists
        const labelToValue = {};
        $('table tr').each((_, tr) => {
            const tds = $(tr).find('th,td');
            if (tds.length >= 2) {
                const k = $(tds[0]).text().trim();
                const v = $(tds[1]).text().trim();
                if (k && v) labelToValue[k.toLowerCase()] = v;
            }
        });
        $('dl').each((_, dl) => {
            const terms = $(dl).find('dt');
            terms.each((i, dt) => {
                const k = $(dt).text().trim();
                const v = $(dt).next('dd').text().trim();
                if (k && v) labelToValue[k.toLowerCase()] = v;
            });
        });

        const text = $('body').text().replace(/\s+/g, ' ').trim();
        const tryExtract = (labels) => {
            const re = new RegExp(`(?:${labels})\\s*[:|-]\\s*([^|\\n<]+)`, 'i');
            const m = text.match(re);
            return m ? m[1].trim() : null;
        };

        const carrier = labelToValue['carrier'] || labelToValue['network'] || labelToValue['provider'] || tryExtract('Carrier|Network|Provider');
        const country = labelToValue['country'] || labelToValue['region'] || tryExtract('Country|Region');
        const validity = labelToValue['valid'] || labelToValue['validity'] || labelToValue['status'] || tryExtract('Valid|Validity|Status');
        const type = labelToValue['type'] || labelToValue['line type'] || labelToValue['linetype'] || tryExtract('Type|Line Type');

        const metadata = { ...labelToValue };
        text.split(/;|\|/).map(s => s.trim()).filter(Boolean).forEach(s => {
            const m = s.match(/([A-Za-z][A-Za-z0-9 _-]{2,})\s*[:|-]\s*(.+)/);
            if (m) {
                const key = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '_');
                if (!metadata[key]) metadata[key] = m[2].trim();
            }
        });

        return { phoneApi: { carrier, country, validity, type, metadata } };
    } catch {
        return null;
    }
}

function mergeAggregatedResults(context, parts) {
    const aggregated = {
        query: context.query,
        type: context.qtype,
        basic: {},
        socialProfiles: [],
        leaks: [],
        carrier: null,
        country: null,
        metadata: {}
    };

    const socialUrlToSources = new Map();
    const leaksToSources = new Map();

    for (const p of parts) {
        if (!p) continue;
        if (p.basic) aggregated.basic = { ...aggregated.basic, ...p.basic };
        if (Array.isArray(p.socialProfiles)) {
            const src = p.__source || 'unknown';
            p.socialProfiles.forEach(url => {
                const key = String(url).trim();
                if (!key) return;
                const arr = socialUrlToSources.get(key) || [];
                if (!arr.includes(src)) arr.push(src);
                socialUrlToSources.set(key, arr);
            });
        }
        if (Array.isArray(p.leaks)) {
            const src = p.__source || 'unknown';
            p.leaks.forEach(leak => {
                const key = JSON.stringify(leak);
                const arr = leaksToSources.get(key) || [];
                if (!arr.includes(src)) arr.push(src);
                leaksToSources.set(key, arr);
            });
        }
        if (p.phoneApi) {
            aggregated.carrier = p.phoneApi.carrier || aggregated.carrier;
            aggregated.country = p.phoneApi.country || aggregated.country;
            aggregated.metadata = { ...aggregated.metadata, ...p.phoneApi.metadata };
            if (p.phoneApi.validity != null) aggregated.basic.valid = p.phoneApi.validity;
            if (p.phoneApi.type != null) aggregated.basic.type = p.phoneApi.type;
        }
        if (p.carrier && !aggregated.carrier) aggregated.carrier = p.carrier;
        if (p.metadata) aggregated.metadata = { ...aggregated.metadata, ...p.metadata };
    }

    // Build socialProfiles with confidence
    aggregated.socialProfiles = Array.from(socialUrlToSources.entries()).map(([url, sources]) => ({
        url,
        sources,
        confidence: sources.length >= 2 ? 'high' : 'medium'
    }));

    // Build leaks with confidence
    aggregated.leaks = Array.from(leaksToSources.entries()).map(([key, sources]) => {
        const item = JSON.parse(key);
        return { ...item, sources, confidence: sources.length >= 2 ? 'high' : 'medium' };
    });

    return aggregated;
}
// Removed simulated phone data source

async function getPhoneApiData(phone) {
    try {
        const response = await axios.get(`https://api.phone-number-api.com/phone/${phone}`, {
            headers: {
                'Authorization': `Bearer ${process.env.PHONE_API_KEY || 'demo'}`,
                'User-Agent': 'OSINT-Lookup-Engine/1.0'
            }
        });
        
        return {
            name: response.data.name,
            email: response.data.email,
            carrier: response.data.carrier,
            city: response.data.city,
            type: response.data.type
        };
    } catch (error) {
        throw new Error('Phone API unavailable');
    }
}

// Daily cleanup disabled per user request
// cron.schedule('0 0 * * *', async () => {});

// Test endpoint for tool availability
app.get('/api/test-tools', async (req, res) => {
    const tools = ['sherlock', 'holehe', 'maigret', 'ghunt'];
    const results = {};
    
    for (const tool of tools) {
        try {
            const resolved = await resolveToolCommand(tool);
            results[tool] = {
                available: !!resolved.command,
                command: resolved.command,
                viaPython: resolved.viaPython,
                platform: process.platform
            };
            
            // Test actual execution on Linux/Render
            if (resolved.command && resolved.viaPython) {
                try {
                    await execFileAsync(resolved.command, ['-m', resolved.viaPython, '--help'], { 
                        timeout: 10000, 
                        maxBuffer: 1024 * 1024,
                        env: { ...process.env, PYTHONUNBUFFERED: '1', NO_COLOR: '1' }
                    });
                    results[tool].executionTest = 'passed';
                } catch (execError) {
                    results[tool].executionTest = 'failed';
                    results[tool].executionError = execError.message;
                }
            }
        } catch (error) {
            results[tool] = {
                available: false,
                error: error.message,
                platform: process.platform
            };
        }
    }
    
    res.json({
        platform: process.platform,
        pythonPath: process.env.PYTHON_PATH,
        environment: process.env.NODE_ENV,
        databaseType: 'postgresql',
        results
    });
});

app.listen(PORT, () => {
    console.log(`🚀 OSINT Lookup Engine running on port ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database Type: PostgreSQL`);
    console.log(`🐍 Python Path: ${process.env.PYTHON_PATH || 'python3'}`);
    console.log(`📁 Working Directory: ${process.cwd()}`);
    console.log(`🔧 Node Version: ${process.version}`);
    console.log(`🔍 Environment Variables Debug:`);
    console.log(`   - DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
    console.log(`   - PYTHON_PATH: ${process.env.PYTHON_PATH}`);
    console.log(`   - PATH: ${process.env.PATH?.substring(0, 100)}...`);
    console.log(`📦 Available Tools Test: Visit /api/test-tools to verify OSINT tools`);
    
    // Test tool availability at startup (import check only)
    console.log(`🔍 Testing tool availability at startup (import)...`);
    const tools = ['sherlock', 'holehe', 'maigret', 'ghunt'];
    tools.forEach(async (tool) => {
        try {
            const resolved = await resolveToolCommand(tool);
            console.log(`   - ${tool}: ${resolved.command} ${resolved.viaPython || ''}`);
            if (resolved.command && resolved.viaPython) {
                execFileAsync(resolved.command, ['-c', `import ${resolved.viaPython}; print('ok')`], {
                    timeout: 8000,
                    maxBuffer: 1024 * 256,
                    env: { ...process.env, PYTHONUNBUFFERED: '1', NO_COLOR: '1' }
                }).then(() => {
                    console.log(`   ✅ ${tool}: Import test passed`);
                }).catch(() => {
                    console.log(`   ❌ ${tool}: Import test failed`);
                });
            }
        } catch {
            console.log(`   - ${tool}: ❌ Error resolving command`);
        }
    });
});

// Tools health check endpoint
app.get('/api/tools-health', async (req, res) => {
    try {
        const toolsHealth = {
            status: 'checking',
            timestamp: new Date().toISOString(),
            tools: {}
        };

        // Check Python tools availability
        const tools = ['sherlock', 'holehe', 'maigret', 'ghunt'];
        
        for (const tool of tools) {
            try {
                const result = await runToolIfAvailable(tool, ['--help'], (output) => output);
                toolsHealth.tools[tool] = {
                    available: true,
                    working: result && result.length > 0,
                    output: result ? result.substring(0, 100) + '...' : 'No output'
                };
            } catch (error) {
                toolsHealth.tools[tool] = {
                    available: false,
                    working: false,
                    error: error.message
                };
            }
        }

        // Check PhoneInfoga
        try {
            const phoneInfogaResult = await runToolIfAvailable('phoneinfoga', ['--help'], (output) => output);
            toolsHealth.tools.phoneinfoga = {
                available: true,
                working: phoneInfogaResult && phoneInfogaResult.length > 0,
                output: phoneInfogaResult ? phoneInfogaResult.substring(0, 100) + '...' : 'No output'
            };
        } catch (error) {
            toolsHealth.tools.phoneinfoga = {
                available: false,
                working: false,
                error: error.message
            };
        }

        // Overall status
        const availableTools = Object.values(toolsHealth.tools).filter(t => t.available).length;
        const totalTools = Object.keys(toolsHealth.tools).length;
        
        if (availableTools === totalTools) {
            toolsHealth.status = 'healthy';
        } else if (availableTools > 0) {
            toolsHealth.status = 'degraded';
        } else {
            toolsHealth.status = 'unhealthy';
        }

        toolsHealth.summary = {
            available: availableTools,
            total: totalTools,
            percentage: Math.round((availableTools / totalTools) * 100)
        };

        res.json(toolsHealth);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Database health check endpoint
app.get('/api/db-health', async (req, res) => {
    try {
        const health = {
            status: 'unknown',
            type: 'postgresql',
            connected: dbManager.isConnected,
            timestamp: new Date().toISOString()
        };

        if (dbManager.isConnected && dbManager.db) {
            try {
                    const client = await dbManager.db.connect();
                    const result = await client.query('SELECT NOW() as time, version() as version');
                    client.release();
                    health.status = 'healthy';
                    health.details = {
                        time: result.rows[0].time,
                        version: result.rows[0].version.substring(0, 50)
                    };
            } catch (error) {
                health.status = 'unhealthy';
                health.error = error.message;
            }
        } else {
            health.status = 'disconnected';
        }

        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Search history endpoint

// Database connection is already initialized above

// GHunt direct credentials (v2.3.3) - provided by user
const GHUNT_TOKEN_DIRECT = "oauth2_4/0AVMBsJihaCHpsqoEm3L-M7XKc_3kEWEVvqBP4Jzm14hCBOsHKqcI9mm-y0GA0iVO_6jtLw";
const GHUNT_COOKIES_B64_DIRECT = "eyJjb29raWVzIjp7IlNJRCI6ImcuYTAwMDB3anlHMXVCT0FKQWQtUGVIWlUwVFo4RkZGeFdZenZzRnphYTBON1NEZElRcHZGTjZsYlIyY010Z0VUTlpLXy1HSGpOTHdBQ2dZS0FYb1NBUkFTRlFIR1gyTWlkemlvN0gxU2pEazBpcm4tUEN3MzN4b1ZBVUY4eUtvbXZncmZKSWh0bVJRYTBwTlVjd3YyMDA3NiIsIl9fU2VjdXJlLTNQU0lEIjoiZy5hMDAwMHdqeUcxdUJPQUpBZC1QZUhaVTBUWjhGRkZ4V1l6dnNGemFhME43U0RkSVFwdkZOMTNYX2cxRDB3SXVSTi1lT3pRTnpjQUFDZ1lLQWNFU0FSQVNGUUhHWDJNaUdTY0lpMktxa3A1WVgzRVZBUU40TVJvVkFVRjh5S3BSWGxxY3huQlE2aGNQTmtCVjZFRngwMDc2IiwiTFNJRCI6Im8ubXlhY2NvdW50Lmdvb2dsZS5jb218cy5JTnxzLnlvdXR1YmU6Zy5hMDAwMHdqeUc2dmJ1LTRyWUJHSTZ1aE5hU1ZsekVIZjN4OGJHV2tTdmYwNWxtS2J5eEFSRGpCbVJlSmd2TUkybDlaQmVZdjAyd0FDZ1lLQWQwU0FSQVNGUUhHWDJNaUdTbU1yQ1dtMUhCcU5hVnVhQ3A5S1JvVkFVRjh5S3F5R0MxdHJDUmp3R204clFGcTJHTnYwMDc2IiwiSFNJRCI6IkFkYlQ4aXZxVzMwbjBMQkpwIiwiU1NJRCI6IkE0TkNnYkEzTVNYQWhCVV8tIiwiQVBJU0lEIjoiMU9oOEc1Rm5XV1FCY3ZrdC9BODBGVmVBbjltdUU5aUlZWCIsIlNBUElTSUQiOiItTExlWnNFNmJGTlFMY042L0FCMG1rTF9xNTJqQ0ZwTWUxIn0sIm9hdXRoX3Rva2VuIjoib2F1dGgyXzQvMEFWTUJzSmloYUNIcHNxb0VtM0wtTTdYS2NfM2tFV0VWdnFCUDRKem0xNGhDQk9zSEtxY0k5bW0teTBHQTBpVk9fNmp0THcifQ==";

function initializeGhuntDirect() {
    try {
        const homeDir = process.env.HOME || os.homedir() || process.cwd();
        const cfgDir = path.join(homeDir, '.config', 'ghunt');
        try { fs.mkdirSync(cfgDir, { recursive: true }); } catch {}

        // Prefer environment variables; fallback to the provided static values
        const token = (process.env.GHUNT_TOKEN || process.env.GHUNT_OAUTH_TOKEN || "oauth2_4/0AVMBsJihaCHpsqoEm3L-M7XKc_3kEWEVvqBP4Jzm14hCBOsHKqcI9mm-y0GA0iVO_6jtLw").trim();
        const cookiesB64 = (process.env.GHUNT_COOKIES_B64 || "eyJjb29raWVzIjp7IlNJRCI6ImcuYTAwMDB3anlHMXVCT0FKQWQtUGVIWlUwVFo4RkZGeFdZenZzRnphYTBON1NEZElRcHZGTjZsYlIyY010Z0VUTlpLXy1HSGpOTHdBQ2dZS0FYb1NBUkFTRlFIR1gyTWlkemlvN0gxU2pEazBpcm4tUEN3MzN4b1ZBVUY4eUtvbXZncmZKSWh0bVJRYTBwTlVjd3YyMDA3NiIsIl9fU2VjdXJlLTNQU0lEIjoiZy5hMDAwMHdqeUcxdUJPQUpBZC1QZUhaVTBUWjhGRkZ4V1l6dnNGemFhME43U0RkSVFwdkZOMTNYX2cxRDB3SXVSTi1lT3pRTnpjQUFDZ1lLQWNFU0FSQVNGUUhHWDJNaUdTY0lpMktxa3A1WVgzRVZBUU40TVJvVkFVRjh5S3BSWGxxY3huQlE2aGNQTmtCVjZFRngwMDc2IiwiTFNJRCI6Im8ubXlhY2NvdW50Lmdvb2dsZS5jb218cy5JTnxzLnlvdXR1YmU6Zy5hMDAwMHdqeUc2dmJ1LTRyWUJHSTZ1aE5hU1ZsekVIZjN4OGJHV2tTdmYwNWxtS2J5eEFSRGpCbVJlSmd2TUkybDlaQmVZdjAyd0FDZ1lLQWQwU0FSQVNGUUhHWDJNaUdTbU1yQ1dtMUhCcU5hVnVhQ3A5S1JvVkFVRjh5S3F5R0MxdHJDUmp3R204clFGcTJHTnYwMDc2IiwiSFNJRCI6IkFkYlQ4aXZxVzMwbjBMQkpwIiwiU1NJRCI6IkE0TkNnYkEzTVNYQWhCVV8tIiwiQVBJU0lEIjoiMU9oOEc1Rm5XV1FCY3ZrdC9BODBGVmVBbjltdUU5aUlZWCIsIlNBUElTSUQiOiItTExlWnNFNmJGTlFMY042L0FCMG1rTF9xNTJqQ0ZwTWUxIn0sIm9hdXRoX3Rva2VuIjoib2F1dGgyXzQvMEFWTUJzSmloYUNIcHNxb0VtM0wtTTdYS2NfM2tFV0VWdnFCUDRKem0xNGhDQk9zSEtxY0k5bW0teTBHQTBpVk9fNmp0THcifQ==").trim();

        let ok = true;

        // Write tokens.json with o_auth_token
        if (token) {
            const tokens = { o_auth_token: token };
            try {
                fs.writeFileSync(path.join(cfgDir, 'tokens.json'), JSON.stringify(tokens, null, 2), { encoding: 'utf8', mode: 0o600 });
            } catch (e) {
                ok = false;
                console.log('❌ Failed to write GHunt tokens.json:', e.message);
            }
        } else {
            ok = false;
            console.log('❌ GHunt token missing');webkitURL
        }

        // Decode cookies and write cookies.json
        if (cookiesB64) {
            try {
                const decoded = Buffer.from(cookiesB64, 'base64').toString('utf8');
                JSON.parse(decoded); // validate
                fs.writeFileSync(path.join(cfgDir, 'cookies.json'), decoded, { encoding: 'utf8', mode: 0o600 });
            } catch (e) {
                ok = false;
                console.log('❌ Failed to write GHunt cookies.json:', e.message);
            }
        } else {
            ok = false;
            console.log('❌ GHunt cookies (base64) missing');
        }

        if (ok) {
            process.env.GHUNT_CONFIG = cfgDir;
            console.log('✅ GHunt initialized successfully with provided token & cookies');
        }
    } catch (e) {
        console.log('❌ GHunt direct initialization error:', e.message);
    }
}

// Utility: cleanup previously generated image files in the project (non-recursive critical dirs)
function cleanupGeneratedImages() {
    try {
        const imageGlobs = [/\.png$/i, /\.jpg$/i, /\.jpeg$/i, /\.gif$/i, /\.webp$/i];
        const dirs = [process.cwd(), path.join(process.cwd(), 'public'), path.join(process.cwd(), 'temp')];
        let removed = 0;
        for (const dir of dirs) {
            try {
                if (!fs.existsSync(dir)) continue;
                const entries = fs.readdirSync(dir);
                entries.forEach((f) => {
                    if (imageGlobs.some((re) => re.test(f))) {
                        const fp = path.join(dir, f);
                        try { fs.unlinkSync(fp); removed++; } catch {}
                    }
                });
            } catch {}
        }
        if (removed > 0) console.log(`🧹 Removed ${removed} generated image files`);
    } catch (e) {
        console.log('⚠️ Image cleanup error:', e.message);
    }
}

// GHunt helpers: status check and conditional Docker login
async function ghuntIsAuthenticated() {
    try {
        const py = await ensurePythonReady();
        if (!py) return false;
        const { stdout } = await execFileAsync(py, ['-m', 'ghunt', 'login', 'status'], { timeout: 15000, maxBuffer: 1024 * 1024 });
        const out = (stdout || '').toLowerCase();
        return /auth/i.test(out) || /logged/i.test(out) || /already/i.test(out) || /token/i.test(out);
    } catch {
        // Try direct CLI if available
        try {
            const { stdout } = await execFileAsync('ghunt', ['login', 'status'], { timeout: 15000, maxBuffer: 1024 * 1024 });
            const out = (stdout || '').toLowerCase();
            return /auth/i.test(out) || /logged/i.test(out) || /already/i.test(out) || /token/i.test(out);
        } catch {}
        return false;
    }
}

async function ghuntNativeLoginIfNeeded() {
    const authed = await ghuntIsAuthenticated();
    if (authed) {
        console.log('🔐 GHunt token already authenticated');
        return true;
    }
    console.log('🔐 GHunt not authenticated, attempting native Python login');
    
    try {
        const py = await ensurePythonReady();
        if (!py) {
            console.log('❌ Python not available for GHunt login');
            return false;
        }
        
        // Try to run ghunt login with Python module
        await execFileAsync(py, ['-m', 'ghunt', 'login'], { 
            timeout: 300000, 
            maxBuffer: 1024 * 1024 * 20,
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });
        console.log('✅ GHunt native login completed');
        // Re-check
        return await ghuntIsAuthenticated();
    } catch (e) {
        console.log('❌ GHunt native login failed:', e.message);
        return false;
    }
}

async function runGhuntEmailSmart(targetEmail) {
    try {
        let authed = await ghuntIsAuthenticated();
        if (!authed) authed = await ghuntNativeLoginIfNeeded();
        const py = await ensurePythonReady();
        if (!py) throw new Error('Python not available');
        const { stdout } = await execFileAsync(py, ['-m', 'ghunt', 'email', targetEmail], { timeout: 180000, maxBuffer: 1024 * 1024 * 20 });
        return stdout || '';
    } catch (e) {
        console.log('❌ GHunt smart run failed:', e.message);
        return '';
    }
}
