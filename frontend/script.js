// Change to college location later
const COLLEGE_LAT = 25.88672;
const COLLEGE_LNG = 86.6189312;
const ALLOWED_DISTANCE = 5000000000; // use 50 at college

function markAttendance() {
    const name = document.getElementById("name").value;
    const roll = document.getElementById("roll").value;
    const status = document.getElementById("status");

    if (!name || !roll) {
        status.innerText = "Please fill all details ❌";
        status.style.color = "red";
        return;
    }

    status.innerText = "Checking location...";
    status.style.color = "blue";

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            const distance = calculateDistance(
                lat, lng, COLLEGE_LAT, COLLEGE_LNG
            );

            if (distance <= ALLOWED_DISTANCE) {
                status.innerText = "Location verified ✅";
                status.style.color = "green";
                sendToBackend(name, roll, lat, lng);
            } else {
                status.innerText = "Outside allowed area ❌";
                status.style.color = "red";
            }
        },
        () => {
            status.innerText = "Location permission denied ❌";
            status.style.color = "red";
        }
    );
}

// Distance formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Backend call
function sendToBackend(name, roll, lat, lng) {
    const btn = document.querySelector("button");
    btn.classList.add("loading");
    btn.disabled = true;

    fetch("http://localhost:3000/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            roll,
            latitude: lat,
            longitude: lng
        })
    })
    .then(res => res.json())
    .then(data => {
        btn.classList.remove("loading");
        btn.disabled = false;

        if (data.success) {
            document.getElementById("status").innerText =
                "Attendance done successfully ✅";
            document.getElementById("status").style.color = "green";
            showToast("Attendance done successfully ✅", "success");
        } else {
            showToast("Attendance failed ❌", "error");
        }
    })
    .catch(() => {
        btn.classList.remove("loading");
        btn.disabled = false;
        showToast("Server error ❌", "error");
    });
}

// Toast
function showToast(msg, type) {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.className = "toast", 3000);
}

// Theme toggle
function toggleTheme() {
    document.body.classList.toggle("light");
}
