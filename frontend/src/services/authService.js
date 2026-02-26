// base URL of the backend. by default the server listens on port 3001
// (see app.js output). the /api prefix is added here so callers can use
// paths like "/auth/login".
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // si el backend devuelve HTML (404), esto evita que se rompa
  }

  if (!res.ok) {

    throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
  }

  return data;
}

export function login(password) {
  return post("/auth/login", { password });
}

export function recover(masterKey, newPassword) {
  return post("/auth/recover", { masterKey, newPassword });
}


export function logout() {
  return post("/auth/logout", {});
}

export { API_BASE };
