/**
 * Rate Limiter Utility
 * Simple in-memory rate limiter to prevent form spam and API abuse.
 */

const store = new Map();

/**
 * Check if an action is within rate limits.
 * @param {string} key  - unique identifier (e.g. 'report-lost-userId')
 * @param {number} limit - max calls allowed
 * @param {number} windowMs - time window in milliseconds
 */
export const checkRateLimit = (key, limit = 5, windowMs = 60_000) => {
  const now = Date.now();
  const record = store.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    // Window expired — reset
    record.count = 1;
    record.resetAt = now + windowMs;
    store.set(key, record);
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (record.count >= limit) {
    const resetIn = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetIn, error: `Too many requests. Try again in ${resetIn}s.` };
  }

  record.count++;
  store.set(key, record);
  return { allowed: true, remaining: limit - record.count, resetIn: 0 };
};

/**
 * Debounce a function
 */
export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle a function
 */
export const throttle = (fn, limit = 500) => {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return fn(...args);
    }
  };
};
