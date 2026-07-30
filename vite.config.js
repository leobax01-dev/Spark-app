import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vite only exposes VITE_-prefixed env vars to client code by default.
  // NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN already exists in .env.local (added
  // ahead of the Surveillance Radar map work) using Next.js's naming
  // convention even though this is a Vite app — rather than duplicate the
  // token under a second name or rename it and risk breaking whatever else
  // expects that exact name, this just tells Vite to also inline
  // NEXT_PUBLIC_-prefixed vars. Mapbox access tokens are meant to be
  // public/client-side (unlike a service-role key), so exposing it to the
  // browser bundle is the intended use, not a leak.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
