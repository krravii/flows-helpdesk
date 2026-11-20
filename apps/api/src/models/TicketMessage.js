import mongoose from 'mongoose';

const ticketMessageSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    type: {
      type: String,
      enum: ['customer', 'engineer', 'internal_note', 'system'],
      required: true,
      index: true
    },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    authorName: { type: String, required: true },
    authorEmail: { type: String, default: '' },
    bodyText: { type: String, required: true },
    bodyHtml: { type: String, default: '' },
    attachments: [
      {
        fileName: String,
        mimeType: String,
        sizeBytes: Number,
        s3Key: String
      }
    ],
    emailMeta: {
      from: String,
      to: String,
      cc: String,
      subject: String,
      messageId: { type: String, index: true },
      inReplyTo: String,
      references: [String]
    }
  },
  { timestamps: true }
);

export const TicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);
