const state = { token: null, user: null, contacts: [], alerts: [], authMode: "login", view: "overview", lastLocation: null };
let fallSensorEnabled = false;
let fallCandidateTimer = null;
let fallCooldownUntil = 0;

const $ = (id) => document.getElementById(id);
const api = async (path, options = {}) => {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) signOut(false);
    throw new Error(body?.detail || "Something went wrong. Please try again.");
  }
  return body;
};
function showMessage(id, message, kind = "") {
  const element = $(id);
  if (!element) return;
  element.textContent = message;
  element.className = `form-message ${kind}`;
}
function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 3300);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}
function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}
function dateLabel(value) {
  return new Date(value).toLocaleString([], { month:"short", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" });
}
function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll("[data-auth]").forEach((button) => button.classList.toggle("selected", button.dataset.auth === mode));
  $("name-wrap").hidden = mode !== "register";
  $("password-hint").hidden = mode !== "register";
  $("full-name").required = mode === "register";
  $("password").autocomplete = mode === "register" ? "new-password" : "current-password";
  $("auth-submit").innerHTML = mode === "register" ? 'Create account <span>→</span>' : 'Sign in securely <span>→</span>';
  $("auth-message").textContent = "";
}
function showSignedIn() {
  $("auth-panel").hidden = true;
  $("app-content").hidden = false;
  $("logout-btn").hidden = false;
  $("side-name").textContent = state.user.full_name;
  $("side-email").textContent = state.user.email;
  $("avatar").textContent = initials(state.user.full_name);
}
function showSignedOut() {
  $("auth-panel").hidden = false;
  $("app-content").hidden = true;
  $("logout-btn").hidden = true;
  $("side-name").textContent = "Guest";
  $("side-email").textContent = "Not signed in";
  $("avatar").textContent = "M";
}
function signOut(showToast = true) {
  stopFallSensor("Fall sensor stopped. Sign in to use the dashboard.");
  state.token = null;
  state.user = null;
  state.contacts = [];
  state.alerts = [];
  state.lastLocation = null;
  showSignedOut();
  if (showToast) toast("You have signed out.");
}
async function loadDashboard() {
  const [me, contacts, alerts] = await Promise.all([api("/api/me"), api("/api/contacts"), api("/api/alerts")]);
  state.user = me;
  state.contacts = contacts;
  state.alerts = alerts;
  showSignedIn();
  renderContacts();
  renderAlerts();
  updateStats();
}
function updateStats() {
  $("stat-contacts").textContent = state.contacts.length;
  $("stat-alerts").textContent = state.alerts.length;
  $("stat-location").textContent = state.lastLocation ? "Available" : "Not shared";
}
function renderContacts() {
  const contacts = state.contacts;
  $("contact-preview").innerHTML = contacts.length
    ? contacts.slice(0, 3).map((contact) => contactRow(contact, false)).join("")
    : '<div class="empty-state">No contacts saved yet. Add someone you trust to keep their details ready.</div>';
  $("all-contacts").innerHTML = contacts.length
    ? contacts.map((contact) => contactRow(contact, true)).join("")
    : '<div class="empty-state">No emergency contacts yet. Use the form above to add your first contact.</div>';
}
function contactRow(contact, removable) {
  return `<div class="contact-row"><div class="contact-avatar">${escapeHtml(initials(contact.name))}</div><div class="contact-info"><b>${escapeHtml(contact.name)}</b><small>${escapeHtml(contact.phone)} · ${escapeHtml(contact.relationship_label)}</small></div><span class="contact-tag">Trusted</span>${removable ? `<button class="delete-btn" data-delete-contact="${contact.id}" aria-label="Delete ${escapeHtml(contact.name)}" title="Delete contact">×</button>` : ""}</div>`;
}
function alertTable(alerts) {
  if (!alerts.length) return '<div class="empty-state">No alerts created yet. Your alert history will appear here.</div>';
  return `<table class="data-table"><thead><tr><th>Alert ID</th><th>Date & time</th><th>Location</th><th>Status</th></tr></thead><tbody>${alerts.map((alert) => {
    const location = alert.latitude != null && alert.longitude != null
      ? `<a class="text-btn" target="_blank" rel="noopener noreferrer" href="https://maps.google.com/?q=${encodeURIComponent(alert.latitude + "," + alert.longitude)}">View map ↗</a>`
      : "Not attached";
    return `<tr><td>#MA-${alert.id}</td><td>${escapeHtml(dateLabel(alert.created_at))}</td><td>${location}</td><td><span class="status-pill">Saved · not dispatched</span></td></tr>`;
  }).join("")}</tbody></table>`;
}
function renderAlerts() {
  $("recent-alerts").innerHTML = alertTable(state.alerts.slice(0, 5));
  $("all-alerts").innerHTML = alertTable(state.alerts);
}
function setView(view) {
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("contacts-view").hidden = view !== "contacts";
  $("history-view").hidden = view !== "history";
  document.querySelector(".dashboard-grid").hidden = view !== "overview";
  document.querySelector(".stats-grid").hidden = view !== "overview";
  document.querySelector(".emergency-banner").hidden = view !== "overview";
  document.querySelector(".fall-panel").hidden = view !== "overview";
  document.querySelector(".history-panel").hidden = view !== "overview";
  $("page-title").textContent = view === "contacts" ? "Emergency contacts" : view === "history" ? "Alert history" : "Overview";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-auth]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.auth)));
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
$("today-label").textContent = new Date().toLocaleDateString([], { weekday:"short", month:"short", day:"numeric", year:"numeric" });

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("auth-message", "");
  const mode = state.authMode;
  const payload = { email: $("email").value.trim(), password: $("password").value };
  if (mode === "register") payload.full_name = $("full-name").value.trim();
  const submit = $("auth-submit");
  submit.disabled = true;
  submit.textContent = mode === "register" ? "Creating account…" : "Signing in…";
  try {
    const result = await api(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST", body: JSON.stringify(payload)
    });
    state.token = result.access_token; // Intentionally memory-only, not localStorage.
    state.user = result.user;
    await loadDashboard();
    setView("overview");
    toast(mode === "register" ? "Your account is ready." : "Welcome back.");
  } catch (error) {
    showMessage("auth-message", error.message, "error");
  } finally {
    submit.disabled = false;
    submit.innerHTML = mode === "register" ? 'Create account <span>→</span>' : 'Sign in securely <span>→</span>';
  }
});
$("logout-btn").addEventListener("click", () => signOut());

$("contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("contacts-message", "");
  const payload = {
    name: $("contact-name").value.trim(),
    phone: $("contact-phone").value.trim(),
    relationship_label: $("contact-relationship").value.trim()
  };
  try {
    await api("/api/contacts", { method: "POST", body: JSON.stringify(payload) });
    $("contact-form").reset();
    $("contact-relationship").value = "Family";
    state.contacts = await api("/api/contacts");
    renderContacts();
    updateStats();
    showMessage("contacts-message", "Contact saved successfully.", "success");
    toast("Emergency contact saved.");
  } catch (error) {
    showMessage("contacts-message", error.message, "error");
  }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-contact]");
  if (!button) return;
  if (!confirm("Remove this emergency contact?")) return;
  try {
    await api(`/api/contacts/${button.dataset.deleteContact}`, { method: "DELETE" });
    state.contacts = await api("/api/contacts");
    renderContacts();
    updateStats();
    toast("Contact removed.");
  } catch (error) {
    toast(error.message);
  }
});
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        location_accuracy: position.coords.accuracy
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 15000 }
    );
  });
}
async function createEmergencyAlert(message = "Emergency assistance requested", requireConfirm = true) {
  if (!state.token) return;
  if (requireConfirm && !confirm("Create an alert now? This prototype only saves it to your dashboard; it will NOT text contacts or dispatch emergency services. For immediate assistance in India, call 112.")) return;
  const button = $("sos-button");
  if (button) { button.disabled = true; button.style.opacity = ".7"; }
  $("sos-caption").textContent = "Requesting optional location permission…";
  showMessage("sos-message", "");
  try {
    const location = await getLocation();
    state.lastLocation = location;
    const result = await api("/api/alerts", {
      method: "POST",
      body: JSON.stringify({ ...(location || {}), message })
    });
    state.alerts = await api("/api/alerts");
    renderAlerts();
    updateStats();
    const locationText = location ? " Location attached." : " No location attached.";
    showMessage("sos-message", `Alert #MA-${result.alert.id} saved.${locationText} ${result.notice}`, "success");
    $("sos-caption").textContent = "Alert saved. This prototype has not notified contacts.";
    toast(`Alert #MA-${result.alert.id} saved to your history.`);
  } catch (error) {
    showMessage("sos-message", error.message, "error");
    $("sos-caption").textContent = "The alert could not be saved. If urgent, call 112 directly.";
  } finally {
    if (button) { button.disabled = false; button.style.opacity = "1"; }
  }
}
$("sos-button").addEventListener("click", () => createEmergencyAlert());

