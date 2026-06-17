import logging
import redis
import json
from app.config import settings

logger = logging.getLogger("carboeco")

class CacheService:
    _client = None
    _enabled = True

    @classmethod
    def get_client(cls):
        if cls._client is None and cls._enabled:
            try:
                # Set a strict connection and socket timeout so we don't hang if Redis is unavailable
                cls._client = redis.from_url(
                    settings.REDIS_URL, 
                    socket_timeout=2.0, 
                    socket_connect_timeout=2.0,
                    decode_responses=True
                )
                cls._client.ping()
                logger.info("Successfully connected to Redis cache.")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis at {settings.REDIS_URL}. Falling back to disabled cache: {e}")
                cls._client = None
                cls._enabled = False
        return cls._client

    @classmethod
    def get(cls, key: str):
        client = cls.get_client()
        if not client:
            return None
        try:
            val = client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get failed for key {key}: {e}")
            # If Redis connection drops, disable cache to prevent subsequent hangs
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                cls._client = None
                cls._enabled = False
        return None

    @classmethod
    def set(cls, key: str, value: any, expire: int = 300):
        client = cls.get_client()
        if not client:
            return False
        try:
            client.set(key, json.dumps(value), ex=expire)
            return True
        except Exception as e:
            logger.warning(f"Redis set failed for key {key}: {e}")
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                cls._client = None
                cls._enabled = False
            return False

    @classmethod
    def invalidate(cls, key: str):
        client = cls.get_client()
        if not client:
            return False
        try:
            client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis delete failed for key {key}: {e}")
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                cls._client = None
                cls._enabled = False
            return False

    @classmethod
    def invalidate_pattern(cls, pattern: str):
        client = cls.get_client()
        if not client:
            return False
        try:
            keys = client.keys(pattern)
            if keys:
                client.delete(*keys)
            return True
        except Exception as e:
            logger.warning(f"Redis delete pattern {pattern} failed: {e}")
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                cls._client = None
                cls._enabled = False
            return False
