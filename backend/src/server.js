// Servidor local (npm run dev / npm start). Na hospedagem do Netlify quem usa o
// app e a funcao em netlify/functions/api.mjs.
import app from './app.js'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Servidor rodando: http://localhost:${PORT}`)
})
