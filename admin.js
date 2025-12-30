const qrStatus = document.getElementById("qrStatus");
const qrImage = document.getElementById("qrImage");

/* ================= AUTH TOKEN ================= */

const token = localStorage.getItem("adminToken");

if (!token) {
  window.location.href = "admin-login.html";
}

const API_BASE = "https://qr-attendance-backend-bmgt.onrender.com";

/* ================= GENERATE QR ================= */

function generateQR() {
  qrStatus.innerText = "Fetching location...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      fetch(`${API_BASE}/start-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        })
      })
      .then(res => res.json())
      .then(data => {
        if (!data.sessionId) {
          qrStatus.innerText = "Failed to generate QR";
          return;
        }

        qrStatus.innerText = "QR Generated (Valid for 5 minutes)";

        const qrURL =
          `https://pkds7644-cyber.github.io/qr-attendance-system/?sessionId=${data.sessionId}`;

        qrImage.src =
          `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrURL)}`;
      })
      .catch(() => {
        qrStatus.innerText = "Error generating QR";
      });
    },
    () => {
      qrStatus.innerText = "Location permission denied";
    }
  );
}

/* ================= LOAD ATTENDANCE ================= */

fetch(`${API_BASE}/admin/attendance`, {
  headers: {
    "Authorization": "Bearer " + token
  }
})
.then(res => {
  if (res.status === 401) {
    localStorage.removeItem("adminToken");
    window.location.href = "admin-login.html";
    return;
  }
  return res.json();
})
.then(data => {
  if (!data) return;

  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.innerHTML = "";

  data.slice(1).forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r[0]}</td>
      <td>${r[1]?.replace(/^'/,"")}</td>
      <td>${r[4]}</td>
      <td>${r[5]}</td>
    `;
    tbody.appendChild(tr);
  });
});

/* ================= DOWNLOAD CSV (FIXED) ================= */

function downloadCSV() {
  fetch(`${API_BASE}/admin/download`, {
    headers: {
      "Authorization": "Bearer " + token
    }
  })
  .then(res => {
    if (!res.ok) throw new Error("Unauthorized");
    return res.blob();
  })
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  })
  .catch(() => {
    alert("Failed to download CSV. Please login again.");
  });
}

/* ================= LOGOUT ================= */

function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "admin-login.html";
}

/* ================= ANALYTICS ================= */

fetch(`${API_BASE}/admin/analytics`, {
  headers: {
    "Authorization": "Bearer " + token
  }
})
.then(res => {
  if (res.status === 401) {
    localStorage.removeItem("adminToken");
    window.location.href = "admin-login.html";
    return;
  }
  return res.json();
})
.then(data => {
  if (!data || !data.attendanceByDate) return;

  /* ✅ FIX todayCount & totalDays */
  const dates = Object.keys(data.attendanceByDate);
  const today = new Date().toISOString().split("T")[0];

  const todayCount = data.attendanceByDate[today] || 0;
  const totalDays = dates.length;

  document.getElementById("todayCount").innerText = todayCount;
  document.getElementById("totalDays").innerText = totalDays;

  /* Calendar */
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  Object.entries(data.attendanceByDate).forEach(([date, count]) => {
    const box = document.createElement("div");
    box.className = "day-box";
    box.innerHTML = `
      <strong>${count}</strong>
      <span>${date}</span>
    `;
    calendar.appendChild(box);
  });

  window.studentAnalytics = data.attendanceByStudent || [];
});

/* ================= FILTER BY PERCENTAGE ================= */

document.getElementById("percentageFilter").addEventListener("change", () => {
  const min = Number(percentageFilter.value);
  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.innerHTML = "";

  (window.studentAnalytics || [])
    .filter(s => Number(s.percentage) >= min)
    .forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.name || "-"}</td>
        <td>${s.roll}</td>
        <td>${s.percentage}%</td>
        <td>${s.count}</td>
      `;
      tbody.appendChild(tr);
    });
});
