/* ================= QR ATTENDANCE ================= */

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("sessionId");

function markAttendance() {
  const name = document.getElementById("name").value;
  const roll = document.getElementById("roll").value;
  const status = document.getElementById("status");

  navigator.geolocation.getCurrentPosition(pos => {
    fetch("http://localhost:3000/attendance", {
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
    });
  });
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
