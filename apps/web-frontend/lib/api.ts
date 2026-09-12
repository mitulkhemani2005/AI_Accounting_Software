import axios from "axios";

// On browser, use relative path '/api/v1' to leverage Next.js rewrites; on server fallback to backend URL
const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: handle session expiration gracefully without crashing forms
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const isAuthEndpoint =
        error.config?.url?.includes("/auth/login") ||
        error.config?.url?.includes("/auth/signup");

      if (error.response?.status === 401 && !isAuthEndpoint) {
        const path = window.location.pathname;
        if (path !== "/login" && path !== "/signup" && path !== "/") {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_session");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
