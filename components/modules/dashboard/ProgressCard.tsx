'use client'

export function ProgressCard() {
  const completed = 11
  const inProgress = 2
  const total = 13
  const percentage = Math.round((completed / total) * 100)

  const tasks = [
    { name: 'Dashboard mejorado', status: 'in-progress', progress: 50 },
    { name: 'Calendario sesiones', status: 'in-progress', progress: 25 },
    { name: 'Fintoc integration', status: 'pending', progress: 0 },
    { name: 'Push notificaciones', status: 'pending', progress: 0 },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Plan de Acción</h2>
        <span className="text-sm font-medium text-blue-600">{percentage}% avance</span>
      </div>

      <div className="mb-6">
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {completed} completadas, {inProgress} en progreso
        </p>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
            <div className="flex-1">
              <p className="text-sm text-gray-700">{task.name}</p>
              <div className="w-full h-1 bg-gray-100 rounded mt-1">
                <div
                  className={`h-full transition-all ${
                    task.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
            <span className={`ml-2 text-xs px-2 py-1 rounded ${
              task.status === 'in-progress'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {task.progress}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
