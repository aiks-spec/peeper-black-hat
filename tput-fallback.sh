#!/bin/bash
# tput fallback script for Render.com deployment
# This script provides basic tput functionality when tput is not available

case "$1" in
    "colors")
        echo "8"
        ;;
    "lines")
        echo "24"
        ;;
    "cols")
        echo "80"
        ;;
    "setaf"|"setab")
        # Color codes - return empty for no color
        echo ""
        ;;
    "sgr0"|"reset")
        # Reset colors - return empty
        echo ""
        ;;
    "bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso")
        # Text formatting - return empty
        echo ""
        ;;
    *)
        # Default case - return empty
        echo ""
        ;;
esac
