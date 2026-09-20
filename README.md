# painel-opcoes

Página cifrada. O conteúdo só abre com a senha, que não está aqui nem em lugar nenhum público.

- `index.html` e `painel.js`: a casca e o comportamento. Nenhum dado.
- `dados.js`: o painel inteiro, comprimido e cifrado com **AES-256-GCM**, chave derivada da senha por
  **PBKDF2-SHA256 com 600 mil iterações**. O navegador decifra com a Web Crypto API, que é nativa: a
  página não carrega biblioteca de fora e não faz nenhuma conexão (`connect-src 'none'`).

Sem a senha, este repositório é um bloco de bytes sem leitura.

Gerado por [opc](https://github.com/fleandro1234-netizen/opc-venda-put-b3) (repositório privado), que
antes de gravar procura o conteúdo em claro nestes arquivos e recusa publicar se achar.

Este é um sistema de análise de uso pessoal. Não envia ordem para corretora e não é recomendação de
investimento.
