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
            if (this.dbType === 'postgresql' && this.databaseUrl) {
                console.log('🐘 Connecting to PostgreSQL database...');
                this.db = new Pool({
                    connectionString: this.databaseUrl,
                    ssl: {
                        rejectUnauthorized: false
                    }
                });
                
                // Test connection
                const client = await this.db.connect();
                console.log('✅ PostgreSQL connection established');
                client.release();
                this.isConnected = true;
            } else {
                console.log('📁 Using SQLite database...');
                const dbPath = process.env.DB_PATH || './osint.db';
                this.db = new sqlite3.Database(dbPath);
                this.isConnected = true;
                console.log('✅ SQLite connection established');
            }
            
            await this.initializeTables();
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    async initializeTables() {
        if (this.dbType === 'postgresql') {
            await this.initializePostgreSQLTables();
        } else {
            await this.initializeSQLiteTables();
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
                        console.error('❌ SQLite table initialization failed:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ SQLite tables initialized');
                        resolve();
                    }
                });
            });
        });
    }

    async insertVisitor(ip, userAgent) {
        if (!this.isConnected) return false;

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
            return false;
        }
    }

    async insertSearch(query, queryType, results) {
        if (!this.isConnected) return false;

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                await client.query(
                    'INSERT INTO searches (query, query_type, results) VALUES ($1, $2, $3)',
                    [query, queryType, JSON.stringify(results)]
                );
                client.release();
            } else {
                return new Promise((resolve, reject) => {
                    this.db.run(
                        'INSERT INTO searches (query, query_type, results) VALUES (?, ?, ?)',
                        [query, queryType, JSON.stringify(results)],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }
            return true;
        } catch (error) {
            console.error('❌ Search insertion failed:', error.message);
            return false;
        }
    }

    async getVisitorStats() {
        if (!this.isConnected) return { visitors_today: 0, total_visitors: 0 };

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
        if (!this.isConnected) return 0;

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

    async cleanup() {
        if (this.dbType === 'postgresql' && this.db) {
            await this.db.end();
            console.log('✅ PostgreSQL connection closed');
        } else if (this.db) {
            this.db.close();
            console.log('✅ SQLite connection closed');
        }
    }
}

module.exports = DatabaseManager;
