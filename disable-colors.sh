#!/bin/bash
# Comprehensive color disabling script for Render.com

echo "🎨 Disabling all color output for OSINT tools..."

# Set environment variables
export TERM=dumb
export FORCE_COLOR=0
export NO_COLOR=1
export CLICOLOR=0
export CLICOLOR_FORCE=0
export ANSI_COLORS_DISABLED=1
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8
export RICH_NO_COLOR=1
export PYTHONUTF8=1

# Create a simple tput replacement
cat > /usr/local/bin/tput << 'EOF'
#!/bin/bash
# Simple tput replacement that returns empty strings
case "$1" in
    "colors"|"lines"|"cols"|"setaf"|"setab"|"sgr0"|"reset"|"bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso")
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF

chmod +x /usr/local/bin/tput

echo "✅ Color output disabled successfully"
echo "✅ tput replacement created"
