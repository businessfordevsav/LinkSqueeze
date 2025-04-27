// tests/utils/express-server.js
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import urlRouter from '../../src/routes/url.js';
import authRouter from '../../src/routes/auth.js';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import { promisify } from 'util';

// Load environment variables
dotenv.config();

// Track active server instances to avoid port conflicts
let activeServerInstances = [];
let nextAvailablePort = 3100; // Start from a port range less likely to conflict

export class ExpressServer {
  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.linkActivityEmitter = new EventEmitter();
    this.port = null;
    
    this.setup();
  }
  
  setup() {
    // Setup middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
    
    // Add mock user-agent middleware for testing
    this.app.use((req, res, next) => {
      // Add mock user-agent data
      req.useragent = {
        isWindows: false,
        isMac: true,
        isLinux: false, 
        isAndroid: false,
        isiOS: false,
        browser: 'Test Browser',
        platform: 'Test Platform',
        isMobile: false
      };
      next();
    });
    
    // Set up session management
    this.app.use(
      session({
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: mongoose.connection.client.s.url,
          touchAfter: 24 * 60 * 60, // 1 day period in seconds
        }),
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
          httpOnly: true,
        },
      })
    );
    
    // Set up user data for views
    this.app.use((req, res, next) => {
      res.locals.user = req.session.user || null;
      res.locals.isAuthenticated = !!req.session.user;
      next();
    });
    
    // Make linkActivityEmitter accessible to controllers
    this.app.set('linkActivityEmitter', this.linkActivityEmitter);
    
    // Set up routes
    this.app.use('/api/url', urlRouter);
    this.app.use('/', authRouter);
    
    // Handle 404s 
    this.app.use((req, res, next) => {
      res.status(404).send('Not found');
    });
    
    // Handle errors
    this.app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).send('Something broke!');
    });
  }
  
  async start() {
    return new Promise((resolve) => {
      // Get a unique port for this server instance
      this.port = nextAvailablePort++;
      
      this.httpServer.listen(this.port, () => {
        console.log(`Test server started on port ${this.port}`);
        activeServerInstances.push(this);
        resolve();
      });
    });
  }
  
  async close() {
    if (!this.httpServer) return Promise.resolve();
    
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log(`Test server stopped on port ${this.port}`);
        // Remove this server from the active instances
        const index = activeServerInstances.indexOf(this);
        if (index > -1) {
          activeServerInstances.splice(index, 1);
        }
        resolve();
      });
    });
  }
}

// A helper function to make sure all servers are stopped between tests
export async function cleanupServers() {
  console.log(`Cleaning up ${activeServerInstances.length} active server instances`);
  
  for (const server of [...activeServerInstances]) {
    await server.close();
  }
  
  activeServerInstances = [];
}

export async function createTestServer() {
  await cleanupServers(); // Ensure no servers are running before starting a new one
  
  const server = new ExpressServer();
  await server.start();
  
  // Import and create a new supertest instance
  const supertest = (await import('supertest')).default;
  const request = supertest(server.app);
  
  return {
    app: server,
    supertest: request
  };
}

export default ExpressServer;