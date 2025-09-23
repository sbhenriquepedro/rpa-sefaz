import OrganizeCertificateService from '@services/OrganizeCertificateService'
import logger from '@utils/logger'

export async function organizeCertificatesJob(): Promise<void> {
    while (true) {
        try {
            logger.info('Iniciando organização de certificados...')
            OrganizeCertificateService.start()
            logger.info('Organização de certificados concluída.')
        } catch (error) {
            logger.error(`Erro ao organizar certificados: `)
            console.error(error)
        }
    }
}
