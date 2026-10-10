use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const SERIAL_DATA_EVENT: &str = "serial-data";
const SERIAL_STATUS_EVENT: &str = "serial-status";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    pub path: String,
    pub name: String,
    pub port_type: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialStatus {
    pub connected: bool,
    pub path: Option<String>,
    pub baud_rate: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialDataPayload {
    pub data: String,
}

struct OpenPort {
    path: String,
    baud_rate: u32,
    stop: Arc<AtomicBool>,
    writer: Arc<Mutex<Box<dyn serialport::SerialPort>>>,
    reader: Option<JoinHandle<()>>,
}

pub struct SerialState {
    inner: Mutex<Option<OpenPort>>,
}

impl Default for SerialState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

fn port_type_label(port_type: &serialport::SerialPortType) -> String {
    match port_type {
        serialport::SerialPortType::UsbPort(info) => {
            let mut label = "USB".to_string();
            if let Some(product) = &info.product {
                label.push_str(": ");
                label.push_str(product);
            } else if let Some(manufacturer) = &info.manufacturer {
                label.push_str(": ");
                label.push_str(manufacturer);
            }
            label
        }
        serialport::SerialPortType::PciPort => "PCI".into(),
        serialport::SerialPortType::BluetoothPort => "Bluetooth".into(),
        serialport::SerialPortType::Unknown => "Unknown".into(),
    }
}

fn emit_status(app: &AppHandle, status: SerialStatus) {
    let _ = app.emit(SERIAL_STATUS_EVENT, status);
}

fn close_inner(port: &mut Option<OpenPort>) {
    if let Some(open) = port.take() {
        open.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = open.reader {
            let _ = handle.join();
        }
    }
}

#[tauri::command]
pub fn serial_list_ports() -> Result<Vec<PortInfo>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    let mut result: Vec<PortInfo> = ports
        .into_iter()
        .map(|p| PortInfo {
            name: p.port_name.clone(),
            path: p.port_name,
            port_type: port_type_label(&p.port_type),
        })
        .collect();
    result.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(result)
}

#[tauri::command]
pub fn serial_get_status(state: State<'_, SerialState>) -> SerialStatus {
    let guard = state.inner.lock().unwrap_or_else(|e| e.into_inner());
    match guard.as_ref() {
        Some(open) => SerialStatus {
            connected: true,
            path: Some(open.path.clone()),
            baud_rate: Some(open.baud_rate),
            error: None,
        },
        None => SerialStatus {
            connected: false,
            path: None,
            baud_rate: None,
            error: None,
        },
    }
}

#[tauri::command]
pub fn serial_open(
    app: AppHandle,
    state: State<'_, SerialState>,
    path: String,
    baud_rate: u32,
) -> Result<SerialStatus, String> {
    let mut guard = state.inner.lock().unwrap_or_else(|e| e.into_inner());
    close_inner(&mut guard);

    let port = serialport::new(&path, baud_rate)
        .timeout(Duration::from_millis(50))
        .open()
        .map_err(|e| format!("Failed to open {path}: {e}"))?;

    let writer = Arc::new(Mutex::new(port.try_clone().map_err(|e| e.to_string())?));
    let mut reader_port = port;
    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = Arc::clone(&stop);
    let app_handle = app.clone();
    let path_for_thread = path.clone();

    let reader = thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        let mut pending = String::new();

        while !stop_flag.load(Ordering::SeqCst) {
            match reader_port.read(&mut buffer) {
                Ok(0) => thread::sleep(Duration::from_millis(10)),
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buffer[..n]);
                    pending.push_str(&chunk);

                    while let Some(idx) = pending.find(['\n', '\r']) {
                        let mut line = pending[..idx].to_string();
                        let rest = pending[idx..].trim_start_matches(['\n', '\r']);
                        pending = rest.to_string();
                        if !line.is_empty() {
                            // Keep CR-stripped line output
                            line = line.trim_end_matches('\r').to_string();
                            let _ = app_handle.emit(
                                SERIAL_DATA_EVENT,
                                SerialDataPayload { data: line },
                            );
                        }
                    }

                    // Flush incomplete line if buffer grows too large
                    if pending.len() > 4096 {
                        let _ = app_handle.emit(
                            SERIAL_DATA_EVENT,
                            SerialDataPayload {
                                data: std::mem::take(&mut pending),
                            },
                        );
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(e) => {
                    emit_status(
                        &app_handle,
                        SerialStatus {
                            connected: false,
                            path: Some(path_for_thread.clone()),
                            baud_rate: None,
                            error: Some(format!("Serial read error: {e}")),
                        },
                    );
                    break;
                }
            }
        }

        if !pending.is_empty() {
            let _ = app_handle.emit(
                SERIAL_DATA_EVENT,
                SerialDataPayload {
                    data: std::mem::take(&mut pending),
                },
            );
        }
    });

    *guard = Some(OpenPort {
        path: path.clone(),
        baud_rate,
        stop,
        writer,
        reader: Some(reader),
    });

    let status = SerialStatus {
        connected: true,
        path: Some(path),
        baud_rate: Some(baud_rate),
        error: None,
    };
    emit_status(&app, status.clone());
    Ok(status)
}

#[tauri::command]
pub fn serial_close(
    app: AppHandle,
    state: State<'_, SerialState>,
) -> Result<SerialStatus, String> {
    let mut guard = state.inner.lock().unwrap_or_else(|e| e.into_inner());
    close_inner(&mut guard);
    let status = SerialStatus {
        connected: false,
        path: None,
        baud_rate: None,
        error: None,
    };
    emit_status(&app, status.clone());
    Ok(status)
}

#[tauri::command]
pub fn serial_write(state: State<'_, SerialState>, data: String) -> Result<(), String> {
    let guard = state.inner.lock().unwrap_or_else(|e| e.into_inner());
    let open = guard
        .as_ref()
        .ok_or_else(|| "Serial port is not connected".to_string())?;

    let mut port = open
        .writer
        .lock()
        .map_err(|_| "Serial port lock poisoned".to_string())?;

    port.write_all(data.as_bytes())
        .map_err(|e| format!("Write failed: {e}"))?;
    port.flush().map_err(|e| format!("Flush failed: {e}"))?;
    Ok(())
}
