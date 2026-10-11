/** IPC channel names shared by main and preload. Keep in sync with renderer bridge. */
export const IpcChannels = {
  SERIAL_LIST: "serial:list",
  SERIAL_OPEN: "serial:open",
  SERIAL_CLOSE: "serial:close",
  SERIAL_WRITE: "serial:write",
  SERIAL_WRITE_BYTES: "serial:write-bytes",
  SERIAL_STATUS: "serial:status",
  SERIAL_DATA: "serial:data",
  SERIAL_BYTES: "serial:bytes",
  SERIAL_STATUS_EVENT: "serial:status-event",

  NET_OPEN_TCP: "net:open-tcp",
  NET_OPEN_UDP: "net:open-udp",
  NET_CLOSE: "net:close",
  NET_WRITE_BYTES: "net:write-bytes",
  NET_STATUS: "net:status",
  NET_BYTES: "net:bytes",
  NET_STATUS_EVENT: "net:status-event",

  APP_GET_VERSION: "app:get-version",
  APP_GET_PATHS: "app:get-paths",
  APP_CHECK_UPDATE: "app:check-update",

  DIALOG_OPEN_FILE: "dialog:open-file",
  FS_READ_FILE: "fs:read-file",

  DFU_DETECT: "dfu:detect",
  DFU_LIST: "dfu:list",
  DFU_FLASH: "dfu:flash",
  DFU_OUTPUT: "dfu:output",
  DFU_STATUS: "dfu:status",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
