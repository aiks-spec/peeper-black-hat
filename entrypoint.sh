#!/bin/bash
# Custom entrypoint to handle tput issues

# Create tput replacement that does nothing (since we don't use tput)
echo '#!/bin/bash\necho ""' > /usr/bin/tput && chmod +x /usr/bin/tput
echo '#!/bin/bash\necho ""' > /usr/local/bin/tput && chmod +x /usr/local/bin/tput
echo '#!/bin/bash\necho ""' > /bin/tput && chmod +x /bin/tput

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
