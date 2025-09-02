#!/usr/bin/env node

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function testTool(toolName) {
    console.log(`\n🔍 Testing ${toolName}...`);
    
    try {
        const { stdout, stderr } = await execFileAsync('python3', ['-m', toolName, '--help'], {
            timeout: 10000,
            maxBuffer: 1024 * 1024,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PYTHONIOENCODING: 'utf-8',
                PYTHONUTF8: '1',
                LC_ALL: 'C.UTF-8',
                LANG: 'C.UTF-8',
                LANGUAGE: 'C.UTF-8',
                TERM: 'dumb',
                NO_COLOR: '1',
                FORCE_COLOR: '0',
                ANSI_COLORS_DISABLED: '1',
                CLICOLOR: '0',
                CLICOLOR_FORCE: '0'
            }
        });
        
        console.log(`✅ ${toolName} is working!`);
        console.log(`📤 stdout length: ${stdout?.length || 0}`);
        console.log(`📤 stderr length: ${stderr?.length || 0}`);
        
        if (stdout && stdout.length > 0) {
            console.log(`📄 ${toolName} help preview:`, stdout.substring(0, 200) + '...');
        }
        
        return true;
    } catch (error) {
        console.log(`❌ ${toolName} failed:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🧪 Testing Python OSINT Tools...');
    console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
    console.log('🐍 Python path:', process.env.PYTHON_PATH || 'python3');
    
    const tools = ['sherlock', 'holehe', 'maigret', 'ghunt'];
    const results = [];
    
    for (const tool of tools) {
        const success = await testTool(tool);
        results.push({ tool, success });
    }
    
    console.log('\n📊 Test Results:');
    results.forEach(({ tool, success }) => {
        console.log(`   ${success ? '✅' : '❌'} ${tool}`);
    });
    
    const allWorking = results.every(r => r.success);
    console.log(`\n${allWorking ? '🎉 All tools are working!' : '⚠️ Some tools failed. Check the output above.'}`);
    
    if (!allWorking) {
        console.log('\n🔧 Troubleshooting tips:');
        console.log('1. Make sure Python 3 is installed');
        console.log('2. Check if tools are installed: pip3 list | grep -E "(sherlock|holehe|maigret|ghunt)"');
        console.log('3. Try installing tools: pip3 install sherlock-project maigret holehe ghunt');
        console.log('4. Check Python path: which python3');
    }
}

main().catch(console.error);
