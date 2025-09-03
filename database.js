const { Pool } = require('pg');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.databaseUrl = process.env.DATABASE_URL;
        this.isConnected = false;
    }

    async connect() {
        try {
            console.log(`🔍 PostgreSQL connection attempt - URL: ${this.databaseUrl ? 'Set' : 'Not set'}`);
            console.log(`🔍 Environment check - DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
            
            if (!this.databaseUrl) {
                throw new Error('DATABASE_URL environment variable is required for PostgreSQL connection');
            }
            
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
            
            await this.initializeTables();
            return true;
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            console.error('❌ Database error details:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error stack:', error.stack);
            this.isConnected = false;
            throw error;
        }
    }

    async initializeTables() {
        try {
            await this.initializePostgreSQLTables();
        } catch (error) {
            console.error('❌ Table initialization failed:', error.message);
            throw error;
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

    async insertVisitor(ip, userAgent) {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, skipping visitor insert');
            return false;
        }
        
        console.log(`🔍 Inserting visitor: ${ip} with user agent: ${userAgent?.substring(0, 50)}...`);

        try {
            const client = await this.db.connect();
            await client.query(
                'INSERT INTO visitors (ip, user_agent) VALUES ($1, $2)',
                [ip, userAgent]
            );
            client.release();
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
            const client = await this.db.connect();
            const result = await client.query(
                'INSERT INTO searches (query, query_type, results) VALUES ($1, $2, $3) RETURNING id',
                [query, queryType, JSON.stringify(results)]
            );
            client.release();
            return result.rows[0].id;
        } catch (error) {
            console.error('❌ Search insertion failed:', error.message);
            console.error('❌ Search insertion error details:', error);
            return null;
        }
    }

    async insertTempFile(searchId, filePath, expiresAt) {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, skipping temp file insert');
            return false;
        }

        try {
            const client = await this.db.connect();
            await client.query(
                'INSERT INTO temp_files (search_id, file_path, expires_at) VALUES ($1, $2, $3)',
                [searchId, filePath, expiresAt]
            );
            client.release();
            return true;
        } catch (error) {
            console.error('❌ Temp file insertion failed:', error.message);
            return false;
        }
    }

    async getVisitorStats() {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, returning default stats');
            return { visitors_today: 0, total_visitors: 0 };
        }

        try {
            const client = await this.db.connect();
            
            // Get total visitors
            const totalResult = await client.query('SELECT COUNT(*) as count FROM visitors');
            const totalVisitors = parseInt(totalResult.rows[0].count);

            // Get today's visitors
            const todayResult = await client.query(`
                SELECT COUNT(*) as count FROM visitors 
                WHERE DATE(timestamp) = CURRENT_DATE
            `);
            const visitorsToday = parseInt(todayResult.rows[0].count);

            client.release();
            return { visitors_today: visitorsToday, total_visitors: totalVisitors };
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
            const client = await this.db.connect();
            const result = await client.query('SELECT COUNT(*) as count FROM searches');
            client.release();
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('❌ Search count failed:', error.message);
            return 0;
        }
    }

    async getSearchHistory(limit = 10) {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, returning empty search history');
            return [];
        }

        try {
            const client = await this.db.connect();
            const result = await client.query(`
                SELECT id, query, query_type, timestamp, results
                FROM searches 
                ORDER BY timestamp DESC 
                LIMIT $1
            `, [limit]);
            client.release();
            return result.rows;
        } catch (error) {
            console.error('❌ Search history failed:', error.message);
            return [];
        }
    }

    async resetCounts() {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, cannot reset counts');
            return false;
        }

        try {
            const client = await this.db.connect();
            
            // Reset visitor counts
            await client.query('DELETE FROM visitors');
            console.log('✅ Visitor counts reset');
            
            // Reset search counts
            await client.query('DELETE FROM searches');
            console.log('✅ Search counts reset');
            
            // Reset temp files
            await client.query('DELETE FROM temp_files');
            console.log('✅ Temp files reset');
            
            client.release();
            return true;
        } catch (error) {
            console.error('❌ Reset counts failed:', error.message);
            return false;
        }
    }

    async cleanupExpiredFiles() {
        if (!this.isConnected || !this.db) {
            console.log('⚠️ Database not connected, cannot cleanup files');
            return [];
        }

        try {
            const client = await this.db.connect();
            
            // Get expired files
            const result = await client.query(`
                SELECT file_path FROM temp_files 
                WHERE expires_at < NOW()
            `);
            
            const expiredFiles = result.rows.map(row => row.file_path);
            
            if (expiredFiles.length > 0) {
                // Delete expired file records
                await client.query(`
                    DELETE FROM temp_files 
                    WHERE expires_at < NOW()
                `);
                console.log(`✅ Cleaned up ${expiredFiles.length} expired file records`);
            }
            
            client.release();
            return expiredFiles;
        } catch (error) {
            console.error('❌ Cleanup expired files failed:', error.message);
            return [];
        }
    }

    async cleanup() {
        if (this.db) {
            try {
                await this.db.end();
                console.log('✅ PostgreSQL connection closed');
            } catch (error) {
                console.error('❌ Error closing PostgreSQL connection:', error.message);
            }
        }
    }
}

module.exports = DatabaseManager;
