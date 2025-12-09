#!/bin/bash
# Script to check EC2 server performance and memory usage

echo "Connecting to production server to check performance..."

ssh -i /c/Users/Windows/fsda_key.pem ubuntu@13.60.137.180 << 'ENDSSH'
    echo "=========================================="
    echo "1. MEMORY USAGE"
    echo "=========================================="
    free -h

    echo ""
    echo "=========================================="
    echo "2. DISK USAGE"
    echo "=========================================="
    df -h

    echo ""
    echo "=========================================="
    echo "3. CPU USAGE & LOAD AVERAGE"
    echo "=========================================="
    uptime

    echo ""
    echo "=========================================="
    echo "4. TOP PROCESSES BY MEMORY"
    echo "=========================================="
    ps aux --sort=-%mem | head -15

    echo ""
    echo "=========================================="
    echo "5. TOP PROCESSES BY CPU"
    echo "=========================================="
    ps aux --sort=-%cpu | head -15

    echo ""
    echo "=========================================="
    echo "6. DJANGO & FASTAPI PROCESS STATUS"
    echo "=========================================="
    sudo supervisorctl status

    echo ""
    echo "=========================================="
    echo "7. NGINX STATUS"
    echo "=========================================="
    sudo systemctl status nginx --no-pager | head -20

    echo ""
    echo "=========================================="
    echo "8. DATABASE CONNECTIONS (PostgreSQL)"
    echo "=========================================="
    sudo -u postgres psql -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null || echo "PostgreSQL not accessible"

    echo ""
    echo "=========================================="
    echo "9. RECENT ERRORS IN DJANGO LOG"
    echo "=========================================="
    tail -50 /var/log/supervisor/fsvc-django-stderr.log 2>/dev/null || echo "No Django error log found"

    echo ""
    echo "=========================================="
    echo "10. RECENT ERRORS IN FASTAPI LOG"
    echo "=========================================="
    tail -50 /var/log/supervisor/fsvc-fastapi-stderr.log 2>/dev/null || echo "No FastAPI error log found"

    echo ""
    echo "=========================================="
    echo "11. EC2 INSTANCE TYPE"
    echo "=========================================="
    curl -s http://169.254.169.254/latest/meta-data/instance-type
    echo ""

    echo ""
    echo "=========================================="
    echo "12. SWAP USAGE"
    echo "=========================================="
    swapon --show

    echo ""
    echo "=========================================="
    echo "PERFORMANCE SUMMARY"
    echo "=========================================="

    # Calculate memory usage percentage
    TOTAL_MEM=$(free | grep Mem | awk '{print $2}')
    USED_MEM=$(free | grep Mem | awk '{print $3}')
    MEM_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($USED_MEM/$TOTAL_MEM)*100}")

    echo "Memory Usage: ${MEM_PERCENT}%"

    # Check if memory is critical
    if (( $(echo "$MEM_PERCENT > 85" | bc -l) )); then
        echo "⚠️  WARNING: High memory usage detected!"
        echo "   Recommendation: Consider upgrading instance or optimizing applications"
    fi

    # Check load average
    LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    echo "Current Load Average (1 min): $LOAD"

    echo ""
    echo "=========================================="
ENDSSH

echo ""
echo "Performance check complete!"
