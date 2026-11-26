// Funcao do Netlify que executa o backend Express inteiro.
// O site chama /api/...; o netlify.toml redireciona para esta funcao.
import serverless from 'serverless-http'
import express from 'express'
import app from '../../backend/src/app.js'

const wrapper = express()

// Remove o prefixo (/api ou /.netlify/functions/api) para as rotas do Express
// continuarem iguais as do desenvolvimento local (/auth/login, /alunos...).
wrapper.use((req, _res, next) => {
  req.url = req.url.replace(/^\/(?:\.netlify\/functions\/api|api)(?=\/|\?|$)/, '') || '/'
  next()
})
// O serverless-http entrega o body ja lido (Buffer) e o express.json() do Express 5
// nao reprocessa isso. Aqui convertemos para objeto antes de chegar nas rotas.
wrapper.use((req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    const texto = req.body.toString('utf8')
    try {
      req.body = texto ? JSON.parse(texto) : {}
    } catch {
      req.body = {}
    }
  }
  next()
})

wrapper.use(app)

export const handler = serverless(wrapper)
