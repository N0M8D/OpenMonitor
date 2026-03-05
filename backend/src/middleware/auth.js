/**
 * requireAuth – middleware that rejects unauthenticated requests.
 * Attaches req.user = { id, username, email, role } from the session.
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = req.session.user;
    next();
}

/**
 * requireRole(...roles) – middleware factory.
 * Must be used AFTER requireAuth.
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

const requireAdmin = requireRole('admin');
const requireMaintainer = requireRole('admin', 'maintainer');

/**
 * Validate that the request Origin matches the server host.
 * Protects state-changing endpoints against CSRF.
 * Only enforced in production (NODE_ENV === 'production') or when
 * CSRF_STRICT env var is set to 'true'.
 */
function validateOrigin(req, res, next) {
    const enforce = process.env.NODE_ENV === 'production' || process.env.CSRF_STRICT === 'true';
    if (!enforce) return next();

    const origin = req.headers['origin'] || '';
    const host = req.headers['host'] || '';
    try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
            return res.status(403).json({ error: 'Invalid request origin' });
        }
    } catch {
        return res.status(403).json({ error: 'Missing or invalid Origin header' });
    }
    next();
}

module.exports = { requireAuth, requireRole, requireAdmin, requireMaintainer, validateOrigin };
