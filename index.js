require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const africastalking = require("africastalking");
const axios = require("axios");
const translations = require("./translations");

const app = express();
const port = 3000;

const at = africastalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

app.use(bodyParser.urlencoded({ extended: false }));

const campaigns = [
  { title: "Vacinação gratuita", location: "Zango" },
  { title: "Palestra comunitária", location: "Cazenga" },
];
const tips = [
  "Use mosquiteiro tratado com inseticida.",
  "Evite água parada perto de casa.",
  "Cubra-se ao dormir, principalmente à noite.",
];

const userSessions = {};

app.post("/ussd", async (req, res) => {
  const { phoneNumber, text, sessionId, serviceCode } = req.body;
  let response = "";
  const inputs = text.split("*");
  const inputLength = inputs.length;
  const currentInput = inputs[inputLength - 1];

  if (!userSessions[phoneNumber]) {
    userSessions[phoneNumber] = { level: 0, lang: null, tipIndex: 0 };
  }

  const session = userSessions[phoneNumber];

  // === Idioma ===
  if (text === "") {
    response = `CON 🌍 Escolha o idioma:\n\n1️⃣ Português\n2️⃣ Umbundu\n3️⃣ Inglês`;
  }

  // === Salva idioma e mostra menu ===
  else if (inputLength === 1 && !session.lang) {
    if (currentInput === "1") session.lang = "pt";
    else if (currentInput === "2") session.lang = "umb";
    else if (currentInput === "3") session.lang = "en";
    else session.lang = "pt";
    const t = translations[session.lang];
    response = `CON 🦟 ${t.welcome}\n\n1️⃣ ${t.menu.report}\n2️⃣ ${t.menu.zones}\n3️⃣ ${t.menu.tips}\n4️⃣ ${t.menu.campaigns}\n5️⃣ ${t.menu.exit}`;
  } else {
    const lang = session.lang || "pt";
    const t = translations[lang];
    const step1 = inputs[1];

    // === 1. Reportar caso ===
    if (step1 === "1") {
  if (inputLength === 2) {
    response = `CON 📍 Passo 1/5\n${t.askProvincia}`;
  } else if (inputLength === 3) {
    session.reportProvincia = currentInput;
    response = `CON 📍 Passo 2/5\n${t.askMunicipio}`;
  } else if (inputLength === 4) {
    session.reportMunicipio = currentInput;
    response = `CON 🏘 Passo 3/5\n${t.askBairro}`;
  } else if (inputLength === 5) {
    session.reportBairro = currentInput;
    response = `CON ⚠ Passo 4/5\n${t.confirmRisk}`;
  } else if (inputLength === 6) {
    if (currentInput === "1") {
      response = `CON 📍 Passo 5/5\n${t.nivelRisco}`;
    } else {
      response = `END ❌ ${t.cancel}`;
    }
  } else if (inputLength === 7) {
    session.nivelRisco = currentInput;
    const reportText = `1*${session.reportProvincia}*${session.reportMunicipio}*${session.reportBairro}*1*${session.nivelRisco}`;
    const reportData = {
      sessionId: sessionId || "no-session",
      phone: phoneNumber,
      serviceCode: serviceCode || "*123#",
      text: reportText,
    };

    
    try {
        await axios.post("https://mapazzz-backend.onrender.com/api/ussd", reportData, {
            headers: { "Content-Type": "application/json" },
        });
        console.log("📤 Enviando reporte:", reportData);
      response = `END ✅ ${t.thankYou}`;
    } catch (err) {
      console.error("❌ Erro ao enviar para a API:", err.message);
      response = `END ⚠ ${t.apiError}`;
    }
  }
}

    // === 2. Zonas críticas ===
    else if (step1 === "2") 
      response = `END 🚨 ${t.criticalZones}\nZango 3\nCazenga\nKikolo`;
    else if (step1 === "3") { // === 3. Dicas ===
      const index = parseInt(inputs[2] || "0");
      const dica = tips[index];

      if (currentInput === "0") response = `END ${t.exit}`;
      else if (dica) response = `CON 🧴 ${t.dicaLabel(index, dica)}`;
      else response = `END ${t.exit}`;
    }

    // === 4. Campanhas ===
    else if (step1 === "4") {
      if (inputLength === 2) response = `CON 🗺${t.askBairro}`;
      else if (inputLength === 3) {
        if (currentInput === "0") response = `CON ${t.mainMenu}`;
        else {
          const zona = currentInput.toLowerCase();
          const result = campaigns.filter(c =>
            c.location.toLowerCase().includes(zona)
          );

          if (result.length > 0) {
            const lista = result
              .map(c => `- ${c.title} - ${c.location}`)
              .join("\n");
            response = `END 📢 Campanhas:\n${lista}`;
          } else
              response = `END ⚠ ${t.noCampaigns}`;
        }
      }
    }
    else if (step1 === "5")// 5. Sair 
      response = `END 👋 ${t.exit}`;
    else if (step1 === "9") //Voltar ao menu
      response = `CON ${t.mainMenu}`;
    else  // Inválido
      response = `END ❌ ${t.invalid}`;
  }

  if (response.startsWith("END"))
    delete userSessions[phoneNumber];
  res.set("Content-Type", "text/plain");
  res.send(response);
});

app.listen(port, () => {
  console.log(`🟢 MAPAZZZ USSD rodando em http://localhost:${port}`);
});
