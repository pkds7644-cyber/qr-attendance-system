const qrStatus = document.getElementById("qrStatus");
const qrImage = document.getElementById("qrImage");

/* ================= GENERATE QR ================= */

function generateQR() {
  qrStatus.innerText = "Fetching location...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      fetch("https://qr-attendance-backend-bmgt.onrender.com/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        })
      })
      .then(res => res.json())
      .then(data => {
        qrStatus.innerText = "QR Generated (Valid for 5 minutes)";

        // 🔴 LIVE FRONTEND URL (GitHub Pages)
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

fetch("https://qr-attendance-backend-bmgt.onrender.com/admin/attendance", {
  credentials: "include"
})
.then(res => {
  if (res.status === 401) {
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

/* ================= DOWNLOAD CSV ================= */

function downloadCSV() {
  window.open("https://qr-attendance-backend-bmgt.onrender.com/admin/download");
}

/* ================= LOGOUT ================= */

function logout() {
  fetch("https://qr-attendance-backend-bmgt.onrender.com/admin/logout", {
    method: "POST",
    credentials: "include"
  }).then(() => {
    window.location.href = "admin-login.html";
  });
}

/* ================= ANALYTICS ================= */

fetch("https://qr-attendance-backend-bmgt.onrender.com/admin/analytics", {
  credentials: "include"
})
.then(res => res.json())
.then(data => {
  if (!data) return;

  // Today count
  document.getElementById("todayCount").innerText = data.todayCount;
  document.getElementById("totalDays").innerText = data.totalDays;

  // Calendar
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

  // Store for filtering
  window.studentAnalytics = data.attendanceByStudent;
});

/* ================= FILTER BY PERCENTAGE ================= */

document.getElementById("percentageFilter").addEventListener("change", () => {
  const min = Number(percentageFilter.value);
  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.innerHTML = "";

  window.studentAnalytics
    .filter(s => s.percentage >= min)
    .forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${s.roll}</td>
        <td>${s.percentage}%</td>
        <td>${s.count}</td>
      `;
      tbody.appendChild(tr);
    });
});
