# SalesFlow CRM — GitHub Pages

CRM comercial estático, inspirado na estética de um pipeline moderno, pronto para publicar no GitHub Pages.

## O que já funciona

- Importação por arrastar e soltar de arquivos `.xls`, `.xlsx` e `.csv`
- Reconhecimento automático de colunas, sem tela de mapeamento
- Dashboard comercial com faturamento, clientes, follow-ups e reposição
- Funil Kanban com drag & drop
- Cadastro manual de negócios
- Carteira de clientes consolidada
- Calendário comercial
- Follow-ups e tarefas
- Ponto de reposição estimado pelo intervalo médio entre compras
- Alertas no navegador
- Exportação da carteira para CSV
- Persistência local no navegador (localStorage)

## Publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `salesflow-crm`.
2. Envie `index.html`, `styles.css` e `app.js` para a raiz do repositório.
3. Vá em **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione `main` e pasta `/ (root)`.
6. Aguarde o GitHub gerar o link.

## Como usar

Abra o CRM e clique em **Importar planilha**. Arraste sua planilha. O sistema tentará localizar campos como Cliente, Data, Valor, Pedido, Cidade, UF, Vendedor, Produto e Status. Não existe mais tela de mapeamento. Ao soltar o arquivo, o CRM tenta reconhecer e importar os campos automaticamente.

## Importante sobre os dados

Esta versão foi pensada para GitHub Pages e, portanto, funciona sem servidor. Os dados importados ficam salvos **somente no navegador/dispositivo atual**. Para uma versão multiusuário, com login, banco de dados, acesso por vários computadores e alertas reais por e-mail/WhatsApp, a próxima evolução recomendada é conectar Supabase/Firebase e um serviço de automação.

## Regra de ponto de reposição

Para clientes com compras em mais de uma data, o CRM calcula a média de dias entre compras e projeta a próxima reposição. Para quem possui apenas uma compra registrada, usa 30 dias como referência inicial. O campo "Dias de antecedência" permite trazer clientes para a lista antes do vencimento estimado.


## Integração das 3 planilhas comerciais

Esta versão foi ajustada para os três relatórios usados no projeto:

1. **TESTE APLICATIVO** — carteira/base de clientes: código, razão social, CNPJ, representante, cidade/UF, última compra, dias sem comprar, valor da última compra, responsável e telefones.
2. **VENDAS MES** — controle das ordens/vendas: status, etapa, ordem, cliente, digitação, valores, representante e UF.
3. **APURAÇÃO** — metas por representante: representante, razão social, meta, valor atingido e supervisor.

As três podem ser selecionadas juntas. O CRM consolida as informações sem exibir mapeamento manual.


## Revisão de estabilidade

Esta versão corrige o problema em que o CRM podia parar de responder quando uma biblioteca externa (gráfico/calendário) não carregava. A navegação e o salvamento agora continuam funcionando em modo seguro. Ao salvar uma atividade, o sistema abre Follow-ups; ao salvar um negócio, abre o Funil.
