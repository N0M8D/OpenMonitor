import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword } from '../api/client.js';

const ROLE_LABELS = { admin: 'Admin', maintainer: 'Maintainer', user: 'User' };

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [showChangePwd, setShowChangePwd] = useState(false);
    const [cpCurrent, setCpCurrent] = useState('');
    const [cpNew, setCpNew] = useState('');
    const [cpConfirm, setCpConfirm] = useState('');
    const [cpError, setCpError] = useState('');
    const [cpLoading, setCpLoading] = useState(false);
    const [cpSuccess, setCpSuccess] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const openChangePwd = () => {
        setCpCurrent(''); setCpNew(''); setCpConfirm('');
        setCpError(''); setCpSuccess(false);
        setShowChangePwd(true);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (cpNew !== cpConfirm) {
            setCpError('New passwords do not match');
            return;
        }
        if (cpNew.length < 8) {
            setCpError('New password must be at least 8 characters');
            return;
        }
        setCpError('');
        setCpLoading(true);
        try {
            await changePassword(cpCurrent, cpNew);
            setCpSuccess(true);
            setTimeout(() => {
                setShowChangePwd(false);
                setCpSuccess(false);
            }, 1500);
        } catch (err) {
            setCpError(err.message);
        } finally {
            setCpLoading(false);
        }
    };

    if (!user) return null;

    return (
        <>
            <nav className="navbar">
                <Link to="/" className="navbar-brand">
                    <span className="navbar-brand-icon">⬡</span>
                    OpenMonitor
                </Link>
                <div className="navbar-right">
                    {user.role === 'admin' && (
                        <Link to="/admin/users" className="navbar-link">Users</Link>
                    )}
                    <span className="navbar-user">
                        <span className="navbar-username">{user.username}</span>
                        <span className="navbar-role">{ROLE_LABELS[user.role] || user.role}</span>
                    </span>
                    <button className="navbar-change-pwd" onClick={openChangePwd}>Change password</button>
                    <button className="navbar-logout" onClick={handleLogout}>Sign out</button>
                </div>
            </nav>

            {showChangePwd && (
                <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowChangePwd(false)}>
                    <div className="modal">
                        <h2 className="modal-title">Change Password</h2>
                        {cpSuccess ? (
                            <p style={{ color: '#22c55e', textAlign: 'center', padding: '1rem 0' }}>✓ Password changed successfully</p>
                        ) : (
                            <form onSubmit={handleChangePassword}>
                                <div className="form-group">
                                    <label className="form-label">Current password</label>
                                    <input
                                        className="form-input" type="password" required
                                        value={cpCurrent} onChange={(e) => setCpCurrent(e.target.value)}
                                        autoComplete="current-password"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">New password</label>
                                    <input
                                        className="form-input" type="password" required
                                        value={cpNew} onChange={(e) => setCpNew(e.target.value)}
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirm new password</label>
                                    <input
                                        className="form-input" type="password" required
                                        value={cpConfirm} onChange={(e) => setCpConfirm(e.target.value)}
                                        autoComplete="new-password"
                                    />
                                </div>
                                {cpError && <p className="error-msg">{cpError}</p>}
                                <div className="form-btn-row">
                                    <button type="button" className="btn btn-ghost" onClick={() => setShowChangePwd(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={cpLoading}>
                                        {cpLoading ? 'Saving…' : 'Change Password'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
