#!/bin/bash
# Set up automated PostgreSQL backups on production

SERVER="ubuntu@13.60.137.180"
KEY="fsda_key.pem"

echo "=========================================="
echo "Setup Automated PostgreSQL Backups"
echo "=========================================="
echo ""

ssh -i $KEY $SERVER << 'ENDSSH'

echo "1. Creating backup directory..."
echo "========================================"
sudo mkdir -p /var/backups/postgresql
sudo chown postgres:postgres /var/backups/postgresql
echo "✓ Backup directory created"
echo ""

echo "2. Creating backup script..."
echo "========================================"
sudo tee /usr/local/bin/backup-postgres.sh > /dev/null << 'BACKUP_SCRIPT'
#!/bin/bash
# Automated PostgreSQL backup script

BACKUP_DIR="/var/backups/postgresql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE="fsvc_db"
BACKUP_FILE="${BACKUP_DIR}/${DATABASE}_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Keep backups for 30 days
RETENTION_DAYS=30

echo "$(date): Starting backup of ${DATABASE}" >> ${LOG_FILE}

# Perform backup
sudo -u postgres pg_dump ${DATABASE} | gzip > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo "$(date): Backup completed successfully: ${BACKUP_FILE}" >> ${LOG_FILE}

    # Get backup size
    BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
    echo "$(date): Backup size: ${BACKUP_SIZE}" >> ${LOG_FILE}

    # Delete old backups
    find ${BACKUP_DIR} -name "*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
    echo "$(date): Old backups removed (older than ${RETENTION_DAYS} days)" >> ${LOG_FILE}
else
    echo "$(date): ERROR: Backup failed!" >> ${LOG_FILE}
    exit 1
fi

echo "$(date): Backup process completed" >> ${LOG_FILE}
echo "----------------------------------------" >> ${LOG_FILE}
BACKUP_SCRIPT

sudo chmod +x /usr/local/bin/backup-postgres.sh
echo "✓ Backup script created"
echo ""

echo "3. Setting up daily cron job..."
echo "========================================"
# Add cron job to run daily at 2 AM
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-postgres.sh") | sudo crontab -
echo "✓ Cron job added (runs daily at 2 AM)"
echo ""

echo "4. Testing backup script..."
echo "========================================"
sudo /usr/local/bin/backup-postgres.sh
echo ""

echo "5. Verifying backup..."
echo "========================================"
ls -lh /var/backups/postgresql/
echo ""

echo "6. Checking backup log..."
echo "========================================"
tail -20 /var/backups/postgresql/backup.log

ENDSSH

echo ""
echo "=========================================="
echo "✓ Automated Backups Configured!"
echo "=========================================="
echo ""
echo "Backup Details:"
echo "- Location: /var/backups/postgresql/"
echo "- Schedule: Daily at 2 AM"
echo "- Retention: 30 days"
echo "- Format: Compressed SQL (.sql.gz)"
echo ""
echo "To restore from backup:"
echo "  gunzip < backup_file.sql.gz | psql fsvc_db"
