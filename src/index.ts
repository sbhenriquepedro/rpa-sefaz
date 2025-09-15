import logger from '@utils/logger'
import { connectDB } from '@utils/database'
import ApiPfxManager from '@utils/apiPfxManager'
import { validateEnv } from '@utils/validateEnv'
import Company, { ICompany } from '@models/Company'
import Note, { StatusNote } from '@models/Note'
import env from '@utils/env'
import { getPeriodDates } from '@utils/period'
import NoteService from '@services/NoteService'

const REQUIRED_ENV_VARS = ['API_PFX_MANAGER', 'STRUCTURE']
const MODEL_NOTES = ['NF-e', 'NFC-e', 'CT-e']
const SITUATION_NOTES = ['Autorizadas', 'Canceladas']
const COMPANIES_TO_DOWNLOAD = env.COMPANIES_TO_DOWNLOAD
        ? env.COMPANIES_TO_DOWNLOAD.split(',').map((id) => id.trim())
        : null
const PERIODS = getPeriodDates()

async function checkAndSetNoteStatus(company: ICompany): Promise<boolean> {
    for (const modelNote of MODEL_NOTES) {
        for (const sitNote of SITUATION_NOTES) {
            for (const { initialPeriod, finalPeriod } of PERIODS) {
                logger.warn('********************************')
                logger.warn(`Verificando empresa ${company.name} (${company.codeCompanieAccountSystem}),`)
                logger.warn(`Modelo: ${modelNote},`)
                logger.warn(`Situação: ${sitNote},`)
                logger.warn(`Período: ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}.`)

                const existingNote = await Note.findOne({
                    company: company._id,
                    modelNote,
                    sitNote,
                    initialPeriod,
                    finalPeriod,
                })

                if (existingNote) {
                    logger.warn('Já possui notas pendentes. Pulando...')
                    continue
                } else {
                    logger.warn('Nenhuma nota pendente encontrada. Criando nova nota...')
                }

                await Note.create({
                    company: company._id,
                    modelNote,
                    sitNote,
                    statusNote: 'Pending',
                    initialPeriod,
                    finalPeriod,
                    screenshot: '',
                    quantityNotes: 0,
                })
            }
        }
    }

    return true
}

async function processCompany(company: ICompany, status: StatusNote[] = ['Pending']): Promise<void> {
    if (COMPANIES_TO_DOWNLOAD && !COMPANIES_TO_DOWNLOAD.includes(String(company.codeCompanieAccountSystem))) {
        return
    }

    const canProcess = await checkAndSetNoteStatus(company)
    if (!canProcess) return

    for (const modelNote of MODEL_NOTES) {
        for (const sitNote of SITUATION_NOTES) {
            for (const { initialPeriod, finalPeriod } of PERIODS) {
                const note = await Note.findOne({
                    company: company._id,
                    modelNote,
                    sitNote,
                    initialPeriod,
                    finalPeriod,
                }).populate('company')

                if (note != null && note.queued !== true && status.includes(note.statusNote)) {
                    logger.info('********************************')
                    logger.info(`Processando empresa: ${company.name} (${company.codeCompanieAccountSystem}),`)
                    logger.info(`Modelo: ${modelNote},`)
                    logger.info(`Situacao: ${sitNote},`)
                    logger.info(`Periodo: ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}.`)

                    await ApiPfxManager.clearCertificates()
                    await ApiPfxManager.installCertificate(company.federalRegistration)
                    

                    await new NoteService(note).getDownloadLink()
                }
            }
        }
    }
}

async function main(): Promise<void> {
    await connectDB()
    await ApiPfxManager.checkApiHealth()
    validateEnv(REQUIRED_ENV_VARS)

    const companies = await Company.find()
    logger.info(`Total de empresas encontradas: ${companies.length}`)

    for (const company of companies) {
        await processCompany(company)
    }

    logger.info('********************************')
    logger.info('Processamento concluído.')
}

main().catch((err) => {
    logger.error(`Erro: ${err.message}`)
})
