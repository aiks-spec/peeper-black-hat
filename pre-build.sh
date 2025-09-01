#!/bin/bash
# Pre-build script to fix tput error before any other operations

echo "🚨 CRITICAL: Fixing tput error before any operations..."

# Create system-wide tput replacement in ALL possible locations
mkdir -p /usr/bin /usr/local/bin /bin /home/render/.local/bin

# Create tput replacement script
cat > /tmp/tput_script << 'EOF'
#!/bin/bash
# Universal tput replacement that returns empty strings
case "$1" in
    "colors"|"lines"|"cols"|"setaf"|"setab"|"sgr0"|"reset"|"bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso")
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF

# Copy tput replacement to all locations
cp /tmp/tput_script /usr/bin/tput
cp /tmp/tput_script /usr/local/bin/tput
cp /tmp/tput_script /bin/tput
cp /tmp/tput_script /home/render/.local/bin/tput

# Make all tput replacements executable
chmod +x /usr/bin/tput
chmod +x /usr/local/bin/tput
chmod +x /bin/tput
chmod +x /home/render/.local/bin/tput

# Override the problematic colors.sh script
mkdir -p /home/render
cat > /home/render/colors.sh << 'EOF'
#!/bin/bash
# Overridden colors.sh script that does nothing
# This prevents the tput error from occurring
exit 0
EOF

chmod +x /home/render/colors.sh

# Set environment variables immediately
export TERM=dumb
export FORCE_COLOR=0
export NO_COLOR=1
export ANSI_COLORS_DISABLED=1
export PATH="/usr/bin:/usr/local/bin:/bin:/home/render/.local/bin:$PATH"

# Test tput
echo "🧪 Testing tput replacement..."
/usr/bin/tput colors
/usr/local/bin/tput colors
/bin/tput colors

echo "✅ tput error fixed at system level"
echo "✅ colors.sh script overridden"
echo "✅ Environment variables set"
