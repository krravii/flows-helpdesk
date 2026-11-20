import mongoose from 'mongoose';
import { PERMISSION_KEYS } from '@flows-helpdesk/shared';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['System', 'Custom'], default: 'Custom' },
    category: { type: String, default: 'General' },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' },
    permissions: [
      {
        type: String,
        enum: PERMISSION_KEYS
      }
    ]
  },
  { timestamps: true }
);

export const Role = mongoose.model('Role', roleSchema);
