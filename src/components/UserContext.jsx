import { createContext, useContext, useState, useMemo } from 'react'

export const USERS = {
  admin: [
    { id: 'srushti', name: 'Srushti', role: 'admin', avatar: 'SR',
      locations: ['bangalore', 'hyderabad', 'chennai_1', 'chennai_2'] },
  ],
  users: [
    { id: 'varsha', name: 'Varsha', role: 'user', avatar: 'VA',
      locations: ['bangalore', 'hyderabad'] },
    { id: 'pushpa', name: 'Pushpa', role: 'user', avatar: 'PU',
      locations: ['hyderabad'] },
    { id: 'nitya',  name: 'Nitya',  role: 'user', avatar: 'NI',
      locations: ['bangalore'] },
  ],
}

const CAM_NAMES = {
  'CAM-A01':    'Foundation Pit View',
  'CAM-HYD-1':  'Main Gate Entry',
  'CAM-HYD-2':  'Tower A — Ground Floor',
  'CAM-HYD-3':  'Tower A — Level 3',
  'CAM-HYD-4':  'Tower A — Level 6',
  'CAM-HYD-5':  'Tower A — Rooftop',
  'CAM-HYD-6':  'Tower B — Ground Floor',
  'CAM-HYD-7':  'Tower B — Level 3',
  'CAM-HYD-8':  'Tower B — Level 6',
  'CAM-HYD-9':  'Tower B — Rooftop',
  'CAM-HYD-10': 'Crane Zone Alpha',
  'CAM-HYD-11': 'Crane Zone Beta',
  'CAM-HYD-12': 'Concrete Pour Area',
  'CAM-HYD-13': 'Material Storage Yard',
  'CAM-HYD-14': 'Workers Welfare Block',
  'CAM-HYD-15': 'North Perimeter Fence',
  'CAM-HYD-16': 'South Perimeter Fence',
  'CAM-HYD-17': 'Excavation Pit East',
  'CAM-HYD-18': 'Excavation Pit West',
  'CAM-HYD-19': 'Site Office Entrance',
  'CAM-HYD-20': 'Emergency Exit Gate',
  'CAM-CHN-1':  'Block B — Perimeter',
  'CAM-CHN-2':  'Block B — Entry Gate',
}

function withName(cam) {
  return {
    ...cam,
    displayName: CAM_NAMES[cam.id] || cam.id,
    name:        cam.db_id,
  }
}

export const CAMERA_LOCATIONS = [
  {
    id: 'bangalore', label: 'Bangalore', icon: '🏗️',
    cameras: [withName({
      id:      'CAM-A01',
      db_id:   'Pier_Cap_Cam_16389',
      hls_url: '/hls/CAM-A01/stream.m3u8',
      ready:   true,
    })],
  },
  {
    id: 'hyderabad', label: 'Hyderabad', icon: '🏢',
    cameras: Array.from({ length: 20 }, (_, i) => withName({
      id:      `CAM-HYD-${i + 1}`,
      db_id:   'Pier_Cap_Cam_16388',
      hls_url: '/hls/CAM-A02/stream.m3u8',
      ready:   i === 0,
    })),
  },
  {
    id: 'chennai', label: 'Chennai', icon: '🏭',
    subLocations: [
      {
        id: 'chennai_1', label: 'Location 1',
        cameras: [withName({
          id:      'CAM-CHN-1',
          db_id:   'Pier_Cap_Cam_16387',
          hls_url: '/hls/CAM-A03/stream.m3u8',
          ready:   true,
        })],
      },
      {
        id: 'chennai_2', label: 'Location 2',
        cameras: [withName({
          id:      'CAM-CHN-2',
          db_id:   'Pier_Cap_Cam_16386',
          hls_url: '/hls/CAM-A07/stream.m3u8',
          ready:   false,
        })],
      },
    ],
  },
]

