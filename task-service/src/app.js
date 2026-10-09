const express = require('express')
const cors = require('cors')
const taskRouter = require('./routes/tasks')

const app = express()

app.use(cors({ origin: process.env.CORS_ALLOW_ORIGIN || '*' }))
app.use(express.json({ limit: '100kb' }))
app.use('/api/tasks', taskRouter)
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'task-service' }))

// Malformed JSON bodies and any other uncaught errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

module.exports = app
