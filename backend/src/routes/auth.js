const express = require('express');
const argon2 = require('argon2');
const rateLimit = require('express-rate-limit');
const prisma = require('../db');
const { requireAuth, validateOrigin } = require('../middleware/auth');

const router = express.Router();

// Strict rate limit for login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later' },
});

// Argon2id options (OWASP recommended minimums)
const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 64 * 1024, // 64 MB
    timeCost: 3,
    parallelism: 4,
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, validateOrigin, async (req, res) => {
    const { username, password } = req.body;

    // Generic error to prevent user enumeration
    const INVALID = { error: 'Invalid credentials' };

    if (!username || !password) return res.status(400).json(INVALID);

    try {
        const user = await prisma.user.findUnique({ where: { username } });

        // Verify password even on missing user to prevent timing-based enumeration
        const dummyHash =
            '$argon2id$v=19$m=65536,t=3,p=4$dummysaltdummysalt$dummydummydummydummydummydummyd';
        const hash = user ? user.passwordHash : dummyHash;

        let valid = false;
        try {
            valid = await argon2.verify(hash, password);
        } catch { /* invalid hash format */ }

        if (!user || !valid || !user.isActive) {
            return res.status(401).json(INVALID);
        }

        // Regenerate session to prevent session fixation
        req.session.regenerate(async (err) => {
            if (err) return res.status(500).json({ error: 'Session error' });

            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            };

            // Update last_login_at (fire and forget)
            prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            }).catch(() => { });

            res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Could not logout' });
        res.clearCookie('openmonitor.sid');
        res.json({ ok: true });
    });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
    res.json(req.user);
});

// ── PATCH /api/auth/password ──────────────────────────────────────────────────
router.patch('/password', requireAuth, validateOrigin, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    if (new_password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await argon2.verify(user.passwordHash, current_password);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        const passwordHash = await argon2.hash(new_password, ARGON2_OPTIONS);
        await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

        // Destroy all sessions to force re-login everywhere
        req.session.destroy(() => { });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── GET /api/auth/setup-needed ────────────────────────────────────────────────
// Public – returns whether the first-run setup wizard is needed
router.get('/setup-needed', async (_req, res) => {
    try {
        const count = await prisma.user.count();
        res.json({ needed: count === 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST /api/auth/setup ──────────────────────────────────────────────────────
// Creates the first admin user. Blocked once any user exists.
const setupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many setup attempts, please try again later' },
});

router.post('/setup', setupLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Username and password are required' });
    if (username.length < 3)
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters' });

    try {
        const count = await prisma.user.count();
        if (count > 0)
            return res.status(409).json({ error: 'Setup already completed. Please log in.' });

        const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
        const user = await prisma.user.create({
            data: { username, passwordHash, role: 'admin' },
        });

        console.log(`[setup] First admin user "${username}" created via setup wizard`);

        // Auto-login after setup
        req.session.regenerate((err) => {
            if (err) return res.status(500).json({ error: 'Session error' });
            req.session.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            };
            res.status(201).json({ id: user.id, username: user.username, email: user.email, role: user.role });
        });
    } catch (err) {
        if (err.code === 'P2002')
            return res.status(409).json({ error: 'Username already taken' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = { router, ARGON2_OPTIONS };
