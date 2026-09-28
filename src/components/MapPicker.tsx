"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current).setView([lat || 36.2972, lng || 59.6067], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    let marker: L.Marker | undefined;
    if (lat && lng) marker = L.marker([lat, lng]).addTo(map);
    map.on("click", (e) => {
      marker?.remove();
      marker = L.marker(e.latlng).addTo(map);
      callback.current(e.latlng.lat, e.latlng.lng);
    });
    return () => {
      map.remove();
    }; /* initial coordinates only */
  }, [lat, lng]);
  return <div ref={el} />;
}
