# short-link

A simple and efficient URL shortener built with Node.js and Express.

## Features

- Generate short links quickly
- Redirect users to original URLs seamlessly
- Track analytics such as visits, IP, platform, browser, and country

## Technologies Used

- **Node.js** - Server-side JavaScript runtime
- **Express** - Minimal and flexible web framework for Node.js
- **Mongoose** - MongoDB ODM for schema modeling and database operations
- **GeoIP-lite** - Retrieves geographical information for analytics
- **NanoID** - Generates short, unique IDs for URLs
- **express-useragent** - Extracts user-agent details for analytics

## Installation

1. Clone the repository:
   ```sh
   git clone [text](https://github.com/businessfordevsav/short-link.git)
   cd short-link
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
   The server runs on `http://localhost:3000`.

## API Endpoints

### 1. Create Short Link

**Endpoint:** `POST /url`

**Request Body:**

```json
{
  "originalUrl": "https://example.com"
}
```

**Response:**

```json
{
  "status": "success",
  "statusCode": 200,
  "body": {
    "redirectUrl": "http://localhost:3000/BGiSZKlH"
  }
}
```

---

### 2. Redirect to Original URL

**Endpoint:** `GET /:shortId`

Redirects the user to the original URL associated with the given `shortId`.

---

### 3. Get Short Link Analytics

**Endpoint:** `GET /url/analytics?shortId=<shortId>`

**Response:**

```json
{
  "status": "success",
  "body": {
    "visitHistory": [
      {
        "ipAddress": "::1",
        "platform": "Apple Mac",
        "browser": "Chrome",
        "country": "Unknown",
        "_id": "67b0a0878534912e0011d723",
        "timestamp": "2025-02-15T14:11:19.595Z"
      }
    ],
    "totalVisits": 1
  }
}
```

## Usage

1. Send a `POST` request to `/url` with the original URL to generate a short link.
2. Access the shortened URL to be redirected to the original site.
3. Retrieve analytics using the `/url/analytics` endpoint.

## License

This project is licensed under the MIT License.
