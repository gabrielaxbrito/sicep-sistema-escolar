import express from 'express'
import supabase from '../config/supabase.js'
import { obterIndicadores } from '../services/dashboard.js'

const router = express.Router()
router.get('/dashboard', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    res.json(await obterIndicadores(supabase))
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar os indicadores.' })
  }
})
export default router
