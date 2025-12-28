const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

app.use(session({
  secret: "admin-secret",
  resave: false,
  saveUninitialized: false
}));

/* GOOGLE SHEETS */
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = "1eisbaQ237bb-j6o9WsjYOPaOcvIiQe8flK9ojs5bqOI";
const SHEET_NAME = "Sheet1";

/* ADMIN CREDENTIALS */
const ADMIN = {
  username: "admin",
  password: "admin123"
};

/* QR SESSIONS */
const sessions = {};

/* ================= DISTANCE FUNCTION (ADDED) ================= */

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = deg => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ================= ADMIN LOGIN ================= */

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

function checkAdmin(req, res, next) {
  if (req.session.isAdmin) next();
  else res.status(401).json({ error: "Unauthorized" });
}

/* ================= START SESSION ================= */

app.post("/start-session", (req, res) => {
  const { latitude, longitude } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Location missing" });
  }

  const sessionId = uuidv4();
  sessions[sessionId] = {
    latitude,
    longitude,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  res.json({ sessionId });
});

/* ================= MARK ATTENDANCE ================= */

app.post("/attendance", async (req, res) => {
  try {
    const { name, roll, latitude, longitude, sessionId } = req.body;

    const session = sessions[sessionId];
    if (!session || Date.now() > session.expiresAt) {
      return res.json({ success: false, message: "QR expired" });
    }

    /* ✅ LOCATION VALIDATION (50 METERS) */
    const distance = getDistanceInMeters(
      session.latitude,
      session.longitude,
      latitude,
      longitude
    );

    if (distance > 50) {
      return res.json({
        success: false,
        message: "You are not within 50 meters of the class location"
      });
    }

    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0];
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

/* ================= EXCEL-SAFE CSV DOWNLOAD ================= */

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

/* ================= ATTENDANCE ANALYTICS ================= */

app.get("/admin/analytics", checkAdmin, async (req, res) => {
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:F`,
  });

  const rows = data.data.values || [];
  if (rows.length <= 1) return res.json({});

  const attendanceByDate = {};
  const attendanceByStudent = {};

  rows.slice(1).forEach(r => {
    const name = r[0];
    const roll = r[1]?.replace(/^'/, "");
    const date = r[4];

    attendanceByDate[date] = (attendanceByDate[date] || 0) + 1;

    if (!attendanceByStudent[roll]) {
      attendanceByStudent[roll] = { name, roll, count: 0 };
    }
    attendanceByStudent[roll].count++;
  });

  const totalDays = Object.keys(attendanceByDate).length;

  Object.values(attendanceByStudent).forEach(s => {
    s.percentage = ((s.count / totalDays) * 100).toFixed(2);
  });

  const today = new Date().toISOString().split("T")[0];
  const todayCount = attendanceByDate[today] || 0;

  res.json({
    todayCount,
    totalDays,
    attendanceByDate,
    attendanceByStudent: Object.values(attendanceByStudent)
  });
});

/* ================= START SERVER ================= */

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
