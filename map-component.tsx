"use client"

import { useState, useEffect } from "react"

const MapComponent = ({
  initialPosition,
  selectedArea,
  setSelectedArea,
  selectionPoints,
  setSelectionPoints,
  onAreaSelected,
  eeInitialized,
}) => {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [L, setL] = useState(null)
  const [ReactLeaflet, setReactLeaflet] = useState(null)
  const [map, setMap] = useState(null)

  // Area selection style
  const areaStyle = {
    fillColor: "#3388ff",
    color: "#3388ff",
    weight: 2,
    opacity: 1,
    fillOpacity: 0.2,
  }

  useEffect(() => {
    const loadMapLibraries = async () => {
      try {
        // Load Leaflet CSS
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          document.head.appendChild(link)
        }

        // Load Leaflet JS
        if (!window.L) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script")
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            script.onload = resolve
            script.onerror = reject
            document.head.appendChild(script)
          })
        }

        // Configure Leaflet icons
        if (window.L) {
          delete window.L.Icon.Default.prototype._getIconUrl
          window.L.Icon.Default.mergeOptions({
            iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          })
          setL(window.L)
        }

        // Load React-Leaflet
        const reactLeafletModule = await import("react-leaflet")
        setReactLeaflet(reactLeafletModule)
        setMapLoaded(true)

        console.log("✅ Map libraries loaded successfully")
      } catch (err) {
        console.error("❌ Error loading map libraries:", err)
      }
    }

    if (typeof window !== "undefined") {
      loadMapLibraries()
    }
  }, [])

  const createAreaGeoJSON = (bounds) => {
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
            [bounds.getSouthWest().lng, bounds.getNorthEast().lat],
            [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
            [bounds.getNorthEast().lng, bounds.getSouthWest().lat],
            [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
          ],
        ],
      },
    }
  }

  // Area selector component
  const AreaSelector = () => {
    const { useMap, useMapEvents, GeoJSON } = ReactLeaflet
    const map = useMap()
    const [tempArea, setTempArea] = useState(null)

    useMapEvents({
      click(e) {
        const newPoints = [...selectionPoints, e.latlng]
        setSelectionPoints(newPoints)

        if (newPoints.length === 2) {
          const bounds = L.latLngBounds(newPoints)
          const areaGeoJSON = createAreaGeoJSON(bounds)
          setSelectedArea(areaGeoJSON)
          setTempArea(null)
          onAreaSelected(bounds)
          setSelectionPoints([])
        }
      },
      mousemove(e) {
        if (selectionPoints.length === 1) {
          const bounds = L.latLngBounds([selectionPoints[0], e.latlng])
          setTempArea(createAreaGeoJSON(bounds))
        }
      },
    })

    return <>{tempArea && <GeoJSON key="temp-area" data={tempArea} style={{ ...areaStyle, fillOpacity: 0.1 }} />}</>
  }

  if (!mapLoaded || !ReactLeaflet || !L) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    )
  }

  const { MapContainer, TileLayer, GeoJSON } = ReactLeaflet

  return (
    <MapContainer center={initialPosition} zoom={12} style={{ height: "100%", width: "100%" }} doubleClickZoom={false}>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
      />

      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
        pane="overlayPane"
      />

      {selectedArea && <GeoJSON key={`selected-area-${Date.now()}`} data={selectedArea} style={areaStyle} />}
      <AreaSelector />
    </MapContainer>
  )
}

export default MapComponent
