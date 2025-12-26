const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

// Google Sheets auth
const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// CONFIG
const SPREADSHEET_ID = "1eisbaQ237bb-j6o9WsjYOPaOcvIiQe8flK9ojs5bqOI";
const SHEET_NAME = "Sheet1";

/* ================= STUDENT ATTENDANCE ================= */

app.post("/attendance", async (req, res) => {
    try {
        const { name, roll, latitude, longitude } = req.body;

        const normalizedRoll = String(roll).trim().toUpperCase();
        const now = new Date();
        const today = now.toLocaleDateString();
        const time = now.toLocaleTimeString();

        const read = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:F`,
        });

        const rows = read.data.values || [];

        for (let i = 1; i < rows.length; i++) {
            const existingRoll = String(rows[i][1] || "")
                .replace(/^'/, "")
                .trim()
                .toUpperCase();
            const existingDate = rows[i][4];

            if (existingRoll === normalizedRoll && existingDate === today) {
                return res.json({
                    success: false,
                    message: "Attendance already marked today",
                });
            }
        }

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:F`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [[
                    name,
                    `'${normalizedRoll}`,
                    latitude,
                    longitude,
                    today,
                    time
                ]],
            },
        });

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

/* ================= ADMIN APIs ================= */

// Fetch all attendance
app.get("/admin/attendance", async (req, res) => {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:F`,
    });
    res.json(response.data.values || []);
});

// Download CSV
app.get("/admin/download", async (req, res) => {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:F`,
    });

    const rows = response.data.values || [];
    const csv = rows.map(r => r.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=attendance.csv");
    res.send(csv);
});

app.listen(3000, () => {
    console.log("✅ Server running at http://localhost:3000");
});
