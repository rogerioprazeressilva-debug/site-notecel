const response = await fetch('/api/gerar-pix', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('notecel_token')}`
            },
            body: JSON.stringify({
                valor: total.toFixed(2), 
                descricao: descricao
            })
        });