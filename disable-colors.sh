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

# Create system-wide tput replacement in multiple locations
echo "🔧 Creating system-wide tput replacement..."

# Create tput in /usr/bin (highest priority)
sudo mkdir -p /usr/bin
cat > /usr/bin/tput << 'EOF'
#!/bin/bash
# System-wide tput replacement that returns empty strings
case "$1" in
    "colors"|"lines"|"cols"|"setaf"|"setab"|"sgr0"|"reset"|"bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso")
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF

# Create tput in /usr/local/bin
sudo mkdir -p /usr/local/bin
cat > /usr/local/bin/tput << 'EOF'
#!/bin/bash
# System-wide tput replacement that returns empty strings
case "$1" in
    "colors"|"lines"|"cols"|"setaf"|"setab"|"sgr0"|"reset"|"bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso")
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF

# Create tput in /bin
sudo mkdir -p /bin
cat > /bin/tput << 'EOF'
#!/bin/bash
# System-wide tput replacement that returns empty strings
case "$1" in
    "colors"|"lines"|"cols"|"setaf"|"setab"|"sgr0"|"reset"|"bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso")
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF

# Make all tput replacements executable
chmod +x /usr/bin/tput
chmod +x /usr/local/bin/tput
chmod +x /bin/tput

# Override the problematic colors.sh script
echo "🔧 Overriding colors.sh script..."
sudo mkdir -p /home/render
cat > /home/render/colors.sh << 'EOF'
#!/bin/bash
# Overridden colors.sh script that does nothing
# This prevents the tput error from occurring
exit 0
EOF

chmod +x /home/render/colors.sh

# Update PATH to prioritize our tput replacements
export PATH="/usr/bin:/usr/local/bin:/bin:$PATH"

echo "✅ Color output disabled successfully"
echo "✅ System-wide tput replacement created"
echo "✅ colors.sh script overridden"
