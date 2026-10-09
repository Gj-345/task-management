'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL

export default function LoginPage() {
  const router = useRouter()
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const url = isRegister
        ? `${AUTH_URL}/api/auth/register`
        : `${AUTH_URL}/api/auth/login`

      const payload = isRegister
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password }

      const res = await axios.post(url, payload)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      router.push('/dashboard')
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Something went wrong' : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">
          {isRegister ? '📝 Create account' : '🔐 Sign in'}
        </h1>
        <p className="text-gray-400 mb-6 text-sm">Task Management System</p>

        <div className="space-y-4">
          {isRegister && (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Name</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Email</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="email@example.com"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Password</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
          >
            {loading ? 'Loading...' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          <button
            onClick={() => setIsRegister(!isRegister)}
            className="w-full text-gray-400 hover:text-white text-sm transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </main>
  )
}