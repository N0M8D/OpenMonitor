import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { setupAdmin } from '../api/client.js';

export default function SetupPage() {
    const { user, loading, setupNeeded, completeSetup } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (loading) return null;
    // Already logged in or setup done → go to dashboard
    if (user) return <Navigate to="/" replace />;
    if (!setupNeeded) return <Navigate to="/login" replace />;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (username.length < 3)
            return setError('Username must be at least 3 characters.');
        if (password.length < 8)
            return setError('Password must be at least 8 characters.');
        if (password !== confirmPassword)
            return setError('Passwords do not match.');

        setSubmitting(true);
        try {
            const me = await setupAdmin(username, password);
            completeSetup(me);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message || 'Setup failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card setup-card">
                <div className="login-logo">
                    <span className="login-logo-icon">⬡</span>
                    <span className="login-logo-text">OpenMonitor</span>
                </div>
                <h1 className="login-title">Welcome to OpenMonitor</h1>
                <p className="setup-subtitle">
                    No accounts exist yet. Create the first administrator account to get started.
                </p>
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label className="form-label">Admin username</label>
                        <input
                            className="form-input"
                            type="text"
                            autoComplete="username"
                            value={username}
                            required
                            autoFocus
                            minLength={3}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="form-input"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            required
                            minLength={8}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm password</label>
                        <input
                            className="form-input"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            required
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                    {error && <p className="error-msg">{error}</p>}
                    <button className="btn btn-primary login-btn" type="submit" disabled={submitting}>
                        {submitting ? 'Creating account…' : 'Create admin account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
