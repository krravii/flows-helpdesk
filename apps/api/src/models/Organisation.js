import mongoose from 'mongoose';

const organisationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true, maxlength: 6 },
    description: { type: String, default: '' },
    primaryDomain: { type: String, required: true, lowercase: true, trim: true, index: true },
    additionalDomains: [{ type: String, lowercase: true, trim: true }],
    domainVerified: { type: Boolean, default: false },
    registeredEmails: [{ type: String, lowercase: true, trim: true }],
    contactPerson: { type: String, default: '' },
    contactEmail: { type: String, lowercase: true, trim: true, default: '' },
    contactPhone: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Disabled'], default: 'Active', index: true },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

organisationSchema.index({ additionalDomains: 1 });
organisationSchema.index({ registeredEmails: 1 });

export const Organisation = mongoose.model('Organisation', organisationSchema);
