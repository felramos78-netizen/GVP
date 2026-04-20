'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns'

interface Session {
  date: Date
  branch: string
  tasks: string[]
  duration: number
}

export function SessionCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 20)) // April 20
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date(2026, 3, 20))

  // Mock sessions data
  const sessions: Session[] = [
    {
      date: new Date(2026, 3, 20),
      branch: 'claude/blissful-bell-I023Z',
      tasks: [
        'Creación de SESSION_PROGRESS.md',
        'Componente ProgressCard',
        'Componente SessionCalendar',
        'Actualización del dashboard'
      ],
      duration: 30
    },
    {
      date: new Date(2026, 3, 19),
      branch: 'main',
      tasks: ['Setup inicial', 'Integración Supabase'],
      duration: 120
    }
  ]

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) =>
    days.slice(i * 7, (i + 1) * 7)
  )

  const getSessionsForDate = (date: Date) =>
    sessions.filter(s => isSameDay(s.date, date))

  const selected = selectedDate ? getSessionsForDate(selectedDate) : []

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Sesiones de Trabajo</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded"
          >
            ←
          </button>
          <span className="text-sm font-medium text-gray-600 min-w-32 text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-500 h-8 flex items-center justify-center">
                {day}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-1">
                {week.map(day => {
                  const daySession = getSessionsForDate(day)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`h-12 rounded text-sm font-medium transition-colors ${
                        !isCurrentMonth
                          ? 'text-gray-300 bg-gray-50'
                          : isSelected
                          ? 'bg-blue-500 text-white'
                          : daySession.length > 0
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {format(day, 'd')}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Sessions Detail */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg p-4">
            {selectedDate ? (
              <>
                <h3 className="font-semibold text-gray-900 mb-3">
                  {format(selectedDate, 'EEE, MMM d')}
                </h3>

                {selected.length > 0 ? (
                  <div className="space-y-4">
                    {selected.map((session, idx) => (
                      <div key={idx} className="border-l-2 border-green-500 pl-3">
                        <div className="text-xs font-mono text-gray-500 mb-1">
                          {session.branch}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          ⏱️ {session.duration} min
                        </div>
                        <ul className="text-xs space-y-1 text-gray-700">
                          {session.tasks.map((task, i) => (
                            <li key={i} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Sin sesiones registradas</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Selecciona un día</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
