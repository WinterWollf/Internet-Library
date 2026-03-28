import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // JWT is stored in httpOnly cookies and sent automatically via withCredentials.
  // If using Authorization header instead, attach the token here.
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // TODO: attempt token refresh via POST /api/v1/auth/token/refresh/
      // then retry the original request
    }
    return Promise.reject(error);
  },
);

export default api;
