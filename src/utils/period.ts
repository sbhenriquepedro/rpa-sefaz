import logger from "./logger"
import env from "./env"

export type Period = { initialPeriod: Date; finalPeriod: Date }

export function getPeriodDates(): Period[] {
    const today = new Date()
    const currentDay = today.getDate()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const periods = []

    const yearStart = Number(env.YEAR_START) || currentYear
    const monthStart = (Number(env.MONTH_START) || currentMonth + 1) - 1
    const yearEnd = Number(env.YEAR_END) || currentYear
    const monthEnd = (Number(env.MONTH_END) || currentMonth + 1) - 1

    const daysDownload = env.DAYS_DOWNLOAD
        ? env.DAYS_DOWNLOAD.split(',')
              .map((day) => Number(day.trim()))
              .sort((a, b) => a - b)
        : []

    if (yearStart && monthStart >= 0 && yearEnd && monthEnd >= 0) {
        for (let year = yearStart; year <= yearEnd; year++) {
            for (let month = 0; month < 12; month++) {
                if (year === yearStart && month < monthStart) continue
                if (year === yearEnd && month > monthEnd) break

                const initialPeriod = new Date(year, month, 1)
                const finalPeriod = new Date(year, month + 1, 0)
                periods.push({ initialPeriod, finalPeriod })
            }
        }
    }

    if (daysDownload.length) {
        const lastMonth = new Date(currentYear, currentMonth, 0)
        const recentDays = [
            lastMonth.getDate(),
            new Date(currentYear, currentMonth, currentDay - 1).getDate(),
            new Date(currentYear, currentMonth, currentDay - 2).getDate(),
            new Date(currentYear, currentMonth, currentDay - 3).getDate(),
        ]

        if (env.REPROCCESS) {
            recentDays.push(new Date(currentYear, currentMonth, currentDay - 1).getDate())
        }

        for (const day of daysDownload) {
            logger.info(`Dia de download: ${day}`)

            if (recentDays.includes(day)) {
                periods.push({
                    initialPeriod: new Date(currentYear, currentMonth, 1),
                    finalPeriod: new Date(currentYear, currentMonth, day),
                })
            }
        }

        const daysDownloadInitial = [1, 2, 3, 4, 5]

        if (daysDownloadInitial.includes(currentDay)) {
            periods.push({
                initialPeriod: new Date(currentYear, currentMonth - 1, 1),
                finalPeriod: new Date(currentYear, currentMonth, 0),
            })
        }
    }

    return periods
}
