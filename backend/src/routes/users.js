const express = require('express');
const argon2 = require('argon2');
const prisma = require('../db');
const { requireAuth, requireAdmin, validateOrigin } = require('../middleware/auth');
const { ARGON2_OPTIONS } = require('./auth');

const router = express.Router();

// All /api/users routes require auth
router.use(requireAuth);

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true, username: true, email: true, role: true,
                isActive: true, createdAt: true, lastLoginAt: true,
                createdById: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/', requireAdmin, validateOrigin, async (req, res) => {
    const { username, email, password, role = 'user' } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }
    if (!['admin', 'maintainer', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    try {
        const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
        const user = await prisma.user.create({
            data: {
                username,
                email: email || null,
                passwordHash,
                role,
                createdById: req.user.id,
            },
            select: {
                id: true, username: true, email: true, role: true,
                isActive: true, createdAt: true,
            },
        });
        res.status(201).json(user);
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
router.patch('/:id', requireAdmin, validateOrigin, async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    const { email, role, is_active } = req.body;

    // Admin cannot demote/deactivate themselves
    if (targetId === req.user.id) {
        if (role && role !== 'admin') {
            return res.status(400).json({ error: 'Admins cannot change their own role' });
        }
        if (is_active === false) {
            return res.status(400).json({ error: 'Admins cannot deactivate their own account' });
        }
    }

    if (role && !['admin', 'maintainer', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    const data = {};
    if (email !== undefined) data.email = email || null;
    if (role !== undefined) data.role = role;
    if (is_active !== undefined) data.isActive = is_active;

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    try {
        const user = await prisma.user.update({
            where: { id: targetId },
            data,
            select: {
                id: true, username: true, email: true, role: true,
                isActive: true, createdAt: true, lastLoginAt: true,
            },
        });
        res.json(user);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', requireAdmin, validateOrigin, async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) {
        return res.status(400).json({ error: 'Admins cannot delete their own account' });
    }
    try {
        await prisma.user.delete({ where: { id: targetId } });
        res.json({ ok: true });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── POST /api/users/:id/reset-password ────────────────────────────────────────
router.post('/:id/reset-password', requireAdmin, validateOrigin, async (req, res) => {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
        return res.status(400).json({ error: 'new_password must be at least 8 characters' });
    }
    try {
        const passwordHash = await argon2.hash(new_password, ARGON2_OPTIONS);
        await prisma.user.update({
            where: { id: parseInt(req.params.id, 10) },
            data: { passwordHash },
        });
        res.json({ ok: true });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
