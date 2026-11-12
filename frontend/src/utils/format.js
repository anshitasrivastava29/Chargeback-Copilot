const DAY = 24 * 60 * 60 * 1000

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatCurrency(value) {
  return currencyFormatter.format(value)
}

export function formatBytes(value) {
  const bytes = Number(value) || 0

  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`
}

export function formatDate(value) {
  return shortDateFormatter.format(new Date(value))
}

export function formatFullDate(value) {
  return fullDateFormatter.format(new Date(value))
}

export function getDueInfo(dateValue) {
  if (!dateValue) {
    return null
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dateValue)
  due.setHours(0, 0, 0, 0)

  const days = Math.round((due.getTime() - today.getTime()) / DAY)

  if (days < 0) {
    return { days, label: `${Math.abs(days)}d overdue`, tone: 'danger' }
  }
  if (days === 0) {
    return { days, label: 'Due today', tone: 'warning' }
  }
  if (days === 1) {
    return { days, label: 'Due tomorrow', tone: 'warning' }
  }

  return {
    days,
    label: `Due in ${days}d`,
    tone: days <= 3 ? 'warning' : 'neutral',
  }
}
