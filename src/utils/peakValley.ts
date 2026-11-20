import { HOLIDAY_DATES, MAKEUP_WORKDAYS } from '../services/holidayData.js'
import { formatDate } from './format.js'

const holidaySet = new Set(HOLIDAY_DATES)
const makeupWorkdaySet = new Set(MAKEUP_WORKDAYS)

/** 休息日：周六周日或法定放假日；法定调休上班日按工作日处理 */
export const isRestDay = (date: Date): boolean => {
  const key = formatDate(date)
  if (key === null) {
    return false
  }
  if (makeupWorkdaySet.has(key)) {
    return false
  }
  return holidaySet.has(key) || date.getDay() === 0 || date.getDay() === 6
}

/** 峰段：工作日的 9:00-12:00 与 14:00-18:00；其余时段（含休息日全天）为谷段 */
export const isPeakTime = (date: Date = new Date()): boolean => {
  if (isRestDay(date)) {
    return false
  }
  const hour = date.getHours()
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}