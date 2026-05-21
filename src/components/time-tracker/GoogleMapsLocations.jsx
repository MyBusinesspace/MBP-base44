import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * GoogleMapsLocations
 * 
 * Props:
 *  locations  - array of location objects (legacy multi-user mode)
 *  trailMode  - boolean: when true, draws a detailed trail for a single user
 *               In trail mode, locations should be sorted chronologically and include ALL points
 */
export default function GoogleMapsLocations({ locations = [], trailMode = false }) {
  const [apiKey, setApiKey] = useState(null);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const hasFitBoundsRef = useRef(false);

  // Load Google Maps API key
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        let key = null;
        try {
          const response = await base44.functions.invoke('getGoogleMapsKey');
          key = response.data?.key || response.key;
        } catch (err) {
          setError('Failed to load API key');
          setIsLoading(false);
          return;
        }

        if (!key) {
          setError('API key not configured');
          setIsLoading(false);
          return;
        }

        setApiKey(key);

        if (window.google && window.google.maps) {
          setScriptLoaded(true);
          setIsLoading(false);
          return;
        }

        const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
        if (existingScript) {
          existingScript.addEventListener('load', () => {
            setScriptLoaded(true);
            setIsLoading(false);
          });
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => { setScriptLoaded(true); setIsLoading(false); };
        script.onerror = () => { setError('Failed to load Google Maps'); setIsLoading(false); };
        document.head.appendChild(script);
      } catch (err) {
        setError(err.message);
        setIsLoading(false);
      }
    };
    loadGoogleMaps();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!scriptLoaded || !window.google || !window.google.maps) return;

    const initMap = () => {
      requestAnimationFrame(() => {
        try {
          if (!mapRef.current || !document.body.contains(mapRef.current)) return;

          const map = new window.google.maps.Map(mapRef.current, {
            center: { lat: 25.2048, lng: 55.2708 },
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
          });

          googleMapRef.current = map;
          setMapReady(true);
        } catch (err) {
          setError('Failed to initialize map');
        }
      });
    };

    const timer = setTimeout(initMap, 150);
    return () => clearTimeout(timer);
  }, [scriptLoaded]);

  // Update markers and routes
  useEffect(() => {
    if (!mapReady || !googleMapRef.current || !window.google || locations.length === 0) return;

    // Clear existing
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    if (trailMode) {
      renderTrailMode();
    } else {
      renderMultiUserMode();
    }
  }, [locations, mapReady, trailMode]);

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    try {
      return new Date(timeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return timeStr; }
  };

  // ─── TRAIL MODE ───────────────────────────────────────────────────────────────
  // Renders a single user's full day route: clock-in → tracking dots → clock-out
  const renderTrailMode = () => {
    if (locations.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    const pathCoords = [];

    // Sort by time
    const sorted = [...locations].sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return ta - tb;
    });

    const user = sorted[0]?.user;
    const TRAIL_COLOR = '#4F46E5'; // indigo
    const AURORA_GREEN = '#AADB1E'; // corporate Aurora Green

    // GPS anomaly detection: flag jumps >50km between consecutive points within <5 mins
    const anomalousSegments = new Set();
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (!prev.lat || !curr.lat) continue;
      const timeDiffMin = prev.time && curr.time
        ? (new Date(curr.time) - new Date(prev.time)) / 60000
        : 999;
      // Haversine distance in km
      const R = 6371;
      const dLat = (curr.lat - prev.lat) * Math.PI / 180;
      const dLng = (curr.lng - prev.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(prev.lat*Math.PI/180) * Math.cos(curr.lat*Math.PI/180) * Math.sin(dLng/2)**2;
      const distKm = 2 * R * Math.asin(Math.sqrt(a));
      if (distKm > 50 && timeDiffMin < 10) {
        anomalousSegments.add(i); // segment from i-1 to i is anomalous
      }
    }

    sorted.forEach((loc, idx) => {
      const position = { lat: loc.lat, lng: loc.lng };
      bounds.extend(position);
      pathCoords.push(position);

      const isStart = loc.type === 'clock_in';
      const isEnd = loc.type === 'clock_out';
      const isCurrent = loc.type === 'current';
      const isTracking = loc.type === 'tracking';

      if (isStart || isEnd || isCurrent) {
        // Big avatar marker for start/end/current
        const ringColor = isStart ? '#10B981' : isEnd ? '#EF4444' : AURORA_GREEN;
        const size = 40;
        const avatarUrl = user?.avatar_url || user?.profile_picture_url;

        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.strokeStyle = ringColor; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 3, 0, 2*Math.PI); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 6, 0, 2*Math.PI); ctx.fill();

        const initials = (user?.first_name || '?').substring(0, 1).toUpperCase();
        ctx.fillStyle = ringColor; ctx.font = `bold ${size/2.5}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initials, size/2, size/2);

        const marker = new window.google.maps.Marker({
          position,
          map: googleMapRef.current,
          icon: {
            url: canvas.toDataURL('image/png'),
            scaledSize: new window.google.maps.Size(size, size),
            anchor: new window.google.maps.Point(size/2, size/2),
          },
          title: formatTime(loc.time),
          optimized: false,
          zIndex: 10
        });

        if (avatarUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const nc = document.createElement('canvas');
            nc.width = size; nc.height = size;
            const nctx = nc.getContext('2d');
            nctx.strokeStyle = ringColor; nctx.lineWidth = 4;
            nctx.beginPath(); nctx.arc(size/2, size/2, size/2-3, 0, 2*Math.PI); nctx.stroke();
            nctx.fillStyle = '#fff';
            nctx.beginPath(); nctx.arc(size/2, size/2, size/2-6, 0, 2*Math.PI); nctx.fill();
            nctx.save();
            nctx.beginPath(); nctx.arc(size/2, size/2, size/2-6, 0, 2*Math.PI); nctx.clip();
            nctx.drawImage(img, 6, 6, size-12, size-12); nctx.restore();
            marker.setIcon({ url: nc.toDataURL('image/png'), scaledSize: new window.google.maps.Size(size, size), anchor: new window.google.maps.Point(size/2, size/2) });
          };
          img.src = avatarUrl;
        }

        const label = isStart ? 'CLOCK IN' : isEnd ? 'CLOCK OUT' : 'ACTIVE NOW';
        const labelColor = isStart ? '#10B981' : isEnd ? '#EF4444' : AURORA_GREEN;
        const infoContent = `<div style="padding:8px;max-width:180px">
          <div style="font-weight:600;color:#1e293b;margin-bottom:4px">${user?.first_name || 'Unknown'}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:4px">${formatTime(loc.time)}</div>
          ${loc.address ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${loc.address}</div>` : ''}
          <div style="padding:2px 8px;background:${labelColor};color:white;border-radius:12px;font-size:10px;font-weight:600;display:inline-block">${label}</div>
        </div>`;
        const iw = new window.google.maps.InfoWindow({ content: infoContent });
        marker.addListener('click', () => iw.open(googleMapRef.current, marker));
        markersRef.current.push(marker);

      } else if (isTracking) {
        // Small dot marker for tracking points
        const dotSize = 12;
        const dotCanvas = document.createElement('canvas');
        dotCanvas.width = dotSize; dotCanvas.height = dotSize;
        const dctx = dotCanvas.getContext('2d');

        // White outline
        dctx.fillStyle = '#fff';
        dctx.beginPath(); dctx.arc(dotSize/2, dotSize/2, dotSize/2, 0, 2*Math.PI); dctx.fill();
        // Colored inner dot
        dctx.fillStyle = TRAIL_COLOR;
        dctx.beginPath(); dctx.arc(dotSize/2, dotSize/2, dotSize/2 - 2, 0, 2*Math.PI); dctx.fill();

        const dotMarker = new window.google.maps.Marker({
          position,
          map: googleMapRef.current,
          icon: {
            url: dotCanvas.toDataURL('image/png'),
            scaledSize: new window.google.maps.Size(dotSize, dotSize),
            anchor: new window.google.maps.Point(dotSize/2, dotSize/2),
          },
          title: formatTime(loc.time),
          optimized: false,
          zIndex: 5
        });

        // Tooltip on click
        const stopInfo = `<div style="padding:6px 10px;max-width:160px">
          <div style="font-size:13px;font-weight:600;color:#4F46E5">${formatTime(loc.time)}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">Stop #${idx}</div>
        </div>`;
        const iw = new window.google.maps.InfoWindow({ content: stopInfo });
        dotMarker.addListener('click', () => iw.open(googleMapRef.current, dotMarker));
        markersRef.current.push(dotMarker);
      }
    });

    // Draw route segments — anomalous jumps shown as dashed red
    for (let i = 1; i < pathCoords.length; i++) {
      const isAnomaly = anomalousSegments.has(i);
      const segPolyline = new window.google.maps.Polyline({
        path: [pathCoords[i - 1], pathCoords[i]],
        geodesic: true,
        strokeColor: isAnomaly ? '#EF4444' : TRAIL_COLOR,
        strokeOpacity: isAnomaly ? 0 : 0.75, // opacity 0 + icons for dashed effect on anomaly
        strokeWeight: isAnomaly ? 2 : 3,
        map: googleMapRef.current,
        icons: isAnomaly
          ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: '#EF4444', scale: 4 }, offset: '0', repeat: '16px' }]
          : [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: TRAIL_COLOR, fillOpacity: 0.8, strokeColor: '#fff', strokeWeight: 1 }, offset: '100%', repeat: '120px' }]
      });
      polylinesRef.current.push(segPolyline);
    }

    if (!hasFitBoundsRef.current && markersRef.current.length > 0) {
      hasFitBoundsRef.current = true;
      googleMapRef.current.fitBounds(bounds);
      if (markersRef.current.length === 1) {
        window.google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
          if (googleMapRef.current?.getZoom() > 16) googleMapRef.current.setZoom(16);
        });
      }
    }
  };

  // ─── MULTI-USER MODE (original behavior) ─────────────────────────────────────
  const renderMultiUserMode = () => {
    const bounds = new window.google.maps.LatLngBounds();
    const userRoutes = {};

    locations.forEach(loc => {
      const userId = loc.user?.id || loc.user?.first_name || 'unknown';
      if (!userRoutes[userId]) userRoutes[userId] = { user: loc.user, points: [] };
      userRoutes[userId].points.push(loc);
    });

    Object.values(userRoutes).forEach((route, idx) => {
      const color = ['#4F46E5', '#059669', '#DC2626', '#EA580C', '#7C3AED', '#DB2777'][idx % 6];

      route.points.sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return ta - tb;
      });

      const filteredPoints = [];
      const clockInPoint = route.points.find(p => p.type === 'clock_in');
      const clockOutPoint = route.points.find(p => p.type === 'clock_out');
      const currentPoints = route.points.filter(p => p.type === 'current');
      const trackingPoints = route.points.filter(p => p.type === 'tracking');

      if (clockInPoint) filteredPoints.push(clockInPoint);
      if (trackingPoints.length > 0 && !clockOutPoint) {
        filteredPoints.push({ ...trackingPoints[trackingPoints.length - 1], type: 'last_updated' });
      }
      if (clockOutPoint) filteredPoints.push(clockOutPoint);
      if (currentPoints.length > 0) filteredPoints.push(...currentPoints);

      filteredPoints.forEach((loc) => {
        const position = { lat: loc.lat, lng: loc.lng };
        bounds.extend(position);

        const isStart = loc.type === 'clock_in';
        const isEnd = loc.type === 'clock_out';
        const isCurrent = loc.type === 'current';
        const isLastUpdated = loc.type === 'last_updated';

        const AURORA_GREEN_MU = '#AADB1E';
        const ringColor = isCurrent ? AURORA_GREEN_MU :
          loc.type === 'clock_in' ? '#10B981' :
          loc.type === 'clock_out' ? '#EF4444' :
          loc.type === 'last_updated' ? '#3B82F6' : color;

        const size = isCurrent ? 48 : 36;
        const avatarUrl = loc.user?.avatar_url || loc.user?.profile_picture_url;

        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = ringColor; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2-3, 0, 2*Math.PI); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2-6, 0, 2*Math.PI); ctx.fill();
        const initials = (loc.user?.first_name || '?').substring(0, 1).toUpperCase();
        ctx.fillStyle = ringColor; ctx.font = `bold ${size/2.5}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initials, size/2, size/2);

        const marker = new window.google.maps.Marker({
          position, map: googleMapRef.current,
          icon: { url: canvas.toDataURL('image/png'), scaledSize: new window.google.maps.Size(size, size), anchor: new window.google.maps.Point(size/2, size/2) },
          title: loc.user?.first_name || 'Unknown',
          optimized: false
        });

        if (avatarUrl) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const nc = document.createElement('canvas');
            nc.width = size; nc.height = size;
            const nctx = nc.getContext('2d');
            nctx.strokeStyle = ringColor; nctx.lineWidth = 4;
            nctx.beginPath(); nctx.arc(size/2, size/2, size/2-3, 0, 2*Math.PI); nctx.stroke();
            nctx.fillStyle = '#fff';
            nctx.beginPath(); nctx.arc(size/2, size/2, size/2-6, 0, 2*Math.PI); nctx.fill();
            nctx.save();
            nctx.beginPath(); nctx.arc(size/2, size/2, size/2-6, 0, 2*Math.PI); nctx.clip();
            nctx.drawImage(img, 6, 6, size-12, size-12); nctx.restore();
            marker.setIcon({ url: nc.toDataURL('image/png'), scaledSize: new window.google.maps.Size(size, size), anchor: new window.google.maps.Point(size/2, size/2) });
            setTimeout(() => { if (googleMapRef.current) { window.google.maps.event.trigger(marker, 'position_changed'); window.google.maps.event.trigger(googleMapRef.current, 'resize'); } }, 100);
          };
          [0, 500, 1500].forEach(delay => setTimeout(() => { img.src = avatarUrl; }, delay));
        }

        const infoContent = `<div style="padding:8px;max-width:200px">
          <div style="font-weight:600;color:#1e293b;margin-bottom:4px">${loc.user?.first_name || 'Unknown'}</div>
          ${loc.time ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px">${formatTime(loc.time)}</div>` : ''}
          ${loc.address ? `<div style="font-size:11px;color:#94a3b8">${loc.address}</div>` : ''}
          ${isCurrent ? `<div style="margin-top:6px;padding:2px 8px;background:#10B981;color:white;border-radius:12px;font-size:10px;font-weight:600;display:inline-block">ACTIVE NOW</div>` : ''}
          ${isStart ? `<div style="margin-top:6px;padding:2px 8px;background:#10B981;color:white;border-radius:12px;font-size:10px;font-weight:600;display:inline-block">CLOCK IN</div>` : ''}
          ${isLastUpdated ? `<div style="margin-top:6px;padding:2px 8px;background:#3B82F6;color:white;border-radius:12px;font-size:10px;font-weight:600;display:inline-block">LAST UPDATED</div>` : ''}
          ${isEnd ? `<div style="margin-top:6px;padding:2px 8px;background:#EF4444;color:white;border-radius:12px;font-size:10px;font-weight:600;display:inline-block">CLOCK OUT</div>` : ''}
        </div>`;
        const iw = new window.google.maps.InfoWindow({ content: infoContent });
        marker.addListener('click', () => iw.open(googleMapRef.current, marker));
        markersRef.current.push(marker);
      });

      if (filteredPoints.length > 1) {
        const polyline = new window.google.maps.Polyline({
          path: filteredPoints.map(l => ({ lat: l.lat, lng: l.lng })),
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: googleMapRef.current
        });
        polylinesRef.current.push(polyline);
      }
    });

    if (markersRef.current.length > 0 && !hasFitBoundsRef.current) {
      hasFitBoundsRef.current = true;
      googleMapRef.current.fitBounds(bounds);
      if (markersRef.current.length === 1) {
        window.google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
          if (googleMapRef.current?.getZoom() > 16) googleMapRef.current.setZoom(16);
        });
      }
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, []);

  if (isLoading) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg">
      <div className="text-sm text-slate-500">Loading map...</div>
    </div>
  );

  if (error) return (
    <div className="w-full h-full flex items-center justify-center bg-red-50 rounded-lg">
      <div className="text-sm text-red-600">{error}</div>
    </div>
  );

  return (
    <div ref={mapRef} className="w-full h-full rounded-lg bg-slate-100"
      style={{ minHeight: '240px', width: '100%', height: '100%', position: 'relative' }}>
      {!scriptLoaded && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Initializing map...</div>}
    </div>
  );
}