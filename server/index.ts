import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "net";
import dotenv from "dotenv";
import { storage } from "./storage";
import { hashPassword } from "./auth";
import { httpLogging, requestId } from "./middleware";
import logger from "./logger";

// Load environment variables from .env file
dotenv.config();

// Use logger for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Create a dev user for easy login if it doesn't exist
async function ensureDevUserExists() {
  try {
    const existingUser = await storage.getUserByUsername("Dev");
    if (!existingUser) {
      log("Creating Dev user for development");
      const hashedPassword = await hashPassword("password");
      await storage.createUser({
        username: "Dev",
        password: hashedPassword,
      });
      log("Dev user created successfully");
    } else {
      // If user exists but has the wrong password, update it
      if (existingUser.password !== "password") {
        await storage.updateUser(existingUser.id, { password: "password" });
        log("Dev user password updated to 'password'");
      } else {
        log("Dev user already exists with correct password");
      }
    }
  } catch (error) {
    console.error("Error creating Dev user:", error);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request ID and logging middleware
app.use(requestId);
app.use(httpLogging);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      // Log the error
      logger.error('Error in middleware:', { 
        error: err.message,
        stack: err.stack,
        status
      });
      
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server on an available port
    const startServer = (port: number, maxRetries = 10, retryCount = 0) => {
      server.listen(port, "localhost")
        .on("error", (err: any) => {
          if (err.code === "EADDRINUSE" && retryCount < maxRetries) {
            log(`Port ${port} is in use, trying port ${port + 1}`);
            // Port is in use, try the next one
            startServer(port + 1, maxRetries, retryCount + 1);
          } else {
            console.error(`Error starting server: ${err.message}`);
            process.exit(1);
          }
        })
        .on("listening", async () => {
          log(`Server running at http://localhost:${port}`);
          
          // Create dev user once server is running
          if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            try {
              // Wait a bit to ensure database connection is fully established
              setTimeout(async () => {
                try {
                  await ensureDevUserExists();
                } catch (error) {
                  console.error("Error in delayed Dev user creation:", error);
                }
              }, 1000);
            } catch (error) {
              console.error("Error scheduling Dev user creation:", error);
            }
          }
        });
    };

    // Start with port from env or default to 3000
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    startServer(port);
  } catch (error) {
    console.error('Failed to start server:', error);
  }
})();
