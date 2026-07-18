
// =============================
// ASSET SWITCHER (MULTI-TARGET PRESETS)
// =============================

document.addEventListener("DOMContentLoaded", function () {
    const assetSelector = document.getElementById("asset-selector");
    const targetInput = document.getElementById("scan-target-input");

    if (assetSelector && targetInput) {
        assetSelector.addEventListener("change", function () {
            if (this.value) {
                targetInput.value = this.value;
                showToast(`Asset selected: ${this.value}. Click [ INITIATE PROBE / SCAN ] to interrogate.`, "info");
            }
        });
    }
});

const API = (window.location.port === "5000" || window.location.port === "") ? "" : "http://127.0.0.1:5000";

// =============================
// GLOBAL STATE
// =============================

let currentScanTarget = "";

// =============================
// TOAST NOTIFICATION SYSTEM
// =============================

const toastStyle = document.createElement("style");
toastStyle.textContent = `@keyframes toastIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`;
document.head.appendChild(toastStyle);

function showToast(message, type = "info") {
    const existing = document.getElementById("sentinel-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "sentinel-toast";
    toast.style.cssText = `
        position: fixed; bottom: 28px; right: 28px;
        padding: 12px 18px; z-index: 9999;
        background: #101318;
        font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 700;
        color: #f3f4f6; max-width: 380px;
        border-radius: 6px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 14px rgba(245, 158, 11, 0.2);
        animation: toastIn 0.2s ease;
        border: 1px solid #272d38;
        border-left: 4px solid ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#f59e0b"};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}



// =============================
// STAR FEATURE: INTERACTIVE ATTACK PATH & NETWORK TOPOLOGY
// =============================

function renderAttackGraph(data) {
    const svg = document.getElementById("attack-path-svg");
    if (!svg) return;

    svg.innerHTML = "";

    const isOpen = data && data.open_ports > 0 && data.target && data.target !== "—";

    if (!isOpen) {
        // STANDBY RADAR RETICLE
        svg.innerHTML = `
            <defs>
                <radialGradient id="standbyGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.2" />
                    <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
                </radialGradient>
            </defs>
            <circle cx="500" cy="190" r="130" fill="url(#standbyGlow)" />
            <circle cx="500" cy="190" r="120" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.6" />
            <circle cx="500" cy="190" r="75" fill="none" stroke="#f59e0b" stroke-width="1" opacity="0.4" />
            <circle cx="500" cy="190" r="30" fill="none" stroke="#f59e0b" stroke-width="1.5" opacity="0.8" />
            <line x1="330" y1="190" x2="670" y2="190" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,4" opacity="0.4" />
            <line x1="500" y1="50" x2="500" y2="330" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4,4" opacity="0.4" />
            
            <circle cx="500" cy="190" r="6" fill="#f59e0b">
                <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
            </circle>

            <text x="500" y="245" text-anchor="middle" fill="#fbbf24" font-family="'Share Tech Mono', monospace" font-size="12" font-weight="700" letter-spacing="2">
                [ SENSOR GRID ARMED // AWAITING TARGET PROBE ]
            </text>
            <text x="500" y="268" text-anchor="middle" fill="#6b7280" font-family="'JetBrains Mono', monospace" font-size="10.5">
                ENTER TARGET IP ABOVE & CLICK [ INITIATE PROBE / SCAN ] TO MAP ATTACK VECTORS
            </text>
        `;
        return;
    }

    const openPorts = data.ports.filter(p => p.state === "open");
    const criticalPortNumbers = [1524, 6667, 445, 21, 23, 5900, 3306, 80, 8180, 8009, 5432, 1099, 2121];
    
    const featured = openPorts.filter(p => criticalPortNumbers.includes(p.port)).slice(0, 8);
    const displayPorts = featured.length > 0 ? featured : openPorts.slice(0, 8);

    const attackerX = 140;
    const attackerY = 190;
    const targetX = 460;
    const targetY = 190;

    let svgHtml = `
        <defs>
            <linearGradient id="attackPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ef4444" />
                <stop offset="100%" stop-color="#f59e0b" />
            </linearGradient>
            <linearGradient id="vectorLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#ef4444" />
            </linearGradient>
            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        <!-- ATTACKER TO TARGET MAIN VECTOR -->
        <path d="M ${attackerX} ${attackerY} L ${targetX} ${targetY}" 
              stroke="url(#attackPathGrad)" stroke-width="3" stroke-dasharray="8,6" opacity="0.85">
            <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1s" repeatCount="indefinite" />
        </path>

        <rect x="250" y="175" width="100" height="20" rx="3" fill="#0a0c0f" stroke="#ef4444" stroke-width="1" opacity="0.9"/>
        <text x="300" y="189" text-anchor="middle" fill="#f87171" font-family="'Share Tech Mono', monospace" font-size="9.5" font-weight="700" letter-spacing="1">
            EXPLOIT VECTOR
        </text>
    `;

    const totalPorts = displayPorts.length;
    const radiusX = 350;
    const radiusY = 150;

    displayPorts.forEach((p, idx) => {
        const isCritical = [1524, 6667, 445, 21].includes(p.port);
        const nodeColor = isCritical ? "#ef4444" : "#f59e0b";

        const angleDeg = -60 + (120 / Math.max(totalPorts - 1, 1)) * idx;
        const angleRad = (angleDeg * Math.PI) / 180;

        const portX = Math.round(targetX + Math.cos(angleRad) * radiusX);
        const portY = Math.round(targetY + Math.sin(angleRad) * radiusY);

        const ctrlX = Math.round((targetX + portX) / 2 + 30);
        const ctrlY = Math.round((targetY + portY) / 2);

        svgHtml += `
            <!-- Vector Line to Port ${p.port} -->
            <path d="M ${targetX} ${targetY} Q ${ctrlX} ${ctrlY} ${portX} ${portY}" 
                  stroke="${nodeColor}" stroke-width="${isCritical ? '2' : '1.5'}" stroke-dasharray="${isCritical ? '6,4' : '4,4'}" opacity="0.75">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="${isCritical ? '1.2s' : '2s'}" repeatCount="indefinite" />
            </path>

            <!-- Port Node -->
            <g style="cursor: pointer;" onclick="showToast('PORT ${p.port} (${p.service.toUpperCase()}) - ${isCritical ? 'CRITICAL ROOT/RCE VECTOR' : 'EXPOSED SERVICE'}', '${isCritical ? 'error' : 'warning'}')">
                <circle cx="${portX}" cy="${portY}" r="22" fill="#0c0e12" stroke="${nodeColor}" stroke-width="2" filter="url(#glowFilter)" />
                <circle cx="${portX}" cy="${portY}" r="17" fill="#12151b" stroke="${nodeColor}" stroke-width="1" />
                
                <text x="${portX}" y="${portY - 2}" text-anchor="middle" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="800">
                    :${p.port}
                </text>
                <text x="${portX}" y="${portY + 10}" text-anchor="middle" fill="${nodeColor}" font-family="'Share Tech Mono', monospace" font-size="8.5" font-weight="700">
                    ${p.service.slice(0, 6).toUpperCase()}
                </text>

                <rect x="${portX - 28}" y="${portY + 26}" width="56" height="15" rx="3" fill="#07080a" stroke="${nodeColor}" stroke-width="1" />
                <text x="${portX}" y="${portY + 37}" text-anchor="middle" fill="${nodeColor}" font-family="'Share Tech Mono', monospace" font-size="8" font-weight="800">
                    ${isCritical ? 'COMPROMISED' : 'EXPOSED'}
                </text>
            </g>
        `;
    });

    // ATTACKER NODE (Left)
    svgHtml += `
        <g>
            <circle cx="${attackerX}" cy="${attackerY}" r="38" fill="rgba(239, 68, 68, 0.12)" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4">
                <animate attributeName="r" values="36;42;36" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="${attackerX}" cy="${attackerY}" r="30" fill="#12151b" stroke="#ef4444" stroke-width="2.5" filter="url(#glowFilter)" />
            <circle cx="${attackerX}" cy="${attackerY}" r="22" fill="#1a0f12" stroke="#dc2626" stroke-width="1" />
            <text x="${attackerX}" y="${attackerY + 5}" text-anchor="middle" fill="#ef4444" font-family="'JetBrains Mono', monospace" font-size="18" font-weight="900">
                ☠
            </text>
            <rect x="${attackerX - 52}" y="${attackerY + 40}" width="104" height="20" rx="3" fill="#0a0c0f" stroke="#ef4444" stroke-width="1" />
            <text x="${attackerX}" y="${attackerY + 54}" text-anchor="middle" fill="#f87171" font-family="'Share Tech Mono', monospace" font-size="9" font-weight="800" letter-spacing="1">
                ATTACK VECTOR
            </text>
        </g>
    `;

    // TARGET NODE (Center)
    svgHtml += `
        <g>
            <circle cx="${targetX}" cy="${targetY}" r="48" fill="rgba(245, 158, 11, 0.12)" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6,4">
                <animate attributeName="r" values="46;54;46" dur="3s" repeatCount="indefinite" />
            </circle>
            <circle cx="${targetX}" cy="${targetY}" r="38" fill="#12151b" stroke="#f59e0b" stroke-width="2.5" filter="url(#glowFilter)" />
            <circle cx="${targetX}" cy="${targetY}" r="28" fill="#1a150e" stroke="#d97706" stroke-width="1" />
            <text x="${targetX}" y="${targetY + 4}" text-anchor="middle" fill="#fbbf24" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="900">
                HOST
            </text>
            <rect x="${targetX - 70}" y="${targetY + 48}" width="140" height="22" rx="3" fill="#07080a" stroke="#f59e0b" stroke-width="1" />
            <text x="${targetX}" y="${targetY + 63}" text-anchor="middle" fill="#fbbf24" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="800">
                ${data.target}
            </text>
        </g>
    `;

    svg.innerHTML = svgHtml;
}


// =============================
// NMAP SCAN DATA
// =============================

async function loadScanData() {
    try {
        const response = await fetch(`${API}/api/scan`);
        const data = await response.json();

        // Store the scan target globally
        currentScanTarget = data.target;

        const criticalPorts = [21, 23, 1524, 3306, 5432, 5900];
        const portsList = Array.isArray(data.ports) ? data.ports : [];
        const criticalServices = portsList.filter(port =>
            port.state === "open" && criticalPorts.includes(port.port)
        );

        const endpointTarget =
    document.getElementById("endpoint-target");

const endpointState =
    document.getElementById("endpoint-state");

const endpointPorts =
    document.getElementById("endpoint-ports");

const endpointRisk =
    document.getElementById("endpoint-risk");

if (endpointTarget) {
    endpointTarget.textContent = data.target;
}

if (endpointState) {
    endpointState.textContent =
        (data.host_status || "STANDBY").toUpperCase();
}

        // Live DEFCON Threat Strip
        const activeStrip = document.getElementById("active-incidents-strip");
        if (activeStrip) {
            if (data.host_status === "STANDBY" || !data.target || data.target === "—") {
                activeStrip.textContent = "STANDBY // AWAITING PROBE";
                activeStrip.style.color = "var(--amber)";
            } else if (criticalServices.length > 0) {
                activeStrip.textContent = "DEFCON 1 // HOSTILE (" + criticalServices.length + " CRITICAL)";
                activeStrip.style.color = "var(--red-bright)";
            } else if (data.open_ports > 0) {
                activeStrip.textContent = "DEFCON 3 // EXPOSURE (" + data.open_ports + " PORTS)";
                activeStrip.style.color = "var(--amber-bright)";
            } else {
                activeStrip.textContent = "DEFCON 5 // PERIMETER SECURE";
                activeStrip.style.color = "var(--green-bright)";
            }
        }

if (endpointPorts) {
    endpointPorts.textContent =
        String(data.open_ports);
}

if (endpointRisk) {
    const riskCount = data.ports.filter(port =>
        port.state === "open" && criticalPorts.includes(port.port)
    ).length;

    endpointRisk.textContent =
        String(riskCount);
}

        console.log("Real Nmap Data:", data);
        renderAttackGraph(data);

        // Endpoint count
        const endpointMetric = document.getElementById("endpoint-count");

        if (endpointMetric) {
            endpointMetric.textContent =
          String(data.endpoint_count).padStart(2, "0");
        }

        // Critical alert metric
        const criticalMetric = document.getElementById("critical-alert-count") || document.querySelector(
            ".metric-card:nth-child(1) .metric-value"
        );

        if (criticalMetric) {
            criticalMetric.textContent =
                String(criticalServices.length).padStart(2, "0");
        }

        // Nmap summary
        document.getElementById("scan-target").textContent =
            data.target;

        document.getElementById("scan-status").textContent =
            data.host_status.toUpperCase();

        document.getElementById("scan-ports").textContent =
            data.open_ports;

        document.getElementById("scan-critical").textContent =
            criticalServices.length;

        // Last scan time
        const scanTime = document.getElementById("scan-time");

        if (scanTime) {
            scanTime.textContent =
                new Date().toLocaleTimeString();
        }

        // Port table
        const tableBody =
            document.getElementById("port-table-body");

        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (data.open_ports === 0 && data.ports.length > 0) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td colspan="6" style="text-align: center; color: var(--muted); padding: 20px;">
                    Target host (${data.target}) has <strong>0 open ports</strong> detected. Scanned ports are filtered/closed by firewall.
                </td>
            `;
            tableBody.appendChild(row);
        } else if (data.ports.length === 0) {
            const isStandby = !data.target || data.target === "—" || data.host_status === "STANDBY";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td colspan="6" style="text-align: center; color: var(--muted); padding: 22px;">
                    ${isStandby
                        ? "Awaiting scan data... Enter a target IP above and click <strong>RUN LIVE SCAN</strong>."
                        : `No response from target (${data.target}). Host may be offline or blocking all probe packets.`}
                </td>
            `;
            tableBody.appendChild(row);
        } else {
            data.ports.forEach(port => {
                const row = document.createElement("tr");
                const isOpen = port.state === "open";
                const severity = !isOpen
                    ? "FILTERED"
                    : (criticalPorts.includes(port.port) ? "CRITICAL" : "OPEN");

                row.innerHTML = `
                    <td>${port.port}</td>
                    <td>${port.protocol.toUpperCase()}</td>
                    <td>${port.service}</td>
                    <td>${port.product || "-"}</td>
                    <td>${port.version || "-"}</td>
                    <td>
                        <span class="port-severity ${severity.toLowerCase()}">
                            ${severity}
                        </span>
                    </td>
                `;

                tableBody.appendChild(row);
            });
        }

    } catch (error) {

        console.error(
            "Backend connection failed:",
            error
        );

        const tableBody =
            document.getElementById("port-table-body");

        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        Backend connection failed
                    </td>
                </tr>
            `;
        }
    }
}


