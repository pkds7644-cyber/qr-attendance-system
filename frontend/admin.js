fetch("http://localhost:3000/admin/attendance")
    .then(res => res.json())
    .then(data => {
        const tbody = document.querySelector("tbody");

        for (let i = 1; i < data.length; i++) {
            const row = document.createElement("tr");
            data[i].forEach(cell => {
                const td = document.createElement("td");
                td.innerText = cell;
                row.appendChild(td);
            });
            tbody.appendChild(row);
        }
    });

function downloadCSV() {
    window.location.href = "http://localhost:3000/admin/download";
}
