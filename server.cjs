var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/firebase.ts
var import_app = require("firebase/app");
var import_auth = require("firebase/auth");
var import_firestore = require("firebase/firestore");

// src/firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "remixed-project-id",
  appId: "remixed-app-id",
  apiKey: "remixed-api-key",
  authDomain: "remixed-auth-domain",
  firestoreDatabaseId: "remixed-firestore-database-id",
  storageBucket: "remixed-storage-bucket",
  messagingSenderId: "remixed-messaging-sender-id",
  measurementId: "remixed-measurement-id"
};

// src/firebase.ts
var app = (0, import_app.initializeApp)(firebase_applet_config_default);
var db = (0, import_firestore.getFirestore)(app, firebase_applet_config_default.firestoreDatabaseId);
var auth = (0, import_auth.getAuth)(app);
var isFirebaseConfigured = !!(firebase_applet_config_default && firebase_applet_config_default.apiKey && firebase_applet_config_default.apiKey !== "" && !firebase_applet_config_default.apiKey.includes("remixed") && firebase_applet_config_default.projectId && firebase_applet_config_default.projectId !== "" && !firebase_applet_config_default.projectId.includes("remixed"));

// server.ts
var import_firestore2 = require("firebase/firestore");
async function startServer() {
  const app2 = (0, import_express.default)();
  const PORT = 3e3;
  app2.use(import_express.default.json());
  app2.use(import_express.default.urlencoded({ extended: true }));
  app2.all("/api/sms-webhook", async (req, res) => {
    console.log("===[ RECEIVING AUTOMATED SMS WEBHOOK CLIENT ]===");
    console.log("Headers:", req.headers);
    console.log("Query parameters:", req.query);
    console.log("Payload/Body:", req.body);
    const rawMessage = req.body.message || req.body.text || req.body.body || req.body.msg || req.query.message || req.query.text || "";
    const rawSender = req.body.from || req.body.sender || req.body.phone || req.query.from || "System Automated";
    const messageText = String(rawMessage).trim();
    const senderNumber = String(rawSender).trim();
    if (!messageText) {
      console.warn("SMS Webhook triggers, but no text body detected.");
      return res.status(200).json({
        status: "success",
        message: "Webhook reachable. Provide 'message' and 'from' parameters to sync transaction."
      });
    }
    console.log(`Extracting transaction from SMS: "${messageText}" | Sender: ${senderNumber}`);
    const bKashRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TrxID\s+([A-Z0-9]{8,12})/gi;
    const nagadRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TxID:\s*([A-Z0-9]{8,12})/gi;
    let match;
    const foundTrxs = [];
    bKashRx.lastIndex = 0;
    while ((match = bKashRx.exec(messageText)) !== null) {
      foundTrxs.push({
        trxId: match[3].toUpperCase(),
        amount: Number(match[1].replace(/,/g, "")),
        sender: match[2] || senderNumber,
        gateway: "bkash",
        status: "unused",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    nagadRx.lastIndex = 0;
    while ((match = nagadRx.exec(messageText)) !== null) {
      foundTrxs.push({
        trxId: match[3].toUpperCase(),
        amount: Number(match[1].replace(/,/g, "")),
        sender: match[2] || senderNumber,
        gateway: "nagad",
        status: "unused",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (foundTrxs.length === 0) {
      const trxIdPattern = /\b([0-9A-Z]{10})\b/g;
      let shortMatch;
      while ((shortMatch = trxIdPattern.exec(messageText)) !== null) {
        const keyVal = shortMatch[1].toUpperCase();
        if (!["CASH", "SEND", "TK", "BKASH", "NAGAD", "TRXID"].includes(keyVal)) {
          foundTrxs.push({
            trxId: keyVal,
            amount: 25,
            // default fee placeholder or direct validation
            sender: senderNumber || "Automated App",
            gateway: "bkash",
            // default
            status: "unused",
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    }
    if (foundTrxs.length === 0) {
      console.log("No valid TrxID signatures found in the text.");
      return res.status(200).json({
        status: "ignored",
        message: "No transaction patterns matched. SMS ignored."
      });
    }
    try {
      let successfulCount = 0;
      for (const trxRecord of foundTrxs) {
        await (0, import_firestore2.setDoc)((0, import_firestore2.doc)(db, "received_payments", trxRecord.trxId), trxRecord, { merge: true });
        console.log(`Successfully synced TrxID ${trxRecord.trxId} with Firestore [GATEWAY: ${trxRecord.gateway}]`);
        successfulCount++;
      }
      return res.status(200).json({
        status: "success",
        synced: successfulCount,
        records: foundTrxs
      });
    } catch (firebaseErr) {
      console.error("Firebase write error from Autopilot Webhook:", firebaseErr);
      return res.status(500).json({
        status: "error",
        error: firebaseErr.message || String(firebaseErr)
      });
    }
  });
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok", gateway: "operational" });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`[AUTOPILOT SERVER] Running on host 0.0.0.0 ports ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
