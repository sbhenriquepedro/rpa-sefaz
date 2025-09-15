import cron from 'node-cron'
import { isValidCron } from '@utils/cron'
import env from '@utils/env'
import logger from '@utils/logger'
import Company, { ICompany } from '@models/Company'
import Note, { StatusNote } from '@models/Note'
import { getPeriodDates } from '@utils/period'
import NoteService from '@services/NoteService'
import ApiPfxManager from '@utils/apiPfxManager'

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

                logger.info('********************************')
                
                if (note != null && note.queued !== true && status.includes(note.statusNote)) {
                    logger.info(`Processando empresa: ${company.name} (${company.codeCompanieAccountSystem}),`)
                    logger.info(`Modelo: ${modelNote},`)
                    logger.info(`Situacao: ${sitNote},`)
                    logger.info(`Periodo: ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}.`)

                    await ApiPfxManager.clearCertificates()
                    await ApiPfxManager.installCertificate(company.federalRegistration)
                    await new NoteService(note).getDownloadLink()
                } else {
                    logger.info(`Nenhuma nota para processar para a empresa ${company.name} (${company.codeCompanieAccountSystem}), modelo ${modelNote}, situação ${sitNote}, período ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}. Pulando...`)
                }
            }
        }
    }
}

export function scheduleProcessCompanyJob(): void {
    let scheduleExpression: string

    if (env.INSTANTLY === 'true') {
        const now = new Date()
        const min = now.getMinutes() + 1
        const hour = now.getHours()

        scheduleExpression = `${min} ${hour} * * *`
    } else if (env.SCHEDULE_PROCESS_COMPANY && isValidCron(env.SCHEDULE_PROCESS_COMPANY)) {
        scheduleExpression = env.SCHEDULE_PROCESS_COMPANY
    } else {
        scheduleExpression = '0 8,12,16 * * *'
    }

    logger.info(`Agendamento definido para processCompanyJob: ${scheduleExpression}`)

    cron.schedule(scheduleExpression, async () => {
        try {
            const companies = await Company.find()
            logger.info(`Total de empresas encontradas: ${companies.length}`)

            for (const company of companies) {
                await processCompany(company)
            }

            logger.info('********************************')
            logger.info('Processamento concluído.')
        } catch (error) {
            logger.error(`Erro no agendamento processCompanyJob.`)
        }
    })
}