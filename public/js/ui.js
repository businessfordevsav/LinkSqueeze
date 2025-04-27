/**
 * LinkSqueeze UI JavaScript
 * Handles all UI interactions including modals, tooltips, copy functionality,
 * form validation, and dark mode toggle
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initialize UI components
  initDarkMode();
  initModals();
  initCopyButtons();
  initTooltips();
  initFormValidation();
  initQRCodeToggle();
  initNotifications();
  initToggleSwitches();
  initOverlaySettings();
});

/**
 * Dark Mode Functionality
 */
function initDarkMode() {
  const darkModeToggle = document.getElementById("darkModeToggle");
  const htmlElement = document.documentElement;
  // Check for saved theme preference or respect OS preference
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    htmlElement.setAttribute("data-theme", "dark");
    if (darkModeToggle) darkModeToggle.checked = true;
  }
  // Toggle dark/light mode
  if (darkModeToggle) {
    darkModeToggle.addEventListener("change", () => {
      if (darkModeToggle.checked) {
        htmlElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      } else {
        htmlElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
      }
    });
  }
}

/**
 * Toggle Switch Functionality
 */
function initToggleSwitches() {
  document.querySelectorAll(".toggle-switch").forEach((toggleSwitch) => {
    const checkbox = toggleSwitch.querySelector('input[type="checkbox"]');
    const slider = toggleSwitch.querySelector(".toggle-slider");

    if (checkbox && slider) {
      // Set initial state based on the checkbox
      updateToggleState(checkbox, toggleSwitch, slider);

      // Add change event
      checkbox.addEventListener("change", function () {
        updateToggleState(this, toggleSwitch, slider);

        // Trigger custom event for external handling
        const event = new CustomEvent("toggleChanged", {
          detail: {
            id: checkbox.id,
            checked: checkbox.checked,
          },
        });
        document.dispatchEvent(event);
      });
    }
  });
}

function updateToggleState(checkbox, toggleSwitch, slider) {
  if (checkbox.checked) {
    toggleSwitch.classList.add("active");
  } else {
    toggleSwitch.classList.remove("active");
  }
}

/**
 * Modal Functionality
 */
function initModals() {
  // Get all modal triggers and attach click handlers
  document.querySelectorAll("[data-modal-target]").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const modalId = trigger.getAttribute("data-modal-target");
      openModal(modalId);
    });
  });

  // Close buttons inside modals
  document.querySelectorAll(".modal-close").forEach((closeBtn) => {
    closeBtn.addEventListener("click", () => {
      const modal = closeBtn.closest(".modal-overlay");
      if (modal) {
        closeModal(modal.id);
      }
    });
  });

  // Close modals with escape key and by clicking outside
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const activeModals = document.querySelectorAll(".modal-overlay.active");
      activeModals.forEach((modal) => {
        closeModal(modal.id);
      });
    }
  });

  // Close when clicking on the modal overlay background
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      // Only close if clicking directly on the overlay, not its children
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

/**
 * Open a modal by ID
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Show the modal
  modal.classList.add("active");

  // Prevent body scrolling
  document.body.style.overflow = "hidden";

  // Focus first input if it exists
  setTimeout(() => {
    const input = modal.querySelector(
      "input:not([type='hidden']):not([type='checkbox']), textarea"
    );
    if (input) input.focus();
  }, 100);

  // Dispatch event for custom handling
  const event = new CustomEvent("modalOpened", { detail: { modalId } });
  document.dispatchEvent(event);
}

/**
 * Close a modal by ID
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Hide the modal
  modal.classList.remove("active");

  // Restore body scrolling if no other modals are open
  const activeModals = document.querySelectorAll(".modal-overlay.active");
  if (activeModals.length === 0) {
    document.body.style.overflow = "";
  }

  // Dispatch event for custom handling
  const event = new CustomEvent("modalClosed", { detail: { modalId } });
  document.dispatchEvent(event);
}

/**
 * Close specific modal handlers
 */
function closeEditModal() {
  closeModal("editUrlModal");
}

function closeDeleteModal() {
  closeModal("deleteUrlModal");
}

/**
 * Helper functions for specific modals
 */
function openEditModal(urlId) {
  // Fetch URL details and populate the form
  fetch(`/api/urls/${urlId}`)
    .then((response) => response.json())
    .then((data) => {
      const form = document.getElementById("editUrlForm");
      if (form) {
        form.setAttribute("data-url-id", urlId);
        form.querySelector('[name="originalUrl"]').value = data.originalUrl;
        form.querySelector('[name="shortCode"]').value = data.shortCode;
        // Set any other fields as needed
        if (form.querySelector('[name="title"]')) {
          form.querySelector('[name="title"]').value = data.title || "";
        }
        // Open the modal
        openModal("editUrlModal");
      }
    })
    .catch((error) => {
      showNotification("Error fetching URL details", "danger");
      console.error("Error:", error);
    });
}

