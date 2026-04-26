import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

def env_flag(name, default=False):
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "neighborfridge-local-dev-secret-key-change-me-12345",
)
DEBUG = env_flag("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")
CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173",
    # "http://127.0.0.1:5174,http://localhost:5174",
)
CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173",
    # "http://127.0.0.1:5174,http://localhost:5174",
)
CORS_ALLOW_CREDENTIALS = True
AUTH_COOKIE_ACCESS = "neighborfridge_access"
AUTH_COOKIE_REFRESH = "neighborfridge_refresh"
AUTH_COOKIE_SECURE = env_flag("DJANGO_COOKIE_SECURE", False)
AUTH_COOKIE_SAMESITE = os.getenv("DJANGO_COOKIE_SAMESITE", "Lax")
AUTH_COOKIE_DOMAIN = os.getenv("DJANGO_COOKIE_DOMAIN") or None


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "core",
    "posts.apps.PostsConfig",
    "receipts.apps.ReceiptsConfig",
    "rest_framework_simplejwt.token_blacklist",
    "users",
    "households",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "America/Los_Angeles")

USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Email Configuration
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = env_flag("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_flag("EMAIL_USE_SSL", False)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", 10))
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "NeighborFridge <noreply@neighborfridge.com>")

AUTH_USER_MODEL = "users.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "users.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

RECEIPT_PROCESSING_PROVIDER = os.getenv("RECEIPT_PROCESSING_PROVIDER", "auto")
VERYFI_API_URL = os.getenv("VERYFI_API_URL", "https://api.veryfi.com")
VERYFI_CLIENT_ID = os.getenv("VERYFI_CLIENT_ID", "")
VERYFI_CLIENT_SECRET = os.getenv("VERYFI_CLIENT_SECRET", "")
VERYFI_USERNAME = os.getenv("VERYFI_USERNAME", "")
VERYFI_API_KEY = os.getenv("VERYFI_API_KEY", "")
VERYFI_AUTO_DELETE = env_flag("VERYFI_AUTO_DELETE", True)
VERYFI_COMPUTE = env_flag("VERYFI_COMPUTE", True)

NOMINATIM_BASE_URL = os.getenv("NOMINATIM_BASE_URL", "https://nominatim.openstreetmap.org")
NOMINATIM_EMAIL = os.getenv("NOMINATIM_EMAIL", "")
NOMINATIM_USER_AGENT = os.getenv(
    "NOMINATIM_USER_AGENT",
    "NeighborFridge/1.0 (hackathon-app; contact via project maintainer)",
)
