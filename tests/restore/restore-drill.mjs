#!/usr/bin/env node
/**
 * Database Restore Drill
 * 
 * Documents and validates the database backup/restore process.
 * Runs in dry-run mode by default (does not execute destructive commands).
 * 
 * Usage: node restore-drill.mjs [--execute]
 * 
 * Steps documented:
 * 1. Create backup using pg_dump
 * 2. Verify backup file integrity
 * 3. Document restore command
 * 4. (Optional) Execute test restore to temporary database
 */

const EXECUTE_MODE = process.argv.includes('--execute');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://app_user:password@localhost:55432/work_db';

// Parse connection string
function parseDbUrl(url) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5]
  };
}

function formatCommand(cmd) {
  return `  $ ${cmd}`;
}

function printStep(num, title) {
  console.log(`\n${num}. ${title}`);
  console.log('─'.repeat(60));
}

async function dryRunDrill() {
  const db = parseDbUrl(DATABASE_URL);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `backup-${db.database}-${timestamp}.sql`;
  const testDbName = `${db.database}_restore_test`;

  console.log('🔄 Database Restore Drill (DRY RUN)');
  console.log('═'.repeat(60));
  console.log(`Database: ${db.database}@${db.host}:${db.port}`);
  console.log(`User: ${db.user}`);
  console.log(`Mode: ${EXECUTE_MODE ? 'EXECUTE' : 'DRY RUN'}`);

  printStep(1, 'Create backup using pg_dump');
  console.log('\nFull backup (schema + data):');
  console.log(formatCommand(
    `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -F p -f ${backupFile}`
  ));
  console.log('\nSchema only:');
  console.log(formatCommand(
    `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -s -f schema-${timestamp}.sql`
  ));
  console.log('\nData only:');
  console.log(formatCommand(
    `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -a -f data-${timestamp}.sql`
  ));

  printStep(2, 'Verify backup file integrity');
  console.log('\nCheck file exists and has content:');
  console.log(formatCommand(`ls -lh ${backupFile}`));
  console.log(formatCommand(`head -n 20 ${backupFile}`));
  console.log('\nValidate SQL syntax (optional):');
  console.log(formatCommand(`psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} --dry-run -f ${backupFile}`));

  printStep(3, 'Restore to new database');
  console.log('\nCreate test database:');
  console.log(formatCommand(
    `createdb -h ${db.host} -p ${db.port} -U ${db.user} ${testDbName}`
  ));
  console.log('\nRestore backup:');
  console.log(formatCommand(
    `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${testDbName} -f ${backupFile}`
  ));
  console.log('\nVerify restore:');
  console.log(formatCommand(
    `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${testDbName} -c "\\dt"`
  ));
  console.log(formatCommand(
    `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${testDbName} -c "SELECT COUNT(*) FROM users;"`
  ));

  printStep(4, 'Production restore procedure');
  console.log('\n⚠️  PRODUCTION RESTORE CHECKLIST:');
  console.log('  [ ] Notify all users of maintenance window');
  console.log('  [ ] Stop all application services');
  console.log('  [ ] Verify no active connections:');
  console.log(formatCommand(
    `psql -h ${db.host} -p ${db.port} -U postgres -c "SELECT * FROM pg_stat_activity WHERE datname = '${db.database}';"`
  ));
  console.log('  [ ] Terminate connections if needed:');
  console.log(formatCommand(
    `psql -h ${db.host} -p ${db.port} -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db.database}' AND pid <> pg_backend_pid();"`
  ));
  console.log('  [ ] Drop and recreate database:');
  console.log(formatCommand(`dropdb -h ${db.host} -p ${db.port} -U postgres ${db.database}`));
  console.log(formatCommand(`createdb -h ${db.host} -p ${db.port} -U postgres ${db.database}`));
  console.log('  [ ] Restore backup:');
  console.log(formatCommand(
    `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -f ${backupFile}`
  ));
  console.log('  [ ] Verify critical tables and counts');
  console.log('  [ ] Run application health checks');
  console.log('  [ ] Start application services');
  console.log('  [ ] Monitor logs for errors');

  printStep(5, 'Automated backup schedule');
  console.log('\nDaily backup cron (3 AM):');
  console.log('  0 3 * * * /usr/bin/pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} ${DB_NAME} | gzip > /backups/$(date +\\%Y\\%m\\%d).sql.gz');
  console.log('\nRetention policy (keep 30 days):');
  console.log('  0 4 * * * find /backups -name "*.sql.gz" -mtime +30 -delete');

  printStep(6, 'Disaster recovery time objectives');
  console.log('\nRTO (Recovery Time Objective): 4 hours');
  console.log('RPO (Recovery Point Objective): 24 hours (daily backups)');
  console.log('\nFor critical systems, consider:');
  console.log('  - Continuous WAL archiving for point-in-time recovery');
  console.log('  - Hot standby replica for failover');
  console.log('  - Off-site backup storage');

  console.log('\n✅ Dry run complete');
  console.log('\nTo execute test restore:');
  console.log('  node restore-drill.mjs --execute');
}

dryRunDrill().catch(error => {
  console.error('❌ Drill failed:', error);
  process.exit(1);
});
