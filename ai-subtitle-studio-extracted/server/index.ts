import "dotenv/config";
import cors from "cors";
import express from "express";

import { handleDemo } from "./routes/demo";
import { handleUpload } from "./routes/upload";

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/upload", handleUpload);

  return app;
}