function motionMagnitude(event) {
  const acceleration = event.accelerationIncludingGravity || event.acceleration;
  if (!acceleration || !Number.isFinite(acceleration.x) || !Number.isFinite(acceleration.y) || !Number.isFinite(acceleration.z)) return null;
  return Math.sqrt(acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2);
}
function stopFallSensor(message = "Fall detection is off.") {
  fallSensorEnabled = false;
  window.removeEventListener("devicemotion", handleMotion);
  if (fallCandidateTimer) window.clearTimeout(fallCandidateTimer);
  fallCandidateTimer = null;
  const button = $("fall-toggle");
  if (button) { button.textContent = "Enable sensor"; button.classList.remove("enabled"); }
  if ($("fall-message")) showMessage("fall-message", message);
}
async function enableFallSensor() {
  if (!("DeviceMotionEvent" in window)) {
    showMessage("fall-message", "This browser/device does not expose motion sensors. Use the SOS button instead.", "error");
    return;
  }
  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== "granted") {
        showMessage("fall-message", "Motion permission was not granted. Sensor remains off.");
        return;
      }
    }
    fallSensorEnabled = true;
    window.addEventListener("devicemotion", handleMotion);
    $("fall-toggle").textContent = "Disable sensor";
    $("fall-toggle").classList.add("enabled");
    showMessage("fall-message", "Sensor enabled for this open page only. It is experimental and not a reliable safety device.", "success");
  } catch (_) {
    showMessage("fall-message", "Could not enable motion access. Check browser permissions and use HTTPS or localhost.", "error");
  }
}
function handleMotion(event) {
  if (!fallSensorEnabled || Date.now() < fallCooldownUntil || fallCandidateTimer) return;
  const magnitude = motionMagnitude(event);
  if (magnitude === null || magnitude < 24) return; // Device-dependent heuristic, not medical detection.
  fallCandidateTimer = window.setTimeout(() => {
    fallCandidateTimer = null;
    if (!fallSensorEnabled || Date.now() < fallCooldownUntil) return;
    const okay = window.confirm("Possible fall-like movement detected. Choose OK if you are okay; choose Cancel to create an alert. The sensor can be wrong. For immediate help, call 112.");
    if (!okay) createEmergencyAlert("Possible fall detected by experimental motion sensor", false);
    fallCooldownUntil = Date.now() + 60000;
    showMessage("fall-message", "Fall-like movement was reviewed. The sensor will wait 60 seconds before checking again.");
  }, 1800);
}
$("fall-toggle").addEventListener("click", () => {
  if (fallSensorEnabled) stopFallSensor("Fall detection disabled.");
  else enableFallSensor();
});
window.addEventListener("pagehide", () => stopFallSensor("Sensor stopped because the page was closed."));
setAuthMode("login");
showSignedOut();
