// tests/setup.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Increase test timeout globally
jest.setTimeout(30000);

// Set environment to test mode for controllers to respond with JSON
process.env.NODE_ENV = 'test';

// Create an in-memory MongoDB server for testing
let mongoServer;

// Setup function to connect to in-memory database before tests
export const setupTestDB = async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    await mongoose.connect(uri);
    console.log('Connected to in-memory MongoDB');
  } catch (error) {
    console.error('Error connecting to in-memory MongoDB:', error);
  }
};

// Teardown function to close connection after tests
export const teardownTestDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from in-memory MongoDB');
    
    if (mongoServer) {
      await mongoServer.stop();
      console.log('Stopped in-memory MongoDB server');
    }
  } catch (error) {
    console.error('Error tearing down test DB:', error);
  }
};

// Function to clear all collections after each test
export const clearDatabase = async () => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (error) {
    console.error('Error clearing database:', error);
  }
};