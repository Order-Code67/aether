import { useEffect, useRef, useState } from "react";
import {
  Map,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { eventBus } from "@/services/events/eventBus";
import { OSM_STYLE, offlineStyle } from "./mapStyles";

function haversineM(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface UserMarker {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

type TileMode = "osm" | "offline" | "local";

export function MapPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const measureRef = useRef<{
    a: { lng: number; lat: number };
    b?: { lng: number; lat: number };
  } | null>(null);

  const [terrain, setTerrain] = useState(false);
  const [markers, setMarkers] = useState<UserMarker[]>([]);
  const [measureMode, setMeasureMode] = useState(false);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tileMode, setTileMode] = useState<TileMode>("offline");
  const [localUrl, setLocalUrl] = useState("");

  const measureModeRef = useRef(measureMode);
  measureModeRef.current = measureMode;

  const styleFor = (mode: TileMode, url: string) => {
    if (mode === "osm") return OSM_STYLE;
    if (mode === "local") return offlineStyle(url || undefined);
    return offlineStyle();
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      // Prefer blob workers; MapLibre CSP worker is enabled via vite worker.es + CSP.
      const map = new Map({
        container: containerRef.current,
        style: styleFor(tileMode, localUrl),
        center: [37.62, 55.75],
        zoom: 10,
      });
      map.addControl(new NavigationControl(), "top-right");
      map.addControl(new ScaleControl({ unit: "metric" }));
      map.on("error", (e) => {
        const msg =
          e.error instanceof Error
            ? e.error.message
            : "Ошибка слоя карты (тайлы / worker)";
        eventBus.emit("warning", "map", msg);
      });
      map.on("click", (e: MapMouseEvent) => {
        if (!measureModeRef.current) return;
        const point = e.lngLat;
        if (!measureRef.current) {
          measureRef.current = { a: { lng: point.lng, lat: point.lat } };
          setDistanceM(0);
          return;
        }
        const a = measureRef.current.a;
        const b = { lng: point.lng, lat: point.lat };
        measureRef.current = { a, b };
        const meters = haversineM(a, b);
        setDistanceM(meters);
        eventBus.emit(
          "info",
          "map",
          `Измерение: ${(meters / 1000).toFixed(2)} км`,
        );
      });
      mapRef.current = map;
      eventBus.emit(
        "info",
        "map",
        tileMode === "offline"
          ? "Карта: офлайн-база (без интернета)"
          : "Карта инициализирована",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка инициализации карты");
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // init once; style switches via setStyle below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setStyle(styleFor(tileMode, localUrl));
      eventBus.emit(
        "info",
        "map",
        tileMode === "osm"
          ? "Тайлы OSM (нужен интернет)"
          : tileMode === "local"
            ? "Локальные тайлы"
            : "Офлайн-база",
      );
    } catch (e) {
      eventBus.emit(
        "error",
        "map",
        e instanceof Error ? e.message : "Не удалось сменить стиль",
      );
    }
  }, [tileMode, localUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = markers.map((m) => {
      const el = document.createElement("div");
      el.className =
        "h-3 w-3 rounded-full border-2 border-white bg-ags-accent shadow";
      el.title = m.label;
      return new Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(new Popup().setText(m.label))
        .addTo(map);
    });
  }, [markers]);

  const addMarkerHere = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setMarkers((prev) => [
      ...prev,
      {
        id: `m_${Date.now().toString(36)}`,
        lng: c.lng,
        lat: c.lat,
        label: `Метка ${prev.length + 1}`,
      },
    ]);
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-ags-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-2 border-b border-ags-border-subtle p-2 text-xs">
        <select
          className="rounded border border-ags-border bg-ags-elevated px-2 py-1"
          value={tileMode}
          onChange={(e) => setTileMode(e.target.value as TileMode)}
        >
          <option value="offline">Офлайн (без тайлов)</option>
          <option value="local">Локальные XYZ</option>
          <option value="osm">OSM онлайн</option>
        </select>
        {tileMode === "local" && (
          <input
            className="min-w-[14rem] flex-1 rounded border border-ags-border bg-ags-elevated px-2 py-1"
            placeholder="http://127.0.0.1:8080/{z}/{x}/{y}.png"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
          />
        )}
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={addMarkerHere}
        >
          Метка в центре
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={() => setMeasureMode((v) => !v)}
        >
          {measureMode ? "Завершить измерение" : "Измерить расстояние"}
        </button>
        <button
          type="button"
          className="rounded border border-ags-border px-2 py-1"
          onClick={() => {
            setTerrain((v) => !v);
            eventBus.emit(
              "info",
              "map",
              terrain
                ? "Слой рельефа скрыт"
                : "Рельеф требует DEM tileset",
            );
          }}
        >
          Рельеф {terrain ? "вкл" : "выкл"}
        </button>
        {distanceM != null && (
          <span className="text-ags-muted">
            Дистанция: {(distanceM / 1000).toFixed(3)} км
          </span>
        )}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
