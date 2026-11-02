import os
import sys
import tempfile
from pathlib import Path
from corsheaders.defaults import default_headers

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

CSRF_TRUSTED_ORIGINS = [
    origin for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if origin
]

AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
]

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

CORS_ALLOW_HEADERS = list(default_headers) + ["authorization"]

# Internationalization

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media

STATIC_URL = '/static/'
STATIC_ROOT = os.getenv("STATIC_ROOT", str(BASE_DIR / "static"))

MEDIA_URL = '/media/'
MEDIA_ROOT = os.getenv("MEDIA_ROOT", str(BASE_DIR / "media"))

if 'test' in sys.argv:
    MEDIA_ROOT = os.path.join(tempfile.gettempdir(), 'eduhub-test-media')

# Security (prod)

if IS_PROD:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
X_FRAME_OPTIONS = "DENY"

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
    _default_log_dir = BASE_DIR.parent / "logs"
    _fallback_log_dir = Path(tempfile.gettempdir()) / "eduhub-logs"
    _log_dir = Path(os.getenv("DJANGO_LOG_DIR", _default_log_dir))
    _log_file = _log_dir / "django_requests.log"
    _file_handler_enabled = True

    try:
        _log_dir.mkdir(parents=True, exist_ok=True)
        with _log_file.open("a", encoding="utf-8"):
            pass
    except OSError:
        _log_dir = _fallback_log_dir
        _log_file = _log_dir / "django_requests.log"
        try:
            _log_dir.mkdir(parents=True, exist_ok=True)
            with _log_file.open("a", encoding="utf-8"):
                pass
        except OSError:
            _file_handler_enabled = False

    _handlers = {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    }
    _root_handlers = ['console']

    if _file_handler_enabled:
        _handlers['file'] = {
            'class': 'logging.FileHandler',
            'filename': str(_log_file),
            'formatter': 'verbose',
        }
        _root_handlers.append('file')

    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                'format': '[{asctime}] {levelname} {name}: {message}',
                'style': '{',
            },
        },
        'handlers': _handlers,
        'root': {
            'handlers': _root_handlers,
            'level': 'INFO',
        },
    }

# Default primary key

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
