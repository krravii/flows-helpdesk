import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, default: '' },
    userType: { type: String, enum: ['internal', 'customer'], required: true, index: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null, index: true },
    team: { type: String, default: 'General Support' },
    availability: {
      type: String,
      enum: ['Available', 'Busy', 'Away', 'Offline'],
      default: 'Available'
    },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active', index: true },
    preferences: {
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'Asia/Dubai' }
    },
    lastLoginAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
