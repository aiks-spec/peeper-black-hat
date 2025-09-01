#!/bin/bash
# IMMEDIATE tput fix - runs before any other operations

echo "🚨 CRITICAL: Creating tput replacement IMMEDIATELY..."

# Create tput replacement in ALL possible locations
mkdir -p /usr/bin /usr/local/bin /bin /home/render/.local/bin

# Create a universal tput replacement
cat > /tmp/tput_replacement << 'EOF'
#!/bin/bash
# Universal tput replacement - returns empty strings for all color operations
case "$1" in
    "colors"|"lines"|"cols"|"setaf"|"setab"|"sgr0"|"reset"|"bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso")
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF

# Copy to all locations
cp /tmp/tput_replacement /usr/bin/tput
cp /tmp/tput_replacement /usr/local/bin/tput
cp /tmp/tput_replacement /bin/tput
cp /tmp/tput_replacement /home/render/.local/bin/tput

# Make all executable
chmod +x /usr/bin/tput
chmod +x /usr/local/bin/tput
chmod +x /bin/tput
chmod +x /home/render/.local/bin/tput

# Override colors.sh script completely
mkdir -p /home/render
cat > /home/render/colors.sh << 'EOF'
#!/bin/bash
# Overridden colors.sh - does nothing to prevent tput errors
exit 0
EOF

chmod +x /home/render/colors.sh

# Set environment variables
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

echo "✅ tput replacement created successfully"
echo "✅ colors.sh script overridden"
echo "✅ Environment variables set"
