const AUTH_ENDPOINT = import.meta.env.VITE_AUTH_ENDPOINT || "/api/auth";

async function request(method, path, body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${AUTH_ENDPOINT}${path}`, options);

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Si backend responde vacío o HTML, no rompemos por parseo JSON.
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
  }

  return data;
}

export function login(password) {
  return request("POST", "/login", { password });
}

export function recover(masterKey, newPassword) {
  return request("POST", "/recover", { masterKey, newPassword });
}

export function logout() {
  return request("POST", "/logout", {});
}

export function getAuthStatus() {
  return request("GET", "/status");
}

export function getCurrentUser() {
  return request("GET", "/me");
}

export function initializeAuth(masterKey, adminPassword) {
  return request("POST", "/init", { masterKey, adminPassword });
}

export { AUTH_ENDPOINT };