// =============================
// SECURITY ALERTS
// =============================

async function loadAlerts() {

    try {

        const response =
            await fetch(`${API}/api/alerts`);

        const data =
            await response.json();

        console.log("Real Alert Data:", data);


        // Severity numbers
        document.getElementById("severity-critical").textContent =
            String(data.severity.critical).padStart(2, "0");

        document.getElementById("severity-high").textContent =
            String(data.severity.high).padStart(2, "0");

        document.getElementById("severity-medium").textContent =
            String(data.severity.medium).padStart(2, "0");

        document.getElementById("severity-low").textContent =
            String(data.severity.low).padStart(2, "0");


        // Severity bars
        const total =
            data.severity.critical +
            data.severity.high +
            data.severity.medium +
            data.severity.low;

        if (total > 0) {

            document.getElementById("bar-critical").style.width =
                `${(data.severity.critical / total) * 100}%`;

            document.getElementById("bar-high").style.width =
                `${(data.severity.high / total) * 100}%`;

            document.getElementById("bar-medium").style.width =
                `${(data.severity.medium / total) * 100}%`;

            document.getElementById("bar-low").style.width =
                `${(data.severity.low / total) * 100}%`;

            const donutEl = document.querySelector(".donut");
            if (donutEl) {
                const cPct = (data.severity.critical / total) * 100;
                const hPct = cPct + (data.severity.high / total) * 100;
                const mPct = hPct + (data.severity.medium / total) * 100;
                donutEl.style.background = `conic-gradient(var(--red) 0% ${cPct}%, var(--orange) ${cPct}% ${hPct}%, var(--amber) ${hPct}% ${mPct}%, var(--green) ${mPct}% 100%)`;
            }
        }


        // Sidebar alert count
        const alertsCount =
            document.getElementById("alerts-count");

        if (alertsCount) {

            alertsCount.textContent =
                String(data.total_alerts).padStart(2, "0");

        }


        // Donut total
        const totalEvents =
            document.getElementById("total-events");

        if (totalEvents) {

            totalEvents.textContent =
                data.total_alerts;

        }


        // Security alerts table
        const tableBody =
            document.getElementById("alerts-table-body");

        if (!tableBody) return;

        tableBody.innerHTML = "";


        if (data.alerts.length === 0) {
            const isStandby = !data.target || data.target === "—";
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = `
                <td colspan="5" style="text-align: center; color: ${isStandby ? 'var(--muted)' : 'var(--green)'}; font-weight: 600; padding: 22px;">
                    ${isStandby
                        ? "Awaiting scan data... Enter a target IP above and click <strong>RUN LIVE SCAN</strong>."
                        : `✓ Zero security alerts detected. No vulnerable open ports found on ${data.target}.`}
                </td>
            `;
            tableBody.appendChild(emptyRow);
            return;
        }

        data.alerts.forEach(alert => {

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>
                    <div class="alert-name">
                        <span class="alert-symbol ${alert.severity.toLowerCase()}">!</span>
                        ${alert.message}
                    </div>
                </td>

                <td>
                    <span class="badge ${alert.severity.toLowerCase()}">
                        ${alert.severity}
                    </span>
                </td>

                <td>${data.target}</td>

                <td>${alert.service.toUpperCase()}</td>

                <td>${new Date().toLocaleTimeString()}</td>
            `;

            tableBody.appendChild(row);

        });

    } catch (error) {

        console.error(
            "Alerts API failed:",
            error
        );

    }
}


// =============================
// EVENTS / THREAT ACTIVITY
// =============================

async function loadEvents() {

    try {

        const response =
            await fetch(`${API}/api/events`);

        const data =
            await response.json();

        

         // =============================
        // UPDATE THREAT GRAPH
       // =============================

const chartLine =
    document.querySelector(".chart-line");

if (chartLine && data.history.length > 0) {

    const points = data.history;

    const maxEvents =
        Math.max(...points.map(item => item.count), 1);

    const width = 800;
    const height = 220;

    const step =
        points.length > 1
            ? width / (points.length - 1)
            : width;

let path = "";

points.forEach((item, index) => {

    const x = index * step;

    const y =
        height -
        ((item.count / maxEvents) * height);

    if (index === 0) {

        path = `M${x},${y}`;

    } else {

        const previous = points[index - 1];

        const previousX =
            (index - 1) * step;

        const previousY =
            height -
            ((previous.count / maxEvents) * height);

        const controlX =
            (previousX + x) / 2;

        path +=
            ` Q${controlX},${previousY} ${x},${y}`;
    }

});
    chartLine.setAttribute("d", path);
    const chartAreaFill = document.querySelector(".chart-area-fill");
    if (chartAreaFill && path) {
        chartAreaFill.setAttribute("d", `${path} L${width},${height} L0,${height} Z`);
    }
}


        // =============================
        // THREAT ACTIVITY
        // =============================

        const eventCount =
            document.getElementById("event-count");

        const eventTime =
            document.getElementById("event-time");


        if (eventCount) {

            eventCount.textContent =
                `${data.total_events} EVENTS`;

        }


        if (eventTime) {

            eventTime.textContent =
                new Date().toLocaleTimeString();

        }

        // =============================
       // LIVE GRAPH POINT
      // =============================

       const chart = document.querySelector(".chart");

     if (chart) {

     const oldPoint =
        chart.querySelector(".live-event-point");

     if (oldPoint) {
        oldPoint.remove();
     }

       const point =
        document.createElement("div");

        point.className =
        "live-event-point";

       point.title =
        `${data.total_events} security events`;

      chart.appendChild(point);
}

        // =============================
        // INCIDENT TIMELINE
        // =============================

        const timeline =
            document.getElementById("incident-timeline");


        if (!timeline) return;


        timeline.innerHTML = "";


        if (data.events.length === 0) {
            const isStandby = !data.target || data.target === "—";
            const cleanItem = document.createElement("div");
            cleanItem.className = "timeline-item";
            cleanItem.innerHTML = `
                <span class="timeline-dot" style="background: ${isStandby ? 'var(--camel)' : 'var(--green)'}; box-shadow: 0 0 0 2px ${isStandby ? 'var(--camel-border)' : 'var(--green-border)'};"></span>
                <div>
                    <strong>${isStandby ? "SYSTEM STANDBY / AWAITING TARGET" : "SYSTEM SECURE / NO ACTIVE THREATS"}</strong>
                    <small>${isStandby ? "No target scanned yet. Enter a target IP above and click RUN LIVE SCAN." : `No critical exposed services or anomalous ports detected on ${data.target}.`}</small>
                </div>
            `;
            timeline.appendChild(cleanItem);
            return;
        }

        data.events.forEach(event => {

            const item =
                document.createElement("div");


             item.className = "timeline-item critical-event event-clickable";
             item.dataset.port = event.port;
             item.dataset.service = event.service;
             item.dataset.type = event.type;
             item.dataset.severity = event.severity;


             item.innerHTML = `
                <span class="timeline-dot"></span>

                <div>

                    <strong>
                      ${event.type === "NEW_SERVICE_DETECTED"
                      ? "NEW SERVICE DETECTED"
                      : event.service.toUpperCase() + " service exposed"}
                    </strong>

                   <small>
                     PORT ${event.port}
                     · ${event.type}
                     · ${event.severity}
                     </small>

                </div>
            `;


            timeline.appendChild(item);
            item.onclick = function () {
    showToast(
        "PORT " + event.port + " · " + event.service.toUpperCase() + " · " + event.severity,
        event.severity === "CRITICAL" ? "error" : "warning"
    );
};

        });


    } catch (error) {

        console.error(
            "Events API failed:",
            error
        );


        const timeline =
            document.getElementById("incident-timeline");


        if (timeline) {

            timeline.innerHTML = `
                <div class="timeline-item">

                    <span class="timeline-dot"></span>

                    <div>

                        <strong>
                            Unable to load events
                        </strong>

                        <small>
                            Backend connection failed
                        </small>

                    </div>

                </div>
            `;

        }

    }

}


// =============================
// MITRE ATT&CK
// =============================

async function loadMitre() {

    try {

        const response =
            await fetch(`${API}/api/mitre`);

        const data =
            await response.json();

        console.log("MITRE Data:", data);


        const mitreGrid =
            document.getElementById("mitre-grid");

        const coverageBadge =
            document.getElementById("mitre-coverage") || document.querySelector(".coverage");

        if (coverageBadge && data.total !== undefined) {
            const pct = Math.min(100, Math.round((data.total / 12) * 100));
            coverageBadge.textContent = `${pct}% COVERAGE`;
        }

        if (!mitreGrid) return;


        mitreGrid.innerHTML = "";

        if (data.techniques.length === 0) {
            mitreGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--muted); padding: 22px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px;">
                    No MITRE ATT&CK techniques mapped. Enter a target IP above and click <strong>RUN LIVE SCAN</strong>.
                </div>
            `;
            return;
        }

        data.techniques.forEach(technique => {

            const card =
                document.createElement("div");

            card.className =
                "mitre-card";


            card.innerHTML = `
                <span>${technique.id}</span>

                <strong>
                    ${technique.name}
                </strong>

                <small>
                    ${technique.status}
                </small>
            `;


            mitreGrid.appendChild(card);

        });

    } catch (error) {

        console.error(
            "MITRE API failed:",
            error
        );

    }
}




// =============================
// LIVE FORENSIC TRIAGE (SSH INTERCEPT)
// =============================

async function loadTriage() {
    const targetInput = document.getElementById("scan-target-input");
    const target = (targetInput && targetInput.value.trim()) || currentScanTarget || "";

    const statusEl = document.getElementById("triage-status");
    const uidsEl = document.getElementById("triage-uids");
    const tmpEl = document.getElementById("triage-tmp");
    const cronEl = document.getElementById("triage-cron");

    const bashEl = document.getElementById("triage-bash-history");
    const uidZeroEl = document.getElementById("triage-uid-zero");
    const tmpFilesEl = document.getElementById("triage-tmp-files");

    if (!target || target === "—") {
        if (statusEl) statusEl.textContent = "STANDBY // READY";
        if (uidsEl) uidsEl.textContent = "0";
        if (tmpEl) tmpEl.textContent = "0";
        if (cronEl) cronEl.textContent = "0";
        if (bashEl) bashEl.innerHTML = "# Awaiting SSH session stream... Enter an IP and scan to hook live agent.";
        if (uidZeroEl) uidZeroEl.innerHTML = "# Awaiting user database interrogation...";
        if (tmpFilesEl) tmpFilesEl.innerHTML = "# Awaiting filesystem walk...";
        return;
    }

    try {
        if (statusEl) statusEl.textContent = "PROBING HOST...";
        const res = await fetch(`${API}/api/triage?host=${encodeURIComponent(target)}`);
        const data = await res.json();

        if (statusEl) {
            statusEl.textContent = data.connected ? "ACTIVE SSH SESSION" : (data.fallback_available ? "ARCHIVE TELEMETRY" : "OFFLINE");
            statusEl.style.color = data.connected ? "var(--green-bright)" : "var(--amber-bright)";
        }

        if (uidsEl) uidsEl.textContent = data.uid_zero_users.length;
        if (tmpEl) tmpEl.textContent = data.tmp_files.length;
        if (cronEl) cronEl.textContent = data.cron_jobs.length;

        // Render Bash History
        if (bashEl) {
            if (data.bash_history && data.bash_history.length > 0) {
                bashEl.innerHTML = data.bash_history.map(cmd => {
                    const isDangerous = cmd.includes("1524") || cmd.includes("shadow") || cmd.includes("rootkit") || cmd.includes("useradd");
                    return `<div style="color: ${isDangerous ? '#f87171' : '#fbbf24'}; font-weight: ${isDangerous ? '700' : '400'};">$ ${cmd}</div>`;
                }).join("");
            } else {
                bashEl.innerHTML = "# No recent shell history entries retrieved.";
            }
        }

        // Render UID 0 accounts
        if (uidZeroEl) {
            if (data.uid_zero_users && data.uid_zero_users.length > 0) {
                uidZeroEl.innerHTML = data.uid_zero_users.map(u => {
                    const isClone = u.includes("backdoor") || u.includes("ANOMALOUS");
                    return `<div style="color: ${isClone ? '#f87171' : '#34d399'}; font-weight: 700;">⚠ ${u}</div>`;
                }).join("");
            } else {
                uidZeroEl.innerHTML = "# Only default root account verified.";
            }
        }

        // Render /tmp files
        if (tmpFilesEl) {
            if (data.tmp_files && data.tmp_files.length > 0) {
                tmpFilesEl.innerHTML = data.tmp_files.map(f => {
                    const isRootkit = f.includes("rootkit") || f.includes("exfil");
                    return `<div style="color: ${isRootkit ? '#fbbf24' : '#9ca3af'}; font-size: 10px;">${f}</div>`;
                }).join("");
            } else {
                tmpFilesEl.innerHTML = "# Clean drop zone. No anomalous temporary binaries detected.";
            }
        }

    } catch (e) {
        console.error("Triage fetch failed:", e);
        if (statusEl) statusEl.textContent = "OFFLINE";
    }
}


// =============================
// CVE VULNERABILITY INTELLIGENCE
// =============================

async function loadCVE() {
    try {
        const response = await fetch(`${API}/api/cve`);
        const data = await response.json();

        console.log("CVE Intelligence Data:", data);

        // Update summary cards
        const cveTotal = document.getElementById("cve-total");
        const cveCritical = document.getElementById("cve-critical");
        const cveHigh = document.getElementById("cve-high");
        const cveAffected = document.getElementById("cve-affected");
        const sidebarCve = document.getElementById("sidebar-cve-count");

        if (cveTotal) cveTotal.textContent = String(data.total_cves).padStart(2, "0");
        if (cveCritical) cveCritical.textContent = String(data.critical_cves).padStart(2, "0");
        if (cveHigh) cveHigh.textContent = String(data.high_cves).padStart(2, "0");
        if (cveAffected) cveAffected.textContent = String(data.services_affected).padStart(2, "0");
        if (sidebarCve) sidebarCve.textContent = String(data.total_cves).padStart(2, "0");

        // Table
        const tableBody = document.getElementById("cve-table-body");
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (data.total_cves === 0) {
            const isStandby = !data.target || data.target === "—";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td colspan="7" style="text-align: center; color: ${isStandby ? 'var(--muted)' : 'var(--green)'}; font-weight: 600; padding: 22px;">
                    ${isStandby ? "Awaiting scan... Enter a target IP above and click <strong>RUN LIVE SCAN</strong> to detect CVE vulnerabilities." : `✓ Zero known CVE vulnerabilities detected on ${data.target}. All active services are secure or filtered.`}
                </td>
            `;
            tableBody.appendChild(row);
            return;
        }

        data.results.forEach(service => {
            service.cves.forEach(cve => {
                const row = document.createElement("tr");
                const sev = (cve.severity || "MEDIUM").toLowerCase();

                row.innerHTML = `
                    <td>
                        <span class="cve-id-badge">
                            <b>${cve.id}</b>
                        </span>
                    </td>
                    <td><b>${service.port}</b>/${service.protocol}</td>
                    <td>${service.product}</td>
                    <td>${service.version}</td>
                    <td>
                        <span class="cvss-score-pill ${sev}">
                            ${Number(cve.score).toFixed(1)}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${sev}">
                            ${cve.severity}
                        </span>
                    </td>
                    <td style="color: var(--text-secondary); font-size: 11px;">
                        ${cve.description}
                    </td>
                `;

                tableBody.appendChild(row);
            });
        });

    } catch (error) {
        console.error("CVE API failed:", error);
        const tableBody = document.getElementById("cve-table-body");
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--red); padding: 18px;">
                        Unable to connect to CVE intelligence database.
                    </td>
                </tr>
            `;
        }
    }
}


// =============================
// LIVE CLOCK
// =============================

function updateClock() {
    const clock = document.getElementById("clock");
    if (clock) {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, "0");
        const mins = String(now.getMinutes()).padStart(2, "0");
        const secs = String(now.getSeconds()).padStart(2, "0");
        clock.textContent = `${hrs}:${mins}:${secs} [LIVE]`;
    }
}

