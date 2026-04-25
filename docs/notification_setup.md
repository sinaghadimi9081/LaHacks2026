# Notification System Setup & Configuration

This document provides instructions on how to manage and configure the notification system for NeighborFridge.

## Current Setup (Development)
The app is currently configured to use the **Console Email Backend**. 
- **Behavior**: All emails are printed to the terminal console where the server is running.
- **Why**: This prevents accidental spam and avoids the need for SMTP credentials during development.

## Switching to Real Email Delivery
To enable real email delivery (e.g., using Gmail or a service like SendGrid), follow these steps:

### 1. Update `backend/settings.py`
Replace the console backend with an SMTP backend:

```python
# settings.py

# Replace the existing EMAIL_BACKEND line:
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# Add your SMTP configuration:
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "your-email@gmail.com")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "your-app-password")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "NeighborFridge <noreply@neighborfridge.com>")
```

### 2. Update `.env`
It is highly recommended to store your credentials in the `.env` file rather than hardcoding them:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

## Running the Automated Expiration Check
Notifications are triggered by a management command. In production, you would schedule this to run daily (e.g., via Cron or a Celery task).

### Manual Run
```bash
python manage.py check_expirations
```

### Expiration Logic
The command checks for food items in the following states:
- **0 Days Left**: Notifies users the food expires **today**.
- **1 Day Left**: Notifies users the food expires **tomorrow**.
- **3 Days Left**: A "heads up" alert for planning.

## Extending Notifications
If you want to add new channels (like SMS or Real-time Browser Push):
1. Open `Backend/core/notifications.py`.
2. Implement the logic inside the placeholder methods:
    - `_send_push_notification()`
    - `_ping_app()`
