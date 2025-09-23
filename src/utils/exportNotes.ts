import ExcelJS from "exceljs"
import Note from "@models/Note"
import Company from "@models/Company"
import logger from "./logger"
import fs from "fs"
import path from "path"

export class exportNotes {
    async run() {
        try {
            // Buscar todas as notas
            const notes = await Note.find()
    
            // Buscar todas as empresas referenciadas de uma vez só
            const companyIds = [...new Set(notes.map((note: any) => note.company?.toString()).filter(Boolean))]
            const companies = await Company.find({ _id: { $in: companyIds } })
            const companyMap = new Map(companies.map((c: any) => [c._id.toString(), c]))
    
            // Montar workbook
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet("Notas")
    
            worksheet.columns = [
                { header: "Empresa", key: "companyName", width: 30 },
                { header: "CNPJ", key: "companyCnpj", width: 20 },
                { header: "Modelo", key: "modelNote", width: 10 },
                { header: "Situação", key: "sitNote", width: 15 },
                { header: "Status", key: "statusNote", width: 15 },
                { header: "Período Inicial", key: "initialPeriod", width: 15 },
                { header: "Período Final", key: "finalPeriod", width: 15 },
                { header: "Arquivo", key: "fileName", width: 40 },
                { header: "Qtd Notas", key: "quantityNotes", width: 10 },
            ]
    
            notes.forEach((note: any) => {
                const company = note.company ? companyMap.get(note.company.toString()) : null
    
                worksheet.addRow({
                    companyName: company?.name || "",
                    companyCnpj: company?.federalRegistration || company?.cnpj || "",
                    modelNote: note.modelNote || "",
                    sitNote: note.sitNote || "",
                    statusNote: note.statusNote === "Success" ? "Sucesso" : (note.statusNote || ""),
                    initialPeriod: note.initialPeriod
                        ? new Date(note.initialPeriod).toISOString().split("T")[0]
                        : "",
                    finalPeriod: note.finalPeriod
                        ? new Date(note.finalPeriod).toISOString().split("T")[0]
                        : "",
                    quantityNotes: note.quantityNotes ?? "",
                    fileName: note.fileName || "",
                })
            })
    
            // Criar pasta "data" se não existir
            const dataDir = path.join(process.cwd(), "data")
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir)
            }
    
            // Gerar nome do arquivo com data e hora local
            const now = new Date()
            const formattedDate = now.toLocaleDateString("pt-BR").replace(/\//g, "-")
            const formattedTime = now.toLocaleTimeString("pt-BR").replace(/:/g, "-")
            const fileName = `notas_exportadas_${formattedDate}_${formattedTime}.xlsx`
    
            const filePath = path.join(dataDir, fileName)
    
            await workbook.xlsx.writeFile(filePath)
            logger.info(`Exportação concluída: ${filePath}`)
            process.exit(0)
        } catch (err) {
            logger.error("Erro:", err)
            process.exit(1)
        }
    }
}
