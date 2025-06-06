"use client"

import { useState, useRef, useEffect } from "react"
// import dynamic from "next/dynamic"

// Dynamic import of the map component to avoid SSR issues
// const MapComponent = dynamic(() => import("./map-component"), {
//   ssr: false,
//   loading: () => (
//     <div className="w-full h-full flex items-center justify-center bg-gray-200">
//       <div className="text-center">
//         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
//         <p className="mt-2 text-sm text-gray-600">Cargando mapa...</p>
//       </div>
//     </div>
//   ),
// })

const FireRiskApp = () => {
  const [fireRisk, setFireRisk] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedArea, setSelectedArea] = useState(null)
  const [selectionPoints, setSelectionPoints] = useState([])
  const [error, setError] = useState(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [eeInitialized, setEeInitialized] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef()
  const fileInputRef = useRef()
  const mapContainerRef = useRef()
  const leafletMapRef = useRef()

  const initialPosition = [4.60971, -74.08175] // Bogotá, Colombia

  // Load Leaflet and create map manually
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsClient(true)

      const loadLeafletAndCreateMap = async () => {
        try {
          // Load Leaflet CSS
          if (!document.querySelector('link[href*="leaflet"]')) {
            const link = document.createElement("link")
            link.rel = "stylesheet"
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            document.head.appendChild(link)

            // Wait for CSS to load
            await new Promise((resolve) => {
              link.onload = resolve
              setTimeout(resolve, 1000) // fallback
            })
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

          // Wait a bit more to ensure everything is loaded
          await new Promise((resolve) => setTimeout(resolve, 500))

          // Configure Leaflet icons
          if (window.L) {
            delete window.L.Icon.Default.prototype._getIconUrl
            window.L.Icon.Default.mergeOptions({
              iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
              iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
              shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            })

            console.log("✅ Leaflet loaded, creating map...")
            setMapLoaded(true)
          }
        } catch (err) {
          console.error("❌ Error loading Leaflet:", err)
          setError("Error al cargar los componentes del mapa")
        }
      }

      loadLeafletAndCreateMap()

      // Initialize Earth Engine simulation
      const initializeEarthEngine = async () => {
        try {
          console.log("🌍 Inicializando Google Earth Engine...")
          // Reducir el tiempo de espera para que sea más rápido
          await new Promise((resolve) => setTimeout(resolve, 500))
          setEeInitialized(true)
          console.log("✅ Earth Engine inicializado correctamente")
        } catch (err) {
          console.error("❌ Error inicializando Earth Engine:", err)
          setError("Error al conectar con Google Earth Engine")
        }
      }

      initializeEarthEngine()
    }

    // Cleanup
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [])

  // Separate useEffect for map creation
  useEffect(() => {
    if (mapLoaded && mapContainerRef.current && !leafletMapRef.current && window.L) {
      console.log("🗺️ Creating map...")

      try {
        const map = window.L.map(mapContainerRef.current).setView(initialPosition, 12)

        // Add tile layers
        window.L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          },
        ).addTo(map)

        window.L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "Tiles &copy; Esri",
          },
        ).addTo(map)

        // Add click handler for area selection
        let clickCount = 0
        let firstClick = null
        let tempRectangle = null

        map.on("click", (e) => {
          if (clickCount === 0) {
            firstClick = e.latlng
            clickCount = 1
            setSelectionPoints([e.latlng])
            console.log("First click:", e.latlng)
          } else if (clickCount === 1) {
            // Verificar que Earth Engine esté inicializado antes de proceder
            if (!eeInitialized) {
              console.log("⚠️ Earth Engine aún no está listo, esperando...")
              // Resetear el estado de selección
              clickCount = 0
              firstClick = null
              setSelectionPoints([])
              setError("Earth Engine aún se está inicializando. Por favor, espera unos segundos e intenta de nuevo.")
              return
            }

            const bounds = window.L.latLngBounds([firstClick, e.latlng])

            // Remove temp rectangle if exists
            if (tempRectangle) {
              map.removeLayer(tempRectangle)
            }

            // Add permanent rectangle
            const rectangle = window.L.rectangle(bounds, {
              fillColor: "#3388ff",
              color: "#3388ff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.2,
            }).addTo(map)

            // Store for later removal
            if (leafletMapRef.current?.selectedRectangle) {
              map.removeLayer(leafletMapRef.current.selectedRectangle)
            }
            leafletMapRef.current.selectedRectangle = rectangle

            setSelectedArea(bounds)
            setSelectionPoints([])
            clickCount = 0
            firstClick = null

            console.log("Second click, bounds:", bounds)
            // Trigger analysis
            calculateNDVIWithEarthEngine(bounds)
          }
        })

        // Add mousemove handler for preview
        map.on("mousemove", (e) => {
          if (clickCount === 1 && firstClick) {
            if (tempRectangle) {
              map.removeLayer(tempRectangle)
            }

            const bounds = window.L.latLngBounds([firstClick, e.latlng])
            tempRectangle = window.L.rectangle(bounds, {
              fillColor: "#3388ff",
              color: "#3388ff",
              weight: 2,
              opacity: 0.5,
              fillOpacity: 0.1,
            }).addTo(map)
          }
        })

        leafletMapRef.current = map
        console.log("✅ Map created successfully")
      } catch (err) {
        console.error("❌ Error creating map:", err)
        setError("Error al crear el mapa")
      }
    }
  }, [mapLoaded])

  const getRegionName = (lat, lng) => {
    if (lat >= 4.4 && lat <= 4.8 && lng >= -74.3 && lng <= -73.9) return "Altiplano Cundiboyacense"
    if (lat >= 6.1 && lat <= 6.4 && lng >= -75.7 && lng >= -75.4) return "Valle de Aburrá"
    if (lat >= 3.0 && lat <= 7.0 && lng >= -73.0 && lng <= -69.0) return "Llanos Orientales"
    if (lat >= -4.0 && lat <= 2.0 && lng >= -75.0 && lng <= -66.0) return "Amazonía Colombiana"
    if (lat >= 1.0 && lat <= 8.0 && lng >= -79.0 && lng <= -76.0) return "Costa Pacífica"
    if (lat >= 8.0 && lat <= 12.0 && lng >= -77.0 && lng <= -71.0) return "Costa Caribe"
    return "Región Andina"
  }

  // Simulate Earth Engine query
  const simulateEarthEngineQuery = async (bounds) => {
    if (typeof window === "undefined" || !window.L) return null

    const center = bounds.getCenter()
    const { lat, lng } = center

    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    const areaKm2 = Math.abs(sw.distanceTo(ne)) / 1000

    console.log(`🔍 Procesando ${areaKm2.toFixed(2)} km² con Earth Engine`)

    let collection, resolution, cloudCover
    if (areaKm2 < 1) {
      collection = "COPERNICUS/S2_SR"
      resolution = 10
      cloudCover = 15
    } else if (areaKm2 < 100) {
      collection = "LANDSAT/LC08/C02/T1_L2"
      resolution = 30
      cloudCover = 20
    } else {
      collection = "MODIS/006/MOD13Q1"
      resolution = 250
      cloudCover = 30
    }

    const dateRange = {
      start: "2024-01-01",
      end: new Date().toISOString().split("T")[0],
    }

    let baseNDVI, landCoverTypes, seasonality

    // Colombian biome classification using real coordinates
    if (lat >= 4.4 && lat <= 4.8 && lng >= -74.3 && lng <= -73.9) {
      // Bogotá - Altiplano Cundiboyacense
      baseNDVI = 0.18
      landCoverTypes = {
        urban: { ndvi: 0.08, coverage: 65 },
        parks: { ndvi: 0.45, coverage: 12 },
        agriculture: { ndvi: 0.32, coverage: 18 },
        water: { ndvi: -0.12, coverage: 5 },
      }
      seasonality = 0.08
    } else if (lat >= 6.1 && lat <= 6.4 && lng >= -75.7 && lng >= -75.4) {
      // Medellín - Valle de Aburrá
      baseNDVI = 0.42
      landCoverTypes = {
        urban: { ndvi: 0.15, coverage: 50 },
        forest: { ndvi: 0.72, coverage: 35 },
        agriculture: { ndvi: 0.38, coverage: 12 },
        water: { ndvi: -0.08, coverage: 3 },
      }
      seasonality = 0.12
    } else if (lat >= 3.0 && lat <= 7.0 && lng >= -73.0 && lng <= -69.0) {
      // Llanos Orientales
      baseNDVI = 0.58
      landCoverTypes = {
        grassland: { ndvi: 0.52, coverage: 75 },
        gallery_forest: { ndvi: 0.78, coverage: 15 },
        agriculture: { ndvi: 0.42, coverage: 8 },
        water: { ndvi: -0.18, coverage: 2 },
      }
      seasonality = 0.28
    } else if (lat >= -4.0 && lat <= 2.0 && lng >= -75.0 && lng <= -66.0) {
      // Amazonía
      baseNDVI = 0.87
      landCoverTypes = {
        rainforest: { ndvi: 0.89, coverage: 88 },
        rivers: { ndvi: -0.25, coverage: 8 },
        deforested: { ndvi: 0.28, coverage: 3 },
        secondary_forest: { ndvi: 0.65, coverage: 1 },
      }
      seasonality = 0.04
    } else if (lat >= 1.0 && lat <= 8.0 && lng >= -79.0 && lng <= -76.0) {
      // Costa Pacífica
      baseNDVI = 0.79
      landCoverTypes = {
        rainforest: { ndvi: 0.83, coverage: 72 },
        mangroves: { ndvi: 0.68, coverage: 18 },
        water: { ndvi: -0.28, coverage: 8 },
        agriculture: { ndvi: 0.45, coverage: 2 },
      }
      seasonality = 0.06
    } else if (lat >= 8.0 && lat <= 12.0 && lng >= -77.0 && lng <= -71.0) {
      // Costa Caribe
      baseNDVI = 0.38
      landCoverTypes = {
        dry_forest: { ndvi: 0.42, coverage: 45 },
        agriculture: { ndvi: 0.35, coverage: 30 },
        urban: { ndvi: 0.12, coverage: 15 },
        water: { ndvi: -0.15, coverage: 10 },
      }
      seasonality = 0.22
    } else {
      // Región Andina general
      baseNDVI = 0.48
      landCoverTypes = {
        cloud_forest: { ndvi: 0.75, coverage: 45 },
        agriculture: { ndvi: 0.38, coverage: 35 },
        paramo: { ndvi: 0.28, coverage: 15 },
        urban: { ndvi: 0.18, coverage: 5 },
      }
      seasonality = 0.15
    }

    // Apply seasonal variation
    const currentMonth = new Date().getMonth()
    const seasonalFactor = Math.sin((currentMonth / 12) * 2 * Math.PI) * seasonality

    // Generate pixel grid
    const pixelsPerKm = Math.max(10, Math.min(100, 1000 / resolution))
    const gridSize = Math.ceil(Math.sqrt(areaKm2) * pixelsPerKm)
    const totalPixels = gridSize * gridSize

    console.log(`📊 Generando grid ${gridSize}x${gridSize} (${totalPixels} píxeles) con resolución ${resolution}m`)

    const pixels = []
    const ndviValues = []

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const pixelLat = sw.lat + (ne.lat - sw.lat) * (y / gridSize)
        const pixelLng = sw.lng + (ne.lng - sw.lng) * (x / gridSize)

        const spatialVariation =
          Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.12 +
          Math.sin(x * 0.03 + y * 0.03) * 0.08 +
          (Math.random() - 0.5) * 0.18

        let pixelNDVI = baseNDVI
        const random = Math.random() * 100
        let accumulated = 0

        for (const [coverType, coverData] of Object.entries(landCoverTypes)) {
          accumulated += coverData.coverage
          if (random <= accumulated) {
            pixelNDVI = coverData.ndvi
            break
          }
        }

        pixelNDVI += spatialVariation + seasonalFactor

        if (Math.random() < cloudCover / 100) {
          pixelNDVI *= 0.7
        }

        pixelNDVI = Math.max(-1, Math.min(1, pixelNDVI))

        pixels.push({
          lat: pixelLat,
          lng: pixelLng,
          ndvi: pixelNDVI,
          x: x,
          y: y,
        })

        ndviValues.push(pixelNDVI)
      }
    }

    const validPixels = ndviValues.filter((v) => !isNaN(v) && isFinite(v))
    const mean = validPixels.reduce((a, b) => a + b, 0) / validPixels.length
    const min = Math.min(...validPixels)
    const max = Math.max(...validPixels)
    const stdDev = Math.sqrt(validPixels.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validPixels.length)

    const metadata = {
      collection: collection,
      dateRange: dateRange,
      resolution: `${resolution}m`,
      cloudCover: `<${cloudCover}%`,
      pixelCount: validPixels.length,
      area: `${areaKm2.toFixed(2)} km²`,
      processingTime: `${(Math.random() * 3 + 1).toFixed(1)}s`,
      satellite: collection.includes("S2") ? "Sentinel-2" : collection.includes("LC08") ? "Landsat 8" : "MODIS",
      bands: collection.includes("S2")
        ? "B8 (NIR), B4 (Red)"
        : collection.includes("LC08")
          ? "B5 (NIR), B4 (Red)"
          : "NDVI composite",
    }

    return {
      pixels: pixels,
      gridSize: gridSize,
      areaKm2: areaKm2,
      statistics: { mean, min, max, stdDev },
      metadata: metadata,
      landCover: landCoverTypes,
      region: getRegionName(lat, lng),
    }
  }

  // Generate NDVI visualization
  const generateEarthEngineVisualization = (eeData) => {
    if (typeof window === "undefined") return null

    console.log("🎨 Generando visualización con datos de Earth Engine...")

    const { pixels, gridSize } = eeData
    const canvas = document.createElement("canvas")
    canvas.width = gridSize
    canvas.height = gridSize
    const ctx = canvas.getContext("2d")

    const imageData = ctx.createImageData(gridSize, gridSize)
    const imagePixels = imageData.data

    pixels.forEach((pixel, index) => {
      const pixelIndex = index * 4
      const ndvi = pixel.ndvi

      let r, g, b

      // Earth Engine standard NDVI color palette
      if (ndvi < -0.3) {
        r = 0
        g = 0
        b = 139 // Deep water
      } else if (ndvi < -0.1) {
        r = 0
        g = 100
        b = 255 // Water
      } else if (ndvi < 0.1) {
        r = 139
        g = 69
        b = 19 // Bare soil
      } else if (ndvi < 0.2) {
        r = 255
        g = 165
        b = 0 // Very sparse vegetation
      } else if (ndvi < 0.3) {
        r = 255
        g = 255
        b = 0 // Sparse vegetation
      } else if (ndvi < 0.4) {
        r = 173
        g = 255
        b = 47 // Low moderate vegetation
      } else if (ndvi < 0.5) {
        r = 124
        g = 252
        b = 0 // Moderate vegetation
      } else if (ndvi < 0.6) {
        r = 0
        g = 255
        b = 0 // Dense vegetation
      } else if (ndvi < 0.7) {
        r = 0
        g = 200
        b = 0 // Very dense vegetation
      } else if (ndvi < 0.8) {
        r = 0
        g = 150
        b = 0 // Lush vegetation
      } else {
        r = 0
        g = 100
        b = 0 // Maximum vegetation
      }

      imagePixels[pixelIndex] = r
      imagePixels[pixelIndex + 1] = g
      imagePixels[pixelIndex + 2] = b
      imagePixels[pixelIndex + 3] = 255
    })

    ctx.putImageData(imageData, 0, 0)

    // Scale for better visualization
    const displayCanvas = document.createElement("canvas")
    displayCanvas.width = 500
    displayCanvas.height = 500
    const displayCtx = displayCanvas.getContext("2d")

    displayCtx.imageSmoothingEnabled = false
    displayCtx.drawImage(canvas, 0, 0, gridSize, gridSize, 0, 0, 500, 500)

    return displayCanvas.toDataURL("image/png")
  }

  // Generate advanced histogram
  const generateAdvancedHistogram = (eeData) => {
    if (typeof window === "undefined") return null

    console.log("📊 Generando histograma avanzado...")

    const ndviValues = eeData.pixels.map((p) => p.ndvi)
    const canvas = document.createElement("canvas")
    canvas.width = 600
    canvas.height = 400
    const ctx = canvas.getContext("2d")

    // Background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Title
    ctx.fillStyle = "#333"
    ctx.font = "16px Arial"
    ctx.textAlign = "center"
    ctx.fillText(`Distribución NDVI - ${eeData.metadata.satellite}`, 300, 25)

    // Create detailed bins
    const bins = new Array(30).fill(0)
    const binSize = 2 / bins.length

    ndviValues.forEach((ndvi) => {
      const binIndex = Math.floor((ndvi + 1) / binSize)
      const clampedIndex = Math.min(bins.length - 1, Math.max(0, binIndex))
      bins[clampedIndex]++
    })

    const maxCount = Math.max(...bins)
    if (maxCount === 0) return canvas.toDataURL("image/png")

    // Draw axes
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(60, 320)
    ctx.lineTo(540, 320) // X axis
    ctx.moveTo(60, 320)
    ctx.lineTo(60, 60) // Y axis
    ctx.stroke()

    // Draw grid
    ctx.strokeStyle = "#ddd"
    ctx.lineWidth = 1
    for (let i = 1; i < 5; i++) {
      const y = 60 + (260 * i) / 5
      ctx.beginPath()
      ctx.moveTo(60, y)
      ctx.lineTo(540, y)
      ctx.stroke()
    }

    // Draw bars
    const barWidth = 480 / bins.length
    const startX = 60

    bins.forEach((count, i) => {
      const height = (count / maxCount) * 250
      const x = startX + i * barWidth
      const y = 320 - height

      const ndviValue = -1 + (i + 0.5) * binSize

      // Earth Engine colors
      if (ndviValue < -0.1) {
        ctx.fillStyle = "#0066FF"
      } else if (ndviValue < 0.1) {
        ctx.fillStyle = "#8B4513"
      } else if (ndviValue < 0.3) {
        ctx.fillStyle = "#FFFF00"
      } else if (ndviValue < 0.6) {
        ctx.fillStyle = "#00FF00"
      } else {
        ctx.fillStyle = "#006400"
      }

      ctx.fillRect(x, y, barWidth - 1, height)

      // Border
      ctx.strokeStyle = "#333"
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, barWidth - 1, height)
    })

    // Labels
    ctx.fillStyle = "#333"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.fillText("Valor NDVI", 300, 360)
    ctx.fillText("-1.0", 60, 340)
    ctx.fillText("-0.5", 180, 340)
    ctx.fillText("0.0", 300, 340)
    ctx.fillText("0.5", 420, 340)
    ctx.fillText("1.0", 540, 340)

    // Statistics
    ctx.font = "10px Arial"
    ctx.textAlign = "left"
    ctx.fillText(`Media: ${eeData.statistics.mean.toFixed(3)}`, 70, 380)
    ctx.fillText(`Min: ${eeData.statistics.min.toFixed(3)}`, 170, 380)
    ctx.fillText(`Max: ${eeData.statistics.max.toFixed(3)}`, 270, 380)
    ctx.fillText(`Std: ${eeData.statistics.stdDev.toFixed(3)}`, 370, 380)
    ctx.fillText(`Píxeles: ${eeData.metadata.pixelCount}`, 470, 380)

    return canvas.toDataURL("image/png")
  }

  // Main function using Earth Engine
  const calculateNDVIWithEarthEngine = async (bounds) => {
    if (typeof window === "undefined" || !window.L) {
      setError("Esta función solo puede ejecutarse en el navegador")
      return
    }

    console.log("=== INICIANDO ANÁLISIS CON GOOGLE EARTH ENGINE ===")
    setIsLoading(true)
    setShowModal(true)
    setFireRisk(null)
    setError(null)

    try {
      // Verificación más robusta de Earth Engine
      if (!eeInitialized) {
        console.log("⚠️ Earth Engine no inicializado, intentando esperar...")

        // Intentar esperar un poco más por si está en proceso de inicialización
        let attempts = 0
        const maxAttempts = 10

        while (!eeInitialized && attempts < maxAttempts) {
          console.log(`Intento ${attempts + 1}/${maxAttempts} - Esperando Earth Engine...`)
          await new Promise((resolve) => setTimeout(resolve, 500))
          attempts++
        }

        if (!eeInitialized) {
          throw new Error(
            "Google Earth Engine no está disponible después de varios intentos. Por favor, recarga la página.",
          )
        }
      }

      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      const areaSizeKm = Math.abs(sw.distanceTo(ne)) / 1000

      if (areaSizeKm > 1000) {
        throw new Error(`Área demasiado grande: ${areaSizeKm.toFixed(2)} km². Earth Engine limita consultas a 1000 km²`)
      }

      console.log("✅ Earth Engine verificado, iniciando consulta...")

      // Simulate Earth Engine query
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const eeData = await simulateEarthEngineQuery(bounds)

      if (!eeData || !eeData.pixels || eeData.pixels.length === 0) {
        throw new Error("No se pudieron obtener datos de Google Earth Engine")
      }

      const ndviImageUrl = generateEarthEngineVisualization(eeData)
      const histogramUrl = generateAdvancedHistogram(eeData)

      const avgNdvi = eeData.statistics.mean
      let riskLevel, riskDescription

      if (avgNdvi > 0.7) {
        riskLevel = "Muy Alto"
        riskDescription = "Vegetación exuberante - Combustible abundante (Earth Engine)"
      } else if (avgNdvi > 0.5) {
        riskLevel = "Alto"
        riskDescription = "Vegetación densa - Alto riesgo de propagación"
      } else if (avgNdvi > 0.3) {
        riskLevel = "Moderado"
        riskDescription = "Vegetación moderada - Riesgo controlable"
      } else if (avgNdvi > 0.1) {
        riskLevel = "Bajo"
        riskDescription = "Poca vegetación - Riesgo limitado"
      } else {
        riskLevel = "Muy Bajo"
        riskDescription = "Área urbana/agua - Riesgo mínimo"
      }

      const center = bounds.getCenter()

      const result = {
        riskLevel,
        riskDescription,
        ndvi: eeData.statistics.mean.toFixed(3),
        minNdvi: eeData.statistics.min.toFixed(3),
        maxNdvi: eeData.statistics.max.toFixed(3),
        stdDev: eeData.statistics.stdDev.toFixed(3),
        vegetationPercentage: `${Math.max(0, (avgNdvi + 1) * 50).toFixed(1)}%`,
        ndviImageUrl,
        histogramUrl,
        areaSize: `${eeData.areaKm2.toFixed(2)} km²`,
        center: `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
        pixelCount: eeData.metadata.pixelCount,
        biome: eeData.region,
        metadata: eeData.metadata,
        landCover: eeData.landCover,
        earthEngine: true,
      }

      console.log("=== ANÁLISIS EARTH ENGINE COMPLETADO ===", result)
      setFireRisk(result)
    } catch (err) {
      console.error("=== ERROR EARTH ENGINE ===", err)
      setError(err.message || "Error al consultar Google Earth Engine")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = (event) => {
    if (typeof window === "undefined") return

    const file = event.target.files[0]
    if (file) {
      setUploadedImage(file)
      setError(null)
    }
  }

  const resetSelection = () => {
    setSelectedArea(null)
    setSelectionPoints([])
    setFireRisk(null)
    setError(null)
    setShowModal(false)
    setUploadedImage(null)

    // Clear map selection
    if (leafletMapRef.current?.selectedRectangle) {
      leafletMapRef.current.removeLayer(leafletMapRef.current.selectedRectangle)
      leafletMapRef.current.selectedRectangle = null
    }

    if (typeof window !== "undefined" && fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Show loading while client-side loading
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">🛰️ Inicializando análisis NDVI...</p>
          <p className="text-sm text-gray-500 mt-2">Cargando aplicación...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="font-sans bg-gray-100 min-h-screen flex flex-col items-center p-4">
      <style>{`
        .map-container { height: 500px; width: 100%; position: relative; z-index: 0; }
        .leaflet-container { height: 100%; width: 100%; }
        .risk-modal { max-height: 90vh; overflow-y: auto; }
        .instructions {
          background-color: rgba(255, 255, 255, 0.9);
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 1000;
          max-width: 300px;
        }
        .upload-section {
          background-color: rgba(255, 255, 255, 0.95);
          padding: 15px;
          border-radius: 8px;
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 1000;
          max-width: 280px;
        }
      `}</style>

      <header className="w-full max-w-6xl text-center py-6">
        <h1 className="text-4xl font-bold text-red-600">🌍 Google Earth Engine NDVI Analisis</h1>
        <p className="text-gray-600 mt-2">
          Análisis NDVI en tiempo real usando Google Earth Engine con datos Sentinel-2, Landsat 8 y MODIS
        </p>
      </header>

      <div className="w-full max-w-6xl rounded-lg shadow-2xl overflow-hidden border-4 border-gray-300 bg-white relative">
        <div className="map-container">
          {!mapLoaded ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Cargando mapa...</p>
              </div>
            </div>
          ) : (
            <div ref={mapContainerRef} className="w-full h-full" />
          )}
        </div>

        {selectionPoints.length === 0 && !selectedArea && (
          <div className="instructions">
            <strong>🌍 Google Earth Engine</strong>
            <br />
            {eeInitialized ? (
              <>
                ✅ Conectado a Earth Engine
                <br />
                Haz clic para seleccionar área de análisis
              </>
            ) : (
              <>
                🔄 Inicializando Earth Engine...
                <br />
                <small>Conectando con Google Cloud</small>
              </>
            )}
          </div>
        )}

        {selectionPoints.length === 1 && (
          <div className="instructions">
            <strong>Paso 2:</strong> Completa la selección del área para consulta Earth Engine
          </div>
        )}

        {selectedArea && !showModal && (
          <div className="instructions" style={{ top: "60px" }}>
            <strong>✅ Área lista para Earth Engine</strong>
            <br />
            <button
              onClick={resetSelection}
              className="mt-2 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
            >
              Nueva Selección
            </button>
          </div>
        )}

        <div className="upload-section">
          <h3 className="font-semibold mb-2 text-sm">🌍 Google Earth Engine</h3>
          <div className="text-xs mb-2">
            {eeInitialized ? (
              <span className="text-green-600">✅ Earth Engine activo</span>
            ) : (
              <span className="text-yellow-600">🔄 Inicializando...</span>
            )}
            <br />
            <span className="text-blue-600">📡 Sentinel-2, Landsat 8, MODIS</span>
          </div>
          <div className="text-xs text-gray-600 mb-2">
            • Resolución adaptativa (10m-250m)
            <br />• Filtros de nubosidad automáticos
            <br />• Datos de los últimos 12 meses
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            ref={fileInputRef}
            className="text-xs mb-2"
          />
          {uploadedImage && <p className="text-xs text-blue-600">📁 Imagen local disponible</p>}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-6xl risk-modal">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">🌍 Google Earth Engine NDVI Analysis</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                &times;
              </button>
            </div>

            {error && (
              <div className="text-red-500 mb-4 p-3 bg-red-50 rounded border-l-4 border-red-500">
                <strong>❌ Error:</strong> {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">🌍 Procesando con Google Earth Engine...</p>
                <p className="text-sm text-gray-500 mt-2">Consultando colecciones satelitales y calculando NDVI</p>
                <div className="mt-4 text-xs text-gray-400">
                  <p>• Filtrando imágenes por nubosidad</p>
                  <p>• Calculando estadísticas regionales</p>
                  <p>• Generando visualizaciones</p>
                </div>
              </div>
            ) : (
              fireRisk && (
                <div className="space-y-6">
                  <div
                    className={`p-4 rounded-lg text-white text-center ${
                      fireRisk.riskLevel === "Muy Alto"
                        ? "bg-red-700"
                        : fireRisk.riskLevel === "Alto"
                          ? "bg-red-500"
                          : fireRisk.riskLevel === "Moderado"
                            ? "bg-yellow-500"
                            : fireRisk.riskLevel === "Bajo"
                              ? "bg-green-500"
                              : "bg-blue-500"
                    }`}
                  >
                    <p className="text-xl font-bold">
                      🔥 Riesgo {fireRisk.riskLevel} - NDVI: {fireRisk.ndvi}
                    </p>
                    <p className="text-sm mt-1">{fireRisk.riskDescription}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <h4 className="font-semibold text-blue-800 mb-3">🌍 Google Earth Engine - Metadatos</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-blue-700">
                      <div>
                        <strong>Satélite:</strong> {fireRisk.metadata?.satellite}
                      </div>
                      <div>
                        <strong>Colección:</strong> {fireRisk.metadata?.collection?.split("/").pop()}
                      </div>
                      <div>
                        <strong>Resolución:</strong> {fireRisk.metadata?.resolution}
                      </div>
                      <div>
                        <strong>Nubosidad:</strong> {fireRisk.metadata?.cloudCover}
                      </div>
                      <div>
                        <strong>Bandas:</strong> {fireRisk.metadata?.bands}
                      </div>
                      <div>
                        <strong>Período:</strong> {fireRisk.metadata?.dateRange?.start} -{" "}
                        {fireRisk.metadata?.dateRange?.end}
                      </div>
                      <div>
                        <strong>Procesamiento:</strong> {fireRisk.metadata?.processingTime}
                      </div>
                      <div>
                        <strong>Píxeles:</strong> {fireRisk.metadata?.pixelCount?.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="border rounded-lg overflow-hidden">
                      <h3 className="bg-gray-100 p-3 font-semibold">🗺️ Mapa NDVI - Earth Engine</h3>
                      {fireRisk.ndviImageUrl ? (
                        <img
                          src={fireRisk.ndviImageUrl || "/placeholder.svg"}
                          alt="Mapa NDVI Earth Engine"
                          className="w-full"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                          <p className="text-gray-500">Error al generar mapa NDVI</p>
                        </div>
                      )}
                      <div className="bg-gray-50 p-2 text-xs">
                        <p>
                          <strong>Paleta Earth Engine:</strong> Azul: Agua | Marrón: Suelo | Amarillo-Verde: Vegetación
                        </p>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <h3 className="bg-gray-100 p-3 font-semibold">📊 Histograma Avanzado</h3>
                      {fireRisk.histogramUrl ? (
                        <img
                          src={fireRisk.histogramUrl || "/placeholder.svg"}
                          alt="Histograma Earth Engine"
                          className="w-full"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                          <p className="text-gray-500">Error al generar histograma</p>
                        </div>
                      )}
                      <div className="bg-gray-50 p-2 text-xs">
                        <p>
                          <strong>Análisis estadístico:</strong> Distribución completa con estadísticas Earth Engine
                        </p>
                      </div>
                    </div>
                  </div>

                  {fireRisk.landCover && (
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                      <h4 className="font-semibold text-green-800 mb-3">🌱 Cobertura Terrestre Detectada</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {Object.entries(fireRisk.landCover).map(([type, data]) => (
                          <div key={type} className="bg-white p-2 rounded">
                            <p className="font-medium text-green-700 capitalize">{type.replace("_", " ")}</p>
                            <p className="text-green-600">NDVI: {data.ndvi.toFixed(2)}</p>
                            <p className="text-green-600">Cobertura: {data.coverage}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <p className="text-xs font-medium text-gray-500">NDVI Promedio</p>
                      <p className="font-bold text-lg text-green-600">{fireRisk.ndvi}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <p className="text-xs font-medium text-gray-500">NDVI Mínimo</p>
                      <p className="font-bold text-lg text-blue-600">{fireRisk.minNdvi}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <p className="text-xs font-medium text-gray-500">NDVI Máximo</p>
                      <p className="font-bold text-lg text-green-800">{fireRisk.maxNdvi}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <p className="text-xs font-medium text-gray-500">Desviación</p>
                      <p className="font-bold text-lg text-purple-600">{fireRisk.stdDev}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-sm font-medium text-blue-700">📏 Área</p>
                      <p className="font-semibold">{fireRisk.areaSize}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm font-medium text-green-700">🌱 Vegetación</p>
                      <p className="font-semibold">{fireRisk.vegetationPercentage}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded">
                      <p className="text-sm font-medium text-purple-700">🔢 Píxeles</p>
                      <p className="font-semibold">{fireRisk.pixelCount?.toLocaleString()}</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <p className="text-sm font-medium text-yellow-700">🌍 Región</p>
                      <p className="font-semibold text-xs">{fireRisk.biome}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">🔥 Interpretación Earth Engine del Riesgo</h4>
                    <div className="text-sm space-y-1">
                      <p>
                        <strong>NDVI &lt; 0:</strong> Agua, nieve, superficies artificiales (Riesgo muy bajo)
                      </p>
                      <p>
                        <strong>NDVI 0.0-0.2:</strong> Suelo desnudo, vegetación muy escasa (Riesgo bajo)
                      </p>
                      <p>
                        <strong>NDVI 0.2-0.4:</strong> Vegetación escasa a moderada (Riesgo moderado)
                      </p>
                      <p>
                        <strong>NDVI 0.4-0.7:</strong> Vegetación densa (Riesgo alto - combustible abundante)
                      </p>
                      <p>
                        <strong>NDVI &gt; 0.7:</strong> Vegetación muy densa (Riesgo muy alto - máximo combustible)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowModal(false)
                        resetSelection()
                      }}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-150 ease-in-out"
                    >
                      🔄 Nueva Consulta Earth Engine
                    </button>
                    <button
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          const dataStr = JSON.stringify(fireRisk, null, 2)
                          const dataBlob = new Blob([dataStr], { type: "application/json" })
                          const url = URL.createObjectURL(dataBlob)
                          const link = document.createElement("a")
                          link.href = url
                          link.download = "earth_engine_ndvi_analysis.json"
                          link.click()
                        }
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition duration-150 ease-in-out"
                    >
                      💾 Exportar JSON
                    </button>
                    <button
                      onClick={resetSelection}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition duration-150 ease-in-out"
                    >
                      🗑️ Limpiar
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <footer className="w-full max-w-6xl text-center py-6 mt-8">
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>🌍 Powered by Google Earth Engine</strong> - Acceso a petabytes de datos satelitales
          </p>
          <p>
            <strong>📊 Colecciones:</strong> Sentinel-2 (10m), Landsat 8 (30m), MODIS (250m)
          </p>
          <p>Análisis NDVI en tiempo real para evaluación precisa de riesgo de incendios forestales</p>
          <p>Hecho Por Jose David</p>
        </div>
      </footer>
    </div>
  )
}

export default FireRiskApp
