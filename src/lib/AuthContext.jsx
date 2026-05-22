import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api } from '@/api/client';
import { appParams } from '@/lib/app-params';
import { http } from '@/api/http';
import { LOCAL_DEV_USER } from '@/lib/localUser';
import LocalLoginPage from '@/lib/LocalLoginPage';
import { clearAppSessionCaches } from '@/lib/sessionCache';

const AuthContext = createContext();

function readOAuthCallbackToken() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  const authError = params.get('auth_error');

  if (token) {
    try {
      localStorage.setItem('mpb_access_token', token);
      clearAppSessionCaches();
    } catch {
      /* ignore */
    }
    params.delete('auth_token');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    return { token, authError: null };
  }

  return { token: null, authError };
}

const LOGOUT_FLAG = 'mpb_logged_out';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [loggedOut, setLoggedOut] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(LOGOUT_FLAG) === '1'
  );

  const authRequired =
    appPublicSettings?.public_settings?.auth_required ??
    appPublicSettings?.public_settings?.google_login_enabled ??
    false;

  /** Build-time flag (Vercel: set VITE_GOOGLE_OAUTH_CLIENT_ID in env for production build) */
  const googleFromBuild = Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID);

  const googleEnabled =
    appPublicSettings?.public_settings?.google_login_enabled ?? googleFromBuild;

  const applyLocalUser = useCallback((currentUser = LOCAL_DEV_USER) => {
    setUser(currentUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('mpb_access_token', 'local-dev');
    } catch {
      /* ignore */
    }
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('mpb_access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('viewAsUser');
    } catch {
      /* ignore */
    }
  }, []);

  const checkUserAuth = useCallback(async (options = {}) => {
    const { authRequired: required = authRequired } = options;

    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const token = localStorage.getItem('mpb_access_token');

      if (!token || token === 'local-dev') {
        if (required || loggedOut) {
          clearSession();
          return;
        }
        applyLocalUser();
        return;
      }

      const currentUser = await api.auth.me();
      sessionStorage.removeItem(LOGOUT_FLAG);
      setLoggedOut(false);
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.warn('Auth check failed:', error.message);
      clearSession();
      if (!required) {
        applyLocalUser();
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, [applyLocalUser, authRequired, clearSession, loggedOut]);

  const handleDevLogin = useCallback(() => {
    sessionStorage.removeItem(LOGOUT_FLAG);
    setLoggedOut(false);
    setLoginError(null);
    applyLocalUser();
  }, [applyLocalUser]);

  const handleLoginSuccess = useCallback((loggedInUser) => {
    sessionStorage.removeItem(LOGOUT_FLAG);
    setLoggedOut(false);
    setLoginError(null);
    clearAppSessionCaches();
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);

    const oauth = readOAuthCallbackToken();
    if (oauth.authError) {
      setLoginError(decodeURIComponent(oauth.authError));
    }

    let publicSettings;
    try {
      publicSettings = await http.get(
        `/api/apps/public/prod/public-settings/by-id/${appParams.appId}`
      );
      setAppPublicSettings(publicSettings);
    } catch (error) {
      console.warn('Public settings unavailable:', error.message);
      let googleLogin = googleFromBuild;
      let authRequired = false;
      try {
        const status = await http.get('/api/auth/status');
        googleLogin = status.google_login_enabled ?? googleLogin;
        authRequired = status.auth_required ?? authRequired;
      } catch {
        /* API may be down */
      }
      publicSettings = {
        id: appParams.appId,
        public_settings: {
          auth_required: authRequired,
          google_login_enabled: googleLogin,
        },
      };
      setAppPublicSettings(publicSettings);
    }

    const required = publicSettings?.public_settings?.auth_required ?? false;
    await checkUserAuth({ authRequired: required });
    setIsLoadingPublicSettings(false);
  }, [checkUserAuth, googleFromBuild]);

  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  useEffect(() => {
    const onLogout = () => clearSession();
    window.addEventListener('mpb:logout', onLogout);
    return () => window.removeEventListener('mpb:logout', onLogout);
  }, [clearSession]);

  const logout = useCallback(() => {
    sessionStorage.setItem(LOGOUT_FLAG, '1');
    setLoggedOut(true);
    clearAppSessionCaches();
    clearSession();
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  }, [clearSession]);

  const navigateToLogin = useCallback(() => {
    clearSession();
    window.location.href = '/';
  }, [clearSession]);

  const showLogin =
    !isLoadingAuth &&
    !isLoadingPublicSettings &&
    !isAuthenticated &&
    (authRequired || loggedOut);

  if (showLogin) {
    return (
      <LocalLoginPage
        googleEnabled={googleEnabled}
        authError={loginError}
        onDevLogin={!googleEnabled ? handleDevLogin : undefined}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
        checkUserAuth,
        authChecked: !isLoadingAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
