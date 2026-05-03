import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { DashboardProvider } from '@/context/DashboardContext'
import NavBar from '@/components/navigation/NavBar'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <DashboardProvider>
      <NavBar />
      <Component {...pageProps} />
    </DashboardProvider>
  )
}
