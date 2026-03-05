import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Wraps routes that require authentication.
 * If setup is needed → redirect to /setup.
 * If not authenticated → redirect to /login.
 * If requiredRole is set and doesn't match → redirect to /.
 */
export default function ProtectedRoute({ children, requiredRole }) {
    const { user, loading, setupNeeded } = useAuth();

    if (loading) {
        return (
            <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem', color: '#64748b' }}>
                Loading…
            </div>
        );
    }

    if (setupNeeded) {
        return <Navigate to="/setup" replace />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/" replace />;
    }

    return children;
}
