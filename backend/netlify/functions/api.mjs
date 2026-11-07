// Permite executar o Express no Netlify.
import express from 'express'
import serverless from 'serverless-http'
import app from '../../src/server.js'

const api = express()
api.use(['/api', '/.netlify/functions/api'], app)
api.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }))

export const handler = serverless(api)
