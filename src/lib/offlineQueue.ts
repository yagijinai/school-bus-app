/**
 * スクールバス運行管理システム：乗務員オフライン点呼キュー & 触覚フィードバック管理
 */

export interface OfflineRideLog {
  id: string
  studentId: string
  date: string
  tripName: string
  status: 'riding' | 'absent' | 'completed'
  timestamp: string
}

const STORAGE_KEY = 'school_bus_offline_ride_queue_v1'

/**
 * 触覚フィードバック (Web Vibration API)
 */
export const triggerHaptic = (pattern: number | number[] = 40): void => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch (_) {
      // Vibration API not supported or blocked by user preference
    }
  }
}

/**
 * オフライン点呼キューの取得
 */
export const getOfflineQueue = (): OfflineRideLog[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as OfflineRideLog[]
    }
  } catch (err) {
    console.error('Failed to load offline queue:', err)
  }
  return []
}

/**
 * オフライン点呼キューへの追加
 */
export const enqueueOfflineRide = (log: Omit<OfflineRideLog, 'id' | 'timestamp'>): OfflineRideLog[] => {
  try {
    const current = getOfflineQueue()
    // 同一キー (studentId, date, tripName) の既存ログがあれば上書き
    const filtered = current.filter(
      item => !(item.studentId === log.studentId && item.date === log.date && item.tripName === log.tripName)
    )
    const newLog: OfflineRideLog = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...log,
      timestamp: new Date().toISOString()
    }
    const updated = [...filtered, newLog]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch (err) {
    console.error('Failed to enqueue offline ride log:', err)
    return getOfflineQueue()
  }
}

/**
 * オフライン点呼キューの削除 / クリア
 */
export const removeOfflineRideItem = (id: string): OfflineRideLog[] => {
  try {
    const current = getOfflineQueue()
    const updated = current.filter(item => item.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch (err) {
    console.error('Failed to remove offline ride item:', err)
    return getOfflineQueue()
  }
}

export const clearOfflineQueue = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error('Failed to clear offline queue:', err)
  }
}