updateClock();
setInterval(updateClock, 1000);


setInterval(() => {
    loadEvents();
}, 15000);


// =============================
// REFRESH SCAN BUTTON / LIVE NMAP
// =============================

const refreshButton =
    document.getElementById("refresh-scan");

if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
        const targetInput = document.getElementById("scan-target-input");
        const target = (targetInput && targetInput.value.trim());
        if (!target) {
            showToast("Please enter a target IP address before scanning.", "warning");
            return;
        }

        refreshButton.disabled = true;
        refreshButton.textContent = "SCANNING NMAP...";
        showToast(`Running live Nmap scan on ${target}... Please wait.`, "warning");

        try {
            const res = await fetch(`${API}/api/run-scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target: target })
            });
            const result = await res.json();

            if (res.ok && result.status === "success") {
                showToast(`Live Nmap scan complete on ${target}! Updating telemetry...`, "success");
                await loadScanData();
                await loadAlerts();
                await loadEvents();
                await loadMitre();
                await loadCVE();
loadTriage();
                await loadTriage();
                await loadCases();
                await loadEvidence();
                await loadReports();
            } else {
                showToast(`Nmap scan failed: ${result.error || "Unknown error"}`, "error");
            }
        } catch (error) {
            console.error("Live scan failed:", error);
            showToast("Failed to connect to scan service.", "error");
        } finally {
            refreshButton.disabled = false;
            refreshButton.textContent = "RUN LIVE SCAN";
        }
    });
}

// =============================
// AUTOMATIC TELEMETRY REFRESH
// =============================

// (Single setInterval for loadEvents already set above)

// =============================
// CASES / INCIDENT MANAGEMENT
// =============================
async function loadCases() {
    try {
        const response = await fetch(`${API}/api/cases`);
        const data = await response.json();

        console.log("Cases Data:", data);

        // Top dashboard metrics
        const casesCount =
            document.getElementById("cases-count");

        const highPriorityCount =
            document.getElementById("high-priority-count");

        if (casesCount) {
            casesCount.textContent =
                String(data.open_cases).padStart(2, "0");
        }

        if (highPriorityCount) {
            highPriorityCount.textContent =
                String(data.high_priority).padStart(2, "0");
        }

        const incidentsStrip = document.getElementById("active-incidents-strip");
        if (incidentsStrip && data.active_incidents !== undefined) {
            incidentsStrip.textContent = `${String(data.active_incidents).padStart(2, "0")} INVESTIGATING`;
        }

        const sidebarCases = document.getElementById("sidebar-cases-count");
        if (sidebarCases && data.cases) {
            sidebarCases.textContent = String(data.cases.length).padStart(2, "0");
        }

        // Case panel summary
        const openCases =
            document.getElementById("case-open");

        const incidents =
            document.getElementById("case-incidents");

        const highCases =
            document.getElementById("case-high");

        if (openCases) {
            openCases.textContent = data.open_cases;
        }

        if (incidents) {
            incidents.textContent = data.active_incidents;
        }

        if (highCases) {
            highCases.textContent = data.high_priority;
        }

        // Case table
        const table =
            document.getElementById("case-table-body");

        if (!table) return;

        table.innerHTML = "";

        const cases = data.cases || [];

        if (cases.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="5">No cases found</td>
                </tr>
            `;
            return;
        }

        cases.forEach(item => {
            const row = document.createElement("tr");

            row.style.cursor = "pointer";

row.addEventListener("click", () => {
    showToast(
        "CASE-" + String(item.id).padStart(3, "0") + " · " + item.title + " · " + (item.status || "OPEN"),
        "info"
    );
});

            const caseId = `CASE-${String(item.id).padStart(3, "0")}`;
            const priority = (item.severity || "MEDIUM").toUpperCase();
            const status = (item.status || "OPEN").toUpperCase();
            const target = item.target || "—";

            row.innerHTML = `
                <td>${caseId}</td>
                <td>${item.title}</td>
                <td>${target}</td>
                <td>
                    <span class="case-priority ${priority.toLowerCase()}">
                        ${priority}
                    </span>
                </td>
                <td>
                    <span class="case-status">
                        ${status}
                    </span>
                </td>
            `;

            table.appendChild(row);
        });

    } catch (error) {
        console.error("Cases API failed:", error);
    }
}

