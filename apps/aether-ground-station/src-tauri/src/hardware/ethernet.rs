use serde::Serialize;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterfaceInfo {
    pub name: String,
    pub ipv4: Option<String>,
    pub mac: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostProbeResult {
    pub ok: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn list_network_interfaces() -> Result<Vec<NetworkInterfaceInfo>, String> {
    let ifaces = if_addrs::get_if_addrs().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for iface in ifaces {
        if iface.is_loopback() {
            continue;
        }
        match iface.addr {
            if_addrs::IfAddr::V4(v4) => {
                out.push(NetworkInterfaceInfo {
                    name: iface.name,
                    ipv4: Some(v4.ip.to_string()),
                    mac: None,
                });
            }
            _ => {}
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[tauri::command]
pub fn probe_host(host: String, port: u16, timeout_ms: u64) -> HostProbeResult {
    let target = format!("{host}:{port}");
    let addrs = match target.to_socket_addrs() {
        Ok(a) => a.collect::<Vec<SocketAddr>>(),
        Err(e) => {
            return HostProbeResult {
                ok: false,
                latency_ms: None,
                error: Some(format!("DNS/адрес: {e}")),
            };
        }
    };
    if addrs.is_empty() {
        return HostProbeResult {
            ok: false,
            latency_ms: None,
            error: Some("Адрес не найден".into()),
        };
    }
    let timeout = Duration::from_millis(timeout_ms.max(200));
    let start = Instant::now();
    match TcpStream::connect_timeout(&addrs[0], timeout) {
        Ok(_) => HostProbeResult {
            ok: true,
            latency_ms: Some(start.elapsed().as_millis() as u64),
            error: None,
        },
        Err(e) => HostProbeResult {
            ok: false,
            latency_ms: None,
            error: Some(e.to_string()),
        },
    }
}
