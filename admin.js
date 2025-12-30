/* ================= ELEMENTS ================= */

const qrStatus = document.getElementById("qrStatus");
const qrImage = document.getElementById("qrImage");

/* ================= AUTH TOKEN ================= */

const token = localStorage.getItem("adminToken");

if (!token) {
  window.location.href = "admin-login.html";
}

const API_BASE = "https://qr-attendance-backend-bmgt.onrender.com";

/* ================= DEVICE TYPE ================= */

const deviceType = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  ? "mobile"
  : "desktop";

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
          longitude: pos.coords.longitude,
          deviceType // ✅ SENT TO BACKEND
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
    },
    {
      enableHighAccuracy: true // ✅ IMPORTANT for better GPS
    }
  );
}
