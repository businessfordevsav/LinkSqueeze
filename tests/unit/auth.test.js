// tests/unit/auth.test.js
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestDB, teardownTestDB, clearDatabase } from '../setup.js';
import User from '../../src/models/user.js';
import bcrypt from 'bcrypt';

describe('User Authentication Tests', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  test('should create a new user', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!'
    };

    const newUser = new User(userData);
    const savedUser = await newUser.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.name).toBe(userData.name);
    expect(savedUser.email).toBe(userData.email);
    
    // Password should be hashed
    expect(savedUser.password).not.toBe(userData.password);
    
    // Verify the password hash
    const isPasswordValid = await bcrypt.compare(userData.password, savedUser.password);
    expect(isPasswordValid).toBe(true);
  });

  test('should not allow duplicate email addresses', async () => {
    const userData = {
      name: 'Test User',
      email: 'duplicate@example.com',
      password: 'Password123!'
    };

    const newUser = new User(userData);
    await newUser.save();

    // Try to create another user with the same email
    const duplicateUser = new User(userData);
    
    let error = null;
    try {
      await duplicateUser.save();
    } catch (err) {
      error = err;
    }
    
    expect(error).toBeDefined();
    expect(error.code).toBe(11000); // MongoDB duplicate key error code
  });

  test('should enforce password complexity', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'simple'  // Not meeting password requirements
    };

    const newUser = new User(userData);
    
    let error = null;
    try {
      await newUser.validate();
    } catch (err) {
      error = err;
    }
    
    expect(error).toBeDefined();
  });
});