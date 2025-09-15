import logger from '@utils/logger'
import { connectDB } from '@utils/database'
import ApiPfxManager from '@utils/apiPfxManager'
import { validateEnv } from '@utils/validateEnv'
import { scheduleProcessCompanyJob } from '@jobs/processCompanyJob'

const REQUIRED_ENV_VARS = ['API_PFX_MANAGER', 'STRUCTURE']

async function main(): Promise<void> {
    await connectDB()
    await ApiPfxManager.checkApiHealth()
    validateEnv(REQUIRED_ENV_VARS)
    scheduleProcessCompanyJob()
}

main().catch((err) => {
    logger.error(`Erro: ${err.message}`)
})
