# Summer Fonseca — Sistema Piloto de Gestão Inteligente de FLV (Hortifruti)

Protótipo prático desenvolvido em **Vue.js 3 + Vite + Tailwind CSS + Pinia + Supabase** para eliminar o uso de papel e caneta no setor de Hortifruti da **Unidade Fonseca** (*Supermercado Summer — Rua Desembargador Lima Castro, 30, Fonseca, Niterói/RJ*).

## Funcionalidades Principais (5 Fluxos Práticos)

1. **👁️ Ronda da Banca Sem Papel (`Operador` e `Gerente`):**
   - Marcação de 1 toque por produto: `🟢 Cheio`, `🟡 Subir da Câmara` (gera fila imediata de puxada da câmara fria) e `🔴 Pedir Novo` (envia automaticamente para a lista de Novos Pedidos).
   - Cadastro instantâneo de produtos novos na hora (`+ Produto Novo`).
2. **📋 Fazer Novos Pedidos:**
   - Consolida automaticamente os itens marcados com `🔴 Pedir` na ronda.
   - Permite definir quantidades em `Caixas`, `Sacos`, `Engradados`, `Dúzias` ou `Kg`.
   - Aprovação pelo **Gerente** e botão **`Copiar p/ WhatsApp`** já formatado para envio ao comprador na CEASA Colubandê / fornecedor.
3. **⚖️ Assistente de Pesagem Livre (Sem Taras Pré-Configuradas):**
   - Permite somar várias pesagens ("viagens na balança") do mesmo lote.
   - Desconto de tara flexível na hora:
     - Informar o peso de **1 caixa/cesto vazio medido na hora** $\times$ quantidade de embalagens;
     - Informar **tara total direta**;
     - Ou **sem tara** (já pesado líquido).
4. **📥 Receber Mercadoria & 🗑️ Pesar Descartes:**
   - Recebimento vinculado ao pedido aprovado ou entrada avulsa, somando o **Peso Líquido Real** no estoque.
   - Registro de Descarte/Quebra em 3 toques (`Podre/Fungo`, `Amassado`, `Murcho/Passado`, `Padaria/Cozinha Interna`) com desconto do peso do cesto vazio na hora.
5. **📊 Gestão de Estoque & Painel do Gerente (Unidade Fonseca):**
   - Alternância instantânea no topo entre **`Visão Operador`** e **`Visão Gerente`**.
   - Indicadores em tempo real de Total Recebido, Total Descartado (kg, % e R$), radiografia de quebras por motivo e histórico auditável de todas as pesagens.

## Como Executar

```powershell
npm install
npm run dev
```

## Conexão com Supabase

1. Crie um projeto no Supabase e execute o script [`supabase/schema.sql`](./supabase/schema.sql) no **SQL Editor** (ou clique no botão **"Conectar Supabase" -> "Copiar SQL das 4 Tabelas"** direto na tela do sistema).
2. Informe a `Project URL` e a `Anon / Publishable Key` no botão **"Conectar Supabase"** no cabeçalho da aplicação (ou no arquivo `.env`).
