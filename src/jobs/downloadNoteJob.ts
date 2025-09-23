import cron from 'node-cron'
import { isValidCron } from '@utils/cron'
import env from '@utils/env'
import logger from '@utils/logger'
import Company, { ICompany } from '@models/Company'
import Note from '@models/Note'
import { getPeriodDates } from '@utils/period'
import NoteService from '@services/NoteService'

const MODEL_NOTES = ['NF-e', 'NFC-e', 'CT-e']
const SITUATION_NOTES = ['Autorizadas', 'Canceladas']
const COMPANIES_TO_DOWNLOAD = env.COMPANIES_TO_DOWNLOAD
        ? env.COMPANIES_TO_DOWNLOAD.split(',').map((id) => id.trim())
        : null
const PERIODS = getPeriodDates()

async function downloadNote(company: ICompany): Promise<void> {
    if (COMPANIES_TO_DOWNLOAD && !COMPANIES_TO_DOWNLOAD.includes(String(company.codeCompanieAccountSystem))) {
        logger.info(`Empresa ${company.name} (${company.codeCompanieAccountSystem}) não está na lista de empresas para download. Pulando...`)
        return
    }

    for (const modelNote of MODEL_NOTES) {
        for (const sitNote of SITUATION_NOTES) {
            for (const { initialPeriod, finalPeriod } of PERIODS) {
                try {
                    const note = await Note.findOne({
                        company: company._id,
                        modelNote,
                        sitNote,
                        initialPeriod,
                        finalPeriod
                    }).populate('company')
                    
                    logger.info('********************************')

                    if (note && note.queued && note.statusNote !== 'Success') {
                        logger.info(`Iniciando download da empresa: ${company.name} (${company.codeCompanieAccountSystem}),`)
                        logger.info(`Modelo: ${modelNote},`)
                        logger.info(`Situacao: ${sitNote},`)
                        logger.info(`Periodo: ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}.`)

                        await new NoteService(note).downloadFile()
                    } else if (!note || !note.queued) {
                        logger.info(`Sem link de download para a empresa: ${company.name} (${company.codeCompanieAccountSystem}),`)
                        logger.info(`Modelo: ${modelNote},`)
                        logger.info(`Situacao: ${sitNote},`)
                        logger.info(`Periodo: ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}.`)
                        logger.info('Pulando...')
                    } else if (note.statusNote === 'Success') {
                        logger.info(`Nota já baixada com sucesso para a empresa: ${company.name} (${company.codeCompanieAccountSystem}),`)
                        logger.info(`Modelo: ${modelNote},`)
                        logger.info(`Situacao: ${sitNote},`)
                        logger.info(`Periodo: ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}.`)
                        logger.info('Pulando...')
                    } else {
                        logger.info(`Nenhuma nota para processar para a empresa: ${company.name} (${company.codeCompanieAccountSystem}),`)
                        logger.info(`Modelo: ${modelNote},`)
                        logger.info(`Situacao: ${sitNote},`)
                        logger.info(`Periodo: ${initialPeriod.toLocaleDateString()} - ${finalPeriod.toLocaleDateString()}.`)
                        logger.info('Pulando...')
                    }
                } catch (error) {
                    logger.error(`Erro ao realizar o download da empresa.`)
                    console.error(error)
                }
            }
        }
    }
}

export async function scheduleDownloadNoteJob(): Promise<void> {
    while (true) {
        try {
            const companies = await Company.find()
            logger.info(`Total de empresas encontradas: ${companies.length}`)

            for (const company of companies) {
                await downloadNote(company)
            }

            logger.info('********************************')
            logger.info('Download concluído.')
        } catch (error) {
            logger.error(`Erro no agendamento downloadNoteJob: `)
            console.error(error)
        }

        // espera 5 minutos antes da próxima iteração
        await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5))
    }
}
