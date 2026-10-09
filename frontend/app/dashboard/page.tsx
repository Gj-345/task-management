'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const TASK_URL = process.env.NEXT_PUBLIC_TASK_URL
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL
const NOTIFICATION_URL = process.env.NEXT_PUBLIC_NOTIFICATION_URL

type Task = {
  _id: string
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  createdAt: string
  createdBy: number
  assignedTo: number | null
}

type User = { id: number; name: string; email: string }

const STATUS_LABEL: Record<string, string> = {
  todo: '📋 To Do',
  in_progress: '⚡ In Progress',
  done: '✅ Done'
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-green-400 bg-green-900',
  medium: 'text-yellow-400 bg-yellow-900',
  high: 'text-red-400 bg-red-900'
}

export default function Dashboard() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    dueDate: '', notifyEmail: '', assigneeEmail: ''
  })

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  })

  // Sends the user back to login on an expired/invalid token; otherwise shows the error.
  const handleError = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      localStorage.clear()
      router.push('/login')
      return
    }
    const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined
    setError(message || fallback)
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }

    const init = async () => {
      const userData = localStorage.getItem('user')
      if (userData) {
        try { setUser(JSON.parse(userData)) } catch { localStorage.removeItem('user') }
      }
      try {
        const res = await axios.get(`${TASK_URL}/api/tasks`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setTasks(res.data)
      } catch (err) {
        handleError(err, 'Failed to load tasks')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router, handleError])

  const canEdit = (t: Task) => t.createdBy === user?.id || t.assignedTo === user?.id
  const canDelete = (t: Task) => t.createdBy === user?.id

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ title: '', description: '', priority: 'medium', dueDate: '', notifyEmail: '', assigneeEmail: '' })
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ title: '', description: '', priority: 'medium', dueDate: '', notifyEmail: '', assigneeEmail: '' })
    setShowForm(true)
  }

  const openEdit = (t: Task) => {
    setEditingId(t._id)
    setForm({
      title: t.title, description: t.description, priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '', notifyEmail: '', assigneeEmail: ''
    })
    setShowForm(true)
  }

  const saveTask = async () => {
    if (!form.title.trim()) return
    setError('')
    const editing = tasks.find(t => t._id === editingId) ?? null

    // Assign by email (the user must already be registered)
    let assignee: User | null = null
    const assigneeEmail = form.assigneeEmail.trim()
    if (assigneeEmail) {
      try {
        const res = await axios.get(`${AUTH_URL}/api/auth/users/lookup`, {
          params: { email: assigneeEmail },
          headers: authHeaders()
        })
        assignee = res.data
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setError('No registered user found for the assignee email')
        } else {
          handleError(err, 'Failed to look up the user')
        }
        return
      }
    }

    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(), description: form.description, priority: form.priority,
        dueDate: form.dueDate || null
      }
      // When editing, only change the assignee if a new email was entered (blank = unchanged)
      if (!editing || assignee) body.assignedTo = assignee?.id ?? null

      const res = editing
        ? await axios.put(`${TASK_URL}/api/tasks/${editing._id}`, body, { headers: authHeaders() })
        : await axios.post(`${TASK_URL}/api/tasks`, body, { headers: authHeaders() })
      setTasks(prev => editing
        ? prev.map(t => t._id === editing._id ? res.data : t)
        : [res.data, ...prev])
      const notifyTo = form.notifyEmail || assignee?.email
      const sent = { title: form.title, description: form.description }
      closeForm()

      // Send the email notification (the task is already saved even if this fails)
      if (notifyTo) {
        try {
          await axios.post(`${NOTIFICATION_URL}/api/notifications/send`, {
            to: notifyTo,
            subject: `${editing ? 'Task Updated' : 'New Task'}: ${sent.title.replace(/[\r\n]+/g, ' ')}`,
            taskTitle: sent.title,
            taskDescription: sent.description,
            assignedBy: user?.name || 'System',
            type: editing ? 'task_updated' : 'task_created'
          }, { headers: authHeaders() })
        } catch (err) {
          const reason = axios.isAxiosError(err) ? err.response?.data?.error : undefined
          setError(`Task saved, but the email notification failed${reason ? `: ${reason}` : ''}`)
        }
      }
    } catch (err) {
      handleError(err, 'Failed to save the task')
    }
  }

  const updateStatus = async (id: string, status: Task['status']) => {
    setError('')
    try {
      await axios.put(`${TASK_URL}/api/tasks/${id}`, { status }, { headers: authHeaders() })
      setTasks(prev => prev.map(t => t._id === id ? { ...t, status } : t))
    } catch (err) {
      handleError(err, 'Failed to update the status')
    }
  }

  const deleteTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return
    setError('')
    try {
      await axios.delete(`${TASK_URL}/api/tasks/${id}`, { headers: authHeaders() })
      setTasks(prev => prev.filter(t => t._id !== id))
    } catch (err) {
      handleError(err, 'Failed to delete the task')
    }
  }

  const logout = () => {
    localStorage.clear()
    router.push('/login')
  }

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">📋 Task Management</h1>
          <p className="text-gray-400 text-sm">Hello, {user?.name || 'User'}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={openCreate}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + New Task
          </button>
          <button onClick={logout}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {error && (
          <div role="alert" className="bg-red-900/40 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3 mb-4 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'All', value: tasks.length, color: 'text-white' },
            { label: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: 'text-blue-400' },
            { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: 'text-yellow-400' },
            { label: 'Done', value: tasks.filter(t => t.status === 'done').length, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 rounded-xl p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {['all', 'todo', 'in_progress', 'done'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === f ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {/* Tasks */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <p className="text-4xl mb-4">📭</p>
            <p>No tasks yet. Click + New Task to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <div key={task._id} className="bg-gray-900 rounded-xl p-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{task.title}</h3>
                    {task.assignedTo === user?.id && task.createdBy !== user?.id && (
                      <span className="text-xs px-2 py-0.5 rounded-full text-blue-300 bg-blue-900">Assigned to you</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLOR[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                  {task.description && <p className="text-gray-400 text-sm mb-2">{task.description}</p>}
                  {task.dueDate && (
                    <p className="text-xs text-gray-500">Due: {new Date(task.dueDate).toLocaleDateString('en-GB')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={task.status}
                    disabled={!canEdit(task)}
                    onChange={e => updateStatus(task._id, e.target.value as Task['status'])}
                    className="bg-gray-800 border border-gray-700 text-sm rounded-lg px-2 py-1 text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="todo">📋 To Do</option>
                    <option value="in_progress">⚡ In Progress</option>
                    <option value="done">✅ Done</option>
                  </select>
                  {canEdit(task) && (
                    <button onClick={() => openEdit(task)}
                      className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 rounded transition-colors">
                      Edit
                    </button>
                  )}
                  {canDelete(task) && (
                    <button onClick={() => deleteTask(task._id)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded transition-colors">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Task Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Task' : 'New Task'}</h2>
            <div className="space-y-3">
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="Title *"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Description"
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none"
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">🟢 Low Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="high">🔴 High Priority</option>
              </select>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
              />
              {(!editingId || tasks.find(t => t._id === editingId)?.createdBy === user?.id) && (
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  placeholder={editingId
                    ? '👤 Change assignee (member email, blank = keep current)'
                    : '👤 Assign to (member email, optional)'}
                  type="email"
                  value={form.assigneeEmail}
                  onChange={e => setForm({ ...form, assigneeEmail: e.target.value })}
                />
              )}
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="📧 Notify by email (member email, optional)"
                type="email"
                value={form.notifyEmail}
                onChange={e => setForm({ ...form, notifyEmail: e.target.value })}
              />
              <div className="flex gap-3 pt-2">
                <button onClick={closeForm}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={saveTask}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-medium transition-colors">
                  {editingId ? 'Save' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}