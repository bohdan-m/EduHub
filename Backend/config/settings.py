import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Environment

ENVIRONMENT = os.getenv("ENVIRONMENT", "dev").lower()
IS_PROD = ENVIRONMENT == "prod"

# Load .env in dev only

if not IS_PROD:
    _env_file = BASE_DIR.parent / ".env"
    if _env_file.exists():
        try:
            import environ
            environ.Env().read_env(env_file=str(_env_file))
        except ImportError:
            pass

# Core security

SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-only-change-in-production"
)

DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"

ALLOWED_HOSTS = [
    h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost").split(",") if h
]

AUTH_USER_MODEL = "users.User"

# Application

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    'courses',
    'users',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',

    'config.middlewares.RequestLoggingMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

# Templates

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Database (Cloud SQL ready)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'postgres'),
        'USER': os.getenv('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'password_default'),
        'HOST': os.getenv("POSTGRES_HOST", "localhost"),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
        'CONN_MAX_AGE': 60 if IS_PROD else 0,
    }
}

# DRF

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 5,
}

# CORS

_raw_cors = os.getenv("CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = [o for o in _raw_cors.split(",") if o]

CORS_ALLOW_HEADERS = ["authorization", "content-type"]

# Internationalization

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media

STATIC_URL = '/static/'
STATIC_ROOT = os.getenv("STATIC_ROOT", BASE_DIR / "static")

MEDIA_URL = '/media/'
MEDIA_ROOT = os.getenv("MEDIA_ROOT", BASE_DIR / "media")

# Security (prod)

if IS_PROD:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Logging (Cloud Run friendly)

if IS_PROD:
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'handlers': {
            'console': {'class': 'logging.StreamHandler'},
        },
        'root': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    }
else:
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                'format': '[{asctime}] {levelname} {name}: {message}',
                'style': '{',
            },
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'formatter': 'verbose',
            },
            'file': {
                'class': 'logging.FileHandler',
                'filename': 'logs/django_requests.log',
                'formatter': 'verbose',
            },
        },
        'root': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
    }

# Default primary key

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
