import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = { admin: 'Admin', maintainer: 'Maintainer', user: 'User' };

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    if (!user) return null;

    return (
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
                <button className="navbar-logout" onClick={handleLogout}>Sign out</button>
            </div>
        </nav>
    );
}
