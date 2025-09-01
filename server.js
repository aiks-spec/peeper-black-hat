require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const DatabaseManager = require('./database');
const path = require('path');
const cron = require('node-cron');
const cheerio = require('cheerio');
const { exec, execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// File cleanup system for publishing
const cleanupQueue = new Map(); // Track files to cleanup

// Ensure temp directory exists for Render.com
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`📁 Created temp directory: ${tempDir}`);
}

function scheduleFileCleanup(filePath, delayMs = 30 * 60 * 1000) { // 30 minutes default
    if (cleanupQueue.has(filePath)) {
        clearTimeout(cleanupQueue.get(filePath));
        cleanupQueue.delete(filePath);
        fs.unlinkSync(filePath); // Remove existing file immediately
    }
    
    const timeoutId = setTimeout(() => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Cleaned up file: ${filePath}`);
            }
        } catch (error) {
            console.log(`❌ Error cleaning up file ${filePath}:`, error.message);
        } finally {
            cleanupQueue.delete(filePath);
        }
    }, delayMs);
    
    cleanupQueue.set(filePath, timeoutId);
    console.log(`⏰ Scheduled cleanup for ${filePath} in ${delayMs/1000/60} minutes`);
}

// Cleanup all temporary files and database connections on server shutdown
process.on('SIGINT', async () => {
    console.log('\n🧹 Cleaning up temporary files and database connections...');
    cleanupQueue.forEach((timeoutId, filePath) => {
        clearTimeout(timeoutId);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Cleaned up: ${filePath}`);
            }
        } catch (error) {
            console.log(`❌ Error cleaning up ${filePath}:`, error.message);
        }
    });
    
    // Clean up temp directory
    try {
        if (fs.existsSync(tempDir)) {
            const tempFiles = fs.readdirSync(tempDir);
            for (const file of tempFiles) {
                const filePath = path.join(tempDir, file);
                fs.unlinkSync(filePath);
                console.log(`🗑️ Cleaned up temp file: ${filePath}`);
            }
            fs.rmdirSync(tempDir);
            console.log(`🗑️ Cleaned up temp directory: ${tempDir}`);
        }
    } catch (error) {
        console.log(`❌ Error cleaning up temp directory:`, error.message);
    }
    
    // Close database connection
    await dbManager.cleanup();
    process.exit(0);
});

// Cross-platform PATH handling for Render.com deployment
try {
    if (process.platform === 'win32') {
        // Windows: try common Python locations
        const userProfile = process.env.USERPROFILE || '';
        const localApp = process.env.LOCALAPPDATA || '';
        const candidates = [
            path.join(userProfile, 'AppData', 'Local', 'Programs', 'Python'),
            path.join(localApp, 'Programs', 'Python')
        ];
        const scriptPaths = [];
        candidates.forEach((base) => {
            try {
                if (fs.existsSync(base)) {
                    const entries = fs.readdirSync(base);
                    entries.forEach((dir) => {
                        const sp = path.join(base, dir, 'Scripts');
                        if (fs.existsSync(sp)) scriptPaths.push(sp);
                    });
                }
            } catch {}
        });
        if (scriptPaths.length) {
            process.env.PATH = `${scriptPaths.join(';')};${process.env.PATH}`;
        }
    } else {
        // Linux/Mac/Render.com: use standard PATH and common locations
        console.log('🌐 Running on Linux/Mac/Render.com platform');
        
        // Add common Python paths for Linux/Render.com
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
        const pathSeparator = process.platform === 'win32' ? ';' : ':';
        const newPaths = linuxPaths.filter(p => fs.existsSync(p));
        
        if (newPaths.length > 0) {
            process.env.PATH = `${newPaths.join(pathSeparator)}${pathSeparator}${existingPath}`;
            console.log('✅ Added Linux Python paths to PATH');
        }
        
        // Set environment variables for Python tools
        process.env.PYTHONUNBUFFERED = '1';
        process.env.PYTHONIOENCODING = 'utf-8';
    }
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

// Auto-cleanup expired files every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    try {
        console.log('🧹 Running auto-cleanup for expired files...');
        const deletedFiles = await dbManager.cleanupExpiredFiles();
        if (deletedFiles.length > 0) {
            console.log(`🗑️ Cleaned up ${deletedFiles.length} expired files:`, deletedFiles);
        }
    } catch (error) {
        console.error('❌ Auto-cleanup failed:', error.message);
    }
});

