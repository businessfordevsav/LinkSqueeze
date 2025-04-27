// tests/e2e/url-shortening.test.js
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { setupTestDB, teardownTestDB, clearDatabase } from '../setup.js';
import { createTestServer, cleanupServers } from '../utils/express-server.js';
import URL from '../../src/models/url.js';
import User from '../../src/models/user.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest'; // Import supertest directly

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Increase timeout to prevent test failures
beforeAll(async () => {
  jest.setTimeout(30000);
}, 1000);

describe('URL Shortening E2E Tests', () => {
  let server;
  let request;
  let testUser;
  let agent;
  
  beforeAll(async () => {
    await setupTestDB();
    const { app, supertest: supertestInstance } = await createTestServer();
    server = app;
    request = supertestInstance;
    // Create agent directly using the app instance
    agent = request.agent(server.app);
  });
  
  afterAll(async () => {
    if (server) await server.close();
    await cleanupServers(); // Clean up any remaining servers
    await teardownTestDB();
  });
  
  beforeEach(async () => {
    await clearDatabase();
    
    // Create a test user
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword
    });
  });
  
  test('should create a shortened URL and redirect to original URL', async () => {
    // 1. Login first to get authenticated session with the agent
    const loginResponse = await agent
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });
    
    expect(loginResponse.status).toBe(200);
    
    // 2. Create a shortened URL
    const payload = {
      redirectUrl: 'https://example.com',
      name: 'example-test'
    };
    
    const createResponse = await agent
      .post('/api/url/shorten')
      .send(payload);
    
    expect(createResponse.status).toBe(200); // Controller returns 200, not 201
    expect(createResponse.body).toHaveProperty('status', 'success');
    expect(createResponse.body.body).toHaveProperty('shortUrl');
    
    // Extract shortId from shortUrl (e.g., http://host/url/abcd1234 -> abcd1234)
    const shortUrlParts = createResponse.body.body.shortUrl.split('/');
    const shortId = shortUrlParts[shortUrlParts.length - 1];
    
    // 3. Visit the shortened URL and check redirection
    const redirectResponse = await agent
      .get(`/url/${shortId}`)
      .expect(302); // HTTP status 302 Found (redirect)
      
    expect(redirectResponse.headers.location).toBe(payload.redirectUrl);
    
    // 4. Verify the click is recorded
    const updatedUrl = await URL.findOne({ shortId });
    expect(updatedUrl.clicks).toBe(1);
  });
  
  test('should 404 for non-existent short URLs', async () => {
    const response = await request
      .get('/nonexistent-url')
      .expect(404);
      
    // Match the actual 404 response format
    expect(response.text).toBe('Not found');
  });
});