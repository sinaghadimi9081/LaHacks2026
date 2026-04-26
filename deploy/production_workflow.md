# NeighborFridge Production Workflow

This project should deploy from the `production` branch only. The EC2 server should pull from GitHub, rebuild the frontend, reinstall backend dependencies, run migrations, and restart services. Production-only config stays on the server and is never committed to git.

## Server Layout

- `/srv/neighborfridge/app/LaHacks2026`: git checkout of the repo
- `/srv/neighborfridge/shared/backend.env`: Django production env file
- `/srv/neighborfridge/shared/frontend-dist/`: built React assets served by nginx
- `/srv/neighborfridge/bin/deploy_neighborfridge.sh`: server-local deploy script

## Branch Rules

- Develop on feature branches or `main`
- Merge tested changes into `production`
- Do not edit Django or React source directly on EC2
- Keep nginx config, systemd service files, `.env`, logs, and media as server-managed state

## Deploy Flow

1. Push the latest code to `origin/production`
2. SSH to EC2
3. Run `/srv/neighborfridge/bin/deploy_neighborfridge.sh`
4. Verify:
   - `systemctl status neighborfridge-gunicorn`
   - `curl http://127.0.0.1:8000/api/auth/csrf/`
   - `sudo nginx -t`

## Frontend Production Build

- The frontend should build with `VITE_API_BASE_URL=/api`
- nginx should serve the built React app and proxy `/api` and `/media` to Gunicorn/Django
- BrowserRouter routes should use `try_files ... /index.html`

## Backend Production Env

Use [`Backend/.env.production.example`](../Backend/.env.production.example) as the starting point for `/srv/neighborfridge/shared/backend.env`.

## HTTPS / DNS

- Point the GoDaddy A record to the EC2 Elastic IP
- Point the `www` CNAME to the apex domain
- Issue HTTPS certs after nginx is serving the site on port 80
