use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbDeviceInfo {
    pub id: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
}

#[tauri::command]
pub fn list_usb_devices() -> Result<Vec<UsbDeviceInfo>, String> {
    let mut out = Vec::new();
    let devices = nusb::list_devices().map_err(|e| format!("USB enumeration failed: {e}"))?;
    for dev in devices {
        let vid = dev.vendor_id();
        let pid = dev.product_id();
        out.push(UsbDeviceInfo {
            id: format!(
                "usb:{:04x}:{:04x}:{}",
                vid,
                pid,
                dev.serial_number().unwrap_or("unknown")
            ),
            vendor_id: vid,
            product_id: pid,
            manufacturer: dev.manufacturer_string().map(|s| s.to_string()),
            product: dev.product_string().map(|s| s.to_string()),
            serial_number: dev.serial_number().map(|s| s.to_string()),
        });
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}
