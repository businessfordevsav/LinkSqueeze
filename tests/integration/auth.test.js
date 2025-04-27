// tests/integration/auth.test.js
import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { setupTestDB, teardownTestDB, clearDatabase } from '../setup.js';
import { createTestServer, cleanupServers } from '../utils/express-server.js';
import User from '../../src/models/user.js';
import bcrypt from 'bcrypt';

// Increase timeout to prevent test failures
beforeAll(async () => {
  jest.setTimeout(30000);
}, 1000);

describe('Authentication API Integration Tests', () => {
  let server;
  let request;
  
  beforeAll(async () => {
    await setupTestDB();
    const { app, supertest } = await createTestServer();
    server = app;
    request = supertest;
  });
  
  afterAll(async () => {
    if (server) await server.close();
    await cleanupServers(); // Clean up any remaining servers
    await teardownTestDB();
  });
  
  beforeEach(async () => {
    await clearDatabase();
  });
  
  test('should register a new user', async () => {
    const userData = {
      name: 'Test User',
      email: 'newuser@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    };
    
    const response = await request
      .post('/register')
      .send(userData)
      .expect(201);
      
    expect(response.body).toHaveProperty('status', 'success');
    
    // Verify user was created in the database
    const user = await User.findOne({ email: userData.email });
    expect(user).toBeDefined();
    expect(user.name).toBe(userData.name);
    
    // Password should be hashed
    const isPasswordValid = await bcrypt.compare(userData.password, user.password);
    expect(isPasswordValid).toBe(true);
  });
  
  test('should login a user with valid credentials', async () => {
    // Create a test user
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await User.create({
      name: 'Test User',
      email: 'testlogin@example.com',
      password: hashedPassword
    });
    
    const loginData = {
      email: 'testlogin@example.com',
      password: password
    };
    
    const response = await request
      .post('/login')
      .send(loginData)
      .expect(200);
      
    expect(response.body).toHaveProperty('status', 'success');
  });
  
  test('should not login with incorrect password', async () => {
    // Create a test user
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await User.create({
      name: 'Test User',
      email: 'testlogin@example.com',
      password: hashedPassword
    });
    
    const loginData = {
      email: 'testlogin@example.com',
      password: 'WrongPassword123!'
    };
    
    const response = await request
      .post('/login')
      .send(loginData)
      .expect(401);
      
    expect(response.body).toHaveProperty('status', 'error');
  });
});