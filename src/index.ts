import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import logger from '@utils/logger'
import { connectDB } from '@utils/database'
import ApiPfxManager from '@utils/apiPfxManager'
import { validateEnv } from '@utils/validateEnv'
import { scheduleQueueNoteJob } from '@jobs/queueNoteJob'
import { scheduleDownloadNoteJob } from '@jobs/downloadNoteJob'

const REQUIRED_ENV_VARS = ['API_PFX_MANAGER', 'STRUCTURE']

async function main() {
    try {
        await connectDB()
        await ApiPfxManager.checkApiHealth()
        validateEnv(REQUIRED_ENV_VARS)
    } catch (error) {
        logger.error(`Erro na inicialização da aplicação`)
        console.error(error)
        process.exit(1)
    }
}

yargs(hideBin(process.argv))
    .command('queueNoteJob', 'Executa o job de inserir download da nota na fila', {}, async () => {
        await main()
        scheduleQueueNoteJob()
    })
    .command('downloadNoteJob', 'Executa o job de download de nota', {}, async () => {
        await main()
        scheduleDownloadNoteJob()
    })
    .demandCommand(1, 'Você precisa especificar um job para executar.')
    .strict()
    .help()
    .parse()
