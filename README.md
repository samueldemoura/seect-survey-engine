# seect-survey-engine

Esse repositório contém a implementação do utilitário de disparos em massa e alguns scripts adicionais, utilizados para conduzir e fazer o acompanhamento das pesquisas de usuário realizadas durante a rodada de 2022 do projeto Paraíba Humana e Inteligente.

## Overview

- [Etapas da execução](#etapas-da-execução)
  - [1. Importação dos destinatários](#1-importação-dos-destinatários)
  - [2. Scraping das respostas das pesquisas](#2-scraping-das-respostas-das-pesquisas)
  - [3. Efetuação dos disparos em si](#3-efetuação-dos-disparos-em-si)
  - [4. Acompanhamento dos disparos e taxa de erros](#4-acompanhamento-dos-disparos-e-taxa-de-erros)
- [Instalação e execução](#instalação-e-execução)

## Etapas da execução

Ao iniciar o utilitário, serão realizadas uma série de etapas. Cada uma delas, junto com suas observações relevantes, são detalhadas a seguir:

### 1. Importação dos destinatários

A primeira etapa é a importação dos dados referentes aos destinatários dos disparos. Em [src/index.ts](src/index.ts) está definido um array (`SOURCE_PEOPLE_CSVS`) que lista quais arquivos serão lidos durante a importação.

Esse array **deve** ser alterado manualmente, a não ser que seu setup contenha _exatamente os mesmos arquivos_ que o meu, o que não deve ser o caso pois os dados originais não são inclusos neste repositório por questões de privacidade.

O utiliário espera que os arquivos sejam CSVs com um conjunto predeterminado de colunas. Um exemplo de CSV seria:

```csv
md5,tipo,email,telefone
3404c01bd0ed628e1ffa1ed985c4f25f,A,emaildoalunoaqui@example.com,83900000000
e42862b60b3ecb8591da053fea8f9d80,P,emaildoprofessor@example.com,83900000000
9657d44fb39068619541798196fdc52f,F,emaildofamiliar@example.com,83900000000
```

Onde:
- `md5` é um identificador único para aquele destinatário. Ele será "condensado" para algo mais human-friendly durante a importação.
- `tipo` identifica, como pode imaginar, o tipo da pessoa. Ao realizar os disparos em si, o utilitário utiliza um _template_ diferente para cada tipo de pessoa. Deve ser `A` para aluno, `P` para professor ou `F` para responsável/familiar.
- `email` é o email do destinatário, obrigatório para o disparo de emails.
- `telefone` é o telefone do destinatário, obrigatório para o disparo via WhatsApp/SMS.
  - **OBS.:** No momento atual em que escrevo esse documento, o disparo via WhatsApp/SMS ainda não foi implementado.

### 2. Scraping das respostas das pesquisas

Existe uma opção no utilitário que evita fazer novos disparos para quem já respondeu à pesquisa. Para que consigamos fazer isso, precisamos antes descobrir quais destinatários já responderam.

Sendo assim, a segunda etapa é exatamente o scraping das respostas. Nas nossas pesquisas, utilizamos o Google Forms para coletar respostas. Essas respostas são automaticamente jogadas em uma planilha do Google Sheets, para cada tipo de destinatário. Essa etapa envolve, então, acessar cada uma dessas planilhas e puxar seus dados.

Isso é feito através das APIs oficiais oferecidas pela Google, o que significa que é preciso configurar duas coisas:

- Os identificadores das planilhas de resposta.
  - Como temos questionários diferentes para alunos, professores e responsáveis, é preciso fornecer 3 identificadores - um para cada tipo. Dentro do arquivo relevante na pasta [config/](config/), deve-se inserir os identificadores da seguinte forma:

    ```js
    {
      // ...outras chaves de config...

      "responseSheetIds": {
        "student": "1hfP0VlEd4fU7IwAeQcJ-F_fSRC4Q4YHCh2nQ77v2yJ0",
        "teacher": "1bsRGjj_YfVxQZ7GdPLc7ECerKphipmNLZoUU_O-nqN8",
        "familyMember": "1C21kQ09oXjnruXVYxSu4sglLv9OCDzSbyXfa_Fhicd4"
      }
    }
    ```

  Os identificadores podem ser descobertos a partir da URL da planilha, só visitar ela no seu navegador e ver o final da URL.

- Credenciais para acesso às planilhas.
  - A autenticação é feita através de um _refresh token_ OAuth2. Na Google Cloud Platform, é necessário criar um usuário com acesso (ao menos de visualização) às planilhas que vão ser consultadas. Siga os passos detalhados pela [documentação da Google](https://developers.google.com/identity/protocols/oauth2) pra obter um token para esse usuário, e o coloque no JSON de configuração. Por exemplo:

    ```js
    {
      // ...outras coisas...

      "googleAuth": {
        "type": "service_account",
        "project_id": "< OMITIDO >",
        "private_key_id": "< OMITIDO >",
        "private_key": "< OMITIDO >",
        "client_email": "< OMITIDO >.iam.gserviceaccount.com",
        "client_id": "< OMITIDO >",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/< OMITIDO >.iam.gserviceaccount.com"
      }
    }
    ```

**OBS.:** O scraper espera que exista uma coluna (ou seja, uma pergunta) com esse _exato_ texto:

```
Campo de Controle (não alterar)
```

Contendo o identificador anonimizado do destinatário. Caso deseje alterar o nome dessa coluna, ver o array `POSSIBLE_PERSON_IDENTIFIER_COLUMN_NAMES` em [src/modules/survey/response-scraper.ts](src/modules/survey/response-scraper.ts). O preenchimento/funcionamento desse campo de controle será detalhado mais a frente.

### 3. Efetuação dos disparos em si

Finalmente, ocorrem os disparos em si. Algumas coisas a se notar/configurar:

- O mecanismo de disparo é hardcoded no código.
  - Por questões de segurança, o valor comitado nesse repositório é um mecanismo mockado. Para disparar emails reais, ir em [src/index.ts](src/index.ts) e substituir `DeliveryMechanisms.MOCK` por `DeliveryMechanisms.EMAIL`.

- As credenciais para disparo devem ser fornecidas no JSON de configuração. Para o mecanismo de disparo de emails, por exemplo, a configuração deve ser feita da seguinte forma:

  ```js
  {
    // ...outras coisas...

    "delivery": {
      "email": {
        "host": "< SERVIDOR SMTP OMITIDO >",
        "isSecure": true,
        "port": 587,
        "auth": {
          "user": "< USUÁRIO OMITIDO >",
          "pass": "< SENHA OMITIDA >"
        }
      }
    }
  }
  ```

- Existe um mecanismo de rate-limiting/throttling, que pode ser configurado através dos seguintes parâmetros no JSON de configuração:

  ```js
  {
    // ...outras coisas...

    "deliveryThrottling": {
      "minDeliveriesPerDay": 12000,
      "maxDeliveriesPerDay": 12000,
      "warmupDurationInMinutes": 30
    }
  }
  ```

- O conteúdo dos disparos é baseado:
  - No nome do template (atualmente hardcoded como `invitation-1`)
  - No mecanismo de disparo (ex.: o mock puxa um arquivo `-mock.txt`, o email puxa um arquivo `-email.html`)
  - O tipo do destinatário.

  Por exemplo, para o template `invitation-1`, disparado via email para um aluno, o seguinte arquivo será utilizado como template: [templates/invitation-1-student-email.html](templates/invitation-1-student-email.html)

  E por fim, todas as instâncias de `{{ PERSONALIZED_SURVEY_LINK }}` serão substituídas pelo link que o destinatário deve receber. Esse link é gerado da seguinte forma: cada tipo de destinatário deve responder a um formulário diferente, logo, cada um deles terá um link base diferente.

  Além disso, cada formulário possui um "campo de controle" onde o identificador anonimizado do destinatário será inserido. Isso é feito para que consigamos ter algum controle sobre quem participou ou não da pesquisa, além de nos permitir fazer análises demográficas sem comprometer a anonimidade dos participantes.

  Para isso, é utilizada a ferramenta do Google Sheets de gerar um link com o formulário pré-preenchido. No campo de controle, jogamos o valor `PERSON_IDENTIFIER_TOKEN`, e o Sheets vai gerar um link customizado. Esse link deve ser inserido no JSON de configuração. Por exemplo:

  ```js
  {
    // ...os outros campos aqui...

    "surveyLinks": {
      "student": "https://docs.google.com/forms/d/e/1FAIpQLSeB4ngAT49bnheiTESuU-mRHsfb-cvxcvbncvbndfdghfdgfgh/viewform?usp=pp_url&entry.507496447=PERSON_IDENTIFIER_TOKEN",
      "teacher": "https://docs.google.com/forms/d/e/1FAIpQLScWv-fgdfjgfhjfdgghjfghjfghj/viewform?usp=pp_url&entry.1235466015=PERSON_IDENTIFIER_TOKEN",
      "familyMember": "https://docs.google.com/forms/d/e/1FAIpQLSfYH-sdfgsdfgsdfgdsfgdsfgfgh/viewform?usp=pp_url&entry.538972642=PERSON_IDENTIFIER_TOKEN"
    },
  }
  ```

  Então, por exemplo, para um responsável com o identificador `XYZ`, o fluxo seria o seguinte:
    - O link base é tomado como ponto de partida:

      ```
      https://docs.google.com/forms/d/e/1FAIpQLSfYH-sdfgsdfgsdfgdsfgdsfgfgh/viewform?usp=pp_url&entry.538972642=PERSON_IDENTIFIER_TOKEN
      ```

    - O identificador dele é inserido, de forma que quando ele visite esse link, o campo de controle já vai vir preenchido com seu identificador:

      ```
      https://docs.google.com/forms/d/e/1FAIpQLSfYH-sdfgsdfgsdfgdsfgdsfgfgh/viewform?usp=pp_url&entry.538972642=XYZ
      ```

    - Em seguida, o template relevante será lido do disco (por ex.: [templates/invitation-1-familyMember-email.html](templates/invitation-1-familyMember-email.html)), e lá, todas as instâncias de

      ```
      {{ PERSONALIZED_SURVEY_LINK }}
      ```

      Serão substituídas pelo seu link customizado:

      ```
      https://docs.google.com/forms/d/e/1FAIpQLSfYH-sdfgsdfgsdfgdsfgdsfgfgh/viewform?usp=pp_url&entry.538972642=XYZ
      ```

    - O disparo será feito com esse corpo customizado. O resultado final é que o usuário receberá um link que:
      - O leva para o questionário correto baseado no seu tipo;
      - Com o campo de controle já preenchido.

Isso conclui a parte dos disparos em si. Os dados sobre cada envio são salvos no banco SQlite, de forma que reiniciar o processo não deve resultar em envios duplicados, com exceção de envios que falharam por algum motivo imediatamente perceptível (ex.: falha de rede).

### 4. Acompanhamento dos disparos e taxa de erros

Como não sabemos se um disparo teve sucesso ou não de forma imediata, é necessário fazer um monitoramento e cruzamento de dados manual para sabermos qual a taxa de erros dos disparos. Para o caso do email, existem alguns scripts em [scripts/](scripts/) que acessam o email relevante via IMAP e fazem uma contagem de quantos emails existem no inbox, o que (a não ser que o email esteja sendo utilizado para outros fins) deve bater com a quantidade de erros que tivemos durante os disparos.

Também existem algumas queries prontas para consultar o banco SQlite e gerar informações sobre quantos disparos foram efetuados por dia e por tipo de pessoa, úteis para cruzar com os números de erros por dia e gerar taxas de erros diárias.

## Instalação e execução

**Antes de seguir as etapas abaixo, favor ler as explicações acima para evitar possíveis problemas.**

O utilitário de disparos em si é um projeto NodeJS, escrito em TypeScript e que utiliza o MikroORM para manter um banco SQlite. Eu pessoalmente utilizei o `pnpm` para fazer o manuseio das dependências, mas se quiser descartar o lockfile e se aventurar com o `npm` ou `yarn`, _provavelmente_ vai funcionar também. Alguns comandos úteis:

```bash
# instalar as deps
pnpm install

# configurar o banco SQlite (CUIDADO: possibilidade de deleção de dados caso o
# banco já exista)
# 1. dê uma olhada se os comandos SQL aparentam estar corretos
pnpm mikro-orm schema:update --dump
# 2. execute
pnpm mikro-orm schema:update --run

# rodar em modo dev (auto-reload quando algum arquivo fonte muda)
pnpm run start:dev

# rodar em modo prod
NODE_ENV=production pnpm run start
```

Os scripts Python utilizam o Python 3 e dependem somente de bibliotecas padrões, então não devem necessitar de nenhum setup adicional. Os scripts SQL foram escritos para o shell `fish`, mas podem ser adaptados para outros shells mais tradicionais mudando o shebang da primeira linha.
