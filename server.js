require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const BACKEND_URL = process.env.BACKEND_URL;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) return res.redirect("/login");
  next();
}

// ── Pages ──────────────────────────────────────────────────────────

// Login page
app.get("/login", (req, res) => {
  if (req.cookies.access_token) return res.redirect("/dashboard");
  res.sendFile(path.join(__dirname, "public/login.html"));
});

// GitHub OAuth redirect
// app.get("/auth/github", (req, res) => {
//   res.redirect(`${BACKEND_URL}/auth/github`);
// });
app.get("/auth/github", (req, res) => {
  const params = new URLSearchParams({
    client_id: "Ov23liapFKh7Rbc8WyGm",
    redirect_uri: process.env.APP_URL + "/auth/callback",
    scope: "user:email",
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// OAuth callback
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect("/login?error=no_code");

  try {
    const response = await axios.get(`${BACKEND_URL}/auth/github/callback?code=${code}`);
    const { access_token, refresh_token, user } = response.data;

    // Store in HTTP-only cookies
    res.cookie("access_token", access_token, {
      httpOnly: true,
      secure: true,
      maxAge: 3 * 60 * 1000, // 3 minutes
    });
    res.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.cookie("user", JSON.stringify(user), {
      httpOnly: false,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err.message);
    res.redirect("/login?error=auth_failed");
  }
});

// Logout
app.post("/logout", (req, res) => {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
  res.clearCookie("user");
  res.redirect("/login");
});

// Token refresh helper
async function getValidToken(req, res) {
  let token = req.cookies.access_token;
  if (token) return token;

  const refreshToken = req.cookies.refresh_token;
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${BACKEND_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    token = response.data.access_token;
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: true,
      maxAge: 3 * 60 * 1000,
    });
    res.cookie("refresh_token", response.data.refresh_token, {
      httpOnly: true,
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return token;
  } catch {
    return null;
  }
}

// Dashboard
app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// Profiles page
app.get("/profiles", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/profiles.html"));
});

// Profile detail page
app.get("/profiles/:id", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/profile-detail.html"));
});

// Search page
app.get("/search", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/search.html"));
});

// Account page
app.get("/account", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/account.html"));
});

// ── API Proxy endpoints ────────────────────────────────────────────

app.get("/api/profiles", async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const response = await axios.get(`${BACKEND_URL}/api/profiles`, {
      params: req.query,
      headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

app.get("/api/profiles/search", async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const response = await axios.get(`${BACKEND_URL}/api/profiles/search`, {
      params: req.query,
      headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

app.get("/api/profiles/:id", async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const response = await axios.get(`${BACKEND_URL}/api/profiles/${req.params.id}`, {
      headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

app.get("/api/users/me", async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const response = await axios.get(`${BACKEND_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

app.get("/api/stats", async (req, res) => {
  const token = await getValidToken(req, res);
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const response = await axios.get(`${BACKEND_URL}/api/profiles`, {
      params: { limit: 1 },
      headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" },
    });
    const total = response.data.total;

    const [maleRes, femaleRes, seniorRes, childRes] = await Promise.all([
      axios.get(`${BACKEND_URL}/api/profiles`, { params: { gender: "male", limit: 1 }, headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" } }),
      axios.get(`${BACKEND_URL}/api/profiles`, { params: { gender: "female", limit: 1 }, headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" } }),
      axios.get(`${BACKEND_URL}/api/profiles`, { params: { age_group: "senior", limit: 1 }, headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" } }),
      axios.get(`${BACKEND_URL}/api/profiles`, { params: { age_group: "child", limit: 1 }, headers: { Authorization: `Bearer ${token}`, "X-API-Version": "1" } }),
    ]);

    res.json({
      total,
      male: maleRes.data.total,
      female: femaleRes.data.total,
      senior: seniorRes.data.total,
      child: childRes.data.total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/", (req, res) => {
  if (req.cookies.access_token) return res.redirect("/dashboard");
  res.redirect("/login");
});
app.listen(PORT, () => console.log(`Web portal running at http://localhost:${PORT}`));