// =============================
// EVIDENCE
// =============================
async function loadEvidence() {
    try {
        const response = await fetch(`${API}/api/evidence`);
        const data = await response.json();

        console.log("Evidence Data:", data);

        // Top dashboard metric
        const evidenceCount =
            document.getElementById("evidence-count");

        const evidenceWeek =
            document.getElementById("evidence-week");

        if (evidenceCount) {
            evidenceCount.textContent =
                String(data.total_evidence).padStart(2, "0");
        }

        if (evidenceWeek) {
            evidenceWeek.textContent =
                `+${data.this_week}`;
        }

        // Evidence panel
        const total =
            document.getElementById("evidence-total");

        const weekly =
            document.getElementById("evidence-new");

        const endpoint =
            document.getElementById("evidence-endpoint");

        if (total) {
            total.textContent = data.total_evidence;
        }

        if (weekly) {
            weekly.textContent = `+${data.this_week}`;
        }

        if (endpoint) {
            endpoint.textContent = data.endpoint;
        }

        // Evidence table
        const table =
            document.getElementById("evidence-table-body");

        if (!table) return;

        table.innerHTML = "";

        if (data.evidence.length === 0) {
            const isStandby = !data.endpoint || data.endpoint === "—";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td colspan="4" style="text-align: center; color: var(--muted); padding: 18px;">
                    ${isStandby ? "Awaiting scan data... Enter a target IP above and click RUN LIVE SCAN." : `No evidence of exposed services found on ${data.endpoint}.`}
                </td>
            `;
            table.appendChild(row);
            return;
        }

        data.evidence.forEach(item => {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.type}</td>
                <td>${item.source}</td>
                <td>${item.status}</td>
            `;

            table.appendChild(row);
        });

    } catch (error) {
        console.error("Evidence API failed:", error);
    }
}