// Initialize database connection
dbManager.connect().then(async (connected) => {
    if (connected) {
        console.log('✅ Database connection established');
        
        // Reset counts for production deployment (uncomment when deploying)
        if (process.env.NODE_ENV === 'production' && process.env.RESET_COUNTS === 'true') {
            try {
                console.log('🔄 Resetting counts for production deployment...');
                await dbManager.resetCounts();
                console.log('✅ Counts reset successfully');
            } catch (error) {
                console.error('❌ Failed to reset counts:', error.message);
            }
        }
    } else {
        console.log('❌ Database connection failed, using fallback');
    }
}).catch((error) => {
    console.error('❌ Database initialization error:', error.message);
});

// Visitor tracking middleware - FIXED FOR RENDER.COM
app.use((req, res, next) => {
    // Get real IP address (Render.com uses proxy headers)
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               '127.0.0.1';
    
    const userAgent = req.get('User-Agent') || 'Unknown';
    
    // Only track unique visitors (not every request)
    if (req.path === '/' || req.path.includes('/api/')) {
        dbManager.insertVisitor(ip, userAgent).then((success) => {
            if (success) {
                console.log('✅ Visitor tracked:', ip);
            } else {
                console.log('❌ Visitor tracking failed');
            }
        });
    }
    
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
        dbManager.insertSearch(phone, 'lookup', result);

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
    dbManager.insertSearch(trimmed, qtype, null);

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
                                                   // For aggregate endpoint, use proper Docker GHunt implementation
             const outputFile = path.join(tempDir, `ghunt_aggregate_${Date.now()}.json`);
             
             console.log('🔍 Using Docker GHunt for aggregate');
             
             // Use Docker with proper volume mounting and environment (Windows path fix)
             const currentDir = process.cwd().replace(/\\/g, '/');
             const dockerArgs = [
                 'run', '--rm',
                 '-v', `${currentDir}:/workspace`,
                 '-w', '/workspace',
                 'mxrch/ghunt:latest',
                 'ghunt', 'email', trimmed, '--json', outputFile
             ];
             
             tasks.push((async () => {
                                  try {
                     const { spawn } = require('child_process');
                     const ghunt = spawn('docker', dockerArgs, { 
                         stdio: ['pipe', 'pipe', 'pipe'],
                         shell: true,
                         env: {
                             ...process.env,
                             PYTHONUNBUFFERED: '1',
                             PYTHONIOENCODING: 'utf-8'
                         }
                     });
                     
                     let stdoutData = '';
                     let stderrData = '';
                     
                     ghunt.stdout.on('data', (data) => {
                         stdoutData += data.toString();
                     });
                     
                     ghunt.stderr.on('data', (data) => {
                         stderrData += data.toString();
                     });
                     
                     await new Promise((resolve, reject) => {
                         ghunt.on('close', (code) => {
                             console.log('🔍 GHunt aggregate Docker process exited with code:', code);
                             resolve();
                         });
                         ghunt.on('error', (error) => {
                             console.log('❌ GHunt aggregate Docker process error:', error.message);
                             reject(error);
                         });
                     });
                     
                     console.log('🔍 GHunt aggregate stdout length:', stdoutData.length);
                     console.log('🔍 GHunt aggregate stderr length:', stderrData.length);
                     
                     // Wait a bit for file to be written
                     await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Try to read the output file
                    if (fs.existsSync(outputFile)) {
                        console.log('✅ GHunt aggregate output file found:', outputFile);
                        const fileContent = fs.readFileSync(outputFile, 'utf8');
                        
                        try {
                            const ghuntData = JSON.parse(fileContent);
                            console.log('✅ GHunt aggregate JSON parsed successfully');
                            
                            const ghuntResult = parseGHuntSimple(ghuntData);
                            console.log('🔍 GHunt aggregate extracted data:', ghuntResult);
                            
                            // Schedule file cleanup instead of immediate deletion
                            scheduleFileCleanup(outputFile);
                            
                            return ghuntResult;
                        } catch (parseError) {
                            console.log('❌ GHunt aggregate JSON parsing failed:', parseError.message);
                            // Schedule file cleanup instead of immediate deletion
                            if (fs.existsSync(outputFile)) {
                                scheduleFileCleanup(outputFile);
                            }
                            return null;
                        }
                    } else {
                        console.log('❌ GHunt aggregate output file not found');
                        return null;
                    }
                } catch (error) {
                    console.log('❌ GHunt aggregate failed:', error.message);
                    return null;
                }
            })());
        }
        if (qtype === 'username') {
            tasks.push(runToolIfAvailable('sherlock', [trimmed, '--print-found', '--no-color'], parseSherlock));
                         tasks.push(runToolIfAvailable('maigret', [trimmed, '--no-color'], parseMaigretSimple));
        }

        const results = await Promise.all(tasks.map(p => p.catch(() => null)));

        const aggregated = mergeAggregatedResults({ qtype, query: trimmed }, results.filter(Boolean));

        return res.json({ success: true, data: aggregated });
    } catch (err) {
        console.error('Aggregate error:', err.message);
        return res.status(500).json({ success: false, error: 'Aggregation failed', details: err.message });
    }
});

