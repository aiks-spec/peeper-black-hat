// OSINT Lookup Engine - Frontend JavaScript
class OSINTLookupEngine {
    constructor() {
        this.initialize();
        this.loadStats();
        this.setupEventListeners();
    }

    initialize() {
        console.log('🚀 OSINT Lookup Engine Initialized');
        this.updateStatus('ONLINE');
        this.startStatusBlink();
        
        // Refresh stats every 30 seconds to keep visitor count updated
        setInterval(() => {
            this.loadStats();
        }, 30000);
    }

    setupEventListeners() {
        // Enter key support for inputs (original UI)
        const emailEl = document.getElementById('email-input');
        const phoneEl = document.getElementById('phone-input');
        const ipEl = document.getElementById('ip-input');
        if (emailEl) emailEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.performEmailLookup(); });
        if (phoneEl) phoneEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.performPhoneLookup(); });
        if (ipEl) ipEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.performIPLookup(); });
    }

    // Status Management
    updateStatus(status) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = status;
        statusElement.classList.add('glitch');

        setTimeout(() => {
            statusElement.classList.remove('glitch');
        }, 1000);
    }

    startStatusBlink() {
        setInterval(() => {
            const statusElement = document.getElementById('status');
            statusElement.style.opacity = statusElement.style.opacity === '0.5' ? '1' : '0.5';
        }, 2000);
    }

    // Loading Management
    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('active');
        this.updateResultsStatus('SCANNING');
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.remove('active');
        this.updateResultsStatus('READY');
    }

    updateResultsStatus(status) {
        const statusText = document.querySelector('.status-text');
        statusText.textContent = status;

        if (status === 'SCANNING') {
            statusText.style.color = '#00ff88';
        } else {
            statusText.style.color = '#00ff00';
        }
    }

    // Email Lookup
    async performEmailLookup() {
        const email = document.getElementById('email-input').value.trim();

        if (!email) {
            this.showError('Please enter a valid email address');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Invalid email format');
            return;
        }

        this.showLoading();
        this.clearResults();

        try {
            const response = await fetch('/api/email-lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                this.displayEmailResults(data.data);
                this.updateStats();
            } else {
                this.showError(data.error || 'Failed to retrieve email information');
            }
        } catch (error) {
            console.error('Email lookup error:', error);
            this.showError('Network error occurred');
        } finally {
            this.hideLoading();
        }
    }

    // Phone Lookup
    async performPhoneLookup() {
        const phone = document.getElementById('phone-input').value.trim();

        if (!phone) {
            this.showError('Please enter a valid phone number');
            return;
        }

        if (!this.isValidPhone(phone)) {
            this.showError('Invalid phone number format');
            return;
        }

        this.showLoading();
        this.clearResults();

        try {
            const response = await fetch('/api/phone-lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone })
            });

            const data = await response.json();

            if (data.success) {
                this.displayPhoneResults(data.data);
                this.updateStats();
            } else {
                this.showError(data.error || 'Failed to retrieve phone information');
            }
        } catch (error) {
            console.error('Phone lookup error:', error);
            this.showError('Network error occurred');
        } finally {
            this.hideLoading();
        }
    }

    // IP Lookup
    async performIPLookup() {
        const ip = document.getElementById('ip-input').value.trim();

        if (!ip) {
            this.showError('Please enter a valid IP address');
            return;
        }

        if (!this.isValidIP(ip)) {
            this.showError('Invalid IP address format');
            return;
        }

        this.showLoading();
        this.clearResults();

        try {
            const response = await fetch('/api/ip-lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ip })
            });

            const data = await response.json();

            if (data.success) {
                this.displayIPResults(data.data);
                this.updateStats();
            } else {
                this.showError(data.error || 'Failed to retrieve IP information');
            }
        } catch (error) {
            console.error('IP lookup error:', error);
            this.showError('Network error occurred');
        } finally {
            this.hideLoading();
        }
    }

    // Aggregate Lookup
    async performAggregate() {
        const query = document.getElementById('target-input').value.trim();
        if (!query) {
            this.showError('Enter a phone number or email');
            return;
        }
        this.showLoading();
        this.clearResults();
        try {
            const response = await fetch('/api/aggregate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const { success, data, error } = await response.json();
            if (!success) return this.showError(error || 'Aggregation failed');
            this.displayAggregate(data);
            this.updateStats();
        } catch (err) {
            console.error(err);
            this.showError('Network error');
        } finally {
            this.hideLoading();
        }
    }

    displayAggregate(data) {
        const container = document.getElementById('results-container');
        const sections = [];
        // General Info
        sections.push(`
            <details open class="result-item">
                <summary class="result-header">
                    <div class="result-title">GENERAL INFO</div>
                    <div class="result-timestamp">${this.formatTimestamp(Date.now())}</div>
                </summary>
                <div class="result-data">
                    <div class="data-field"><div class="field-label">Input</div><div class="field-value">${data.query}</div></div>
                    <div class="data-field"><div class="field-label">Type</div><div class="field-value">${data.type}</div></div>
                    <div class="data-field"><div class="field-label">Country</div><div class="field-value">${data.country || data.basic?.country || 'Unknown'}</div></div>
                    <div class="data-field"><div class="field-label">Carrier</div><div class="field-value">${data.carrier || 'Unknown'}</div></div>
                    <div class="data-field"><div class="field-label">Valid</div><div class="field-value">${String(data.basic?.valid ?? 'Unknown')}</div></div>
                    <div class="data-field"><div class="field-label">Line Type</div><div class="field-value">${data.basic?.type || 'Unknown'}</div></div>
                </div>
            </details>
        `);

        // Social Presence
        const socials = (data.socialProfiles || []).map(s => `<li><a href="${s.url}" target="_blank">${s.url}</a> <span style="color:#00aa00">(${s.confidence})</span></li>`).join('') || '<li>None</li>';
        sections.push(`
            <details class="result-item">
                <summary class="result-header"><div class="result-title">SOCIAL PRESENCE</div></summary>
                <div class="result-data" style="grid-template-columns:1fr;">
                    <div class="data-field" style="grid-column:1/-1;">
                        <ul>${socials}</ul>
                    </div>
                </div>
            </details>
        `);

        // Website Accounts (Holehe)
        const leaks = (data.leaks || []).map(l => `<li>${l.site || l.name || 'site'} - ${l.exists ? 'found' : 'unknown'} <span style="color:#00aa00">(${l.confidence})</span></li>`).join('') || '<li>None</li>';
        sections.push(`
             <details class="result-item">
                 <summary class="result-header"><div class="result-title">WEBSITE ACCOUNTS</div></summary>
                 <div class="result-data" style="grid-template-columns:1fr;">
                     <div class="data-field" style="grid-column:1/-1;">
                         <ul>${leaks}</ul>
                     </div>
                 </div>
             </details>
         `);

        // Maigret Social Profiles
        const maigretProfiles = (data.metadata?.maigret?.socialProfiles || []).map(profile => {
            if (typeof profile === 'string') {
                return `<li><a href="${profile}" target="_blank">${profile}</a></li>`;
            } else if (profile.url) {
                return `<li><a href="${profile.url}" target="_blank">${profile.url}</a></li>`;
            }
            return `<li>${JSON.stringify(profile)}</li>`;
        }).join('') || '<li>None</li>';

        if (data.metadata?.maigret?.socialProfiles?.length > 0) {
            sections.push(`
                 <details class="result-item">
                     <summary class="result-header"><div class="result-title">MAIGRET SOCIAL PROFILES</div></summary>
                     <div class="result-data" style="grid-template-columns:1fr;">
                         <div class="data-field" style="grid-column:1/-1;">
                             <ul>${maigretProfiles}</ul>
                         </div>
                     </div>
                 </details>
             `);
        }

        container.innerHTML = sections.join('');
        this.addGlitchEffect();
        window.__lastAggregate = data;
    }

    exportJSON() {
        const data = window.__lastAggregate;
        if (!data) return this.showError('No results to export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'osint-results.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    async downloadHoleheCSV() {
        try {
            const response = await fetch('/api/download-holehe-csv');
            if (!response.ok) {
                throw new Error('Failed to download CSV');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'holehe_results.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            this.showError('Failed to download Holehe CSV: ' + error.message);
        }
    }

    // Display Results
    buildFields(pairs) {
        return pairs
            .filter(({ value }) => value !== undefined && value !== null && value !== '' && value !== 'Unknown')
            .map(({ label, value }) => `
                <div class="data-field">
                    <div class="field-label">${label}</div>
                    <div class="field-value">${value}</div>
                </div>
            `)
            .join('');
    }

    displayEmailResults(data) {
        const container = document.getElementById('results-container');

        const fields = this.buildFields([
            { label: 'Email Address', value: data.email },
            { label: 'Full Name', value: data.name },
            { label: 'Company', value: data.company },
            { label: 'Position', value: data.position },
            { label: 'Domain', value: data.domain },
            { label: 'Confidence', value: data.confidence }
        ]);

        const resultHTML = `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-title">EMAIL LOOKUP RESULTS</div>
                    <div class="result-timestamp">${this.formatTimestamp(data.timestamp)}</div>
                </div>
                <div class="result-data">
                    ${fields}
                    ${Array.isArray(data.socialProfiles) && data.socialProfiles.length > 0 ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Social Profiles</div>
                            <div class="field-value">
                                <ul style="margin: 0; padding-left: 20px;">
                                                                         ${data.socialProfiles
                    .filter(p => (typeof p === 'string' && /^https?:\/\//i.test(p)) || (p && p.url))
                    .map(profile => {
                        if (typeof profile === 'string') {
                            return `<li><a href="${profile}" target="_blank">${profile}</a></li>`;
                        }
                        const url = profile.url;
                        return `<li><a href="${url}" target="_blank">${url}</a></li>`;
                    }).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                    ${Array.isArray(data.breaches) && data.breaches.length > 0 ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Data Breaches (Holehe)</div>
                            <div class="field-value">
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${data.breaches.map(breach => `<li>${breach.site || breach.name || 'Unknown site'}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                    ${data.metadata && data.metadata.holehe ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Holehe Results</div>
                            <div class="field-value">
                                <button onclick="window.osintEngine.downloadHoleheCSV()" class="download-btn">
                                    📥 Download Holehe CSV
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    ${data.metadata && data.metadata.maigret && data.metadata.maigret.socialProfiles && data.metadata.maigret.socialProfiles.length > 0 ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Maigret Social Profiles</div>
                            <div class="field-value">
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${data.metadata.maigret.socialProfiles.map(profile => {
                        if (typeof profile === 'string') {
                            return `<li>${profile} <a href="${profile}" target="_blank">🔗</a></li>`;
                        } else if (profile.url) {
                            return `<li>${profile.url} <a href="${profile.url}" target="_blank">🔗</a></li>`;
                        }
                        return `<li>${JSON.stringify(profile)}</li>`;
                    }).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                    ${data.google ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Google Account Info</div>
                            <div class="field-value">
                                <details>
                                    <summary>Click to expand</summary>
                                    <div style="background: #1a1a1a; padding: 10px; border-radius: 5px; overflow-x: auto; font-family: 'Share Tech Mono', monospace; font-size: 12px;">
                                        ${this.formatGoogleData(data.google)}
                                    </div>
                                </details>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        container.innerHTML = resultHTML;
        this.addGlitchEffect();
    }

    displayPhoneResults(data) {
        const container = document.getElementById('results-container');

        const fields = this.buildFields([
            { label: 'Phone Number', value: data.phone },
            { label: 'Owner', value: data.owner },
            { label: 'Email', value: data.email },
            { label: 'Carrier', value: data.carrier },
            { label: 'Location', value: data.location },
            { label: 'Line Type', value: data.lineType },
            { label: 'Country', value: data.country },
            { label: 'Valid', value: typeof data.valid === 'boolean' ? (data.valid ? 'true' : 'false') : data.valid },
            { label: 'International', value: data.international }
        ]);

        const resultHTML = `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-title">PHONE LOOKUP RESULTS</div>
                    <div class="result-timestamp">${this.formatTimestamp(data.timestamp)}</div>
                </div>
                <div class="result-data">
                    ${fields}
                    ${Array.isArray(data.socialMedia) && data.socialMedia.length > 0 ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Social Media</div>
                            <div class="field-value">
                                <ul style="margin: 0; padding-left: 20px;">
                                                                         ${data.socialMedia.map(profile => {
            if (typeof profile === 'string') {
                if (/^https?:\/\//i.test(profile)) {
                    return `<li><a href="${profile}" target="_blank">${profile}</a></li>`;
                }
                return `<li>${profile}</li>`;
            } else if (profile.url) {
                return `<li><a href="${profile.url}" target="_blank">${profile.url}</a></li>`;
            }
            return `<li>${JSON.stringify(profile)}</li>`;
        }).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                    ${Array.isArray(data.breaches) && data.breaches.length > 0 ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Data Breaches</div>
                            <div class="field-value">
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${data.breaches.map(breach => `<li>${breach.site || breach.name || 'Unknown site'}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                    ${data.metadata && data.metadata.holehe ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Holehe Results</div>
                            <div class="field-value">
                                <button onclick="window.osintEngine.downloadHoleheCSV()" class="download-btn">
                                    📥 Download Holehe CSV
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    ${data.metadata && data.metadata.maigret && data.metadata.maigret.socialProfiles && data.metadata.maigret.socialProfiles.length > 0 ? `
                        <div class="data-field" style="grid-column: 1 / -1;">
                            <div class="field-label">Maigret Social Profiles</div>
                            <div class="field-value">
                                <ul style="margin: 0; padding-left: 20px;">
                                                                         ${data.metadata.maigret.socialProfiles.map(profile => {
            if (typeof profile === 'string') {
                return `<li><a href="${profile}" target="_blank">${profile}</a></li>`;
            } else if (profile.url) {
                return `<li><a href="${profile.url}" target="_blank">${profile.url}</a></li>`;
            }
            return `<li>${JSON.stringify(profile)}</li>`;
        }).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        container.innerHTML = resultHTML;
        this.addGlitchEffect();
    }

    displayIPResults(data) {
        const container = document.getElementById('results-container');

        const resultHTML = `
            <div class="result-item">
                <div class="result-header">
                    <div class="result-title">IP LOOKUP RESULTS</div>
                    <div class="result-timestamp">${this.formatTimestamp(data.timestamp)}</div>
                </div>
                <div class="result-data">
                    <div class="data-field">
                        <div class="field-label">IP Address</div>
                        <div class="field-value">${data.ip}</div>
                    </div>
                    <div class="data-field">
                        <div class="field-label">City</div>
                        <div class="field-value">${data.city}</div>
                    </div>
                    <div class="data-field">
                        <div class="field-label">Region</div>
                        <div class="field-value">${data.region}</div>
                    </div>
                    <div class="data-field">
                        <div class="field-label">Country</div>
                        <div class="field-value">${data.country}</div>
                    </div>
                    <div class="data-field">
                        <div class="field-label">ISP</div>
                        <div class="field-value">${data.isp}</div>
                    </div>
                    <div class="data-field">
                        <div class="field-label">Timezone</div>
                        <div class="field-value">${data.timezone}</div>
                    </div>
                    <div class="data-field">
                        <div class="field-label">Coordinates</div>
                        <div class="field-value">${data.coordinates}</div>
                    </div>
                    <div class="data-field">
                        <div class="field-label">Organization</div>
                        <div class="field-value">${data.organization}</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = resultHTML;
        this.addGlitchEffect();
    }

    // Utility Functions
    clearResults() {
        const container = document.getElementById('results-container');
        container.innerHTML = '';
    }

    showError(message) {
        const container = document.getElementById('results-container');
        container.innerHTML = `
            <div class="result-item" style="border-color: #ff0000;">
                <div class="result-header">
                    <div class="result-title" style="color: #ff0000;">ERROR</div>
                </div>
                <div class="result-data">
                    <div class="data-field" style="grid-column: 1 / -1;">
                        <div class="field-value" style="color: #ff0000;">${message}</div>
                    </div>
                </div>
            </div>
        `;
    }

    addGlitchEffect() {
        const resultItems = document.querySelectorAll('.result-item');
        resultItems.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('glitch');
                setTimeout(() => {
                    item.classList.remove('glitch');
                }, 500);
            }, index * 100);
        });
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    // Validation Functions
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    isValidIP(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    // Stats Management
    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();

            document.getElementById('visitor-count').textContent = data.visitors_today || 0;
            document.getElementById('search-count').textContent = data.searches || 0;
        } catch (error) {
            console.error('Failed to load stats:', error);
            // Set default values on error
            document.getElementById('visitor-count').textContent = '0';
            document.getElementById('search-count').textContent = '0';
        }
    }

    async updateStats() {
        await this.loadStats();
    }

    // Format Google data with clickable URLs
    formatGoogleData(data) {
        const formatValue = (value, indent = 0) => {
            const spaces = '  '.repeat(indent);

            if (typeof value === 'string') {
                // Check if it's a URL and make it clickable
                if (/^https?:\/\//i.test(value)) {
                    return `${spaces}"<a href="${value}" target="_blank" style="color: #00ff88; text-decoration: underline;">${value}</a>"`;
                }
                return `${spaces}"${value}"`;
            } else if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    if (value.length === 0) return `${spaces}[]`;
                    return `${spaces}[\n${value.map(item => formatValue(item, indent + 1)).join(',\n')}\n${spaces}]`;
                } else {
                    const keys = Object.keys(value);
                    if (keys.length === 0) return `${spaces}{}`;
                    return `${spaces}{\n${keys.map(key => `${spaces}  "${key}": ${formatValue(value[key], indent + 1)}`).join(',\n')}\n${spaces}}`;
                }
            } else {
                return `${spaces}${value}`;
            }
        };

        return formatValue(data);
    }
}

// Global functions for onclick handlers
function performEmailLookup() {
    window.osintEngine.performEmailLookup();
}

function performPhoneLookup() {
    window.osintEngine.performPhoneLookup();
}

function performIPLookup() {
    window.osintEngine.performIPLookup();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.osintEngine = new OSINTLookupEngine();

    // Add some terminal-style startup effects
    setTimeout(() => {
        console.log('🔍 All systems operational');
        console.log('📡 APIs connected');
        console.log('💾 Database initialized');
        console.log('🎯 Ready for intelligence gathering');
    }, 1000);
});

// Add some ambient effects
setInterval(() => {
    const randomElement = document.querySelector('.hacker-input');
    if (randomElement && Math.random() < 0.1) {
        randomElement.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.8)';
        setTimeout(() => {
            randomElement.style.boxShadow = '';
        }, 200);
    }
}, 3000);