function openDeleteModal(urlId, shortCode) {
  const confirmText = document.getElementById("deleteConfirmText");
  if (confirmText) {
    confirmText.textContent = `Are you sure you want to delete the shortened URL for "${shortCode}"?`;
  }
  const form = document.getElementById("deleteUrlForm");
  if (form) {
    form.setAttribute("data-url-id", urlId);
    openModal("deleteUrlModal");
  }
}

function openQRCodeModal(urlId, shortCode) {
  // Show loading state
  const qrContainer = document.getElementById("qrCodeModalImage");
  if (qrContainer) {
    qrContainer.innerHTML = '<div class="loader"></div>';
  }

  // Set modal title
  const modalTitle = document.querySelector("#qrCodeModal .modal-title");
  if (modalTitle) {
    modalTitle.textContent = `QR Code for ${shortCode}`;
  }

  // Open modal first, then fetch QR code
  openModal("qrCodeModal");

  // Fetch QR code image
  fetch(`/api/urls/${urlId}/qrcode`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`
        );
      }
      return response.json();
    })
    .then((data) => {
      if (!qrContainer) return;

      if (data.qrCodeUrl) {
        // Create image with error handling
        const img = new Image();
        img.alt = `QR Code for ${shortCode}`;
        img.className = "qr-code-img";

        // Set up loading indicator and error handling
        qrContainer.innerHTML = '<div class="loader"></div>';

        img.onload = () => {
          qrContainer.innerHTML = "";
          qrContainer.appendChild(img);

          // Add download button
          const downloadLink = document.createElement("a");
          downloadLink.href = data.qrCodeUrl;
          downloadLink.download = `${shortCode}-qrcode.png`;
          downloadLink.className = "btn btn-primary mt-3";
          downloadLink.innerHTML =
            '<i class="fas fa-download"></i> Download QR Code';
          qrContainer.appendChild(downloadLink);

          // Add instructions paragraph
          const instructions = document.createElement("p");
          instructions.className = "mt-2 text-center";
          instructions.textContent = "Scan to open the shortened URL";
          qrContainer.appendChild(instructions);
        };

        img.onerror = () => {
          qrContainer.innerHTML =
            '<div class="alert alert-danger">Failed to load QR code image</div>';

          // Add regenerate button
          const regenerateBtn = document.createElement("button");
          regenerateBtn.className = "btn btn-warning mt-3";
          regenerateBtn.innerHTML =
            '<i class="fas fa-sync"></i> Regenerate QR Code';
          regenerateBtn.onclick = () => regenerateQRCode(urlId, shortCode);
          qrContainer.appendChild(regenerateBtn);
        };

        // Start loading the image
        img.src = data.qrCodeUrl;
      } else {
        qrContainer.innerHTML =
          '<div class="alert alert-warning">No QR code available for this URL</div>';

        // Add generate button
        const generateBtn = document.createElement("button");
        generateBtn.className = "btn btn-primary mt-3";
        generateBtn.innerHTML =
          '<i class="fas fa-qrcode"></i> Generate QR Code';
        generateBtn.onclick = () => regenerateQRCode(urlId, shortCode);
        qrContainer.appendChild(generateBtn);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      if (qrContainer) {
        qrContainer.innerHTML = `
          <div class="alert alert-danger">Error loading QR code: ${error.message}</div>
          <button class="btn btn-warning mt-3" onclick="regenerateQRCode('${urlId}', '${shortCode}')">
            <i class="fas fa-sync"></i> Try Again
          </button>
        `;
      }
    });
}

function regenerateQRCode(urlId, shortCode) {
  const qrContainer = document.getElementById("qrCodeModalImage");
  if (qrContainer) {
    qrContainer.innerHTML =
      '<div class="loader"></div><p class="text-center">Generating new QR code...</p>';
  }

  // Get CSRF token if available
  const csrfToken = document.querySelector('input[name="_csrf"]')?.value;
  
  // Prepare headers with CSRF token
  const headers = {
    "Content-Type": "application/json",
  };
  
  // Add CSRF token to headers if available
  if (csrfToken) {
    headers["CSRF-Token"] = csrfToken;
  }

  const options = {
    adModeEnabled: true,
    iconSizePercent: 20,
    useLargeIcon: false,
  };

  fetch(`/url/${shortCode}/qrcode`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(options),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`
        );
      }
      return response.json();
    })
    .then((data) => {
      if (data.status === "success") {
        showNotification("QR Code regenerated successfully", "success");
        // Re-fetch and display the QR code
        openQRCodeModal(urlId, shortCode);
      } else {
        throw new Error(data.message || "Failed to regenerate QR code");
      }
    })
    .catch((error) => {
      console.error("Error regenerating QR code:", error);
      showNotification("Error: " + error.message, "danger");
      if (qrContainer) {
        qrContainer.innerHTML = `
          <div class="alert alert-danger">Failed to regenerate QR code: ${error.message}</div>
          <button class="btn btn-warning mt-3" onclick="regenerateQRCode('${urlId}', '${shortCode}')">
            <i class="fas fa-sync"></i> Try Again
          </button>
        `;
      }
    });
}

