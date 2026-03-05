import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../api/client.js';

const ROLES = ['admin', 'maintainer', 'user'];
const ROLE_LABELS = { admin: 'Admin', maintainer: 'Maintainer', user: 'User' };
const ROLE_COLORS = { admin: '#f59e0b', maintainer: '#6366f1', user: '#22c55e' };

function RoleBadge({ role }) {
    const color = ROLE_COLORS[role] || '#94a3b8';
    return (
        <span className="badge" style={{ background: color + '22', color, fontSize: '0.7rem', padding: '0.2em 0.6em' }}>
            {ROLE_LABELS[role] || role}
        </span>
    );
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Add user form
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState({ username: '', email: '', password: '', role: 'user' });
    const [addError, setAddError] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    // Edit modal
    const [editUser, setEditUser] = useState(null);
    const [editForm, setEditForm] = useState({ email: '', role: '', is_active: true });
    const [editError, setEditError] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    // Reset password modal
    const [resetUser, setResetUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [resetError, setResetError] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const load = async () => {
        try {
            setUsers(await getUsers());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // ── Add user ────────────────────────────────────────────────────────────────
    const handleAdd = async (e) => {
        e.preventDefault();
        setAddError('');
        setAddLoading(true);
        try {
            await createUser(addForm);
            setShowAdd(false);
            setAddForm({ username: '', email: '', password: '', role: 'user' });
            await load();
        } catch (err) {
            setAddError(err.message);
        } finally {
            setAddLoading(false);
        }
    };

    // ── Edit user ───────────────────────────────────────────────────────────────
    const openEdit = (u) => {
        setEditUser(u);
        setEditForm({ email: u.email || '', role: u.role, is_active: u.isActive });
        setEditError('');
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        setEditError('');
        setEditLoading(true);
        try {
            await updateUser(editUser.id, { email: editForm.email || null, role: editForm.role, is_active: editForm.is_active });
            setEditUser(null);
            await load();
        } catch (err) {
            setEditError(err.message);
        } finally {
            setEditLoading(false);
        }
    };

    // ── Delete user ─────────────────────────────────────────────────────────────
    const handleDelete = async (u) => {
        if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
        try {
            await deleteUser(u.id);
            await load();
        } catch (err) {
            alert(err.message);
        }
    };

    // ── Reset password ──────────────────────────────────────────────────────────
    const handleReset = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetLoading(true);
        try {
            await resetPassword(resetUser.id, newPassword);
            setResetUser(null);
            setNewPassword('');
        } catch (err) {
            setResetError(err.message);
        } finally {
            setResetLoading(false);
        }
    };

    if (loading) return <div className="page-container" style={{ color: '#64748b' }}>Loading…</div>;

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">User management</h1>
                <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add user</button>
            </div>
            {error && <p className="error-msg">{error}</p>}

            {/* ── User table ──────────────────────────────────────────────────────── */}
            <div className="section">
                <table className="data-table users-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Last login</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id}>
                                <td className="users-table-username">{u.username}</td>
                                <td className="users-table-email">{u.email || <span style={{ color: '#475569' }}>—</span>}</td>
                                <td><RoleBadge role={u.role} /></td>
                                <td>
                                    <span className="badge" style={{
                                        background: u.isActive ? '#22c55e22' : '#ef444422',
                                        color: u.isActive ? '#22c55e' : '#ef4444',
                                        fontSize: '0.7rem', padding: '0.2em 0.6em',
                                    }}>
                                        {u.isActive ? 'Active' : 'Paused'}
                                    </span>
                                </td>
                                <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                                </td>
                                <td className="users-table-actions">
                                    <button className="btn-sm btn-sm-blue" onClick={() => openEdit(u)}>Edit</button>
                                    <button className="btn-sm" style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}
                                        onClick={() => { setResetUser(u); setNewPassword(''); setResetError(''); }}>
                                        Reset pw
                                    </button>
                                    <button className="btn-sm btn-sm-red" onClick={() => handleDelete(u)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Add user modal ──────────────────────────────────────────────────── */}
            {showAdd && (
                <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
                    <div className="modal">
                        <h2 className="modal-title">Add user</h2>
                        <form onSubmit={handleAdd}>
                            <label className="form-label">Username</label>
                            <input className="form-input" required value={addForm.username}
                                onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} />
                            <label className="form-label">Email <span className="form-label-hint">(optional)</span></label>
                            <input className="form-input" type="email" value={addForm.email}
                                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
                            <label className="form-label">Password</label>
                            <input className="form-input" type="password" required minLength={8} value={addForm.password}
                                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
                            <label className="form-label">Role</label>
                            <select className="form-input" value={addForm.role}
                                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
                                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                            {addError && <p className="error-msg">{addError}</p>}
                            <div className="form-btn-row">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={addLoading}>
                                    {addLoading ? 'Adding…' : 'Add user'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit user modal ─────────────────────────────────────────────────── */}
            {editUser && (
                <div className="overlay" onClick={(e) => e.target === e.currentTarget && setEditUser(null)}>
                    <div className="modal">
                        <h2 className="modal-title">Edit — {editUser.username}</h2>
                        <form onSubmit={handleEdit}>
                            <label className="form-label">Email <span className="form-label-hint">(optional)</span></label>
                            <input className="form-input" type="email" value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                            <label className="form-label">Role</label>
                            <select className="form-input" value={editForm.role}
                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                            <label className="form-label">Status</label>
                            <div className="status-toggle-row">
                                <button type="button" className="toggle-btn" style={{
                                    background: editForm.is_active ? '#22c55e22' : '#ef444422',
                                    border: `1px solid ${editForm.is_active ? '#22c55e' : '#ef4444'}`,
                                    color: editForm.is_active ? '#22c55e' : '#ef4444',
                                }}
                                    onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}>
                                    {editForm.is_active ? 'Active – click to pause' : 'Paused – click to activate'}
                                </button>
                            </div>
                            {editError && <p className="error-msg">{editError}</p>}
                            <div className="form-btn-row">
                                <button type="button" className="btn btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                                    {editLoading ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Reset password modal ────────────────────────────────────────────── */}
            {resetUser && (
                <div className="overlay" onClick={(e) => e.target === e.currentTarget && setResetUser(null)}>
                    <div className="modal">
                        <h2 className="modal-title">Reset password — {resetUser.username}</h2>
                        <form onSubmit={handleReset}>
                            <label className="form-label">New password</label>
                            <input className="form-input" type="password" required minLength={8} value={newPassword}
                                autoFocus onChange={(e) => setNewPassword(e.target.value)} />
                            {resetError && <p className="error-msg">{resetError}</p>}
                            <div className="form-btn-row">
                                <button type="button" className="btn btn-ghost" onClick={() => setResetUser(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                                    {resetLoading ? 'Saving…' : 'Set password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
