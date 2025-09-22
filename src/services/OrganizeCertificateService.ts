import apiPfxManager from "@utils/apiPfxManager"

export class OrganizeCertificateService {
    constructor() {}

    async start(): Promise<void> {
        apiPfxManager.organizeCertificates()
    }
}

export default new OrganizeCertificateService()