// Function to toggle QR code display with animation
function toggleQRCode(id) {
  const qrCodeElement = document.getElementById(`qrCode-${id}`);
  if (!qrCodeElement) return;

  if (qrCodeElement.classList.contains("visible")) {
    // Hide with animation
    qrCodeElement.style.maxHeight = qrCodeElement.scrollHeight + "px";
    // Force reflow
    qrCodeElement.offsetHeight;
    qrCodeElement.style.maxHeight = "0";
    setTimeout(() => {
      qrCodeElement.classList.remove("visible");
    }, 500);
  } else {
    // Show with animation
    qrCodeElement.classList.add("visible");
    qrCodeElement.style.maxHeight = qrCodeElement.scrollHeight + "px";
    // After animation completes, set to auto to handle content changes
    setTimeout(() => {
      qrCodeElement.style.maxHeight = "200px";
    }, 500);
  }
}

/**
 * Copy to Clipboard Functionality
 */
function initCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const textToCopy = button.getAttribute("data-copy");
      try {
        await navigator.clipboard.writeText(textToCopy);
        // Change button text temporarily
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        // Show a tooltip or notification
        showNotification("Copied to clipboard!", "success");
        // Reset button after delay
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);
      } catch (error) {
        console.error("Failed to copy: ", error);
        showNotification("Failed to copy to clipboard", "danger");
      }
    });
  });
}

/**
 * Tooltip Functionality
 */
function initTooltips() {
  document.querySelectorAll("[data-tooltip]").forEach((element) => {
    // Create tooltip element
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = element.getAttribute("data-tooltip");

    // Show tooltip on hover/focus
    element.addEventListener("mouseenter", () => {
      document.body.appendChild(tooltip);
      // Position the tooltip relative to the element
      const rect = element.getBoundingClientRect();
      tooltip.style.top = `${
        rect.top - tooltip.offsetHeight - 5 + window.scrollY
      }px`;
      tooltip.style.left = `${
        rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + window.scrollX
      }px`;
      // Animate in
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(10px)";
      setTimeout(() => {
        tooltip.style.opacity = "1";
        tooltip.style.transform = "translateY(0)";
      }, 10);
    });

    // Hide tooltip
    element.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
      tooltip.style.transform = "translateY(10px)";
      setTimeout(() => {
        if (tooltip.parentNode) {
          document.body.removeChild(tooltip);
        }
      }, 200);
    });
  });
}

/**
 * Form Validation
 */
function initFormValidation() {
  const urlForms = document.querySelectorAll('form[data-validate="url"]');
  urlForms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      const urlInput = form.querySelector('input[name="originalUrl"]');
      if (urlInput && !isValidUrl(urlInput.value)) {
        e.preventDefault();
        showInputError(
          urlInput,
          "Please enter a valid URL including http:// or https://"
        );
      }
    });
  });

  // Add real-time validation for URL fields
  document.querySelectorAll('input[name="originalUrl"]').forEach((input) => {
    input.addEventListener("blur", () => {
      if (input.value && !isValidUrl(input.value)) {
        showInputError(
          input,
          "Please enter a valid URL including http:// or https://"
        );
      } else {
        clearInputError(input);
      }
    });
  });
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

function showInputError(inputElement, message) {
  clearInputError(inputElement);
  inputElement.classList.add("is-invalid");
  const errorElement = document.createElement("div");
  errorElement.className = "input-error";
  errorElement.textContent = message;
  inputElement.parentNode.appendChild(errorElement);
}

function clearInputError(inputElement) {
  inputElement.classList.remove("is-invalid");
  const existingError = inputElement.parentNode.querySelector(".input-error");
  if (existingError) {
    existingError.remove();
  }
}

/**
 * QR Code Toggle and Preview
 */
function initQRCodeToggle() {
  const qrToggle = document.getElementById("generateQrCode");
  const qrPreview = document.getElementById("qrCodePreview");
  if (qrToggle && qrPreview) {
    qrToggle.addEventListener("change", () => {
      qrPreview.style.display = qrToggle.checked ? "block" : "none";
    });
  }
}

