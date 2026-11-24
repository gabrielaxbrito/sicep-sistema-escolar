
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Rotas
import cursosRoutes from './routes/cursos.routes.js'
import turmasRoutes from './routes/turmas.js'
import alunosRoutes from './routes/alunos.routes.js'
import ajudaRoutes from './routes/ajuda.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import authRoutes from './routes/auth.routes.js'
import usuariosRoutes from './routes/usuarios.routes.js'
import professoresRoutes from './routes/professores.js'

import { exigirLogin } from './auth.js'

// =========================
// CONFIGURAÇÕES
// =========================

dotenv.config({
  path: fileURLToPath(new URL('.env', import.meta.url))
})

dotenv.config()

const app = express()

app.use(cors({
  origin: true,
  credentials: true
}))

app.use(express.json())

// =========================
// LOGIN LIBERADO
// =========================

app.use(authRoutes)

// =========================
// DEMAIS ROTAS EXIGEM LOGIN
// =========================

app.use(exigirLogin)

// =========================
// ROTAS DO SISTEMA
// =========================

app.use(alunosRoutes)
app.use(cursosRoutes)
app.use(turmasRoutes)
app.use(dashboardRoutes)

// Rota de professores:
// GET /professores
// GET /professores/:id
app.use('/professores', professoresRoutes)

app.use(usuariosRoutes)
app.use(ajudaRoutes)

// =========================
// SERVIDOR
// =========================

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Servidor rodando: http://localhost:${PORT}`)
})