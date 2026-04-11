const { createClient } = require("redis");

const memoryCache = new Map();
const redisUrl = process.env.REDIS_URL;
let redisClient = null;
let redisReady = false;

if (redisUrl) {
  redisClient = createClient({ url: redisUrl });

  redisClient.on("error", (err) => {
    redisReady = false;
    console.warn("Redis connection error. Falling back to in-memory cache:", err.message);
  });

  redisClient.on("ready", () => {
    redisReady = true;
    console.log("Redis cache connected");
  });

  redisClient
    .connect()
    .catch((err) => {
      redisReady = false;
      console.warn("Redis connect failed. Falling back to in-memory cache:", err.message);
    });
} else {
  console.log("REDIS_URL not set. Using in-memory cache fallback.");
}

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const get = async (key) => {
  if (!key) return null;

  if (redisClient && redisReady) {
    try {
      const raw = await redisClient.get(key);
      return raw ? safeParse(raw) : null;
    } catch (err) {
      console.warn("Redis GET failed. Falling back to in-memory cache:", err.message);
    }
  }

  const item = memoryCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return item.payload;
};

const set = async (key, payload, ttlSeconds = 15) => {
  if (!key) return;
  const safeTtl = Math.max(1, Number(ttlSeconds) || 15);

  if (redisClient && redisReady) {
    try {
      const serialized = safeStringify(payload);
      if (!serialized) return;
      await redisClient.setEx(key, safeTtl, serialized);
      return;
    } catch (err) {
      console.warn("Redis SET failed. Falling back to in-memory cache:", err.message);
    }
  }

  memoryCache.set(key, {
    payload,
    expiresAt: Date.now() + safeTtl * 1000,
  });
};

const del = async (key) => {
  if (!key) return;

  if (redisClient && redisReady) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.warn("Redis DEL failed:", err.message);
    }
  }

  memoryCache.delete(key);
};

const delByPrefix = async (prefix) => {
  if (!prefix) return;

  if (redisClient && redisReady) {
    try {
      const keys = [];
      for await (const key of redisClient.scanIterator({ MATCH: `${prefix}*`, COUNT: 200 })) {
        keys.push(key);
      }

      if (keys.length) {
        await redisClient.del(keys);
      }
    } catch (err) {
      console.warn("Redis prefix invalidation failed:", err.message);
    }
  }

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
};

module.exports = {
  get,
  set,
  del,
  delByPrefix,
};
