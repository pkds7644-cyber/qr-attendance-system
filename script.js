/* ================= QR ATTENDANCE ================= */

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("sessionId");

function markAttendance() {
  const name = document.getElementById("name").value.trim();
  const roll = document.getElementById("roll").value.trim();
  const status = document.getElementById("status");

  if (!name || !roll) {
    status.innerText = "Please enter name and roll number";
    return;
  }

  status.innerText = "Fetching location...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const accuracy = pos.coords.accuracy; // meters

      /* ❗ Accuracy check (VERY IMPORTANT) */
      if (accuracy > 80) {
        status.innerText =
          "Location accuracy is low. Please move to an open area and try again.";
        return;
      }

      fetch("https://qr-attendance-backend-bmgt.onrender.com/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          roll,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          sessionId
        })
      })
        .then(res => res.json())
        .then(data => {
          status.innerText = data.message;
        })
        .catch(() => {
          status.innerText = "Server error. Please try again.";
        });
    },
    () => {
      status.innerText = "Location permission denied";
    },
    {
      enableHighAccuracy: true, // ✅ FIX #1
      timeout: 15000,
      maximumAge: 0
    }
  );
}

/* ================= ABOUT / CONTACT TOGGLE ================= */

function toggleCard(id) {
  document.getElementById("aboutCard")?.classList.add("hidden");
  document.getElementById("contactCard")?.classList.add("hidden");

  const el = document.getElementById(id);
  el.classList.toggle("hidden");
}

/* ================= THEME TOGGLE ================= */

function toggleTheme() {
  document.body.classList.toggle("light");

  const isLight = document.body.classList.contains("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");

  document.querySelector(".theme-toggle").innerText =
    isLight ? "☀️" : "🌙";
}

/* ================= LOAD SAVED THEME ================= */

(function () {
  const theme = localStorage.getItem("theme");
  if (theme === "light") {
    document.body.classList.add("light");
    document.querySelector(".theme-toggle").innerText = "☀️";
  }
})();
