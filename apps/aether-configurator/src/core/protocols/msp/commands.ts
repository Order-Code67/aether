/** Common MSP command IDs (Betaflight / iNav compatible subset). */

export const MSP_API_VERSION = 1;
export const MSP_FC_VARIANT = 2;
export const MSP_FC_VERSION = 3;
export const MSP_BOARD_INFO = 4;
export const MSP_BUILD_INFO = 5;
export const MSP_NAME = 10;
export const MSP_SET_NAME = 11;
export const MSP_STATUS = 101;
export const MSP_RAW_IMU = 102;
export const MSP_SERVO = 103;
export const MSP_MOTOR = 104;
export const MSP_RC = 105;
export const MSP_RAW_GPS = 106;
export const MSP_COMP_GPS = 107;
export const MSP_ATTITUDE = 108;
export const MSP_ALTITUDE = 109;
export const MSP_ANALOG = 110;
export const MSP_BOXNAMES = 116;
export const MSP_PIDNAMES = 117;
export const MSP_BOXIDS = 119;
export const MSP_MOTOR_TELEMETRY = 139;
export const MSP_STATUS_EX = 150;
export const MSP_UID = 160;
export const MSP_FEATURE_CONFIG = 36;
export const MSP_RX_CONFIG = 44;
export const MSP_FAILSAFE_CONFIG = 75;
export const MSP_MODE_RANGES = 34;
export const MSP_SET_MODE_RANGE = 35;
export const MSP_CF_SERIAL_CONFIG = 54;
export const MSP_SET_CF_SERIAL_CONFIG = 55;
export const MSP_OSD_CONFIG = 84;
export const MSP_SET_MOTOR = 214;
export const MSP_FILTER_CONFIG = 92;
export const MSP_SET_FILTER_CONFIG = 93;
export const MSP_RC_TUNING = 111;
export const MSP_PID = 112;
export const MSP_SET_PID = 202;
export const MSP_SET_RC_TUNING = 204;
/** Keep craft level and still — calibrates accelerometer offsets. */
export const MSP_ACC_CALIBRATION = 205;
/** Rotate craft through all axes until FC finishes mag cal. */
export const MSP_MAG_CALIBRATION = 206;
export const MSP_EEPROM_WRITE = 250;

/** Telemetry used by Setup / Calibration live view. */
export const MSP_SETUP_LIVE_CMDS: number[] = [
  MSP_ATTITUDE,
  MSP_RC,
  MSP_RAW_IMU,
  MSP_STATUS_EX,
  MSP_STATUS,
];

/** Commands used by the Dashboard identity / status poll. */
export const MSP_STATUS_POLL_CMDS: number[] = [
  MSP_API_VERSION,
  MSP_FC_VARIANT,
  MSP_FC_VERSION,
  MSP_NAME,
  MSP_STATUS_EX,
  MSP_STATUS,
  MSP_ANALOG,
  MSP_RAW_GPS,
];
