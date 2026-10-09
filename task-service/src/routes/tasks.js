const express = require('express')
const mongoose = require('mongoose')
const Task = require('../models/Task')
const auth = require('../middleware/auth')

const router = express.Router()

// Fields a client is allowed to set; everything else (e.g. createdBy) is ignored
const EDITABLE_FIELDS = ['title', 'description', 'status', 'priority', 'assignedTo', 'dueDate']

const pickEditable = (body = {}) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((key) => key in body).map((key) => [key, body[key]]))

// A user can only see tasks they created or that are assigned to them
const visibleTo = (userId) => ({ $or: [{ createdBy: userId }, { assignedTo: userId }] })

const serverError = (res, err) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}

const badRequest = (res, err) =>
  res.status(400).json({
    error: err.name === 'ValidationError' ? err.message : 'Invalid request',
  })

// Reject malformed ids early instead of letting Mongoose throw a CastError
router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ error: 'Task not found' })
  }
  next()
})

// List tasks
router.get('/', auth, async (req, res) => {
  try {
    const filter = visibleTo(req.user.user_id)
    // Accept plain strings only, so operators like ?status[$ne]=x cannot be injected
    for (const key of ['status', 'priority']) {
      if (typeof req.query[key] === 'string') filter[key] = req.query[key]
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 })
    res.json(tasks)
  } catch (err) {
    serverError(res, err)
  }
})

// Get one task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, ...visibleTo(req.user.user_id) })
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  } catch (err) {
    serverError(res, err)
  }
})

// Create a task
router.post('/', auth, async (req, res) => {
  try {
    const task = await Task.create({
      ...pickEditable(req.body),
      createdBy: req.user.user_id,
    })
    res.status(201).json(task)
  } catch (err) {
    badRequest(res, err)
  }
})

// Update a task (creator or assignee only)
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const userId = req.user.user_id
    if (task.createdBy !== userId && task.assignedTo !== userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    task.set(pickEditable(req.body))
    await task.save()
    res.json(task)
  } catch (err) {
    badRequest(res, err)
  }
})

// Delete a task (creator only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ error: 'Task not found' })

    if (task.createdBy !== req.user.user_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    await task.deleteOne()
    res.json({ message: 'Task deleted' })
  } catch (err) {
    serverError(res, err)
  }
})

module.exports = router
