/**
 * Sliding Window Rate Limiter Middleware
 * Protects AI Chat endpoints against token exhaustion and spam abuse.
 */
export class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'client';
      const now = Date.now();

      if (!this.requests.has(clientIp)) {
        this.requests.set(clientIp, []);
      }

      const timestamps = this.requests.get(clientIp);
      // Filter timestamps inside current window
      const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

      if (validTimestamps.length >= this.maxRequests) {
        return res.status(429).json({
          success: false,
          error: `Rate limit exceeded: Maximum ${this.maxRequests} requests per minute allowed. Please wait before retrying.`
        });
      }

      validTimestamps.push(now);
      this.requests.set(clientIp, validTimestamps);
      next();
    };
  }
}

export const chatRateLimiter = new RateLimiter(60000, 30);
