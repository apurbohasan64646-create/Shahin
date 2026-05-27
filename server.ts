import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/firebase"; // Standard relative resolve or TS module import
import { doc, setDoc } from "firebase/firestore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Midlewares for parsing different payload formats from various Android SMS forwarders
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Route for Automated SMS Real-time Gateway Hook
  app.all("/api/sms-webhook", async (req, res) => {
    console.log("===[ RECEIVING AUTOMATED SMS WEBHOOK CLIENT ]===");
    console.log("Headers:", req.headers);
    console.log("Query parameters:", req.query);
    console.log("Payload/Body:", req.body);

    // Dynamic field extraction based on popular Android SMS Gateways (SmsForwarder, Webhook.io, etc)
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

    // Regex scanners for bKash vs Nagad TrxIDs
    const bKashRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TrxID\s+([A-Z0-9]{8,12})/gi;
    const nagadRx = /(?:Received|Cash\s+In)\s+Tk\.?\s*([0-9,.]+)(?:\s+from\s+([0-9\+]+))?.*?TxID:\s*([A-Z0-9]{8,12})/gi;

    let match;
    const foundTrxs: any[] = [];

    // Parse bKash
    bKashRx.lastIndex = 0;
    while ((match = bKashRx.exec(messageText)) !== null) {
      foundTrxs.push({
        trxId: match[3].toUpperCase(),
        amount: Number(match[1].replace(/,/g, "")),
        sender: match[2] || senderNumber,
        gateway: "bkash",
        status: "unused",
        timestamp: new Date().toISOString()
      });
    }

    // Parse Nagad
    nagadRx.lastIndex = 0;
    while ((match = nagadRx.exec(messageText)) !== null) {
      foundTrxs.push({
        trxId: match[3].toUpperCase(),
        amount: Number(match[1].replace(/,/g, "")),
        sender: match[2] || senderNumber,
        gateway: "nagad",
        status: "unused",
        timestamp: new Date().toISOString()
      });
    }

    // Fallback if regex is too strict but a 10-char alphanumeric transaction ID resides inside the text
    if (foundTrxs.length === 0) {
      const trxIdPattern = /\b([0-9A-Z]{10})\b/g;
      let shortMatch;
      while ((shortMatch = trxIdPattern.exec(messageText)) !== null) {
        const keyVal = shortMatch[1].toUpperCase();
        
        // Ensure not common words
        if (!["CASH", "SEND", "TK", "BKASH", "NAGAD", "TRXID"].includes(keyVal)) {
          foundTrxs.push({
            trxId: keyVal,
            amount: 25, // default fee placeholder or direct validation
            sender: senderNumber || "Automated App",
            gateway: "bkash", // default
            status: "unused",
            timestamp: new Date().toISOString()
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
        // Direct write to Firebase Firestore database in real-time
        await setDoc(doc(db, "received_payments", trxRecord.trxId), trxRecord, { merge: true });
        console.log(`Successfully synced TrxID ${trxRecord.trxId} with Firestore [GATEWAY: ${trxRecord.gateway}]`);
        successfulCount++;
      }

      return res.status(200).json({
        status: "success",
        synced: successfulCount,
        records: foundTrxs
      });
    } catch (firebaseErr: any) {
      console.error("Firebase write error from Autopilot Webhook:", firebaseErr);
      return res.status(500).json({
        status: "error",
        error: firebaseErr.message || String(firebaseErr)
      });
    }
  });

  // Health probe route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", gateway: "operational" });
  });

  // Vite middleware for dev mode or static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AUTOPILOT SERVER] Running on host 0.0.0.0 ports ${PORT}`);
  });
}

startServer();
