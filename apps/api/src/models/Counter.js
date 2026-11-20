import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 }
});

export const Counter = mongoose.model('Counter', counterSchema);

export async function getNextTicketNumber(prefix = 'FLW-', session = null) {
  const doc = await Counter.findByIdAndUpdate(
    'ticket_number',
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `${prefix}${doc.seq}`;
}
