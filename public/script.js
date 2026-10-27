document.querySelector(selector);

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function showStatus(selector, message, error = false) {
  const el = $(selector);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", error);
}

const guestForm = $("#guestbookForm");
async function loadGuestbook() {
  const list = $("#guestList");
  if (!list) return;
  list.replaceChildren();
  try {
    const entries = await api("/api/guestbook");
    if (!entries.length) {
      list.textContent = "Belum ada pesan.";
      return;
    }
    for (const entry of entries) {
      const article = document.createElement("article");
      article.className = "guest-entry";
      const name = document.createElement("strong");
      name.textContent = entry.username;
      const message = document.createElement("p");
      message.textContent = entry.message;
      const date = document.createElement("small");
      date.className = "muted";
      date.textContent = new Date(entry.createdAt).toLocaleString("id-ID");
      article.append(name, message, date);
      list.append(article);
    }
  } catch (error) {
    list.textContent = "Gagal memuat guestbook: " + error.message;
  }
}

if (guestForm) {
  guestForm.addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(guestForm);
    try {
      await api("/api/guestbook", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          message: form.get("message")
        })
      });
      guestForm.reset();
      showStatus("#guestStatus", "Pesan berhasil dikirim.");
      await loadGuestbook();
    } catch (error) {
      showStatus("#guestStatus", error.message, true);
    }
  });
  loadGuestbook();
}

const uploadForm = $("#uploadForm");
if (uploadForm) {
  uploadForm.addEventListener("submit", async event => {
    event.preventDefault();
    const status = $("#uploadStatus");
    status.textContent = "Mengunggah...";
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: new FormData(uploadForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload gagal");
      status.replaceChildren(document.createTextNode("Upload berhasil: "));
      const link = document.createElement("a");
      link.href = data.url;
      link.textContent = "Lihat gambar";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      status.append(link);
      uploadForm.reset();
    } catch (error) {
      showStatus("#uploadStatus", error.message, true);
    }
  });
}

const loginForm = $("#loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(loginForm);
    try {
      const result = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password")
        })
      });
      // Demo UI only; this is not a secure server-side session.
      localStorage.setItem("labUsername", result.user.username);
      location.href = "/dashboard.html";
    } catch (error) {
      showStatus("#loginStatus", error.message, true);
    }
  });
}

const registerForm = $("#registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(registerForm);
    try {
      const result = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password")
        })
      });
      showStatus("#registerStatus", `Akun ${result.user.username} berhasil dibuat. Silakan login.`);
      registerForm.reset();
    } catch (error) {
      showStatus("#registerStatus", error.message, true);
    }
  });
}

const welcome = $("#welcome");
if (welcome) {
  const username = localStorage.getItem("labUsername");
  welcome.textContent = username
    ? `Halo, ${username}. Ini dashboard demo kamu.`
    : "Kamu belum login. Dashboard ini hanya demonstrasi UI.";
  $("#logoutButton")?.addEventListener("click", () => {
    localStorage.removeItem("labUsername");
    location.href = "/login.html";
  });

  async function refreshData() {
    const output = $("#apiOutput");
    output.textContent = "Memuat...";
    try {
      output.textContent = JSON.stringify(await api("/api/guestbook"), null, 2);
    } catch (error) {
      output.textContent = error.message;
    }
  }
  $("#refreshButton")?.addEventListener("click", refreshData);
  refreshData();
}

const submitForm = $("#submitForm");
if (submitForm) {
  submitForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const form = new FormData(submitForm);
      const payload = JSON.parse(form.get("payload"));
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Masukkan objek JSON, bukan array atau nilai tunggal.");
      }
      await api("/api/submit", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showStatus("#submitStatus", "Data berhasil disimpan ke db.json.");
    } catch (error) {
      showStatus("#submitStatus", error.message, true);
    }
  });
                }
      
