import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true });

/** Extracts a human-readable message from an API error. */
export const errorMessage = (err) =>
  err?.response?.data?.error?.details?.[0]?.message ||
  err?.response?.data?.error?.message ||
  err?.message ||
  'Something went wrong';

/**
 * The access token lives only in memory (Redux); the refresh token is an HttpOnly cookie.
 * On a 401 we try one refresh, then replay the request. Concurrent 401s share the same refresh.
 */
export function setupInterceptors(store, { tokenRefreshed, loggedOut }) {
  api.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  let refreshing = null;
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      const isAuthCall = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(original?.url);
      if (error.response?.status !== 401 || original._retry || isAuthCall) throw error;
      original._retry = true;
      try {
        refreshing = refreshing || api.post('/auth/refresh').finally(() => setTimeout(() => (refreshing = null), 0));
        const { data } = await refreshing;
        store.dispatch(tokenRefreshed(data.data));
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (e) {
        store.dispatch(loggedOut());
        throw error;
      }
    }
  );
}
