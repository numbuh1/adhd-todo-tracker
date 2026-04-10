const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  text:      { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  visible:   { type: Boolean, default: true },  // show on dashboard
  order:     { type: Number,  default: 0 }
}, { _id: true });

const overallTodosSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', required: true, unique: true
  },
  items: [itemSchema]
}, { timestamps: true });

overallTodosSchema.statics.getOrCreate = async function (userId) {
  let doc = await this.findOne({ userId });
  if (!doc) doc = await this.create({ userId, items: [] });
  return doc;
};

module.exports = mongoose.model('OverallTodos', overallTodosSchema);
