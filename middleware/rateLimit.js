


// === Rate Limiter Configuration ===
// Per-route and per-user/IP config (can be extended)
const DEFAULT_LIMIT = 20; // max requests
const DEFAULT_WINDOW_MS = 1000; // 1 second
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute
const MAX_KEYS = 5000; // Prevent key explosion

// Per-route config example (extend as needed)
const routeConfigs = {
	'/api/employees': { limit: 1, windowMs: 1000 },
	// Add more routes here
};

// In-memory store: { key: [timestamps] }
const store = new Map();

// Cleanup timer
setInterval(() => {
	const now = Date.now();
	for (const [key, arr] of store) {
		// Remove keys with no recent activity
		if (!arr.length || now - arr[arr.length - 1] > 2 * DEFAULT_WINDOW_MS) {
			store.delete(key);
		}
	}
	// Prevent key explosion
	if (store.size > MAX_KEYS) {
		// Remove oldest keys
		const keys = Array.from(store.keys());
		for (let i = 0; i < store.size - MAX_KEYS; i++) {
			store.delete(keys[i]);
		}
	}
}, CLEANUP_INTERVAL_MS);

// Helper: get user key (user id if available, else IP)
function getUserKey(req) {
	try {
		if (req.user && typeof req.user === 'object' && req.user.id) {
			return `user:${req.user.id}`;
		}
		// Use req.ip, not headers, to avoid spoofing
		if (typeof req.ip === 'string' && req.ip) {
			return `ip:${req.ip}`;
		}
		// Fallback: random bucket (very rare)
		return `anon:${Math.random().toString(36).slice(2)}`;
	} catch (e) {
		return 'unknown';
	}
}

// Helper: get route config
function getRouteConfig(req) {
	// Match by baseUrl or originalUrl (Express)
	const path = req.baseUrl || req.originalUrl || '';
	for (const route in routeConfigs) {
		if (path.startsWith(route)) return routeConfigs[route];
	}
	return { limit: DEFAULT_LIMIT, windowMs: DEFAULT_WINDOW_MS };
}

// Sliding window rate limiter middleware
module.exports = function rateLimit(req, res, next) {
	try {
		const { limit, windowMs } = getRouteConfig(req);
		const key = getUserKey(req);
		const now = Date.now();
		let timestamps = store.get(key) || [];
		// Remove timestamps outside the window
		timestamps = timestamps.filter(ts => now - ts < windowMs);
		if (timestamps.length >= limit) {
			// Calculate retry-after
			const retryAfter = Math.ceil((windowMs - (now - timestamps[0])) / 1000);
			// Set rate limit headers
			res.set('X-RateLimit-Limit', limit);
			res.set('X-RateLimit-Remaining', 0);
			res.set('X-RateLimit-Reset', Math.ceil((timestamps[0] + windowMs) / 1000));
			res.set('Retry-After', retryAfter);
			return res.status(429).json({
				message: `Too many requests. Limit is ${limit} per ${windowMs / 1000} second(s).`,
				retryAfter,
			});
		}
		timestamps.push(now);
		store.set(key, timestamps);
		// Set rate limit headers
		res.set('X-RateLimit-Limit', limit);
		res.set('X-RateLimit-Remaining', Math.max(0, limit - timestamps.length));
		res.set('X-RateLimit-Reset', Math.ceil((timestamps[0] + windowMs) / 1000));
		next();
	} catch (err) {
		// Fail open: allow request but log error
		console.error('Rate limiter error:', err);
		next();
	}
};
