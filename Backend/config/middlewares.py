import time
import logging
from django.db import connection
from datetime import datetime

logger = logging.getLogger(__name__)

class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()

        user = getattr(request.user, 'username', 'Anonymous')
        logger.info(f"[{datetime.now()}] {request.method} {request.path} by {user}")

        response = self.get_response(request)

        duration = time.time() - start_time
        num_queries = len(connection.queries)
        logger.info(f"SQL queries: {num_queries}")
        logger.info(f"Status: {response.status_code}")
        logger.info(f"Duration: {duration:.3f}s")

        return response