export const ALL_LOCATION_IDS = ['bangalore', 'hyderabad', 'chennai_1', 'chennai_2']

// ── localStorage helpers ──────────────────────────────────────────────────────
const STORAGE_KEY = 'yolointel_users'

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return USERS
    const saved = JSON.parse(raw)
    // Merge: keep USERS structure but overwrite locations from saved data
    const mergeList = (defaults, saved) =>
      defaults.map(u => {
        const match = saved.find(s => s.id === u.id)
        return match ? { ...u, locations: match.locations } : u
      })
    return {
      admin: mergeList(USERS.admin, saved.admin || []),
      users: mergeList(USERS.users, saved.users || []),
    }
  } catch {
    return USERS
  }
}

function saveUsers(users) {
  try {
    // Only persist id + locations — nothing sensitive
    const slim = list => list.map(u => ({ id: u.id, locations: u.locations }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      admin: slim(users.admin),
      users: slim(users.users),
    }))
  } catch {
    // localStorage unavailable — silent fail, in-memory still works
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const UserContext = createContext(null)

export function UserProvider({ children }) {
  // null means not logged in — shows LoginPage
  const [currentUserId, setCurrentUserId] = useState(null)

  // ── Initialise from localStorage so admin changes survive logout ──────────
  const [users, setUsers] = useState(() => loadUsers())

  const allUsers    = [...users.admin, ...users.users]
  const currentUser = currentUserId ? allUsers.find(u => u.id === currentUserId) ?? null : null
  const isAdmin     = currentUser?.role === 'admin'
  const isLoggedIn  = currentUser !== null

  // ── visibleLocations: depends on users state AND currentUserId so it
  //    recomputes both when admin toggles access AND when a user logs in ──────
  const visibleLocations = useMemo(() => {
    if (!currentUser) return []
    // Re-read currentUser's locations from the live `users` state
    const liveUser = allUsers.find(u => u.id === currentUser.id)
    if (!liveUser) return []
    return CAMERA_LOCATIONS
      .filter(loc => {
        if (loc.subLocations)
          return loc.subLocations.some(sub => liveUser.locations.includes(sub.id))
        return liveUser.locations.includes(loc.id)
      })
      .map(loc => {
        if (loc.subLocations) {
          return {
            ...loc,
            subLocations: loc.subLocations.filter(sub =>
              liveUser.locations.includes(sub.id)
            ),
          }
        }
        return loc
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, users])   // ← key fix: depend on `users` not `currentUser`

  // Called from LoginPage — sets the active user
  const login = (user) => setCurrentUserId(user.id)

  // Clears session — renders LoginPage again
  const logout = () => setCurrentUserId(null)

  // Switch active user from Settings (admin demo tool)
  const setCurrentUser = (user) => setCurrentUserId(user.id)

  // Admin only: toggle a location on/off for a specific user
  const toggleUserLocation = (userId, locationId) => {
    if (!isAdmin) return
    setUsers(prev => {
      const update = list => list.map(u => {
        if (u.id !== userId) return u
        const has = u.locations.includes(locationId)
        return {
          ...u,
          locations: has
            ? u.locations.filter(l => l !== locationId)
            : [...u.locations, locationId],
        }
      })
      const next = { admin: update(prev.admin), users: update(prev.users) }
      saveUsers(next)   // ← persist immediately on every toggle
      return next
    })
  }

  // Admin only: permanently remove a user
  const deleteUser = (userId) => {
    if (!isAdmin) return
    setUsers(prev => {
      const next = {
        admin: prev.admin.filter(u => u.id !== userId),
        users: prev.users.filter(u => u.id !== userId),
      }
      saveUsers(next)
      return next
    })
  }

  return (
    <UserContext.Provider value={{
      currentUser,
      isLoggedIn,
      isAdmin,
      visibleLocations,
      users,
      login,
      logout,
      setCurrentUser,
      toggleUserLocation,
      deleteUser,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}