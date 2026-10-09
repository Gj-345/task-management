require('dotenv').config()
const app = require('./src/app')
const connectDB = require('./src/db')

for (const name of ['JWT_SECRET', 'MONGODB_URI']) {
  if (!process.env[name]) {
    console.error(`${name} must be set`)
    process.exit(1)
  }
}

const PORT = process.env.PORT || 3002

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Task service running on http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message)
    process.exit(1)
  })
