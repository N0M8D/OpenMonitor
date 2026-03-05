import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, getSetupNeeded } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);      // null = not loaded yet
    const [loading, setLoading] = useState(true); // true while fetching /me
    const [setupNeeded, setSetupNeeded] = useState(false);

    // On mount, check if there's an active session; if not, check setup
    useEffect(() => {
        getMe()
            .then((u) => { setUser(u); setSetupNeeded(false); })
            .catch(async () => {
                setUser(false);
                try {
                    const { needed } = await getSetupNeeded();
                    setSetupNeeded(needed);
                } catch { /* ignore */ }
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (username, password) => {
        const me = await apiLogin(username, password);
        setUser(me);
        setSetupNeeded(false);
        return me;
    }, []);

    const logout = useCallback(async () => {
        await apiLogout();
        setUser(false);
    }, []);

    // Called by SetupPage after setup completes (already auto-logged in by backend)
    const completeSetup = useCallback((me) => {
        setUser(me);
        setSetupNeeded(false);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, setupNeeded, login, logout, completeSetup }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
