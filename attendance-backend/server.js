require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");

const app = express();

/* ================= BASIC SETUP ================= */

app.use(cors({
  origin: "https://pkds7644-cyber.github.io",
}));

app.use(express.json());

/* ================= SIMPLE TOKEN AUTH ================= */

// Static admin token (perfect for college project)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "QR_ADMIN_TOKEN_2025";

const ADMIN = {
  username: "admin",
  password: "admin123"
};

function checkAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const token = auth.split(" ")[1];
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Invalid token" });
  }
  next();
}

/* ================= GOOGLE SHEETS ================= */

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1eisbaQ237bb-j6o9WsjYOPaOcvIiQe8flK9ojs5bqOI";
const SHEET_NAME = "Sheet1";

/* ================= QR SESSIONS ================= */

const sessions = {};

/* ================= DISTANCE FUNCTION ================= */

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ================= ADMIN LOGIN ================= */

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN.username && password === ADMIN.password) {
    return res.json({
      success: true,
      token: ADMIN_TOKEN
    });
  }

  res.json({ success: false });
});

/* ================= START QR SESSION ================= */

app.post("/start-session", checkAdmin, (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Location missing" });
  }

  const sessionId = uuidv4();
  sessions[sessionId] = {
    latitude,
    longitude,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  res.json({ sessionId });
});

/* ================= MARK ATTENDANCE ================= */

app.post("/attendance", async (req, res) => {
  try {
    const { name, roll, latitude, longitude, sessionId } = req.body;

    const qrSession = sessions[sessionId];
    if (!qrSession || Date.now() > qrSession.expiresAt) {
      return res.json({ success: false, message: "QR expired" });
    }

    const distance = getDistanceInMeters(
      qrSession.latitude,
      qrSession.longitude,
      latitude,
      longitude
    );

    if (distance > 200) {
      return res.json({
        success: false,
        message: "You are not within 50 meters of the class location"
      });
    }

    /* ===== IST TIME FIX ===== */
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);

    const date = istTime.toISOString().split("T")[0];
    const time = istTime.toTimeString().split(" ")[0];

    const normalizedRoll = roll.trim().toUpperCase();

    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
    });

    const rows = read.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i][1]?.replace(/^'/, "").toUpperCase();
      const d = rows[i][4];
      if (r === normalizedRoll && d === date) {
        return res.json({ success: false, message: "Already marked today" });
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[name, `'${normalizedRoll}`, latitude, longitude, date, time]],
      },
    });

    res.json({ success: true, message: "Attendance marked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ================= ADMIN DATA ================= */

app.get("/admin/attendance", checkAdmin, async (req, res) => {
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:F`,
  });
  res.json(data.data.values || []);
});

/* ================= CSV DOWNLOAD ================= */

app.get("/admin/download", checkAdmin, async (req, res) => {
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:F`,
  });

  const rows = data.data.values || [];

  const csv = rows.map((row, i) => {
    if (i === 0) return row.join(",");
    return row.map((cell, idx) => {
      if (idx === 4 || idx === 5) return `="${cell}"`;
      return `"${cell}"`;
    }).join(",");
  }).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
  res.send(csv);
});

/* ================= ANALYTICS (FIXED) ================= */

app.get("/admin/analytics", checkAdmin, async (req, res) => {
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:F`,
  });

  const rows = data.data.values || [];
  if (rows.length <= 1) {
    return res.json({
      todayCount: 0,
      totalDays: 0,
      attendanceByDate: {},
      attendanceByStudent: []
    });
  }

  const attendanceByDate = {};
  const attendanceByStudent = {};

  rows.slice(1).forEach(r => {
    const roll = r[1]?.replace(/^'/, "");
    const date = r[4];

    attendanceByDate[date] = (attendanceByDate[date] || 0) + 1;

    if (!attendanceByStudent[roll]) {
      attendanceByStudent[roll] = { roll, count: 0 };
    }
    attendanceByStudent[roll].count++;
  });

  const totalDays = Object.keys(attendanceByDate).length;

  Object.values(attendanceByStudent).forEach(s => {
    s.percentage = ((s.count / totalDays) * 100).toFixed(2);
  });

  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  res.json({
    todayCount: attendanceByDate[today] || 0,
    totalDays,
    attendanceByDate,
    attendanceByStudent: Object.values(attendanceByStudent)
  });
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
