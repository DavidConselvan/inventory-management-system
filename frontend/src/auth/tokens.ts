const ACCESS = 'access_token';
const REFRESH = 'refresh_token';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  setPair(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  setAccess(access: string) {
    localStorage.setItem(ACCESS, access);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

/** Fired when the session can no longer be refreshed; AuthProvider listens. */
export const AUTH_LOGOUT_EVENT = 'auth:logout';
