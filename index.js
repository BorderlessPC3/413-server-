require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();

const {
  PORT = 3000,
  MP_ACCESS_TOKEN = "",
  SERVER_API_KEY = "",
  FRONTEND_URL = "",
  MP_SUCCESS_URL = "",
  MP_PENDING_URL = "",
  MP_FAILURE_URL = "",
  MP_NOTIFICATION_URL = "",
  CORS_ORIGINS = "",
} = process.env;

const allowedOrigins = [
  ...CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  FRONTEND_URL.trim(),
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);
app.use(express.json());

const mpClient = MP_ACCESS_TOKEN
  ? new MercadoPagoConfig({
      accessToken: MP_ACCESS_TOKEN,
    })
  : null;

const requireApiKey = (req, res, next) => {
  const incomingApiKey = req.header("x-api-key");

  if (!SERVER_API_KEY || incomingApiKey !== SERVER_API_KEY) {
    return res.status(401).json({ error: "Unauthorized request" });
  }

  return next();
};

app.get("/", (_req, res) => {
  return res.status(200).send("server up (413)");
});

app.get("/health", (_req, res) => {
  return res.status(200).json({
    status: "ok",
    mercadopagoConfigured: Boolean(MP_ACCESS_TOKEN),
  });
});

app.post("/create-payment", requireApiKey, async (req, res) => {
  const { amount } = req.body;

  if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount. Use a positive number." });
  }

  if (!mpClient) {
    return res.status(500).json({
      error: "Mercado Pago is not configured. Set MP_ACCESS_TOKEN in .env.",
    });
  }

  try {
    const preference = new Preference(mpClient);

    const paymentData = {
      items: [
        {
          title: "Pagamento",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(amount),
        },
      ],
      back_urls: {
        success: MP_SUCCESS_URL || FRONTEND_URL || undefined,
        pending: MP_PENDING_URL || FRONTEND_URL || undefined,
        failure: MP_FAILURE_URL || FRONTEND_URL || undefined,
      },
      notification_url: MP_NOTIFICATION_URL || undefined,
    };

    const result = await preference.create({ body: paymentData });

    return res.status(201).json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    console.error("Error creating Mercado Pago payment:", error);
    return res.status(500).json({ error: "Failed to create payment" });
  }
});

app.post("/webhook/mercadopago", (req, res) => {
  console.log("Mercado Pago webhook received:", req.body);
  return res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Payments server running on port ${PORT}`);
});
