
const API_BASE = "/api/auth";

function showError(msg) {
  const el = document.getElementById("errorMsg");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
}
function hideError() {
  const el = document.getElementById("errorMsg");
  if (el) el.classList.remove("show");
}
function showSuccess(msg) {
  const el = document.getElementById("successMsg");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const identifier = document.getElementById("identifier").value.trim();
    const password = document.getElementById("password").value;

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Login failed.");
        return;
      }
const ROLE_DASHBOARDS = {
  farmer: "dashboard-farmer.html",
  buyer: "dashboard-buyer.html",
  transporter: "dashboard-transporter.html",
  admin:"dashboard-admin.html",
  storage_provider:"dashboard-storager.html"

};

localStorage.setItem("hl_token", data.token);
localStorage.setItem("hl_user", JSON.stringify(data.user));
window.location.href = ROLE_DASHBOARDS[data.user.role] || "dashboard.html";
    } catch (err) {
      showError("Could not reach the server. Is it running?");
    }
  });
}


const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const payload = {
      role: document.getElementById("role").value,
      full_name: document.getElementById("full_name").value.trim(),
      email: document.getElementById("email").value.trim() || null,
      phone: document.getElementById("phone").value.trim() || null,
      district: document.getElementById("district").value.trim() || null,
      sector: document.getElementById("sector").value.trim() || null,
      password: document.getElementById("password").value,
    };

    if (!payload.email && !payload.phone) {
      showError("Please provide either an email or a phone number.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Registration failed.");
        return;
      }

      showSuccess("Account created. Redirecting to login...");
      setTimeout(() => (window.location.href = "login.html"), 1400);
    } catch (err) {
      showError("Could not reach the server. Is it running?");
    }
  });
}
