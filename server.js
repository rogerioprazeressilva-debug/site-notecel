const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve arquivos estáticos da pasta raiz
app.use(express.static(__dirname));

// Rota principal para o index.html
app.get('(.*)', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Notecell rodando em: http://localhost:${PORT}`);
});