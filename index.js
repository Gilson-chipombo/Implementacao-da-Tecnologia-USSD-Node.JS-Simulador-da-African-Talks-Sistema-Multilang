require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const africastalking = require("africastalking");
// const axios = require("axios"); // descomentá se quiser integrar a uma API real
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
  const { phoneNumber, text, sessionId, serviceCode } = req.body;
  let response = "";
  const inputs = text.split("*");
  const inputLength = inputs.length;
  const currentInput = inputs[inputLength - 1];

  if (!userSessions[phoneNumber]) userSessions[phoneNumber] = { lang: null, transfer: {} };
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
      case "1": // Minha conta (mantive como antes)
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
              response = `CON 🔐 ${t.askNewPin}`;
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
          response = `END ✅ ${t.pinChanged}`;
        }
        break;

      case "2": // Transferir - novo fluxo realista
        // Se apenas entrou no menu Transferir
        if (inputLength === 2) {
          response = `CON ${t.transferMenu}`;
        } 
        // Usuário escolhe tipo de transferência (Carteira->Carteira ou Carteira->Banco)
        else if (inputLength === 3) {
          if (currentInput === "1" || currentInput === "2") {
            // guarda o tipo
            session.transfer.type = currentInput === "1" ? "wallet-wallet" : "wallet-bank";
            // pede IBAN / conta / carteira
            response = `CON ${t.askBeneficiary}\n0️⃣ ${t.backShort}`;
          } else if (currentInput === "0") {
            response = `CON ${t.mainMenu}`;
          } else {
            response = `END ${t.invalid}`;
          }
        } 
        // Recebe o IBAN / conta / carteira do beneficiário
        else if (inputLength === 4) {
          if (currentInput === "0") {
            response = `CON ${t.transferMenu}`;
          } else {
            session.transfer.beneficiary = currentInput.trim();
            response = `CON ${t.askAmount}\n0️⃣ ${t.backShort}`;
          }
        } 
        // Recebe o valor
        else if (inputLength === 5) {
          if (currentInput === "0") {
            response = `CON ${t.askBeneficiary}`;
          } else {
            // valida simples: remover vírgulas e verificar número
            const amountRaw = currentInput.replace(",", ".").trim();
            const amount = parseFloat(amountRaw);
            if (isNaN(amount) || amount <= 0) {
              response = `CON ${t.invalidAmount}\n${t.askAmount}`;
            } else {
              session.transfer.amount = amount.toFixed(2);
              // mostra resumo e pede confirmação
              response = `CON ${t.confirmTransfer}\n\n${t.transferSummary(session.transfer.beneficiary, session.transfer.amount)}\n\n1️⃣ ${t.confirmYes}  2️⃣ ${t.confirmNo}`;
            }
          }
        }
        // Recebe confirmação e processa (simulação)
        else if (inputLength === 6) {
          if (currentInput === "1") {
            // Simula a execução: log e resposta final
            const payload = {
              sessionId: sessionId || "no-session",
              phone: phoneNumber,
              serviceCode: serviceCode || "*123#",
              action: "transfer",
              type: session.transfer.type,
              beneficiary: session.transfer.beneficiary,
              amount: session.transfer.amount,
              timestamp: new Date().toISOString(),
            };

            console.log("📤 Simulated transfer payload:", payload);

            // Aqui você poderia chamar a API real com axios.post(...)
            response = `END ✅ ${t.transferSuccess}\n${t.transferSummary(session.transfer.beneficiary, session.transfer.amount)}`;
          } else {
            response = `END ❌ ${t.cancel}`;
          }
        } else {
          response = `END ${t.invalid}`;
        }
        break;

      case "3":
        response = `END 🧾 ${t.payComingSoon}`;
        break;

      case "4":
        response = `END 💵 ${t.receiveInfo(phoneNumber)}`;
        break;

      case "5":
        response = `END 📱 ${t.rechargeComingSoon}`;
        break;

      case "6":
        response = `END 🏧 ${t.withdrawInfo}`;
        break;

      case "7":
        response = `END 📍 ${t.agentsList}`;
        break;

      case "8":
        response = `END 🎓 ${t.universityInfo}`;
        break;

      case "9":
        response = `END 🔧 ${t.othersInfo}`;
        break;

      default:
        response = `END ${t.invalid}`;
    }
  }

  if (response.startsWith("END")) delete userSessions[phoneNumber];
  res.set("Content-Type", "text/plain");
  res.send(response);
});

app.listen(port, () => console.log(`💵 KulelaPay USSD rodando em http://localhost:${port}`));

