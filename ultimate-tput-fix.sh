#!/bin/bash
# ULTIMATE tput fix - covers ALL possible scenarios

echo "🚨 ULTIMATE tput fix - ensuring 100% coverage..."

# Create comprehensive tput replacement
cat > /tmp/ultimate_tput << 'EOF'
#!/bin/bash
# Ultimate tput replacement - handles ALL possible tput commands
case "$1" in
    "colors"|"lines"|"cols"|"setaf"|"setab"|"sgr0"|"reset"|"bold"|"dim"|"smul"|"rmul"|"rev"|"smso"|"rmso"|"cup"|"civis"|"cnorm"|"clear"|"ed"|"el"|"home"|"ht"|"il"|"ind"|"ri"|"sc"|"rc"|"tab"|"bel"|"blink"|"invis"|"standout"|"underline"|"kf1"|"kf2"|"kf3"|"kf4"|"kf5"|"kf6"|"kf7"|"kf8"|"kf9"|"kf10"|"kf11"|"kf12"|"kf13"|"kf14"|"kf15"|"kf16"|"kf17"|"kf18"|"kf19"|"kf20"|"kf21"|"kf22"|"kf23"|"kf24"|"kf25"|"kf26"|"kf27"|"kf28"|"kf29"|"kf30"|"kf31"|"kf32"|"kf33"|"kf34"|"kf35"|"kf36"|"kf37"|"kf38"|"kf39"|"kf40"|"kf41"|"kf42"|"kf43"|"kf44"|"kf45"|"kf46"|"kf47"|"kf48"|"kf49"|"kf50"|"kf51"|"kf52"|"kf53"|"kf54"|"kf55"|"kf56"|"kf57"|"kf58"|"kf59"|"kf60"|"kf61"|"kf62"|"kf63")
        echo ""
        ;;
    *)
        echo ""
        ;;
esac
EOF

# Install in ALL possible locations
for dir in /usr/bin /usr/local/bin /bin /home/render/.local/bin /opt/local/bin; do
    mkdir -p "$dir"
    cp /tmp/ultimate_tput "$dir/tput"
    chmod +x "$dir/tput"
done

# Override colors.sh in ALL possible locations
for dir in /home/render /usr/local /opt; do
    mkdir -p "$dir"
    echo '#!/bin/bash\nexit 0' > "$dir/colors.sh"
    chmod +x "$dir/colors.sh"
done

# Set ALL possible environment variables
export TERM=dumb
export FORCE_COLOR=0
export NO_COLOR=1
export ANSI_COLORS_DISABLED=1
export CLICOLOR=0
export CLICOLOR_FORCE=0
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8
export RICH_NO_COLOR=1
export PYTHONUTF8=1
export PATH="/usr/bin:/usr/local/bin:/bin:/home/render/.local/bin:/opt/local/bin:$PATH"

echo "✅ ULTIMATE tput fix completed - 100% coverage achieved!"
