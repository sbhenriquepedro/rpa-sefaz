import cron from 'node-cron'
import OrganizeCertificateService from '@services/OrganizeCertificateService'

OrganizeCertificateService.start()

cron.schedule('*/30 * * * *', async () => {
    try {
        OrganizeCertificateService.start()
    } catch (err) {
        console.error('Erro ao organizar certificados:', err)
    }
})
