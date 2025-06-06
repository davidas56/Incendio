import type React from "react"
import "./globals.css"

export const metadata = {
  title: "NDVI Analisis de riesgos",
  description: "Análisis NDVI para evaluación de riesgo de incendios usando Google Earth Engine",
    generator: 'Davidas'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
