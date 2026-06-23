import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { RISK_HEX } from "../lib/risk";

/**
 * Interactive choropleth of Bangladesh's 64 districts (PRD 6.4.1).
 * Restyles imperatively (via a layer ref) instead of remounting, which keeps
 * Leaflet's zoom animation stable.
 *
 * @param geojson      FeatureCollection (features keyed by properties.shapeName)
 * @param riskByName   { [name]: { id, risk_level, risk_score, trajectory, lat, lon } }
 * @param week         0 = current (W+1), 1..3 = forecast weeks ahead
 * @param onSelect     (districtName) => void
 * @param selected     currently highlighted district name
 * @param showLabels   render labeled hotspot markers for High/Critical
 */
export default function ChoroplethMap({
  geojson, riskByName, week = 0, onSelect, selected, showLabels = true,
  hospitals = [],
}) {
  const geoRef = useRef(null);

  const levelFor = (name) => {
    const r = riskByName[name];
    if (!r) return null;
    if (week > 0 && r.trajectory?.[week]) return r.trajectory[week].risk_level;
    return r.risk_level;
  };
  const scoreFor = (name) => {
    const r = riskByName[name];
    if (!r) return null;
    if (week > 0 && r.trajectory?.[week]) return r.trajectory[week].risk_score;
    return r.risk_score;
  };

  const styleFor = (feature) => {
    const name = feature.properties.shapeName;
    const level = levelFor(name);
    const isSel = selected === name;
    return {
      fillColor: level ? RISK_HEX[level] : "#e2e8f0",
      weight: isSel ? 3 : 0.6,
      color: isSel ? "#0f172a" : "#ffffff",
      fillOpacity: level ? 0.8 : 0.35,
    };
  };

  // Restyle + refresh tooltips whenever week / data / selection changes.
  useEffect(() => {
    const layer = geoRef.current;
    if (!layer) return;
    layer.eachLayer((l) => {
      const name = l.feature?.properties?.shapeName;
      l.setStyle(styleFor(l.feature));
      const level = levelFor(name) || "—";
      const score = scoreFor(name);
      l.bindTooltip(
        `<div style="font-weight:700">${name}</div><div>${level} · ${score != null ? Math.round(score * 100) : "—"}/100</div>`,
        { sticky: true, direction: "top" }
      );
    });
  }, [week, riskByName, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEachFeature = (feature, layer) => {
    layer.on({
      click: () => onSelect && onSelect(feature.properties.shapeName),
      mouseover: (e) => e.target.setStyle({ weight: 2.2, color: "#0f172a" }),
      mouseout: (e) => e.target.setStyle(styleFor(feature)),
    });
  };

  const hotspots = showLabels
    ? Object.values(riskByName).filter((r) => {
        const lvl = week > 0 && r.trajectory?.[week] ? r.trajectory[week].risk_level : r.risk_level;
        return (lvl === "Critical" || lvl === "High") && r.lat && r.lon;
      })
    : [];

  return (
    <MapContainer
      center={[23.78, 90.36]}
      zoom={7}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      className="rounded-2xl"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap &copy; CARTO"
      />
      {geojson && (
        <GeoJSON ref={geoRef} data={geojson} style={styleFor} onEachFeature={onEachFeature} />
      )}
      {hotspots.map((r) => {
        const lvl = week > 0 && r.trajectory?.[week] ? r.trajectory[week].risk_level : r.risk_level;
        return (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lon]}
            radius={lvl === "Critical" ? 8 : 5}
            pathOptions={{
              color: "#fff", weight: 1.5, fillColor: RISK_HEX[lvl], fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect && onSelect(r.name) }}
          >
            {lvl === "Critical" && (
              <Tooltip permanent direction="right" offset={[8, 0]} className="hotspot-label">
                {r.name}
              </Tooltip>
            )}
            <Tooltip sticky direction="top">
              <b>{r.name}</b> — {lvl}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {hospitals.map((h) => (
        <CircleMarker
          key={`h-${h.id}`}
          center={[h.lat, h.lon]}
          radius={4}
          pathOptions={{ color: "#1d4ed8", weight: 1.5, fillColor: "#3b82f6", fillOpacity: 0.95 }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold">🏥 {h.name}</p>
              <p className="text-slate-600">{h.type}</p>
              <p className="mt-1">{h.beds} beds · <b>{h.dengue_beds}</b> dengue-ready</p>
              <p className="text-slate-500">{h.dist_from_center_km} km from district centre</p>
            </div>
          </Popup>
          <Tooltip direction="top">{h.name}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
