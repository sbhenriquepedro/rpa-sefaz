import Note, { INote, SitNote, ModelNote, StatusNote } from "@models/Note"
import { chromium, Browser, BrowserContext, Page } from "playwright"
import path from "path"
import fs from "fs"
import env from "@utils/env"
import logger from "@utils/logger"

interface IRow {
    sit: string
    file: string
    date: string
    obs: string
    linkDownload?: string
}

class NoteService {
    note: INote
    browser!: Browser
    context!: BrowserContext
    page!: Page
    continue: boolean

    constructor(note: INote) {
        this.note = note
        this.continue = true
    }

    getStructure(print: boolean = false): string {
        const origin = env.STRUCTURE || 'C:\\notes'

        const date = new Date(this.note.initialPeriod)
        const year = date.getFullYear().toString()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')

        const basePath = path.resolve(origin, this.note.modelNote, `${this.note.company.codeCompanieAccountSystem}-`, `${month}${year}`)
        const finalPath = print ? path.join(basePath, 'prints') : basePath

        if (!fs.existsSync(finalPath)) {
            fs.mkdirSync(finalPath, { recursive: true })
        }

        return finalPath
    }

    private async screenshot(pathname: string): Promise<string> {
        const dateTimeString = new Date().toLocaleString().replace(/[^a-zA-Z0-9]/g, '')
        const name = `${dateTimeString}.png`
        const pathScreenshot = path.join(pathname, name)
        await this.page.screenshot({ path: path.resolve(pathScreenshot) })
        return pathScreenshot
    }

    private async checkIfNoCpfDataFound(): Promise<void> {
        if (!this.continue) return

        try {
            const alert = this.page.getByText('×FecharNão foram encontrados')
            if (await alert.isVisible()) {
                const screenshotPath = this.getStructure(true)
                const screenshot = await this.screenshot(screenshotPath)

                await Note.findOneAndUpdate(
                    {
                        company: this.note.company,
                        modelNote: this.note.modelNote,
                        sitNote: this.note.sitNote,
                        initialPeriod: this.note.initialPeriod,
                        finalPeriod: this.note.finalPeriod,
                    },
                    {
                        screenshot,
                        statusNote: 'Warning',
                        warn: 'Não foram encontrados dados para o CNPJ do certificado.',
                    },
                    { upsert: true, new: true }
                )

                logger.warn('Não foram encontrados dados para o CNPJ do certificado.')

                await this.page.close()
                await this.browser.close()
            }
        } catch (error) {
            logger.error(`Erro ao verificar dados do CNPJ: ${error}`)

            await this.page.close()
            await this.browser.close()
        }
    }

