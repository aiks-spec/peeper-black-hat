#!/bin/bash
# Custom entrypoint to handle tput issues

# Create tput replacement if it doesn't exist
if ! command -v tput &> /dev/null; then
    echo '#!/bin/bash\necho ""' > /usr/bin/tput && chmod +x /usr/bin/tput
fi

# Delete any colors.sh files
rm -f /home/render/colors.sh
rm -f /usr/local/colors.sh
rm -f /opt/colors.sh

# Set environment variables
export TERM=dumb
export FORCE_COLOR=0
export NO_COLOR=1
export ANSI_COLORS_DISABLED=1

# Start the application
exec "$@"
