/**
 * Mission / waypoint model shared by iNav-style MSP and MAVLink planners.
 */

export type WaypointAction =
  | "waypoint"
  | "rth"
  | "poshold"
  | "land"
  | "jump"
  | "set_poi";

export interface Waypoint {
  id: number;
  action: WaypointAction;
  lat: number;
  lon: number;
  alt: number;
  /** Speed m/s or FC units — informational for now. */
  speed: number;
  p1: number;
  p2: number;
  p3: number;
}

export interface Mission {
  id: string;
  name: string;
  craft: string;
  waypoints: Waypoint[];
  updatedAt: number;
}

export function emptyWaypoint(id: number): Waypoint {
  return {
    id,
    action: "waypoint",
    lat: 0,
    lon: 0,
    alt: 50,
    speed: 5,
    p1: 0,
    p2: 0,
    p3: 0,
  };
}

export function formatMissionCli(mission: Mission): string {
  const lines = [
    `# Aether mission: ${mission.name}`,
    `# waypoints: ${mission.waypoints.length}`,
  ];
  for (const wp of mission.waypoints) {
    lines.push(
      `# wp ${wp.id} ${wp.action} ${wp.lat.toFixed(7)} ${wp.lon.toFixed(7)} ${wp.alt} ${wp.speed}`,
    );
  }
  lines.push("# Upload path: use FC mission UI / MAVLink MISSION_ITEM in a later revision.");
  return lines.join("\n");
}
