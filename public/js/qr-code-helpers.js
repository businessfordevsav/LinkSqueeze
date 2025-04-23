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
  img.src = imageUrl;
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
  const link = document.createElement("a");
  link.href = url;
  link.download = `qrcode-${shortId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate a custom QR code with options
function generateCustomQRCode(urlId, shortId) {
  // Show a modal with QR code customization options
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(5px);
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    background: var(--card-bg);
    border-radius: 1rem;
    max-width: 450px;
    width: 90%;
    padding: 1.5rem;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
    color: var(--text);
  `;

  content.innerHTML = `
    <h3 style="margin-bottom: 1rem;">Generate QR Code</h3>
    
    <div class="form-group" style="margin-bottom: 1rem;">
      <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.75rem;">
        <input type="checkbox" id="modal-adModeEnabled" style="width: auto; cursor: pointer;">
        Enable QR code ad mode with app icon
      </label>
      
      <div class="expandable-section" id="modal-adModeOptions" style="margin-left: 1.5rem; display: none;">
        <div class="form-group">
          <label style="display: block; margin-bottom: 0.25rem; font-size: 0.9rem; color: var(--text-light)">
            Icon Size (% of QR code)
          </label>
          <input 
            type="range" 
            id="modal-iconSizePercent" 
            min="10" 
            max="30" 
            value="20" 
            style="width: 100%"
            oninput="document.getElementById('modal-iconSizeValue').textContent = this.value + '%'"
          />
          <small id="modal-iconSizeValue" style="display: block; text-align: center; margin-top: 0.25rem; color: var(--text-light)">20%</small>
        </div>
        <div class="form-group" style="margin-top: 0.5rem">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="modal-useLargeIcon" style="width: auto; cursor: pointer;">
            Use larger icon
          </label>
        </div>
      </div>
    </div>
    
    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem;">
      <button id="modal-cancelBtn" style="background-color: var(--secondary);">Cancel</button>
      <button id="modal-generateBtn" style="background-color: var(--primary);">Generate QR Code</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Toggle ad mode options
  document
    .getElementById("modal-adModeEnabled")
    .addEventListener("change", function () {
      document.getElementById("modal-adModeOptions").style.display =
        this.checked ? "block" : "none";
    });

  // Cancel button
  document
    .getElementById("modal-cancelBtn")
    .addEventListener("click", function () {
      document.body.removeChild(modal);
    });

  // Generate button
  document
    .getElementById("modal-generateBtn")
    .addEventListener("click", function () {
      const adModeEnabled = document.getElementById(
        "modal-adModeEnabled"
      ).checked;
      const iconSizePercent = document.getElementById(
        "modal-iconSizePercent"
      ).value;
      const useLargeIcon =
        document.getElementById("modal-useLargeIcon").checked;

      // Show loading state
      this.disabled = true;
      this.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Generating...';

      // Send request to regenerate QR code
      fetch(`/url/${shortId}/qrcode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
