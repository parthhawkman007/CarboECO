import logging
import redis.asyncio as redis
import json
from app.config import settings

logger = logging.getLogger("carboeco")

class CacheService:
    _client = None
    _enabled = True
    _last_fail_time = 0.0
    COOLDOWN_PERIOD = 30.0

    @classmethod
    async def get_client(cls):
        import time
        # If disabled, check if cooldown period has passed to retry connection
        if not cls._enabled:
            if time.time() - cls._last_fail_time > cls.COOLDOWN_PERIOD:
                cls._enabled = True
                logger.info("Redis cache cooldown expired. Attempting to reconnect...")

        if cls._client is None and cls._enabled:
            try:
                # Set a strict connection and socket timeout so we don't hang if Redis is unavailable
                cls._client = redis.from_url(
                    settings.REDIS_URL, 
                    socket_timeout=2.0, 
                    socket_connect_timeout=2.0,
                    decode_responses=True
                )
                await cls._client.ping()
                logger.info("Successfully connected to Redis cache (Async).")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis at {settings.REDIS_URL}. Falling back to disabled cache: {e}")
                cls._client = None
                cls._enabled = False
                cls._last_fail_time = time.time()
        return cls._client

    @classmethod
    async def get(cls, key: str):
        client = await cls.get_client()
        if not client:
            return None
        try:
            val = await client.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get failed for key {key}: {e}")
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                import time
                cls._client = None
                cls._enabled = False
                cls._last_fail_time = time.time()
        return None

    @classmethod
    async def set(cls, key: str, value: any, expire: int = 300):
        client = await cls.get_client()
        if not client:
            return False
        try:
            await client.set(key, json.dumps(value), ex=expire)
            return True
        except Exception as e:
            logger.warning(f"Redis set failed for key {key}: {e}")
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                import time
                cls._client = None
                cls._enabled = False
                cls._last_fail_time = time.time()
            return False

    @classmethod
    async def invalidate(cls, key: str):
        client = await cls.get_client()
        if not client:
            return False
        try:
            await client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis delete failed for key {key}: {e}")
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                import time
                cls._client = None
                cls._enabled = False
                cls._last_fail_time = time.time()
            return False

    @classmethod
    async def invalidate_pattern(cls, pattern: str):
        client = await cls.get_client()
        if not client:
            return False
        try:
            keys = []
            async for key in client.scan_iter(match=pattern):
                keys.append(key)
            if keys:
                await client.delete(*keys)
            return True
        except Exception as e:
            logger.warning(f"Redis delete pattern {pattern} failed: {e}")
            if isinstance(e, (redis.ConnectionError, redis.TimeoutError)):
                import time
                cls._client = None
                cls._enabled = False
                cls._last_fail_time = time.time()
            return False
