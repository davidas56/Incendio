# 1. Crear un nuevo proyecto Next.js
npx create-next-app@latest fire-risk-app --typescript --tailwind --eslint --app

# 2. Navegar al directorio
cd fire-risk-app

# 3. Instalar dependencias necesarias
npm install react-leaflet leaflet
npm install -D @types/leaflet

# 4. Instalar shadcn/ui
npx shadcn@latest init

# 5. Instalar componentes de shadcn/ui que necesitas
npx shadcn@latest add button card

echo "✅ Proyecto configurado correctamente"
echo "📁 Ahora copia el código de fire-risk-app.tsx a tu proyecto"
echo "🚀 Ejecuta 'npm run dev' para iniciar el servidor"
