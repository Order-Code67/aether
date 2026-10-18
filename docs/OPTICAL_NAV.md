# Optical navigation (GPS-denied)

Aether can estimate **position without a live GPS fix** from a **down-looking camera** (e.g. ESP32-CAM), using optical flow + dead reckoning. Absolute WGS84 coordinates require a **geo anchor** (last known GPS or a surveyed point).

This runs on the **companion PC inside Aether** (Camera panel). It is a development / research aid — **not** a certified flight-controller navigation stack.

## How it works

1. **Frames** — Camera tab auto-refreshes JPEG `/capture` (1 Hz by default when optical nav is enabled).
2. **Optical flow** — Block matching on a downscaled grayscale image estimates pixel motion of the ground.
3. **Scale** — Altitude AGL + horizontal FOV convert pixels → meters on the ground plane.
4. **Heading** — Yaw rotates body motion into local **NED** (North / East / Down).
5. **Geo** — Optional anchor `(lat, lon, alt)` + NED offset → estimated WGS84.

```
camera JPEG → gray + block flow → Δbody(m) → ΔNED → pose
                                      ↘ optional → lat/lon
```

## UI (Camera panel)

| Control | Role |
|--------|------|
| **Optical nav (no GPS)** | Enable processing |
| **AGL** | Height above ground (m) — required for metric scale |
| **FOV** | Camera horizontal field of view (°) |
| **Yaw** | Vehicle heading, 0° = North, clockwise |
| **Sync alt/yaw from FC** | Pull AGL + heading from Plotter MAVLink HUD and/or iNav MSP GPS snapshot each frame |
| **Inject VISION_POSITION_ESTIMATE** | Write MAVLink msg 102 to the open COM port after each estimate |
| **Log dist/brg to Serial** | Append `OPTNAV … dist=… brg=…` into the Serial Monitor (local log, not TX to FC) |
| **Home compass** | Overlay on camera preview: needle = direction to home relative to nose |
| **Set geo anchor** | Last GPS / surveyed WGS84 point; zeros local NED |
| **Anchor from FC GPS** | Copy lat/lon from live MAVLink/MSP fix into the anchor |
| **Reset pose** | Clear accumulated NED / restart flow |

HUD shows **Home** (distance, bearing to start, relative turn arrow), NED, geo (if anchored), ground speed, and flow quality.

### FC sync sources

1. **MAVLink** (Plotter → MAVLink mode): `relative_alt` / `alt`, `ATTITUDE` yaw or `VFR_HUD` / `GLOBAL_POSITION_INT` heading, GPS for anchor.
2. **MSP** (БПЛА → refresh status): `MSP_RAW_GPS` altitude, ground course, lat/lon.

MAVLink values win when both are present; MSP fills gaps. Inject is skipped while an MSP status poll is active (same COM).

## Library API

```ts
import { OpticalNavEngine, buildVisionPositionEstimateFrame } from "@/lib/opticalNav";

const eng = new OpticalNavEngine({ altitudeM: 12, fovHDeg: 66, headingDeg: 30 });
eng.setGeoAnchor({ lat: 55.75, lon: 37.62, altM: 12 });

await eng.pushUrl("http://192.168.4.1/capture");
const est = eng.estimate;
// est.ned, est.geo, est.velocity, est.sigmaXYM

const mav = buildVisionPositionEstimateFrame(est!, { headingDeg: 30 });
// MAVLink v1 VISION_POSITION_ESTIMATE (msgid 102) for FC / GCS experiments
```

Core modules: `src/lib/opticalNav/` (flow, dead reckoning, geo, MAVLink helper).

## MAVLink inject

With **Inject VISION_POSITION_ESTIMATE** enabled and Serial connected, each optical-nav update writes a v1 **VISION_POSITION_ESTIMATE** (102) frame (`x/y/z` = local NED meters, `yaw` from current heading). Compid defaults to `197` (MAV_COMP_ID_VISUAL_INERTIAL_ODOMETRY).

Configure the FC to accept external vision (ArduPilot `VISO_*` / PX4 vision topics as applicable). Prefer a dedicated MAVLink telemetry port — do not mix with an active MSP CLI session.

Human-readable log line: `formatOpticalNavTelemetryLine(est)` → `OPTNAV N=… E=… lat=…`.

## Limits (honest)

| Issue | Effect |
|-------|--------|
| No / wrong altitude | Scale wrong → position wrong |
| Textureless ground (water, snow, dark) | Flow quality → 0 |
| Pitch/roll not compensated | Couples attitude into false translation |
| No loop closure / map | Drift grows with path length (`sigmaXYM`) |
| Low frame rate / motion blur | Underestimates speed |
| CORS / unreachable camera | Frame fetch fails (desktop Tauri fetch to LAN usually works) |

For production GPS-denied flight you typically want **VIO/VSLAM + IMU** on the FC or a companion (OpenVINS, VINS-Fusion, ORB-SLAM3, PX4 optical flow, etc.), with this Aether path as a **lab / prototyping** front-end.

## Roadmap ideas

- Fuse baro/rangefinder into the estimator (beyond GPS relative alt)
- Onboard ESP32 optical-flow sketch (lower bandwidth than full JPEG)
- Visual place recognition against a geotagged map tile (absolute fix without GPS)
