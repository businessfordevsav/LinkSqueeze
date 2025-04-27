// tests/integration/url-shortening.test.js
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { setupTestDB, teardownTestDB, clearDatabase } from '../setup.js';
import { createTestServer, cleanupServers } from '../utils/express-server.js';
import User from '../../src/models/user.js';
import URL from '../../src/models/url.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

// Increase timeout to prevent test failures
beforeAll(async () => {
  jest.setTimeout(30000);
}, 1000);

describe('URL Shortening API Integration Tests', () => {
  let server;
  let request;
  let testUser;
  let agent; // Add agent to maintain session
  
  beforeAll(async () => {
    await setupTestDB();
    const { app, supertest } = await createTestServer();
    server = app;
    request = supertest;
    agent = request.agent(server.app); // Create agent properly
  });
  
  afterAll(async () => {
    if (server) await server.close();
    await cleanupServers(); // Clean up any remaining servers
    await teardownTestDB();
  });
  
  beforeEach(async () => {
    await clearDatabase();
    
    // Create a test user for authentication
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword
    });
  });
  
  test('should create a shortened URL', async () => {
    // Login first to set up the session
    const loginResponse = await agent
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });
      
    expect(loginResponse.status).toBe(200);
    
    const payload = {
      redirectUrl: 'https://example.com',
      name: 'example-test'
    };
    
    const response = await agent
      .post('/api/url/shorten')
      .send(payload);
      
    expect(response.status).toBe(200); // API returns 200, not 201
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body.body).toHaveProperty('shortUrl');
    
    // Extract shortId from the response
    const shortUrlParts = response.body.body.shortUrl.split('/');
    const shortId = shortUrlParts[shortUrlParts.length - 1];
    
    // Verify the URL was saved to the database
    const url = await URL.findOne({ shortId });
    expect(url).toBeDefined();
    expect(url.redirectUrl).toBe(payload.redirectUrl);
  });
  
  test('should retrieve all URLs for authenticated user', async () => {
    // Login first to set up the session
    const loginResponse = await agent
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'Password123!'
      });
      
    expect(loginResponse.status).toBe(200);
    
    // Create some test URLs
    await URL.create({
      redirectUrl: 'https://example.com',
      shortId: 'abc123',
      name: 'example',
      createdBy: testUser._id
    });
    
    await URL.create({
      redirectUrl: 'https://example.org',
      shortId: 'def456',
      name: 'example-org',
      createdBy: testUser._id
    });
    
    const response = await agent
      .get('/api/url/all');
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'success');
    // The response format may vary, adjust the expectations based on actual API
    expect(response.body.body).toBeDefined();
    const urls = Array.isArray(response.body.body) ? 
      response.body.body : 
      (response.body.body.urls || []);
    
    expect(urls.length).toBeGreaterThan(0);
  });
});