// Email lookup endpoint (CUFinder + GHunt + Holehe + Sherlock + Maigret)
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
        const searchId = await dbManager.insertSearch(email, 'email', null);
        
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
        
                                   // 2. GHunt (Google account OSINT) - PROPER DOCKER IMPLEMENTATION
         try {
             console.log('🔍 Running GHunt with Docker...');
             
             const outputFile = path.join(tempDir, `ghunt_${Date.now()}.json`);
             let ghuntResult = null;
             
             // Method 1: Try Docker GHunt (proper implementation)
             try {
                 console.log('🔍 Attempting GHunt with Docker...');
                 
                 // Use Docker with proper volume mounting and environment (Windows path fix)
                 const currentDir = process.cwd().replace(/\\/g, '/');
                 const dockerArgs = [
                     'run', '--rm',
                     '-v', `${currentDir}:/workspace`,
                     '-w', '/workspace',
                     'mxrch/ghunt:latest',
                     'ghunt', 'email', email, '--json', outputFile
                 ];
                 
                 console.log('🔍 Docker GHunt command:', `docker ${dockerArgs.join(' ')}`);
                 
                 const { stdout, stderr } = await new Promise((resolve, reject) => {
                     const { spawn } = require('child_process');
                     const ghunt = spawn('docker', dockerArgs, { 
                         stdio: ['pipe', 'pipe', 'pipe'],
                         shell: true,
                         env: {
                             ...process.env,
                             PYTHONUNBUFFERED: '1',
                             PYTHONIOENCODING: 'utf-8'
                         }
                     });
                     
                     let stdoutData = '';
                     let stderrData = '';
                     
                     ghunt.stdout.on('data', (data) => {
                         stdoutData += data.toString();
                     });
                     
                     ghunt.stderr.on('data', (data) => {
                         stderrData += data.toString();
                     });
                     
                     ghunt.on('close', (code) => {
                         console.log('🔍 GHunt Docker process exited with code:', code);
                         resolve({ stdout: stdoutData, stderr: stderrData, code });
                     });
                     
                     ghunt.on('error', (error) => {
                         console.log('❌ GHunt Docker process error:', error.message);
                         reject(error);
                     });
                 });
                 
                 console.log('🔍 GHunt Docker stdout length:', stdout.length);
                 console.log('🔍 GHunt Docker stderr length:', stderr.length);
                 
                 if (stderr) {
                     console.log('🔍 GHunt Docker stderr preview:', stderr.substring(0, 500));
                 }
                 
                 // Wait a bit for file to be written
                 await new Promise(resolve => setTimeout(resolve, 5000));
                 
                 // Try to read the output file
                 if (fs.existsSync(outputFile)) {
                     console.log('✅ GHunt Docker output file found:', outputFile);
                     const fileContent = fs.readFileSync(outputFile, 'utf8');
                     console.log('🔍 GHunt file content length:', fileContent.length);
                     
                     try {
                         const ghuntData = JSON.parse(fileContent);
                         console.log('✅ GHunt Docker JSON parsed successfully');
                         ghuntResult = parseGHuntSimple(ghuntData);
                         console.log('🔍 GHunt Docker extracted data:', ghuntResult);
                         
                         // Schedule file cleanup instead of immediate deletion
                         scheduleFileCleanup(outputFile);
                     } catch (parseError) {
                         console.log('❌ GHunt Docker JSON parsing failed:', parseError.message);
                         console.log('🔍 File content preview:', fileContent.substring(0, 1000));
                         if (fs.existsSync(outputFile)) {
                             scheduleFileCleanup(outputFile);
                         }
                     }
                 } else {
                     console.log('❌ GHunt Docker output file not found');
                     console.log('🔍 Current directory files:', fs.readdirSync('.').filter(f => f.includes('ghunt')));
                 }
                 
             } catch (dockerError) {
                 console.log('❌ GHunt Docker failed:', dockerError.message);
             }
             
             // Method 2: Try local GHunt if Docker failed
             if (!ghuntResult) {
                 try {
                     console.log('🔍 Attempting GHunt with local installation...');
                     const localArgs = ['email', email, '--json', outputFile];
                     
                     const { stdout, stderr } = await new Promise((resolve, reject) => {
                         const { spawn } = require('child_process');
                         const ghunt = spawn('ghunt', localArgs, { 
                             stdio: ['pipe', 'pipe', 'pipe'],
                             shell: true,
                             env: {
                                 ...process.env,
                                 PYTHONUNBUFFERED: '1',
                                 PYTHONIOENCODING: 'utf-8',
                                 RICH_NO_COLOR: '1',
                                 NO_COLOR: '1'
                             }
                         });
                         
                         let stdoutData = '';
                         let stderrData = '';
                         
                         ghunt.stdout.on('data', (data) => {
                             stdoutData += data.toString();
                         });
                         
                         ghunt.stderr.on('data', (data) => {
                             stderrData += data.toString();
                         });
                         
                         ghunt.on('close', (code) => {
                             console.log('🔍 GHunt local process exited with code:', code);
                             resolve({ stdout: stdoutData, stderr: stderrData, code });
                         });
                         
                         ghunt.on('error', (error) => {
                             console.log('❌ GHunt local process error:', error.message);
                             reject(error);
                         });
                     });
                     
                     console.log('🔍 GHunt local stdout length:', stdout.length);
                     console.log('🔍 GHunt local stderr length:', stderr.length);
                     
                     if (stderr) {
                         console.log('🔍 GHunt local stderr preview:', stderr.substring(0, 500));
                     }
                     
                     // Wait a bit for file to be written
                     await new Promise(resolve => setTimeout(resolve, 5000));
                     
                     // Try to read the output file
                     if (fs.existsSync(outputFile)) {
                         console.log('✅ GHunt local output file found:', outputFile);
                         const fileContent = fs.readFileSync(outputFile, 'utf8');
                         
                         try {
                             const ghuntData = JSON.parse(fileContent);
                             console.log('✅ GHunt local JSON parsed successfully');
                             ghuntResult = parseGHuntSimple(ghuntData);
                             console.log('🔍 GHunt local extracted data:', ghuntResult);
                             
                             // Schedule file cleanup instead of immediate deletion
                             scheduleFileCleanup(outputFile);
                         } catch (parseError) {
                             console.log('❌ GHunt local JSON parsing failed:', parseError.message);
                             if (fs.existsSync(outputFile)) {
                                 scheduleFileCleanup(outputFile);
                             }
                         }
                     } else {
                         console.log('❌ GHunt local output file not found');
                     }
                     
                 } catch (localError) {
                     console.log('❌ GHunt local failed:', localError.message);
                 }
             }
                          
             // Use the result if we got one
             if (ghuntResult && Object.keys(ghuntResult).length > 0) {
                 results.google = ghuntResult;
                 
                 // Extract additional info from GHunt
                 if (ghuntResult.name && !results.basic.name) {
                     results.basic.name = ghuntResult.name;
                 }
                 if (ghuntResult.picture && !results.metadata.picture) {
                     results.metadata.picture = ghuntResult.picture;
                 }
             } else {
                 console.log('❌ GHunt extracted no useful data from both methods');
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
        
                 // 4. Sherlock (username search across social media) + Specific Platform Checks
         try {
             console.log('🔍 Running Sherlock...');
             const username = email.split('@')[0];
             console.log('🔍 Username extracted:', username);
             
             // First run Sherlock for general search
             const sherlockResult = await runToolIfAvailable('sherlock', [username, '--print-found', '--no-color'], (stdout) => {
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
             
             const specificResults = await runToolIfAvailable('sherlock', [username, '--print-found', '--site', specificPlatforms.join(',')], (stdout) => {
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
            const username = email.split('@')[0];
            const maigretResult = await runToolIfAvailable('maigret', [username, '--no-color'], parseMaigretSimple);
            
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

// Phone lookup endpoint (PhoneInfoga + phone-number-api.com + Sherlock + Maigret + Holehe)
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
        const searchId = await dbManager.insertSearch(phone, 'phone', null);
        
        console.log(`🔍 Starting phone lookup for: ${phone}`);
        
        // Collect data from all available sources
        const results = {
            phone: phone,
            basic: {},
            social: [],
            leaks: [],
            metadata: {}
        };
        
        // 1. PhoneInfoga (primary phone OSINT tool) - DOCKER-FIRST APPROACH
        try {
            console.log('📱 Running PhoneInfoga...');
            let infoga = null;
            
            // Method 1: Try Docker PhoneInfoga first (most reliable on Render)
            try {
                console.log('🐳 Attempting PhoneInfoga with Docker...');
                infoga = await runPhoneInfogaDocker(phone);
                if (infoga) {
                    console.log('✅ PhoneInfoga Docker execution successful');
                }
            } catch (dockerError) {
                console.log('❌ PhoneInfoga Docker failed:', dockerError.message);
                
                // Method 2: Try local PhoneInfoga as fallback
                try {
                    console.log('🔍 Attempting PhoneInfoga with local installation...');
                    infoga = await runToolIfAvailable('phoneinfoga', ['scan', '-n', phone, '--no-color'], parsePhoneInfoga);
                    if (infoga) {
                        console.log('✅ PhoneInfoga local execution successful');
                    }
                } catch (localError) {
                    console.log('❌ PhoneInfoga local failed:', localError.message);
                }
            }
            
            // Method 2: Try Docker if local failed
            if (!infoga) {
                try {
                    console.log('🔍 Attempting PhoneInfoga with Docker...');
                    const { spawn } = require('child_process');
                    
                    // Try multiple Docker images for better compatibility
                    const dockerImages = [
                        'sundowndev/phoneinfoga:latest',
                        'ghcr.io/sundowndev/phoneinfoga:latest',
                        'sundowndev/phoneinfoga'
                    ];
                    
                    for (const image of dockerImages) {
                        try {
                            console.log(`🔍 Trying Docker image: ${image}`);
                            
                            const dockerArgs = [
                                'run', '--rm',
                                image,
                                'scan', '-n', phone
                            ];
                            
                            console.log('🔍 Docker PhoneInfoga command:', `docker ${dockerArgs.join(' ')}`);
                            
                            const { stdout, stderr } = await new Promise((resolve, reject) => {
                                const phoneinfoga = spawn('docker', dockerArgs, { 
                                    stdio: ['pipe', 'pipe', 'pipe'],
                                    shell: true,
                                    env: {
                                        ...process.env,
                                        PYTHONUNBUFFERED: '1',
                                        PYTHONIOENCODING: 'utf-8'
                                    }
                                });
                                
                                let stdoutData = '';
                                let stderrData = '';
                                
                                phoneinfoga.stdout.on('data', (data) => {
                                    stdoutData += data.toString();
                                });
                                
                                phoneinfoga.stderr.on('data', (data) => {
                                    stderrData += data.toString();
                                });
                                
                                phoneinfoga.on('close', (code) => {
                                    console.log(`🔍 PhoneInfoga Docker process exited with code: ${code} for image: ${image}`);
                                    resolve({ stdout: stdoutData, stderr: stderrData, code });
                                });
                                
                                phoneinfoga.on('error', (error) => {
                                    console.log(`❌ PhoneInfoga Docker process error for image ${image}:`, error.message);
                                    reject(error);
                                });
                            });
                            
                            console.log(`🔍 PhoneInfoga Docker stdout length: ${stdout.length} for image: ${image}`);
                            console.log(`🔍 PhoneInfoga Docker stderr length: ${stderr.length} for image: ${image}`);
                            
                            if (stdout && stdout.length > 0) {
                                infoga = parsePhoneInfoga(stdout);
                                console.log(`✅ PhoneInfoga Docker data parsed successfully from image: ${image}`);
                                break; // Success, exit the loop
                            } else if (stderr && stderr.includes('docker: error during connect')) {
                                console.log('💡 Docker Desktop is not running. Skipping Docker attempts.');
                                break; // Don't try other images if Docker isn't running
                            } else {
                                console.log(`❌ PhoneInfoga Docker produced no output from image: ${image}`);
                                continue; // Try next image
                            }
                            
                        } catch (imageError) {
                            console.log(`❌ PhoneInfoga Docker failed for image ${image}:`, imageError.message);
                            if (imageError.message.includes('docker: error during connect')) {
                                console.log('💡 Docker Desktop is not running. Skipping remaining Docker attempts.');
                                break; // Don't try other images if Docker isn't running
                            }
                            continue; // Try next image
                        }
                    }
                    
                } catch (dockerError) {
                    console.log('❌ PhoneInfoga Docker failed completely:', dockerError.message);
                }
            }
            
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
        
                 // 3. Sherlock (username search across social media) + Specific Platform Checks
         try {
             console.log('🔍 Running Sherlock...');
             // For phone numbers, try both with and without + symbol
             const username = phone.replace(/[^a-zA-Z0-9+]/g, '');
             
             // First run Sherlock for general search
             const sherlockResult = await runToolIfAvailable('sherlock', [username, '--print-found'], (stdout) => {
                try {
                    // Sherlock outputs found profiles line by line
                    const lines = stdout.split('\n').filter(line => line.trim() && line.includes('http'));
                                         return lines.map(line => {
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
                } catch (e) {
                    return null;
                }
            });
            
                         if (sherlockResult && Array.isArray(sherlockResult)) {
                 console.log('✅ Sherlock data received');
                 results.social = [...new Set([...results.social, ...sherlockResult])];
             }
             
             // Add specific platform checks for popular sites
             console.log('🔍 Running specific platform checks for phone...');
             const specificPlatforms = [
                 'instagram', 'facebook', 'twitter', 'linkedin', 'tinder', 'bumble', 
                 'okcupid', 'hinge', 'pinterest', 'tiktok', 'snapchat', 'reddit',
                 'github', 'youtube', 'twitch', 'discord', 'telegram', 'whatsapp'
             ];
             
             const specificResults = await runToolIfAvailable('sherlock', [username, '--print-found', '--site', specificPlatforms.join(',')], (stdout) => {
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
                 console.log('✅ Specific platform checks completed for phone, found:', specificResults.length);
                 results.social = [...new Set([...results.social, ...specificResults])];
             }
        } catch (error) {
            console.log('❌ Sherlock failed:', error.message);
        }
        
                 // 4. Maigret (extended Sherlock sources)
         try {
             console.log('🔍 Running Maigret...');
             // For phone numbers, try both with and without + symbol
             const username = phone.replace(/[^a-zA-Z0-9+]/g, '');
             const maigretResult = await runToolIfAvailable('maigret', [username, '--no-color'], parseMaigretSimple);
            
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
        } catch (error) {
            console.log('❌ Maigret failed:', error.message);
        }
        
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
        const searchId = await dbManager.insertSearch(ip, 'ip', null);
        
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

// Stats endpoint - FIXED FOR RENDER.COM
app.get('/api/stats', async (req, res) => {
    try {
        const visitorStats = await dbManager.getVisitorStats();
        const searchCount = await dbManager.getSearchCount();
        
        res.json({
            visitors_today: visitorStats.visitors_today,
            total_visitors: visitorStats.total_visitors,
            searches: searchCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.log('❌ Stats error:', error.message);
        res.status(500).json({ error: 'Database error' });
    }
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
        // Windows 'where', *nix 'which'. Prefer 'where' as environment is Windows.
        await execAsync(`where ${cmd} | cat`);
        return true;
    } catch {
        try {
            await execAsync(`which ${cmd} | cat`);
            return true;
        } catch {
            return false;
        }
    }
}

function resolveToolCommand(cmd) {
    // If directly available, return as-is
    return isCommandAvailable(cmd).then((ok) => {
        if (ok) return { command: cmd, viaPython: false };
        
        // Cross-platform tool resolution
        if (process.platform === 'win32') {
            // Windows: try Scripts folders
            const pathParts = (process.env.PATH || '').split(';').filter(Boolean);
            for (const p of pathParts) {
                try {
                    // Try .exe and no extension
                    const exe = path.join(p, `${cmd}.exe`);
                    if (fs.existsSync(exe)) return { command: exe, viaPython: false };
                    const bare = path.join(p, cmd);
                    if (fs.existsSync(bare)) {
                        return { command: 'python', viaPython: bare };
                    }
                } catch {}
            }
        } else {
            // Linux/Mac/Render.com: try common locations
            const pathParts = (process.env.PATH || '').split(':').filter(Boolean);
            for (const p of pathParts) {
                try {
                    const toolPath = path.join(p, cmd);
                    if (fs.existsSync(toolPath)) {
                        return { command: toolPath, viaPython: false };
                    }
                } catch {}
            }
            
            // Try Python module execution for Render.com
            const pythonCommands = ['python3', 'python', 'py'];
            for (const pythonCmd of pythonCommands) {
                try {
                    // Check if python command exists
                    const pythonPath = path.join(p, pythonCmd);
                    if (fs.existsSync(pythonPath) || isCommandAvailable(pythonCmd)) {
                        return { command: pythonCmd, viaPython: `-m ${cmd}` };
                    }
                } catch {}
            }
            
            // Try direct Python module execution with different module names
            if (cmd === 'sherlock') {
                return { command: 'python3', viaPython: '-m sherlock' };
            } else if (cmd === 'holehe') {
                return { command: 'python3', viaPython: '-m holehe' };
            } else if (cmd === 'maigret') {
                return { command: 'python3', viaPython: '-m maigret' };
            } else if (cmd === 'ghunt') {
                return { command: 'python3', viaPython: '-m ghunt' };
            }
            
            // Try alternative module names
            const moduleMap = {
                'sherlock': ['sherlock', 'sherlock-project'],
                'holehe': ['holehe'],
                'maigret': ['maigret'],
                'ghunt': ['ghunt']
            };
            
            if (moduleMap[cmd]) {
                for (const moduleName of moduleMap[cmd]) {
                    return { command: 'python3', viaPython: `-m ${moduleName}` };
                }
            }
        }
        
        // Final fallback: try python -m <module>
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        return { command: pythonCmd, viaPython: `-m ${cmd}` };
    });
}

// Docker-based PhoneInfoga execution for Render.com
async function runPhoneInfogaDocker(phone) {
    return new Promise((resolve, reject) => {
        console.log('🐳 Starting PhoneInfoga Docker container...');
        
        const dockerArgs = [
            'run', '--rm',
            '-e', 'TERM=dumb',
            '-e', 'NO_COLOR=1',
            '-e', 'FORCE_COLOR=0',
            'sundowndev/phoneinfoga:latest',
            'scan', '-n', phone
        ];
        
        const child = spawn('docker', dockerArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                TERM: 'dumb',
                NO_COLOR: '1',
                FORCE_COLOR: '0'
            }
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log('✅ PhoneInfoga Docker completed successfully');
                const result = parsePhoneInfoga(stdout, stderr);
                resolve(result);
            } else {
                console.log('❌ PhoneInfoga Docker failed with code:', code);
                console.log('stderr:', stderr);
                reject(new Error(`Docker PhoneInfoga failed with code ${code}`));
            }
        });
        
        child.on('error', (error) => {
            console.log('❌ PhoneInfoga Docker spawn error:', error.message);
            reject(error);
        });
    });
}

async function runToolIfAvailable(cmd, args, parseFn) {
    console.log(`🔧 Running tool: ${cmd} with args:`, args);
    const resolved = await resolveToolCommand(cmd);
    console.log(`🔍 Tool resolution result:`, resolved);
    if (!resolved.command) {
        console.log(`❌ Tool ${cmd} not available`);
        return null;
    }
    const spawnCmd = resolved.command;
    const spawnArgs = resolved.viaPython
        ? (resolved.viaPython.startsWith('-m ')
            ? ['-m', resolved.viaPython.replace('-m ', ''), ...args]
            : resolved.viaPython.startsWith('-m')
            ? [resolved.viaPython, ...args]
            : [resolved.viaPython, ...args])
        : args;
    console.log(`🔧 Executing: ${spawnCmd} ${spawnArgs.join(' ')}`);
    try {
        const { stdout, stderr } = await execFileAsync(spawnCmd, spawnArgs, {
            timeout: 180000,
            maxBuffer: 1024 * 1024 * 20,
            env: {
                ...process.env,
                PYTHONUTF8: '1',
                PYTHONIOENCODING: 'utf-8',
                PYTHONUNBUFFERED: '1'
            }
        });
        console.log(`✅ Tool ${cmd} executed successfully`);
        console.log(`📤 stdout length: ${stdout?.length || 0}`);
        console.log(`📤 stderr length: ${stderr?.length || 0}`);
        const parsed = parseFn(stdout, stderr);
        if (parsed && typeof parsed === 'object') parsed.__source = cmd;
        
        // Debug logging for PhoneInfoga
        if (cmd === 'phoneinfoga' || (cmd === 'docker' && args.includes('phoneinfoga'))) {
            console.log('🔍 PhoneInfoga raw output preview:', stdout.substring(0, 500) + '...');
            console.log('🔍 PhoneInfoga parsed result:', parsed);
        }
        
        return parsed;
    } catch (err) {
        console.log(`❌ Tool ${cmd} failed:`, err.message);
        return null;
    }
}

// -- Modular helpers for /lookup --
async function queryPhoneInfoga(phone) {
    const available = await isCommandAvailable('phoneinfoga');
    if (!available) return null;
    try {
        const { stdout } = await execFileAsync('phoneinfoga', ['scan', '-n', phone], { timeout: 120000, maxBuffer: 1024 * 1024 * 10 });
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
    const available = await isCommandAvailable('phoneinfoga');
    if (!available) return null;
    try {
        const { stdout } = await execFileAsync('phoneinfoga', ['scan', '-n', phone], { timeout: 120000, maxBuffer: 1024 * 1024 * 10 });
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
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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

// Reset visitor and search counts for publishing
db.run('DELETE FROM visitors', (err) => {
    if (err) console.log('❌ Error resetting visitors:', err.message);
    else console.log('✅ Visitor count reset to 0');
});

db.run('DELETE FROM searches', (err) => {
    if (err) console.log('❌ Error resetting searches:', err.message);
    else console.log('✅ Search count reset to 0');
});

// Cleanup old records daily
cron.schedule('0 0 * * *', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    db.run('DELETE FROM searches WHERE timestamp < ?', [thirtyDaysAgo.toISOString()]);
    db.run('DELETE FROM visitors WHERE timestamp < ?', [thirtyDaysAgo.toISOString()]);
});

app.listen(PORT, () => {
    console.log(`🚀 OSINT Lookup Engine running on port ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
});



