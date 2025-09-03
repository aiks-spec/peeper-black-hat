const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbType = process.env.DB_TYPE || 'sqlite';
        this.databaseUrl = process.env.DATABASE_URL;
        this.isConnected = false;
    }

    async connect() {
        try {
            console.log(`🔍 Database connection attempt - Type: ${this.dbType}, URL: ${this.databaseUrl ? 'Set' : 'Not set'}`);
            
            if (this.dbType === 'postgresql' && this.databaseUrl) {
                console.log('🐘 Connecting to PostgreSQL database...');
                this.db = new Pool({
                    connectionString: this.databaseUrl,
                    ssl: {
                        rejectUnauthorized: false
                    },
                    // Add connection pool settings for production
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                });
                
                // Test connection with timeout
                const client = await Promise.race([
                    this.db.connect(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Connection timeout')), 10000)
                    )
                ]);
                
                console.log('✅ PostgreSQL connection established');
                client.release();
                this.isConnected = true;
                
                // Test a simple query
                const testResult = await client.query('SELECT NOW()');
                console.log('✅ Database query test successful:', testResult.rows[0]);
                
            } else {
                console.log('📁 Using SQLite database (fallback)...');
                const dbPath = process.env.DB_PATH || './osint.db';
                this.db = new sqlite3.Database(dbPath);
                
                // Test SQLite connection
                return new Promise((resolve, reject) => {
                    this.db.get('SELECT 1 as test', (err, row) => {
                        if (err) {
                            console.error('❌ SQLite connection test failed:', err.message);
                            reject(err);
                        } else {
                            console.log('✅ SQLite connection established');
                            this.isConnected = true;
                            resolve(true);
                        }
                    });
                });
            }
            
            await this.initializeTables();
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            console.error('❌ Database error details:', error);
            this.isConnected = false;
            
            // Try SQLite fallback if PostgreSQL fails
            if (this.dbType === 'postgresql') {
                console.log('🔄 Attempting SQLite fallback...');
                try {
                    const dbPath = process.env.DB_PATH || './osint.db';
                    this.db = new sqlite3.Database(dbPath);
                    this.dbType = 'sqlite';
                    
                    return new Promise((resolve, reject) => {
                        this.db.get('SELECT 1 as test', (err, row) => {
                            if (err) {
                                console.error('❌ SQLite fallback also failed:', err.message);
                                reject(err);
                            } else {
                                console.log('✅ SQLite fallback successful');
                                this.isConnected = true;
                                this.initializeTables().then(() => resolve(true));
                            }
                        });
                    });
                } catch (fallbackError) {
                    console.error('❌ SQLite fallback failed:', fallbackError.message);
                    return false;
                }
            }
            
            return false;
        }
    }

    async initializeTables() {
        try {
            if (this.dbType === 'postgresql') {
                await this.initializePostgreSQLTables();
            } else {
                await this.initializeSQLiteTables();
            }
        } catch (error) {
            console.error('❌ Table initialization failed:', error.message);
            // Don't throw error, just log it
        }
    }

    async initializePostgreSQLTables() {
        const client = await this.db.connect();
        try {
            // Create visitors table
            await client.query(`
                CREATE TABLE IF NOT EXISTS visitors (
                    id SERIAL PRIMARY KEY,
                    ip VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create searches table
            await client.query(`
                CREATE TABLE IF NOT EXISTS searches (
                    id SERIAL PRIMARY KEY,
                    query TEXT NOT NULL,
                    query_type VARCHAR(20) NOT NULL,
                    results JSONB,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Check if query_type column exists, add it if missing
            try {
                const columnCheck = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'searches' AND column_name = 'query_type'
                `);
                
                if (columnCheck.rows.length === 0) {
                    console.log('🔧 Adding missing query_type column to PostgreSQL searches table...');
                    await client.query(`
                        ALTER TABLE searches ADD COLUMN query_type VARCHAR(20) DEFAULT 'unknown'
                    `);
                    console.log('✅ Added query_type column to PostgreSQL searches table');
                }
            } catch (migrationError) {
                console.error('❌ PostgreSQL migration failed:', migrationError.message);
            }

            // Create temporary files table for auto-cleanup
            await client.query(`
                CREATE TABLE IF NOT EXISTS temp_files (
                    id SERIAL PRIMARY KEY,
                    search_id INTEGER REFERENCES searches(id),
                    file_path TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL
                )
            `);

            // Create indexes for better performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_visitors_ip ON visitors(ip);
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_visitors_timestamp ON visitors(timestamp);
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query);
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_searches_timestamp ON searches(timestamp);
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_temp_files_expires ON temp_files(expires_at);
            `);

            console.log('✅ PostgreSQL tables initialized');
        } catch (error) {
            console.error('❌ PostgreSQL table initialization failed:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    async initializeSQLiteTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS visitors (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ip TEXT NOT NULL,
                        user_agent TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                this.db.run(`
                    CREATE TABLE IF NOT EXISTS searches (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        query TEXT NOT NULL,
                        query_type TEXT NOT NULL,
                        results TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('❌ SQLite searches table initialization failed:', err.message);
                        reject(err);
                        return;
                    }
                    
                    this.db.run(`
                        CREATE TABLE IF NOT EXISTS temp_files (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            search_id INTEGER,
                            file_path TEXT NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            expires_at DATETIME NOT NULL
                        )
                    `, (err) => {
                        if (err) {
                            console.error('❌ SQLite temp_files table initialization failed:', err.message);
                            reject(err);
                        } else {
                            console.log('✅ SQLite tables initialized');
                            resolve();
                        }
                    });
                });
            });
        });
    }

    async insertVisitor(ip, userAgent) {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, skipping visitor insert');
            return false;
        }
        
        console.log(`🔍 Inserting visitor: ${ip} with user agent: ${userAgent?.substring(0, 50)}...`);

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                await client.query(
                    'INSERT INTO visitors (ip, user_agent) VALUES ($1, $2)',
                    [ip, userAgent]
                );
                client.release();
            } else {
                return new Promise((resolve, reject) => {
                    this.db.run(
                        'INSERT INTO visitors (ip, user_agent) VALUES (?, ?)',
                        [ip, userAgent],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            return true;
        } catch (error) {
            console.error('❌ Visitor insertion failed:', error.message);
            console.error('❌ Visitor insertion error details:', error);
            return false;
        }
    }

    async insertSearch(query, queryType, results) {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, skipping search insert');
            return null;
        }
        
        console.log(`🔍 Inserting search: ${query} (${queryType}) with results: ${results ? 'Yes' : 'No'}`);

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                const result = await client.query(
                    'INSERT INTO searches (query, query_type, results) VALUES ($1, $2, $3) RETURNING id',
                    [query, queryType, JSON.stringify(results)]
                );
                client.release();
                return result.rows[0].id;
            } else {
                return new Promise((resolve, reject) => {
                    this.db.run(
                        'INSERT INTO searches (query, query_type, results) VALUES (?, ?, ?)',
                        [query, queryType, JSON.stringify(results)],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        }
                    );
                });
            }
        } catch (error) {
            console.error('❌ Search insertion failed:', error.message);
            console.error('❌ Search insertion error details:', error);
            return false;
        }
    }

    async getVisitorStats() {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, returning default visitor stats');
            return { visitors_today: 0, total_visitors: 0 };
        }

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                
                // Get visitors today
                const todayResult = await client.query(`
                    SELECT COUNT(DISTINCT ip) as visitors 
                    FROM visitors 
                    WHERE timestamp > NOW() - INTERVAL '24 hours'
                `);
                
                // Get total visitors
                const totalResult = await client.query(`
                    SELECT COUNT(DISTINCT ip) as total_visitors 
                    FROM visitors
                `);
                
                client.release();
                
                return {
                    visitors_today: parseInt(todayResult.rows[0].visitors) || 0,
                    total_visitors: parseInt(totalResult.rows[0].total_visitors) || 0
                };
            } else {
                return new Promise((resolve, reject) => {
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    
                    this.db.get(`
                        SELECT COUNT(DISTINCT ip) as visitors 
                        FROM visitors 
                        WHERE timestamp > ?
                    `, [oneDayAgo], (err, visitorResult) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        this.db.get(`
                            SELECT COUNT(DISTINCT ip) as total_visitors 
                            FROM visitors
                        `, (err, totalVisitorResult) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            
                            resolve({
                                visitors_today: visitorResult.visitors || 0,
                                total_visitors: totalVisitorResult.total_visitors || 0
                            });
                        });
                    });
                });
            }
        } catch (error) {
            console.error('❌ Visitor stats failed:', error.message);
            return { visitors_today: 0, total_visitors: 0 };
        }
    }

    async getSearchCount() {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, returning default search count');
            return 0;
        }

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                const result = await client.query('SELECT COUNT(*) as searches FROM searches');
                client.release();
                return parseInt(result.rows[0].searches) || 0;
            } else {
                return new Promise((resolve, reject) => {
                    this.db.get('SELECT COUNT(*) as searches FROM searches', (err, result) => {
                        if (err) reject(err);
                        else resolve(result.searches || 0);
                    });
                });
            }
        } catch (error) {
            console.error('❌ Search count failed:', error.message);
            return 0;
        }
    }

    async insertTempFile(searchId, filePath) {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, cannot insert temp file');
            return false;
        }

        try {
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
            
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                await client.query(
                    'INSERT INTO temp_files (search_id, file_path, expires_at) VALUES ($1, $2, $3)',
                    [searchId, filePath, expiresAt]
                );
                client.release();
            } else {
                return new Promise((resolve, reject) => {
                    this.db.run(
                        'INSERT INTO temp_files (search_id, file_path, expires_at) VALUES (?, ?, ?)',
                        [searchId, filePath, expiresAt],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            return true;
        } catch (error) {
            console.error('❌ Temp file insertion failed:', error.message);
            return false;
        }
    }

    async cleanupExpiredFiles() {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, cannot cleanup expired files');
            return [];
        }

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                const result = await client.query(`
                    DELETE FROM temp_files 
                    WHERE expires_at < NOW()
                    RETURNING file_path
                `);
                client.release();
                
                // Return deleted file paths for cleanup
                return result.rows.map(row => row.file_path);
            } else {
                return new Promise((resolve, reject) => {
                    this.db.all(`
                        SELECT file_path FROM temp_files 
                        WHERE expires_at < datetime('now')
                    `, (err, rows) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        const filePaths = rows.map(row => row.file_path);
                        
                        this.db.run(`
                            DELETE FROM temp_files 
                            WHERE expires_at < datetime('now')
                        `, (err) => {
                            if (err) reject(err);
                            else resolve(filePaths);
                        });
                    });
                });
            }
        } catch (error) {
            console.error('❌ Cleanup expired files failed:', error.message);
            return [];
        }
    }

    async getSearchHistory(limit = 10) {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, returning empty search history');
            return [];
        }

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                const result = await client.query(`
                    SELECT id, query, query_type, results, timestamp 
                    FROM searches 
                    ORDER BY timestamp DESC 
                    LIMIT $1
                `, [limit]);
                client.release();
                
                return result.rows.map(row => ({
                    ...row,
                    results: row.results ? JSON.parse(row.results) : null
                }));
            } else {
                return new Promise((resolve, reject) => {
                    this.db.all(`
                        SELECT id, query, query_type, results, timestamp 
                        FROM searches 
                        ORDER BY timestamp DESC 
                        LIMIT ?
                    `, [limit], (err, rows) => {
                        if (err) reject(err);
                        else {
                            resolve(rows.map(row => ({
                                ...row,
                                results: row.results ? JSON.parse(row.results) : null
                            })));
                        }
                    });
                });
            }
        } catch (error) {
            console.error('❌ Get search history failed:', error.message);
            return [];
        }
    }

    async cleanup() {
        if (this.dbType === 'postgresql' && this.db) {
            await this.db.end();
            console.log('✅ PostgreSQL connection closed');
        } else if (this.db) {
            this.db.close();
            console.log('✅ SQLite connection closed');
        }
    }

    async resetCounts() {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, cannot reset counts');
            return false;
        }

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                await client.query('DELETE FROM visitors');
                await client.query('DELETE FROM searches');
                await client.query('DELETE FROM temp_files');
                client.release();
                console.log('✅ All counts reset successfully');
            } else {
                return new Promise((resolve, reject) => {
                    this.db.serialize(() => {
                        this.db.run('DELETE FROM visitors', (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            
                            this.db.run('DELETE FROM searches', (err) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }
                                
                                this.db.run('DELETE FROM temp_files', (err) => {
                                    if (err) reject(err);
                                    else {
                                        console.log('✅ All counts reset successfully');
                                        resolve();
                                    }
                                });
                            });
                        });
                    });
                });
            }
            return true;
        } catch (error) {
            console.error('❌ Reset counts failed:', error.message);
            return false;
        }
    }
}

module.exports = DatabaseManager;
