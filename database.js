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
            this.isConnected = true;
            
            // Test a simple query
            const testResult = await client.query('SELECT NOW()');
            console.log('✅ Database query test successful:', testResult.rows[0]);
            client.release();
            
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
                    ip TEXT NOT NULL,
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

            // Check if IP column needs to be updated from VARCHAR(45) to TEXT
            try {
                const ipColumnCheck = await client.query(`
                    SELECT data_type, character_maximum_length
                    FROM information_schema.columns 
                    WHERE table_name = 'visitors' AND column_name = 'ip'
                `);
                
                if (ipColumnCheck.rows.length > 0) {
                    const columnInfo = ipColumnCheck.rows[0];
                    if (columnInfo.data_type === 'character varying' && columnInfo.character_maximum_length === 45) {
                        console.log('🔧 Updating IP column from VARCHAR(45) to TEXT...');
                        await client.query(`
                            ALTER TABLE visitors ALTER COLUMN ip TYPE TEXT
                        `);
                        console.log('✅ Updated IP column to TEXT type');
                    }
                }
            } catch (migrationError) {
                console.error('❌ IP column migration failed:', migrationError.message);
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
        
        // Clean and truncate IP address if it's too long
        const cleanIp = String(ip || '').trim().substring(0, 255); // Limit to 255 chars
        const cleanUserAgent = String(userAgent || '').trim().substring(0, 1000); // Limit user agent
        
        console.log(`🔍 Inserting visitor: ${cleanIp} with user agent: ${cleanUserAgent?.substring(0, 50)}...`);

        try {
            const client = await this.db.connect();
            await client.query(
                'INSERT INTO visitors (ip, user_agent) VALUES ($1, $2)',
                [cleanIp, cleanUserAgent]
            );
            client.release();
            return true;
        } catch (error) {
            console.error('❌ Visitor insertion failed:', error.message);
            console.error('❌ Visitor insertion error details:', error);
            console.error('❌ IP length:', cleanIp.length, 'User Agent length:', cleanUserAgent.length);
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
            console.log('⚠️ Database not connected, returning default visitor stats');
            return { visitors_today: 0, total_visitors: 0, hits_today: 0, total_hits: 0 };
        }

        try {
            if (this.dbType === 'postgresql') {
                const client = await this.db.connect();
                
                // Unique visitors today
                const todayUniqueResult = await client.query(`
                    SELECT COUNT(DISTINCT ip) as visitors 
                    FROM visitors 
                    WHERE timestamp > NOW() - INTERVAL '24 hours'
                `);
                
                // Total unique visitors overall
                const totalUniqueResult = await client.query(`
                    SELECT COUNT(DISTINCT ip) as total_visitors 
                    FROM visitors
                `);

                // Total hits today
                const todayHitsResult = await client.query(`
                    SELECT COUNT(*) as hits_today 
                    FROM visitors 
                    WHERE timestamp > NOW() - INTERVAL '24 hours'
                `);

                // Total hits overall
                const totalHitsResult = await client.query(`
                    SELECT COUNT(*) as total_hits 
                    FROM visitors
                `);
                
                client.release();
                
                return {
                    visitors_today: parseInt(todayUniqueResult.rows[0].visitors) || 0,
                    total_visitors: parseInt(totalUniqueResult.rows[0].total_visitors) || 0,
                    hits_today: parseInt(todayHitsResult.rows[0].hits_today) || 0,
                    total_hits: parseInt(totalHitsResult.rows[0].total_hits) || 0
                };
            } else {
                return new Promise((resolve, reject) => {
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    
                    // Unique visitors today
                    this.db.get(`
                        SELECT COUNT(DISTINCT ip) as visitors 
                        FROM visitors 
                        WHERE timestamp > ?
                    `, [oneDayAgo], (err, visitorResult) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // Total unique visitors overall
                        this.db.get(`
                            SELECT COUNT(DISTINCT ip) as total_visitors 
                            FROM visitors
                        `, (err, totalVisitorResult) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            // Total hits today
                            this.db.get(`
                                SELECT COUNT(*) as hits_today 
                                FROM visitors 
                                WHERE timestamp > ?
                            `, [oneDayAgo], (err, hitsTodayResult) => {
                                if (err) {
                                    reject(err);
                                    return;
                                }

                                // Total hits overall
                                this.db.get(`
                                    SELECT COUNT(*) as total_hits 
                                    FROM visitors
                                `, (err, totalHitsResult) => {
                                    if (err) {
                                        reject(err);
                                        return;
                                    }

                                    resolve({
                                        visitors_today: visitorResult?.visitors || 0,
                                        total_visitors: totalVisitorResult?.total_visitors || 0,
                                        hits_today: hitsTodayResult?.hits_today || 0,
                                        total_hits: totalHitsResult?.total_hits || 0
                                    });
                                });
                            });
                        });
                    });
                });
            }
        } catch (error) {
            console.error('❌ Visitor stats failed:', error.message);
            return { visitors_today: 0, total_visitors: 0, hits_today: 0, total_hits: 0 };
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
