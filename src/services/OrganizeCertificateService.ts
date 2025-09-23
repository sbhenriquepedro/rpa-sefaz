import apiPfxManager from "@utils/apiPfxManager"

export class OrganizeCertificateService {
    constructor() {}

    async start(): Promise<void> {
        await apiPfxManager.organizeCertificates()
    }
}

export default new OrganizeCertificateService()