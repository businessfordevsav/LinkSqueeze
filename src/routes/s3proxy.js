import express from 'express';
import AWS from 'aws-sdk';
import { getSignedUrlPromise } from '../services/s3Service.js';
import axios from 'axios';

const router = express.Router();

// Route to proxy S3 images - directly stream content instead of redirecting
router.get('/s3-image/:key(*)', async (req, res) => {
  console.log('S3 proxy request received:', {
    key: req.params.key,
    referer: req.headers.referer,
    userAgent: req.headers['user-agent']
  });
  
  try {
    const key = req.params.key;
    
    // Get a signed URL that allows temporary access to the private S3 object
    const signedUrl = await getSignedUrlPromise(key);
    console.log('Generated signed URL for key:', key);
    
    // Set comprehensive CORS headers to prevent CORB issues
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Timing-Allow-Origin', '*');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    try {
      // Fetch and stream the image content directly
      console.log('Fetching from signed URL:', signedUrl);
      const response = await axios({
        method: 'GET',
        url: signedUrl,
        responseType: 'stream',
        timeout: 10000 // 10 second timeout
      });
      
      // Log response headers
      console.log('S3 response headers:', response.headers);
      
      // Set proper content type and other headers from the S3 response
      const contentType = response.headers['content-type'] || 'image/png';
      res.setHeader('Content-Type', contentType);
      
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      // Stream the image content directly to the client
      response.data.pipe(res);
      
      // Log when stream ends
      response.data.on('end', () => {
        console.log('Successfully streamed S3 image:', key);
      });
      
      // Handle stream errors
      response.data.on('error', (err) => {
        console.error('Stream error for key:', key, err);
        // Stream already started, can't send error response
      });
    } catch (axiosError) {
      console.error('Error fetching from S3:', {
        key: key,
        message: axiosError.message,
        code: axiosError.code,
        response: axiosError.response ? {
          status: axiosError.response.status,
          headers: axiosError.response.headers
        } : 'No response',
        stack: axiosError.stack
      });
      
      // Set content type to prevent CORB issues even on error
      res.setHeader('Content-Type', 'text/plain');
      res.status(404).send('Image could not be retrieved');
    }
  } catch (error) {
    console.error('Error in S3 proxy:', {
      key: req.params.key,
      message: error.message,
      stack: error.stack
    });
    
    // Set content type to prevent CORB issues even on error
    res.setHeader('Content-Type', 'text/plain');
    res.status(404).send('Image not found');
  }
});

export default router;