# Production Deployment Guide

## Prerequisites

Before deploying to production, ensure:
- All features tested in staging environment
- Security review completed (see `tests/security/isolation.checklist.md`)
- Legal documents reviewed (see `docs/legal/`)
- Database backup and restore procedures tested (see `tests/restore/restore-drill.mjs`)
- Performance benchmarks established (see `tests/performance/smoke.mjs`)

---

## Infrastructure Requirements

### Compute
- **API Server:** 2+ CPU cores, 4GB+ RAM, Node.js 22+
- **Web Server:** Nginx or similar for static file serving
- **Database:** PostgreSQL 17+, 2+ CPU cores, 8GB+ RAM
- **Redis:** 1+ CPU cores, 2GB+ RAM
- **Storage:** SeaweedFS or S3-compatible storage, 100GB+ initially
- **ClamAV:** 2+ CPU cores, 4GB+ RAM (virus definitions ~1GB)

### Network
- HTTPS with valid TLS certificate (Let's Encrypt or commercial CA)
- DNS records configured
- Reverse proxy (Nginx/Caddy/Traefik) for API and Web
- Firewall rules (allow only 80/443 inbound)

---

## Deployment Steps

### 1. Prepare Environment Variables

Create `.env.production` file:

```bash
# Database
DATABASE_URL=postgresql://app_user:<password>@<host>:5432/work_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong_password>
POSTGRES_DB=work_db
APP_DATABASE_PASSWORD=<app_user_password>

# Redis
REDIS_URL=redis://:<password>@<host>:6379
REDIS_PASSWORD=<redis_password>

# Storage (S3-compatible)
S3_ENDPOINT=https://storage.example.com
S3_ACCESS_KEY=<access_key>
S3_SECRET_KEY=<secret_key>
S3_BUCKET=work-management-files
S3_REGION=us-east-1

# Application
WEB_ORIGIN=https://app.example.com
DEPLOYMENT_ENV=production
NODE_ENV=production

# Security
AI_CREDENTIAL_KEY=<64-hex-chars>
MFA_CREDENTIAL_KEY=<64-hex-chars>  # Optional, falls back to AI_CREDENTIAL_KEY
SESSION_SECRET=<random-secret>

# Email (SMTP)
MAIL_FROM=noreply@example.com
MAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp_username>
SMTP_PASSWORD=<smtp_password>

# Optional: Notification Channels
SMS_PROVIDER_URL=https://sms-api.example.com
WHATSAPP_PROVIDER_URL=https://whatsapp-api.example.com
VAPID_PUBLIC_KEY=<base64_public_key>
VAPID_PRIVATE_KEY=<base64_private_key>

# ClamAV
CLAMAV_HOST=clamav
CLAMAV_PORT=3310

# Monitoring (optional)
SENTRY_DSN=<sentry_dsn>
```

### 2. Deploy with Docker Compose

Using `infrastructure/deployment/compose.production.yaml`:

```bash
# Clone repository
git clone <repository_url> work-management
cd work-management

# Copy environment file
cp .env.production infrastructure/deployment/.env

# Start services
cd infrastructure/deployment
docker compose -f compose.production.yaml up -d

# Check status
docker compose -f compose.production.yaml ps

# View logs
docker compose -f compose.production.yaml logs -f api
```

### 3. Run Database Migrations

```bash
# Run migrations (automatic on first API startup, or manually):
docker compose -f compose.production.yaml exec api npm run migrate

# Create initial platform admin
docker compose -f compose.production.yaml exec api npm run seed:admin
# Follow prompts to set email and password
```

### 4. Configure Reverse Proxy (Nginx Example)

Create `/etc/nginx/sites-available/work-management`:

```nginx
upstream api {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name app.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # API routes
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        client_max_body_size 100M;
    }

    # Web app (static files from web container)
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/work-management /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 5. SSL Certificate Setup

Using Certbot (Let's Encrypt):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d app.example.com
sudo certbot renew --dry-run  # Test auto-renewal
```

### 6. Verify Deployment

```bash
# Check health endpoint
curl https://app.example.com/api/v1/health/live

# Run smoke test
node tests/performance/smoke.mjs https://app.example.com 10 5

# Check logs for errors
docker compose -f compose.production.yaml logs api | grep ERROR
```

---

## Post-Deployment Configuration

### 1. Platform Settings

Login to platform admin panel at `https://app.example.com/platform`:

- Set platform name and support email
- Configure session timeout
- Enable/disable public pages
- Set maintenance mode if needed

### 2. Billing Configuration

If using billing features:
- Configure free and trial plans
- Set payment instructions for manual payments
- Create initial billing coupons (optional)

### 3. AI Configuration (Optional)

If using AI features:
- Add AI provider credentials via platform admin
- Activate preferred models
- Set monthly budget limits

### 4. Monitoring and Alerts

Set up monitoring for:
- API response times (target: p95 < 500ms)
- Error rates (target: < 1%)
- Database connection pool utilization
- Redis memory usage
- Storage capacity
- ClamAV virus definitions update status

Recommended tools:
- **Application:** Sentry, New Relic, or Datadog
- **Infrastructure:** Prometheus + Grafana
- **Logs:** ELK stack or Loki

### 5. Backups

Automated daily backups (see `tests/restore/restore-drill.mjs`):

```bash
# Setup cron job for PostgreSQL backups
0 3 * * * /usr/bin/pg_dump -h localhost -U app_user work_db | gzip > /backups/$(date +\%Y\%m\%d).sql.gz

# Retention: keep 30 days
0 4 * * * find /backups -name "*.sql.gz" -mtime +30 -delete
```

Storage backups:
- Configure S3 bucket versioning
- Enable lifecycle policies to transition old versions to Glacier

---

## Scaling Considerations

### Horizontal Scaling
- Run multiple API instances behind load balancer
- Use sticky sessions or shared Redis for session storage
- Database read replicas for read-heavy workloads

### Vertical Scaling
- Increase database resources as data grows
- Add Redis memory for larger session/cache workloads
- Scale ClamAV instances if file uploads are high volume

### Performance Tuning
- Enable PostgreSQL query caching
- Implement CDN for static assets
- Use Redis for frequently accessed data
- Optimize database indexes (monitor slow query log)

---

## Security Hardening

### Application
- Enable MFA for all admin accounts
- Regularly rotate encryption keys
- Review audit logs weekly
- Keep dependencies up to date

### Infrastructure
- Enable firewall (UFW/iptables)
- Disable password SSH (use keys only)
- Set up fail2ban for brute force protection
- Regular security patches for OS and Docker

### Compliance
- Conduct annual security audit
- Review and update legal documents annually
- Train team on data protection policies
- Maintain incident response plan

---

## Maintenance Procedures

### Applying Updates
```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose -f compose.production.yaml build

# Run new migrations (if any)
docker compose -f compose.production.yaml exec api npm run migrate

# Restart services with zero-downtime (if using multiple instances)
docker compose -f compose.production.yaml up -d api

# Verify health
curl https://app.example.com/api/v1/health/live
```

### Rollback Procedure
```bash
# Revert to previous version
git checkout <previous_commit>
docker compose -f compose.production.yaml build
docker compose -f compose.production.yaml up -d api

# Rollback migrations (if necessary, rare)
docker compose -f compose.production.yaml exec api npm run migrate:rollback
```

---

## Troubleshooting

### API Not Responding
```bash
# Check container status
docker compose ps

# View logs
docker compose logs api

# Check database connection
docker compose exec api psql $DATABASE_URL -c "SELECT 1"

# Check Redis connection
docker compose exec api redis-cli -u $REDIS_URL ping
```

### High Memory Usage
- ClamAV requires ~2GB RAM; ensure adequate resources
- Check for memory leaks in API (Node.js heap snapshots)
- Scale up instance or add swap

### Slow Queries
```bash
# Enable slow query log in PostgreSQL
ALTER DATABASE work_db SET log_min_duration_statement = 1000;

# View slow queries
docker compose exec postgres tail -f /var/lib/postgresql/data/log/postgresql.log | grep duration
```

---

## Contact and Support

For production issues:
- **Email:** [SUPPORT EMAIL]
- **On-call:** [PAGERDUTY/OPSGENIE LINK]

---

**Last Updated:** [DATE]
