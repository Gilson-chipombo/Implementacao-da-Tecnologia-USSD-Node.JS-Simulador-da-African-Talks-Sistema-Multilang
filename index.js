require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const africastalking = require("africastalking");
const translations = require("./translations");

const app = express();
const port = 3000;

const at = africastalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

app.use(bodyParser.urlencoded({ extended: false }));

const userSessions = {};

app.get("/", (req, res) => {
  res.status(200).send("Servidor KulelaPay está online 🚀");
});

app.post("/ussd", async (req, res) => {
  const { phoneNumber, text } = req.body;
  let response = "";
  const inputs = text.split("*");
  const inputLength = inputs.length;
  const currentInput = inputs[inputLength - 1];

  if (!userSessions[phoneNumber]) {
    userSessions[phoneNumber] = { lang: null };
  }

  const session = userSessions[phoneNumber];

  // === Escolha de idioma ===
  if (text === "") {
    response = `CON 🌍 Escolha o idioma:\n1️⃣ Português\n2️⃣ Umbundu\n3️⃣ English`;
  }
  // === Define idioma e mostra menu principal ===
  else if (inputLength === 1 && !session.lang) {
    if (currentInput === "1") session.lang = "pt";
    else if (currentInput === "2") session.lang = "umb";
    else if (currentInput === "3") session.lang = "en";
    else session.lang = "pt";

    const t = translations[session.lang];
    response = `CON 💳 ${t.welcome}\n\n${t.mainMenu}`;
  }
  // === Menu principal ===
  else {
    const lang = session.lang || "pt";
    const t = translations[lang];
    const step1 = inputs[1];

    switch (step1) {
      case "1": // Minha conta
        if (inputLength === 2) response = `CON ${t.accountMenu}`;
        else if (inputLength === 3) {
          switch (currentInput) {
            case "1":
              response = `END 👤 Nome: João Silva\nNIB: 0034 5567 9922`;
              break;
            case "2":
              response = `END 📜 Últimos movimentos:\n- Pagamento 5.000kz\n- Depósito 10.000kz`;
              break;
            case "3":
              response = `END 💰 Saldo atual: 45.230kz`;
              break;
            case "4":
              response = `CON 🔐 Digite o novo PIN:`;
              break;
            case "5":
              response = `END 🧾 Código de utilizador: KLP-90023`;
              break;
            case "0":
              response = `CON ${t.mainMenu}`;
              break;
            default:
              response = `END ${t.invalid}`;
          }
        } else if (inputLength === 4 && inputs[2] === "4") {
          response = `END ✅ PIN alterado com sucesso.`;
        }
        break;

      case "2": // Transferências
        if (inputLength === 2) response = `CON ${t.transferMenu}`;
        else if (inputLength === 3) {
          response =
            currentInput === "1"
              ? `END 💸 Transferência Carteira→Carteira concluída.`
              : currentInput === "2"
              ? `END 🏦 Transferência Carteira→Banco concluída.`
              : `END ${t.invalid}`;
        }
        break;

      case "3":
        response = `END 🧾 Pagamentos de contas e serviços disponíveis em breve.`;
        break;

      case "4":
        response = `END 💵 Receber dinheiro: peça ao remetente para enviar para ${phoneNumber}.`;
        break;

      case "5":
        response = `END 📱 Comprar recargas: em breve disponível.`;
        break;

      case "6":
        response = `END 🏧 Levantar dinheiro: dirija-se ao agente mais próximo.`;
        break;

      case "7":
        response = `END 📍 Agentes KulelaPay próximos: Zango, Cazenga, Viana.`;
        break;

      case "8":
        response = `END 🎓 E-University: plataforma de cursos financeiros.`;
        break;

      case "9":
        response = `END 🔧 Outros serviços em atualização.`;
        break;

      default:
        response = `END ${t.invalid}`;
    }
  }

  if (response.startsWith("END")) delete userSessions[phoneNumber];
  res.set("Content-Type", "text/plain");
  res.send(response);
});

app.listen(port, () =>
  console.log(`💵 KulelaPay USSD rodando em http://localhost:${port}`)
);