/**
 * Overlay Settings Functionality
 */
function initOverlaySettings() {
  const overlayToggle = document.getElementById("enableOverlay");
  const settingsPanel = document.getElementById("overlaySettings");

  if (overlayToggle && settingsPanel) {
    // Initial state
    settingsPanel.style.display = overlayToggle.checked ? "block" : "none";

    // Toggle settings panel
    overlayToggle.addEventListener("change", () => {
      toggleEditOverlayOptions(overlayToggle.checked);
    });

    // Initialize range inputs
    document.querySelectorAll('input[type="range"]').forEach((range) => {
      const valueDisplay = range.parentElement.querySelector(".range-value");
      if (valueDisplay) {
        valueDisplay.textContent = range.value;

        range.addEventListener("input", () => {
          valueDisplay.textContent = range.value;

          // Update overlay preview if this is opacity slider
          if (range.id === "overlayOpacity") {
            updateOpacityPreview(range.value);
          }
        });
      }
    });

    // Initialize color pickers
    document.querySelectorAll('input[type="color"]').forEach((colorPicker) => {
      const preview = colorPicker.parentElement.querySelector(".color-preview");
      if (preview) {
        preview.style.backgroundColor = colorPicker.value;

        colorPicker.addEventListener("input", () => {
          preview.style.backgroundColor = colorPicker.value;
        });
      }
    });
  }
}

function toggleEditOverlayOptions(show) {
  const settingsPanel = document.getElementById("overlaySettings");
  if (settingsPanel) {
    settingsPanel.style.display = show ? "block" : "none";
  }
}

function updateOpacityPreview(value) {
  const preview = document.getElementById("opacityPreview");
  if (preview) {
    preview.style.opacity = value / 100;
  }
}

/**
 * Notification System
 */
function initNotifications() {
  // Create notification container if it doesn't exist
  if (!document.getElementById("notification-container")) {
    const container = document.createElement("div");
    container.id = "notification-container";
    container.className = "notification-container";
    document.body.appendChild(container);
  }

  // Check for flash messages from server
  const flashMessages = document.querySelectorAll(".flash-message");
  flashMessages.forEach((flash) => {
    const message = flash.textContent || flash.innerText;
    const type = flash.getAttribute("data-type") || "info";
    showNotification(message, type);
    flash.remove();
  });
}

function showNotification(message, type = "info", duration = 3000) {
  // Get or create notification container
  let container = document.getElementById("notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notification-container";
    container.className = "notification-container";
    document.body.appendChild(container);
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;

  // Set icon based on notification type
  let icon = "info-circle";
  if (type === "success") icon = "check-circle";
  if (type === "danger") icon = "exclamation-circle";
  if (type === "warning") icon = "exclamation-triangle";

  notification.innerHTML = `
    <div class="notification-icon">
      <i class="fas fa-${icon}"></i>
    </div>
    <div class="notification-content">
      <div class="notification-title">${
        type.charAt(0).toUpperCase() + type.slice(1)
      }</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close">
      <i class="fas fa-times"></i>
    </button>
    <div class="notification-progress" style="animation-duration: ${duration}ms"></div>
  `;

  // Add close button functionality
  const closeBtn = notification.querySelector(".notification-close");
  closeBtn.addEventListener("click", () => {
    closeNotification(notification);
  });

  // Add to container
  container.prepend(notification);

  // Auto-close after duration
  setTimeout(() => {
    closeNotification(notification);
  }, duration);

  return notification;
}

function closeNotification(notification) {
  notification.classList.add("closing");
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

/**
 * URL Stats Charts
 */
function initUrlStatsChart(containerId, statsData) {
  if (!document.getElementById(containerId)) return;
  // Check if Chart.js is loaded
  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded");
    return;
  }

  const ctx = document.getElementById(containerId).getContext("2d");
  const dates = statsData.map((item) => item.date);
  const counts = statsData.map((item) => item.count);

  new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Clicks",
          data: counts,
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.4,
          pointBackgroundColor: "rgba(59, 130, 246, 1)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
      plugins: {
        tooltip: {
          mode: "index",
          intersect: false,
        },
        legend: {
          display: false,
        },
      },
    },
  });
}

// Export functions for potential use from other scripts
window.LinkSqueeze = {
  openModal,
  closeModal,
  openEditModal,
  closeEditModal,
  openDeleteModal,
  closeDeleteModal,
  openQRCodeModal,
  toggleEditOverlayOptions,
  updateOpacityPreview,
  showNotification,
  initUrlStatsChart,
};
