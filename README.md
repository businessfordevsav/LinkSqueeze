# short-link

A simple and efficient URL shortener built with Node.js and Express.

## Features

- Generate short links quickly
- Redirect users to original URLs seamlessly
- Track analytics such as visits, IP, platform, browser, and country
- Web interface for generating short links and viewing analytics

## Technologies Used

- **Node.js** - Server-side JavaScript runtime
- **Express** - Minimal and flexible web framework for Node.js
- **Mongoose** - MongoDB ODM for schema modeling and database operations
- **GeoIP-lite** - Retrieves geographical information for analytics
- **NanoID** - Generates short, unique IDs for URLs
- **express-useragent** - Extracts user-agent details for analytics
- **EJS** - Embedded JavaScript templating for rendering web pages

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/businessfordevsav/short-link.git
   cd short-link
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm start
   ```
   The server runs on `http://localhost:3000`.

## API Endpoints & Functional Specifications

### 1. Create Short Link

**Endpoint:** `POST /url`

**Request Body:**

```json
{
  "redirectUrl": "https://example.com"
}
```

**Response:**

```json
{
  "status": "success",
  "statusCode": 200,
  "body": {
    "shortUrl": "http://localhost:3000/BGiSZKlH"
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

---

### 4. Web Interface for URL Shortening & Analytics

**Endpoint:** `GET /linksqueeze`

- Renders a web interface using EJS for users to shorten URLs and view analytics.
- Displays a form for submitting URLs.
- Shows a list of recently shortened links with expiration dates.

## Screenshot

Below is an example screenshot of the web interface:

![Web Interface](/resource/screenshot-web-page-1.png)
![Web Interface](/resource/screenshot-web-page-2.png)

## Usage

1. Send a `POST` request to `/url` with the original URL to generate a short link.
2. Access the shortened URL to be redirected to the original site.
3. Retrieve analytics using the `/url/analytics` endpoint.
4. Visit `/linksqueeze` to use the web interface for URL generation and tracking analytics.

## License

This project is licensed under the MIT License.
