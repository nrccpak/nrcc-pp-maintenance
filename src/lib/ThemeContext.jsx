import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = [
  { id: 'daylight',     label: 'Daylight',     short: 'Day' },
  { id: 'control-room', label: 'Control Room', short: 'Room' },
  { id: 'night',        label: 'Night',        short: 'Night' },
]

const STORAGE_KEY = 'nrcc-theme'
const DEFAULT_THEME = 'daylight'

function isValidTheme(id) {
  return THEMES.some(t => t.id === id)
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isValidTheme(stored) ? stored : DEFAULT_THEME
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
