import { Document, Schema, model } from 'mongoose'
import { ICompany } from './Company'

export type ModelNote = 'NF-e' | 'NFC-e' | 'CT-e'
export type SitNote = 'Autorizadas' | 'Canceladas'
export type StatusNote = 'Warning' | 'Error' | 'Success' | 'Pending' | 'Processing'

export interface INote extends Document {
    company: ICompany
    modelNote: ModelNote
    sitNote: SitNote
    statusNote: StatusNote
    initialPeriod: Date
    finalPeriod: Date
    screenshot: string
    linkDownload?: string
    quantityNotes: number
    filePath?: string
    fileName?: string
    warn?: string
    queued?: boolean
}

const NoteSchema: Schema = new Schema(
    {
        company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
        modelNote: { type: String, enum: ['NF-e', 'NFC-e', 'CT-e'], default: 'NF-e' },
        sitNote: { type: String, enum: ['Autorizadas', 'Canceladas'], default: 'Autorizadas' },
        statusNote: { type: String, enum: ['Warning', 'Error', 'Success', 'Pending', 'Processing'], default: 'Pending' },
        initialPeriod: { type: Date, required: true },
        finalPeriod: { type: Date, required: true },
        screenshot: { type: String, required: false, default: '' },
        quantityNotes: { type: Number, required: false, default: 0 },
        linkDownload: { type: String, required: false, default: '' },
        filePath: { type: String, required: false, default: '' },
        fileName: { type: String, required: false, default: '' },
        warn: { type: String, required: false, default: '' },
        queued: { type: Boolean, required: false, default: false },
    },
    { timestamps: true },
)

export default model<INote>('Note', NoteSchema)
