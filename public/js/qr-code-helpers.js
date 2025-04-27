/**
 * QR Code Helper Functions
 * Contains all functions related to QR code generation and display
 */

// Toggle QR code visibility
function toggleQRCode(id) {
  const qrCodeElement = document.getElementById(`qrCode-${id}`);
  qrCodeElement.classList.toggle("visible");
}

// Preview QR code in fullscreen
function previewQRCodeFullscreen(imageUrl, shortId) {
  // Make sure image URL is properly processed to avoid CORB issues
  const processedUrl = ensureProxiedUrl(imageUrl);
  
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 1100;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  `;
  
  const img = document.createElement("img");
  img.src = processedUrl;
  img.alt = "QR Code";
  img.style.cssText = `
    max-width: 80%;
    max-height: 80%;
    border: 3px solid white;
    border-radius: 10px;
  `;
  
  modal.appendChild(img);
  document.body.appendChild(modal);
  
  // Click anywhere to close
  modal.addEventListener("click", function() {
    document.body.removeChild(modal);
  });
}

// Download QR code image
function downloadQRCode(url, shortId) {
  // Make sure download URL is properly processed to avoid CORB issues
  const processedUrl = ensureProxiedUrl(url);
  
  const link = document.createElement("a");
  link.href = processedUrl;
  link.download = `qrcode-${shortId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Ensure URL is properly proxied
function ensureProxiedUrl(url) {
  if (!url) {
    console.error('Empty URL passed to ensureProxiedUrl');
    return '';
  }
  
  console.log('Processing URL in ensureProxiedUrl:', url);
  
  // If it's already a proxied URL, return as is
  if (url.startsWith('/s3-image/')) {
    console.log('URL is already proxied, returning as is');
    return url;
  }
  
  // If already a relative URL starting with /qrcodes, convert to proxied URL
  if (url.startsWith('/qrcodes/')) {
    console.log('Converting local path to proxied URL');
    return `/s3-image${url}`;
  }
  
  // Extract the filename from any URL pattern
  if (url.includes('/')) {
    const filename = url.split('/').pop();
    if (filename && filename.endsWith('.png')) {
      console.log('Extracted filename from URL:', filename);
      return `/s3-image/qrcodes/${filename}`;
    }
  }
  
  // If it's an S3 URL (contains amazonaws.com or s3), convert to proxied URL
  if (url.includes('amazonaws.com') || url.includes('s3.') || url.includes('s3-')) {
    try {
      // Extract the key path - more robust extraction method
      let keyPath = '';
      
      if (url.includes('qrcodes/')) {
        // Extract the qrcodes part and everything after it
        const qrcodesIndex = url.indexOf('qrcodes/');
        keyPath = url.substring(qrcodesIndex);
      } else {
        // If the URL doesn't contain 'qrcodes/', assume it's the filename only
        // and add the qrcodes/ prefix
        const parts = url.split('/');
        const fileName = parts[parts.length - 1];
        keyPath = 'qrcodes/' + fileName;
      }
      
      // Ensure keyPath is not empty and doesn't have any URL parameters
      if (keyPath) {
        // Remove any query parameters if present
        keyPath = keyPath.split('?')[0];
        
        const proxiedUrl = `/s3-image/${keyPath}`;
        console.log('Converted S3 URL to proxied URL:', {
          originalUrl: url,
          keyPath: keyPath,
          proxiedUrl: proxiedUrl
        });
        
        return proxiedUrl;
      }
      // If we can't determine a valid keyPath, fall through to return the original URL
    } catch (error) {
      console.error('Error processing URL in ensureProxiedUrl:', {
        url: url,
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  // Handle direct file references that need to be proxied
  if (url.endsWith('.png') && !url.startsWith('/')) {
    // This might be a direct filename from the database without proper path
    console.log('Direct filename detected, adding proxy path:', url);
    return `/s3-image/qrcodes/${url}`;
  }
  
  // Otherwise, return the URL as is (it's already relative or doesn't match any pattern)
  console.log('URL doesn\'t need proxying, returning as is:', url);
  return url;
}

// Generate a custom QR code with options
function generateCustomQRCode(urlId, shortId) {
  // Build and display the QR code customization modal
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    z-index: 1100;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  modal.innerHTML = `
    <div class="qr-code-custom-modal" style="background: var(--card-bg); border-radius: 8px; max-width: 500px; width: 90%; padding: 20px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);">
      <h3 style="margin-top: 0; color: var(--text);">Customize QR Code</h3>
      
      <div style="margin-bottom: 15px;">
        <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 10px;">
          <input type="checkbox" id="modal-adModeEnabled" checked style="margin-right: 10px;">
          <span style="color: var(--text);">Include App Icon in QR Code</span>
        </label>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: var(--text-light);">Icon Size</label>
        <input type="range" id="modal-iconSizePercent" min="10" max="30" value="20" style="width: 100%;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-light);">
          <span>Small</span>
          <span>Medium</span>
          <span>Large</span>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input type="checkbox" id="modal-useLargeIcon" style="margin-right: 10px;">
          <span style="color: var(--text);">Use High Resolution Icon</span>
        </label>
      </div>
      
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button class="cancel-btn" style="padding: 8px 15px; border: 1px solid var(--border); background: transparent; border-radius: 4px; cursor: pointer; color: var(--text);">Cancel</button>
        <button class="generate-btn" style="padding: 8px 15px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">Generate QR Code</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  modal.querySelector(".cancel-btn").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  modal.querySelector(".generate-btn").addEventListener("click", function () {
    // Get settings from form
    const adModeEnabled = document.getElementById(
      "modal-adModeEnabled"
    ).checked;
    const iconSizePercent = document.getElementById(
      "modal-iconSizePercent"
    ).value;
    const useLargeIcon = document.getElementById("modal-useLargeIcon").checked;

    // Show loading state
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

    // CSRF token code removed
    
    // Send request to regenerate QR code
    fetch(`/url/${shortId}/qrcode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        adModeEnabled,
        iconSizePercent,
        useLargeIcon,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          showToast("QR Code generated successfully");
          // Close modal
          document.body.removeChild(modal);
          // Reload the page to show new QR code
          setTimeout(() => window.location.reload(), 1000);
        } else {
          throw new Error(
            data.message || "Failed to generate QR code"
          );
        }
      })
      .catch((error) => {
        console.error("Error generating QR code:", error);
        showToast("Error: " + error.message);
        this.disabled = false;
        this.innerHTML = "Generate QR Code";
      });
  });
}
