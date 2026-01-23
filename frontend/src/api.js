import axios from "axios";
export const API_BASE = "https://makkaandevelopments.online";

export function api(token) {
  const a = axios.create({ baseURL: API_BASE });
  a.interceptors.request.use((config) => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return a;
}
