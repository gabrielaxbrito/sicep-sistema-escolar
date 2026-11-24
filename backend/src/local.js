// Inicia o backend no computador local.
import app from './server.js'

const port = Number(process.env.PORT) || 3000
app.listen(port, () => console.log(`SICEP API: http://localhost:${port}`))
