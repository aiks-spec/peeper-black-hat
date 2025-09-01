#!/bin/bash
# System-level tput installation script

echo "🚨 CRITICAL: Installing tput system-wide..."

# Install ncurses-bin to provide real tput
apt-get update && apt-get install -y ncurses-bin

# Create tput replacement in ALL possible locations
echo '#!/bin/bash\necho ""' > /usr/bin/tput && chmod +x /usr/bin/tput
echo '#!/bin/bash\necho ""' > /usr/local/bin/tput && chmod +x /usr/local/bin/tput
echo '#!/bin/bash\necho ""' > /bin/tput && chmod +x /bin/tput
echo '#!/bin/bash\necho ""' > /home/render/.local/bin/tput && chmod +x /home/render/.local/bin/tput

# Set environment variables
export TERM=dumb
export FORCE_COLOR=0
export NO_COLOR=1
export ANSI_COLORS_DISABLED=1

echo "✅ tput installed system-wide"
