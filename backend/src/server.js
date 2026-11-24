// Organiza as rotas do sistema escolar.
import express from 'express'
import cors from 'cors'
import supabase from './config/supabase.js'

import cursosRoutes from './routes/cursos.routes.js'
import turmasRoutes from './routes/turmas.js'
import alunosRoutes from './routes/alunos.routes.js'
import ajudaRoutes from './routes/ajuda.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'

const app = express()

app.use(cors())
app.use(express.json())

// =========================
// ROTAS
// =========================

app.use(cursosRoutes)
app.use(dashboardRoutes)
app.use(turmasRoutes)
// Assistente de IA (a chave da Groq fica só aqui no servidor: GROQ_API_KEY no .env)
app.use(ajudaRoutes)
app.use(alunosRoutes)

// =========================
// BUSCAR PROFESSOR POR ID
// =========================

app.get('/professores', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const professores = []
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await supabase.from('professores')
        .select('*').order('id').range(inicio, inicio + 999)
      if (error) return res.status(500).json({ error: 'Não foi possível carregar os professores.' })
      professores.push(...data)
      if (data.length < 1000) break
    }
    return res.json(professores)
  } catch {
    return res.status(500).json({ error: 'Não foi possível carregar os professores.' })
  }
})

app.get("/professores/:id", async (req, res) => {

  const id = req.params.id

  const { data, error } = await supabase
    .from("professores")
    .select("*")
    .eq("id", id)
    .single()

  if(error){

    return res.status(404).json({
      error: "Professor não encontrado"
    })

  }

  res.json(data)

})

export default app
