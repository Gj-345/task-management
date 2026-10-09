const mongoose = require('mongoose')

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['todo', 'in_progress', 'done'], 
    default: 'todo' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  assignedTo: { type: Number, default: null },
  createdBy: { type: Number, required: true },
  dueDate: { type: Date, default: null }
}, { timestamps: true })

module.exports = mongoose.model('Task', taskSchema)