loadCases();
loadEvidence();
loadScanData();
loadAlerts();
loadEvents();
loadMitre();
loadCVE();
loadTriage();

// =============================
// REPORTS
// =============================

async function loadReports() {
    try {
        const scanResponse = await fetch(`${API}/api/scan`);
        const scanData = await scanResponse.json();

        const alertResponse = await fetch(`${API}/api/alerts`);
        const alertData = await alertResponse.json();

        // Report summary
        const target = document.getElementById("report-target");
        const ports = document.getElementById("report-ports");
        const critical = document.getElementById("report-critical");

        if (target) {
            target.textContent = scanData.target;
        }

        if (ports) {
            ports.textContent = scanData.open_ports;
        }

        if (critical) {
            critical.textContent = alertData.total_alerts;
        }

    } catch (error) {
        console.error("Reports API failed:", error);
    }
}


// Generate Executive Styled Briefing / PDF Print Window
async function generateReport() {
    const button = document.getElementById("generate-report");
    if (!button) return;

    try {
        button.disabled = true;
        button.textContent = "COMPILING EXECUTIVE BRIEFING...";

        const scanResponse = await fetch(`${API}/api/scan`);
        const scanData = await scanResponse.json();

        const alertResponse = await fetch(`${API}/api/alerts`);
        const alertData = await alertResponse.json();

        let cveData = { total_cves: 0, critical_cves: 0, results: [] };
        try {
            const cveRes = await fetch(`${API}/api/cve`);
            cveData = await cveRes.json();
        } catch(e) {}

        // Open High-End Printable Executive PDF Window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <title>SENTINEL // EXECUTIVE SOC & DFIR BRIEFING - ${scanData.target}</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #ffffff; color: #111827; padding: 40px; margin: 0; line-height: 1.5; }
        .header { border-bottom: 3px solid #b45309; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
        .classification { background: #b91c1c; color: #ffffff; padding: 6px 14px; font-weight: 800; font-size: 11px; letter-spacing: 2px; border-radius: 3px; display: inline-block; margin-bottom: 10px; }
        h1 { margin: 0; font-size: 24px; color: #111827; letter-spacing: 1px; }
        .meta { color: #6b7280; font-size: 12px; margin-top: 6px; }
        .defcon-badge { background: #fee2e2; border: 1px solid #ef4444; color: #b91c1c; padding: 10px 18px; border-radius: 6px; font-weight: 800; font-size: 14px; text-align: right; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 30px; }
        .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px; }
        .stat-card small { display: block; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
        .stat-card strong { display: block; font-size: 22px; font-weight: 800; color: #111827; margin-top: 4px; }
        h2 { font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-top: 30px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
        th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-weight: 700; border-bottom: 2px solid #e5e7eb; font-size: 11px; }
        td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; }
        .pill { display: inline-block; padding: 2px 7px; border-radius: 3px; font-weight: 700; font-size: 10px; }
        .critical { background: #fee2e2; color: #991b1b; }
        .high { background: #ffedd5; color: #9a3412; }
        .medium { background: #fef3c7; color: #92400e; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
        @media print { .no-print { display: none; } body { padding: 0; } }
    </style>
</head>
<body>
    <div class="no-print" style="background: #111827; color: #ffffff; padding: 14px 24px; margin: -40px -40px 30px -40px; display: flex; justify-content: space-between; align-items: center;">
        <span><strong>SENTINEL EXECUTIVE PDF BRIEFING GENERATOR</strong> // Ready for print & archival</span>
        <div>
            <button onclick="window.print()" style="background: #f59e0b; color: #000; font-weight: 800; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px;">SAVE AS PDF / PRINT</button>
            <button onclick="window.close()" style="background: #374151; color: #fff; border: none; padding: 8px 14px; border-radius: 4px; cursor: pointer;">CLOSE</button>
        </div>
    </div>

    <div class="header">
        <div>
            <div class="classification">CONFIDENTIAL // SOC INCIDENT BRIEFING</div>
            <h1>SENTINEL DIGITAL FORENSICS & THREAT ASSESSMENT</h1>
            <div class="meta">TARGET NODE: <strong>${scanData.target}</strong> | GENERATED: <strong>${new Date().toLocaleString()}</strong> | ANALYST: <strong>CALLSIGN VIPER-1</strong></div>
        </div>
        <div class="defcon-badge">
            STATUS: ${scanData.open_ports > 5 ? 'DEFCON 1 HOSTILE' : 'DEFCON 3 CAUTION'}<br>
            <span style="font-size: 10px; font-weight: 500;">COMPROMISE CONFIRMED</span>
        </div>
    </div>

    <div class="grid">
        <div class="stat-card">
            <small>TARGET IP</small>
            <strong>${scanData.target}</strong>
        </div>
        <div class="stat-card">
            <small>OPEN PORTS</small>
            <strong>${scanData.open_ports}</strong>
        </div>
        <div class="stat-card">
            <small>KNOWN CVES</small>
            <strong style="color: #b91c1c;">${cveData.total_cves}</strong>
        </div>
        <div class="stat-card">
            <small>CRITICAL ALERTS</small>
            <strong style="color: #b91c1c;">${alertData.total_alerts}</strong>
        </div>
    </div>

    <h2>1. CRITICAL CVE VULNERABILITY EXPLOIT MATRIX</h2>
    <table>
        <thead>
            <tr>
                <th>CVE IDENTIFIER</th>
                <th>PORT</th>
                <th>TARGET COMPONENT</th>
                <th>CVSS SCORE</th>
                <th>SEVERITY</th>
                <th>EXPLOIT PROFILE</th>
            </tr>
        </thead>
        <tbody>
            ${cveData.results.flatMap(s => s.cves.map(c => `
                <tr>
                    <td><strong>${c.id}</strong></td>
                    <td>:${s.port}</td>
                    <td>${s.product}</td>
                    <td><span class="pill ${c.severity.toLowerCase()}">${c.score}</span></td>
                    <td><span class="pill ${c.severity.toLowerCase()}">${c.severity}</span></td>
                    <td>${c.description}</td>
                </tr>
            `)).join('') || '<tr><td colspan="6">No CVE vulnerabilities mapped.</td></tr>'}
        </tbody>
    </table>

    <h2>2. DISCOVERED OPEN ATTACK SURFACES & PROTOCOLS</h2>
    <table>
        <thead>
            <tr>
                <th>PORT</th>
                <th>PROTOCOL</th>
                <th>SERVICE NAME</th>
                <th>DETECTED PRODUCT</th>
                <th>SOFTWARE VERSION</th>
                <th>STATUS</th>
            </tr>
        </thead>
        <tbody>
            ${scanData.ports.map(p => `
                <tr>
                    <td><strong>${p.port}</strong></td>
                    <td>${p.protocol.toUpperCase()}</td>
                    <td>${p.service}</td>
                    <td>${p.product || '—'}</td>
                    <td>${p.version || '—'}</td>
                    <td><span class="pill ${p.state === 'open' ? 'critical' : 'medium'}">${p.state.toUpperCase()}</span></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>3. DETECTED HOST INTERCEPTS & ACTIVE THREATS</h2>
    <table>
        <thead>
            <tr>
                <th>CLASSIFICATION</th>
                <th>SEVERITY</th>
                <th>SOURCE</th>
                <th>MESSAGE</th>
            </tr>
        </thead>
        <tbody>
            ${alertData.alerts.map(a => `
                <tr>
                    <td><strong>INTERCEPT-${a.port}</strong></td>
                    <td><span class="pill ${a.severity.toLowerCase()}">${a.severity}</span></td>
                    <td>:${a.port} / ${a.service}</td>
                    <td>${a.message}</td>
                </tr>
            `).join('') || '<tr><td colspan="4">No security intercepts triggered.</td></tr>'}
        </tbody>
    </table>

    <div class="footer">
        <span>SENTINEL CYBER DEFENSE INCIDENT RESPONSE PLATFORM // CERTIFIED CHAIN OF CUSTODY</span>
        <span>PAGE 1 OF 1 // PRODUCED BY AUTONOMOUS AGENT</span>
    </div>
</body>
</html>
            `);
            printWindow.document.close();
        }

        button.textContent = "EXECUTIVE BRIEFING OPENED ✓";
        showToast("Executive PDF Briefing window generated. Click 'Save as PDF' to export.", "success");

        setTimeout(() => {
            button.textContent = "DOWNLOAD TACTICAL REPORT →";
            button.disabled = false;
        }, 2500);

    } catch (error) {
        console.error("Report generation failed:", error);
        button.textContent = "GENERATION FAILED";
        setTimeout(() => {
            button.textContent = "DOWNLOAD TACTICAL REPORT →";
            button.disabled = false;
        }, 2000);
    }
}

// Load report data
loadReports();


// Generate report button
const reportButton =
    document.getElementById("generate-report");

if (reportButton) {
    reportButton.addEventListener(
        "click",
        generateReport
    );
}

document.addEventListener("DOMContentLoaded", function () {

    const newCaseButton = document.getElementById("new-case-button");
    const modal = document.getElementById("new-case-modal");
    const closeButton = document.getElementById("close-case-modal");
    const cancelButton = document.getElementById("cancel-case");
    const createButton = document.getElementById("create-case");

    // OPEN
    newCaseButton.onclick = function () {
        const endpointInput = document.getElementById("new-case-endpoint");
        if (endpointInput && currentScanTarget) {
            endpointInput.value = currentScanTarget;
        }
        modal.classList.add("active");
    };

    // CLOSE
    closeButton.onclick = function () {
        modal.classList.remove("active");
    };

    cancelButton.onclick = function () {
        modal.classList.remove("active");
    };

     // CREATE
    createButton.onclick = async function () {
        const title = document.getElementById("new-case-title").value.trim();
        const description = document.getElementById("new-case-description").value.trim();
        const priorityElement = document.getElementById("new-case-priority");
        const severity = priorityElement ? priorityElement.value : "MEDIUM";
        const endpointInput = document.getElementById("new-case-endpoint");
        const target = (endpointInput && endpointInput.value.trim()) || currentScanTarget || "127.0.0.1";

        if (title === "") {
            showToast("Case title is required.", "warning");
            return;
        }

        createButton.disabled = true;
        createButton.textContent = "CREATING...";

        try {
            const response = await fetch(`${API}/api/cases`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    severity: severity,
                    target: target
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Failed to create case");
            }

            showToast("Case created: CASE-" + String(result.case.id).padStart(3, "0"), "success");

            modal.classList.remove("active");

            document.getElementById("new-case-title").value = "";
            document.getElementById("new-case-description").value = "";

            if (typeof loadCases === "function") {
                loadCases();
            }
        } catch (error) {
            console.error("Case creation failed:", error);
            showToast("Error: " + error.message, "error");
             } finally {
            createButton.disabled = false;
            createButton.textContent = "CREATE CASE";
        }
    };
});

// =============================
// NOTIFICATION BUTTON
// =============================

document.addEventListener("DOMContentLoaded", function () {

    const notificationButton =
        document.getElementById("notification-button");

    if (!notificationButton) return;

    notificationButton.onclick = async function () {
        try {
            const r = await fetch(`${API}/api/alerts`);
            const d = await r.json();
            showToast(
                d.severity.critical + " CRITICAL · " + d.severity.high + " HIGH · " + d.severity.medium + " MEDIUM alerts on " + d.target,
                d.severity.critical > 0 ? "error" : "warning"
            );
        } catch(e) {
            showToast("Could not fetch alert data.", "error");
        }
    };

});

// =============================
// VIEW ALL SECURITY ALERTS
// =============================

document.addEventListener("DOMContentLoaded", function () {

    const viewAllButton =
        document.getElementById("view-all-alerts");

    const modal =
        document.getElementById("alerts-modal");

    const closeButton =
        document.getElementById("close-alerts-modal");

    const table =
        document.getElementById("all-alerts-table-body");

    if (!viewAllButton || !modal) return;

    // OPEN
    viewAllButton.onclick = async function () {

        modal.classList.add("active");

        try {

            const response =
                await fetch(`${API}/api/alerts`);

            const data =
                await response.json();

            // SUMMARY
            document.getElementById("modal-total-alerts").textContent =
                data.total_alerts;

            document.getElementById("modal-critical-alerts").textContent =
                data.severity.critical;

            document.getElementById("modal-high-alerts").textContent =
                data.severity.high;

            document.getElementById("modal-medium-alerts").textContent =
                data.severity.medium;

            // TABLE
            table.innerHTML = "";

            data.alerts.forEach(alert => {

                const row =
                    document.createElement("tr");

                row.innerHTML = `
                    <td>
                        ${alert.message}
                    </td>

                    <td>
                        <span class="alerts-severity ${alert.severity.toLowerCase()}">
                            ${alert.severity}
                        </span>
                    </td>

                    <td>
                        ${alert.port}
                    </td>

                    <td>
                        ${data.target}
                    </td>

                    <td>
                        ${alert.service}
                    </td>
                `;

                table.appendChild(row);

            });

        } catch (error) {

            console.error(
                "Alerts modal failed:",
                error
            );

            table.innerHTML = `
                <tr>
                    <td colspan="5">
                        Unable to load security alerts.
                    </td>
                </tr>
            `;

        }

    };

    // CLOSE
    closeButton.onclick = function () {
        modal.classList.remove("active");
    };

    // CLOSE WHEN CLICKING OUTSIDE
    modal.onclick = function (event) {

        if (event.target === modal) {
            modal.classList.remove("active");
        }

    };

});

// =============================
// EXPAND INCIDENT TIMELINE
// =============================

document.addEventListener("DOMContentLoaded", function () {

    const expandButton =
        document.getElementById("expand-timeline");

    const modal =
        document.getElementById("timeline-modal");

    const closeButton =
        document.getElementById("close-timeline-modal");

    const expandedTimeline =
        document.getElementById("expanded-timeline");

    if (!expandButton || !modal) return;

    expandButton.onclick = async function () {

        modal.classList.add("active");

        try {

            const response =
                await fetch(`${API}/api/events`);

            const data =
                await response.json();

            expandedTimeline.innerHTML = "";

            data.events.forEach(event => {

                const item =
                    document.createElement("div");

                item.className =
                    "timeline-item critical-event";

                item.innerHTML = `
                    <span class="timeline-dot"></span>

                    <div>

                        <strong>
                           ${event.type === "NEW_SERVICE_DETECTED"
                            ? "NEW SERVICE DETECTED"
                            : event.service.toUpperCase() + " service exposed"}
                        </strong>

                        <small>
                            PORT ${event.port}
                            · ${event.type}
                            · ${event.severity}
                        </small>

                    </div>
                `;

                expandedTimeline.appendChild(item);

            });

        } catch (error) {

            console.error(
                "Timeline expand failed:",
                error
            );

        }

    };

    closeButton.onclick = function () {
        modal.classList.remove("active");
    };

    modal.onclick = function (event) {

        if (event.target === modal) {
            modal.classList.remove("active");
        }

    };

});

// =============================
// SIDEBAR NAVIGATION
// =============================

document.addEventListener("DOMContentLoaded", function() {
    const navItems = document.querySelectorAll(".nav-item");
    const sections = {
        "Dashboard": null, // top
        "Attack Path": document.getElementById("attack-path-section"),
        "Alerts": document.querySelector(".alerts-panel"),
        "Cases": document.querySelector(".cases-panel"),
        "Timeline": document.querySelector(".timeline-panel"),
        "Endpoints": document.querySelector(".endpoint-panel"),
        "Evidence": document.querySelector(".evidence-panel"),
        "SSH Triage": document.getElementById("triage-section"),
        "CVE Lookup": document.querySelector(".cve-panel"),
        "MITRE ATT&CK": document.querySelector(".mitre-panel"),
        "Reports": document.querySelector(".reports-panel")
    };

    navItems.forEach(item => {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove("active"));
            this.classList.add("active");
            const label = this.querySelector("span:nth-child(2)")?.textContent.trim();
            const target = sections[label];
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });
});