    private async selectCnpjField() {
        if (!this.continue) {
            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    statusNote: 'Warning',
                    warn: 'Processo interrompido: Campo CNPJ não selecionado.',
                },
                { upsert: true, new: true }
            )
            return
        }

        await this.page.locator('#cmpCnpj').selectOption(this.note.company.federalRegistration)
    }

    private async insertPeriodField(field: string, period: Date) {
        if (!this.continue) {
            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    statusNote: 'Warning',
                    warn: `Processo interrompido: Campo de período (${field}) não preenchido.`,
                },
                { upsert: true, new: true }
            )
            return
        }

        const input = await this.page.waitForSelector(field)

        await this.page.evaluate((input: any) => {
            input.value = ''
        }, input)

        await this.page.click(field)
        await this.page.locator(field).press('Control+A')
        await this.page.locator(field).press('Backspace')

        const data = new Date(period).toLocaleDateString()
        await this.page.type(field, data)
    }

    private async insertSitField() {
        if (!this.continue) {
            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    statusNote: 'Warning',
                    warn: 'Processo interrompido: Situação não selecionada.',
                },
                { upsert: true, new: true }
            )
            return
        }

        if (this.note.sitNote == 'Autorizadas') {
            await this.page.locator('#cmpSituacao').selectOption('2')
        } else {
            await this.page.locator('#cmpSituacao').selectOption('3')
        }
    }

    private async insertModelField() {
        if (!this.continue) {
            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    statusNote: 'Warning',
                    warn: 'Processo interrompido: Modelo não selecionado.',
                },
                { upsert: true, new: true }
            )
            return
        }

        if (this.note.modelNote === 'NF-e') {
            await this.page.locator('#cmpModelo').selectOption('55')
        } else if (this.note.modelNote === 'CT-e') {
            await this.page.locator('#cmpModelo').selectOption('57')
        } else {
            await this.page.locator('#cmpModelo').selectOption('65')
        }
    }

    private async insertForm() {
        await this.selectCnpjField()
        await this.insertPeriodField('input[name="cmpDataInicial"]', this.note.initialPeriod)
        await this.insertPeriodField('input[name="cmpDataFinal"]', this.note.finalPeriod)
        await this.insertSitField()
        await this.insertModelField()
    }

    private async thowCaptcha(): Promise<void> {
        if (!this.continue) return

        try {
            const siteKey = await this.page.getAttribute('[data-callback="pegarTokenSuccess"]', "data-sitekey")
            if (!siteKey) {
                logger.error("Sitekey não encontrada na página!")
                await Note.findOneAndUpdate(
                    {
                        company: this.note.company,
                        modelNote: this.note.modelNote,
                        sitNote: this.note.sitNote,
                        initialPeriod: this.note.initialPeriod,
                        finalPeriod: this.note.finalPeriod,
                    },
                    {
                        statusNote: 'Error',
                        warn: 'Sitekey do captcha não encontrada.',
                    },
                    { upsert: true, new: true }
                )
                return
            }

            logger.info(`Sitekey encontrada: ${siteKey}`)

            const captchaToken = "success"
            if (!captchaToken) {
                logger.error("Não foi possível resolver o captcha!")
                await Note.findOneAndUpdate(
                    {
                        company: this.note.company,
                        modelNote: this.note.modelNote,
                        sitNote: this.note.sitNote,
                        initialPeriod: this.note.initialPeriod,
                        finalPeriod: this.note.finalPeriod,
                    },
                    {
                        statusNote: 'Error',
                        warn: 'Falha ao resolver o captcha.',
                    },
                    { upsert: true, new: true }
                )
                return
            }

            await this.page.evaluate((token: any) => {
                const input = document.getElementById("cf-turnstile-response") as HTMLInputElement
                if (input) input.value = token
            }, captchaToken)

            logger.info("Token injetado no formulário.")
        } catch (error) {
            logger.error(`Erro ao processar o captcha: ${error}`)
            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    statusNote: 'Error',
                    warn: `Erro ao processar o captcha: ${error}`,
                },
                { upsert: true, new: true }
            )
        }
    }

    private getTimoutCTe(): number {
        const transportadoras = [
            "4930201", "4930202", "4930203", "4930204", 
            "5211702", "5229101", "5229102"
        ]
          
        const cnaes = this.note.company.cnaes?.split(',') || []
        
        const isTransportadora = cnaes.some(cnae => transportadoras.includes(cnae))

        let timeout = 1000 * 60 * 10
        
        if (isTransportadora && this.note.modelNote == 'CT-e') {
            timeout = 1000 * 60 * 10
        }

        return timeout
    }

    private async search() {
        if (!this.continue) return

        try {
            const timeout = this.getTimoutCTe()

            const [newTab] = await Promise.all([
                this.page.waitForEvent('domcontentloaded', { timeout }),
                this.page.getByRole('button', { name: 'Pesquisar' }).click(),
            ])

            this.page = newTab
        } catch (error) {
            logger.error(`Erro ao realizar a pesquisa: ${error}`)

            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    statusNote: 'Error',
                    warn: 'Não foi possível carregar o resultado da pesquisa.',
                },
                { upsert: true, new: true }
            )

            await this.page.close()
            await this.browser.close()
        }
    }

    private async checkIfNoResult(): Promise<void> {
        if (!this.continue) return

        try {
            const noResultAlert = this.page.getByText('×FecharSem Resultados!')
            if (await noResultAlert.isVisible()) {
                this.continue = false
                const screenshotPath = this.getStructure(true)
                const screenshot = await this.screenshot(screenshotPath)

                await Note.findOneAndUpdate(
                    {
                        company: this.note.company,
                        modelNote: this.note.modelNote,
                        sitNote: this.note.sitNote,
                        initialPeriod: this.note.initialPeriod,
                        finalPeriod: this.note.finalPeriod,
                    },
                    {
                        screenshot,
                        statusNote: 'Warning',
                        warn: 'Sem resultados encontrados!',
                    },
                    { upsert: true, new: true }
                )

                logger.warn('Sem resultados encontrados para a pesquisa.')

                await this.page.close()
                await this.browser.close()
            }
        } catch (error) {
            logger.error(`Erro ao verificar resultados: ${error}`)

            const screenshotPath = this.getStructure(true)
            const screenshot = await this.screenshot(screenshotPath)

            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    screenshot,
                    statusNote: 'Error',
                    warn: `Erro ao verificar resultados: ${error}`,
                },
                { upsert: true, new: true }
            )

            await this.page.close()
            await this.browser.close()
        }
    }

    async extractFirstRowTable(): Promise<IRow> {
        // Aguarda a tabela estar visível
        await this.page.waitForSelector('table.tablesorter tbody tr')

        // Seleciona a primeira linha da tabela
        const firstRow = this.page.locator('table.tablesorter tbody tr').first()

        // Extrai os dados das colunas
        const sit = await firstRow.locator('.col-situacao').innerText()
        const file = await firstRow.locator('.col-arquivo').innerText()
        const date = await firstRow.locator('.col-data').innerText()
        const obs = await firstRow.locator('.col-observacoes').innerText()
        // const linkDownload = await firstRow.locator('.col-acoes a.btn-info').getAttribute('href')

        // Retorna o objeto com os dados
        return { sit, file, date, obs }
    }

    private async addToDownloadQueue(): Promise<void> {
        if (!this.continue) return

        try {
            const timeout = this.getTimoutCTe()
            await this.page.reload({ timeout })

            await this.page.getByRole('button', { name: 'Baixar todos os arquivos' }).click()

            const downloadButton = this.page.getByRole('button', { name: 'Baixar', exact: true });

            await downloadButton.evaluate((button: HTMLButtonElement) => button.removeAttribute('disabled'))

            const [download] = await Promise.all([
                this.page.waitForEvent('domcontentloaded', { timeout }),
                downloadButton.click(),
            ])

            const url = download.url()
            const { file } = await this.extractFirstRowTable()

            if (url && file) {
                logger.info(`URL do download: ${url}`)
                logger.info(`Nome do arquivo: ${file}`)

                await Note.findOneAndUpdate(
                    {
                        company: this.note.company,
                        modelNote: this.note.modelNote,
                        sitNote: this.note.sitNote,
                        initialPeriod: this.note.initialPeriod,
                        finalPeriod: this.note.finalPeriod,
                    },
                    {
                        fileName: file,
                        linkDownload: url,
                        queued: true,
                    },
                    { upsert: true, new: true }
                )
            } else {
                this.continue = false
                logger.warn('Não foi possível obter a URL ou o nome do arquivo para download.')

                const screenshotPath = this.getStructure(true)
                const screenshot = await this.screenshot(screenshotPath)
                
                await Note.findOneAndUpdate(
                    {
                        company: this.note.company,
                        modelNote: this.note.modelNote,
                        sitNote: this.note.sitNote,
                        initialPeriod: this.note.initialPeriod,
                        finalPeriod: this.note.finalPeriod,
                    },
                    {
                        screenshot,
                        statusNote: 'Error',
                        warn: `Não foi possível obter a URL ou o nome do arquivo para download.`,
                    },
                    { upsert: true, new: true }
                )
            }
        } catch (error) {
            logger.error(`Erro ao adicionar à fila de download: ${error}`)

            const screenshotPath = this.getStructure(true)
            const screenshot = await this.screenshot(screenshotPath)

            await Note.findOneAndUpdate(
                {
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                },
                {
                    screenshot,
                    statusNote: 'Error',
                    warn: `Erro ao adicionar à fila de download: ${error}`,
                },
                { upsert: true, new: true }
            )

            await this.page.close()
            await this.browser.close()
        }
    }

    async getDownloadLink(): Promise<void> {
        await Note.findOneAndUpdate(
            {
                
                modelNote: this.note.modelNote,
                sitNote: this.note.sitNote,
                initialPeriod: this.note.initialPeriod,
                finalPeriod: this.note.finalPeriod,
            },
            {
                statusNote: 'Processing',
            },
            { upsert: true, new: true }
        )

        this.browser = await chromium.launch({ headless: false, slowMo: 500 })
        this.context = await this.browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true })
        this.page = await this.context.newPage()
        await this.page.goto("https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfe/consulta-publica", {
            waitUntil: "domcontentloaded" 
        })

        await this.checkIfNoCpfDataFound()
        await this.insertForm()
        await this.thowCaptcha()
        await this.search()
        await this.checkIfNoResult()
        await this.addToDownloadQueue()

        await this.page.close()
        await this.browser.close()
    }

    private async conferenceScreenshot(): Promise<string> {
        await this.page.keyboard.press('End')
        const screenshotPath = this.getStructure(true)
        const screenshot = await this.screenshot(screenshotPath)
        return screenshot
    }

    async downloadFile() {
        this.browser = await chromium.launch({ headless: false, slowMo: 500, })
        this.context = await this.browser.newContext({ ignoreHTTPSErrors: true, acceptDownloads: true })
        this.page = await this.context.newPage()
        
        try {
            if (!this.note.linkDownload) {
                logger.info('Link de download não disponível.')
                return
            }

            await this.page.goto(this.note.linkDownload, { waitUntil: 'domcontentloaded' })

            // Aguarda a tabela estar visível
            await this.page.waitForSelector('table.tablesorter tbody tr')

            let line

            if (this.note.fileName) {
                // Localiza a linha que contém o nome do arquivo
                line = this.page.locator(`table.tablesorter tbody tr:has(td.col-arquivo:has-text("${this.note.fileName}"))`)
                if (await line.count() === 0) {
                    logger.info(`Arquivo "${this.note.fileName}" não encontrado na tabela.`)
                    return null
                }
            } else {
                // Se não passar o nome, pega a primeira linha
                line = this.page.locator('table.tablesorter tbody tr').first()
            }

            // Pega o link de download
            const linkDownload = await line.locator('.col-acoes a.btn-info').getAttribute('href')

            if (!linkDownload) {
                logger.info(`Arquivo ${this.note.fileName || '(primeira linha)'} encontrado, mas sem link de download.`)
                return null
            }

            // Configura o listener para o evento de download
            const [download] = await Promise.all([
                this.page.waitForEvent('download'),
                line.locator('.col-acoes a.btn-info').click() // clica no botão de download
            ])

            const pathRelativeNote = this.getStructure()
            const filename = download.suggestedFilename() || ''
            const pathRelativeAbsolute = path.resolve(path.join(pathRelativeNote, filename))

            await download.saveAs(pathRelativeAbsolute)

            if (fs.existsSync(pathRelativeAbsolute)) {
                const conferenceScreenshotPath = await this.conferenceScreenshot()

                logger.info(conferenceScreenshotPath)
                logger.info('Download realizado com sucesso.')

                await Note.findOneAndUpdate({
                    company: this.note.company,
                    modelNote: this.note.modelNote,
                    sitNote: this.note.sitNote,
                    initialPeriod: this.note.initialPeriod,
                    finalPeriod: this.note.finalPeriod,
                }, {
                    screenshot: conferenceScreenshotPath,
                    filePath: pathRelativeAbsolute,
                    statusNote: 'Success',
                }, { upsert: true, new: true })
            }

            logger.info(pathRelativeAbsolute)
        } finally {
            await this.page.close()
            await this.browser.close()
        }
    }
}

export default NoteService
