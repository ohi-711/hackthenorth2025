class ProductDetector {
  constructor() {
    this.isShoppingSite = false;
    this.currentProduct = null;
    this.init();
  }

  init() {
    // Listen for shopping site signal from background
    window.addEventListener("message", (event) => {
      if (event.data.type === "STOCKSWAP_SHOPPING_SITE") {
        this.isShoppingSite = true;
        this.startProductDetection();
      }
    });

    // Start detection if already on a shopping site
    if (this.detectShoppingSite()) {
      this.isShoppingSite = true;
      this.startProductDetection();
    }
  }

  detectShoppingSite() {
    const hostname = window.location.hostname.toLowerCase();
    const shoppingSites = [
      "amazon.com",
      "amazon.ca",
      "ebay.com",
      "walmart.com",
      "target.com",
      "bestbuy.com",
      "shopify.com",
      "etsy.com",
    ];

    return shoppingSites.some((site) => hostname.includes(site));
  }

  startProductDetection() {
    // Create floating advisor button
    this.createAdvisorButton();

    // Detect product information
    this.detectProduct();

    // Monitor for page changes
    this.observePageChanges();
  }

  createAdvisorButton() {
    // Remove existing button if it exists
    const existingButton = document.getElementById("stockswap-btn");
    if (existingButton) {
      existingButton.remove();
    }

    const button = document.createElement("button");
    button.id = "stockswap-btn";
    button.innerHTML = "💡💰";
    button.title = "StockSwap: See Investment Alternative";

    // Styling for the floating button
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      width: 120px;
      height: 50px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Hover effects
    button.addEventListener("mouseenter", () => {
      button.style.transform = "scale(1.05)";
      button.style.boxShadow = "0 6px 25px rgba(102, 126, 234, 0.6)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "0 4px 20px rgba(102, 126, 234, 0.4)";
    });

    // Click handler
    button.addEventListener("click", () => {
      this.showInvestmentAlternative();
    });

    document.body.appendChild(button);
  }

  detectProduct() {
    const productData = this.extractProductData();
    if (productData) {
      this.currentProduct = productData;
      this.updateButtonWithProduct();
    }
  }

  extractProductData() {
    const hostname = window.location.hostname.toLowerCase();

    // Amazon detection
    if (hostname.includes("amazon")) {
      return this.extractAmazonProduct();
    }

    // eBay detection
    if (hostname.includes("ebay")) {
      return this.extractEbayProduct();
    }

    // Best Buy detection
    if (hostname.includes("bestbuy")) {
      return this.extractBestBuyProduct();
    }

    // Generic detection
    return this.extractGenericProduct();
  }

  extractAmazonProduct() {
    const title = document.querySelector(
      '#productTitle, [data-a-size="large"]'
    );
    const price = document.querySelector(".a-price-whole, .a-offscreen");
    const brand = document.querySelector("#bylineInfo, .a-link-normal");

    console.log("Amazon product detection:", {
      title: title ? title.textContent.trim() : "Not found",
      price: price ? price.textContent : "Not found",
      brand: brand ? brand.textContent.trim() : "Not found",
    });

    if (title && price) {
      const priceText = price.textContent.replace(/[^0-9.,]/g, "");
      const priceValue = parseFloat(priceText.replace(",", ""));

      const productData = {
        name: title.textContent.trim(),
        price: priceValue,
        brand: brand ? brand.textContent.trim() : "Clothing, Shoes & Jewelry",
        category: this.getCategoryFromUrl() || "Fashion",
        url: window.location.href,
      };

      console.log("Extracted product data:", productData);
      return productData;
    }

    console.log("No product data found on Amazon page");
    return null;
  }

  extractEbayProduct() {
    const title = document.querySelector(".x-item-title-label, h1");
    const price = document.querySelector(".notranslate");

    if (title && price) {
      const priceText = price.textContent.replace(/[^0-9.,]/g, "");
      const priceValue = parseFloat(priceText.replace(",", ""));

      return {
        name: title.textContent.trim(),
        price: priceValue,
        brand: "Various",
        category: "General",
        url: window.location.href,
      };
    }

    return null;
  }

  extractBestBuyProduct() {
    const title = document.querySelector(".heading-5, .sr-only");
    const price = document.querySelector(".sr-only, .pricing-price__range");

    if (title && price) {
      const priceText = price.textContent.replace(/[^0-9.,]/g, "");
      const priceValue = parseFloat(priceText.replace(",", ""));

      return {
        name: title.textContent.trim(),
        price: priceValue,
        brand: "Various",
        category: "Electronics",
        url: window.location.href,
      };
    }

    return null;
  }

  extractGenericProduct() {
    // Try to find common price patterns
    const priceSelectors = [
      ".price",
      ".cost",
      ".amount",
      '[class*="price"]',
      '[class*="cost"]',
    ];

    const titleSelectors = [
      "h1",
      ".title",
      ".product-title",
      '[class*="title"]',
      ".name",
    ];

    let price = null;
    let title = null;

    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent.match(
          /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
        );
        if (priceText) {
          price = parseFloat(priceText[1].replace(",", ""));
          break;
        }
      }
    }

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 0) {
        title = element.textContent.trim();
        break;
      }
    }

    if (price && title) {
      return {
        name: title,
        price: price,
        brand: "Unknown",
        category: "General",
        url: window.location.href,
      };
    }

    return null;
  }

  getCategoryFromUrl() {
    const url = window.location.href.toLowerCase();
    const categories = {
      electronics: "Electronics",
      clothing: "Fashion",
      shoes: "Fashion",
      gaming: "Gaming",
      computer: "Technology",
      phone: "Technology",
      book: "Books",
      home: "Home & Garden",
    };

    for (const [key, value] of Object.entries(categories)) {
      if (url.includes(key)) {
        return value;
      }
    }

    return "Fashion";
  }

  updateButtonWithProduct() {
    const button = document.getElementById("stockswap-btn");
    if (button && this.currentProduct) {
      button.innerHTML = `💡 $${this.currentProduct.price}`;
      button.style.animation = "pulse 2s infinite";

      // Add pulse animation
      if (!document.getElementById("stockswap-styles")) {
        const style = document.createElement("style");
        style.id = "stockswap-styles";
        style.textContent = `
          @keyframes pulse {
            0% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); }
            50% { box-shadow: 0 6px 30px rgba(102, 126, 234, 0.8); }
            100% { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  async showInvestmentAlternative() {
    console.log(
      "showInvestmentAlternative called, currentProduct:",
      this.currentProduct
    );

    if (!this.currentProduct) {
      console.log("No product detected, trying to detect again...");
      this.detectProduct();

      if (!this.currentProduct) {
        this.showNotification("Product not detected. Try refreshing the page.");
        return;
      }
    }

    this.ensurePopupContainer();
    // Show loading state
    this.showLoadingModal();

    try {
      console.log("Sending product data to background:", this.currentProduct);

      // Add retry logic with shorter timeout
      let retries = 2;
      let response = null;

      while (retries > 0 && !response) {
        try {
          response = await this.sendMessageWithTimeout(
            {
              action: "analyzeProduct",
              productData: this.currentProduct,
            },
            30000
          ); // Increase timeout to 30 seconds
          break;
        } catch (error) {
          console.warn(`Attempt failed, ${retries - 1} retries left:`, error);
          retries--;

          if (retries === 0) {
            throw error;
          }

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log("Received response from background:", response);

      // Show investment suggestion modal
      this.showInvestmentModal(response);
    } catch (error) {
      console.error("Failed to analyze product:", error);
      this.hideModal();

      // Show fallback modal instead of just notification
      this.showFallbackModal();
    }
  }

  sendMessageWithTimeout(message, timeout = 30000) {
    return new Promise((resolve, reject) => {
      console.log("Sending message to background:", message);

      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        reject(new Error("Extension context invalidated"));
        return;
      }

      const timer = setTimeout(() => {
        console.error("Message timeout after", timeout, "ms");
        reject(new Error("Request timeout"));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timer);

          console.log("Background response received:", response);

          // Check for Chrome runtime errors
          if (chrome.runtime.lastError) {
            console.error(
              "Chrome runtime error:",
              chrome.runtime.lastError.message
            );
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          // Check if we got a response
          if (!response) {
            console.error("No response received from background");
            reject(new Error("No response from background script"));
            return;
          }

          // Check for error in response
          if (response.error) {
            console.error("Background script error:", response.error);
            reject(new Error(response.error));
            return;
          }

          resolve(response);
        });
      } catch (error) {
        clearTimeout(timer);
        console.error("Failed to send message:", error);
        reject(error);
      }
    });
  }

  ensurePopupContainer() {
    let popupContainer = document.getElementById('stockswap-popup');
    if (!popupContainer) {
        // Create the popup container dynamically
        popupContainer = document.createElement('div');
        popupContainer.id = 'stockswap-popup';
        popupContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        max-height: 400px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        overflow-y: auto;
        z-index: 1000001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        document.body.appendChild(popupContainer);
    }
    return popupContainer;
}

  showLoadingModal() {
    const popupContainer = document.getElementById('stockswap-popup');
    if (!popupContainer) {
        console.error('Popup container not found. Ensure the popup DOM is loaded.');
        return;
    }
    popupContainer.innerHTML = `
      <div class="stockswap-modal-content">
        <h2>🔍 Analyzing Your Purchase...</h2>
        <div class="loading-spinner"></div>
        <p>Finding the best investment alternatives for $${this.currentProduct.price}</p>
      </div>
    `;

    // Add loading spinner styles
    const style = document.createElement("style");
    style.textContent = `
      .loading-spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #667eea;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 20px auto;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  showFallbackModal() {
    const popupContainer = document.getElementById('stockswap-popup');
    popupContainer.innerHTML = `
      <div class="stockswap-modal-content">
        <div class="modal-header">
          <h2>💡 Investment Alternative</h2>
          <span class="close"></span>
        </div>
        
        <div class="product-info">
          <p><strong>Instead of spending:</strong> $${
            this.currentProduct.price
          }</p>
        </div>
        
        <div class="investment-suggestion">
          <h3>Consider This Investment Strategy:</h3>
          <p>Rather than purchasing this item, consider investing that money in a diversified portfolio. Here's what your $${
            this.currentProduct.price
          } could become:</p>
          
          <div class="strategy-grid">
            <div class="strategy-card">
              <h4>Conservative (7% annual return)</h4>
              <p class="projected-value">$${(
                this.currentProduct.price * 1.07
              ).toFixed(2)}</p>
              <p class="strategy-desc">After 1 year</p>
            </div>
            <div class="strategy-card">
              <h4>Balanced (10% annual return)</h4>
              <p class="projected-value">$${(
                this.currentProduct.price * 1.1
              ).toFixed(2)}</p>
              <p class="strategy-desc">After 1 year</p>
            </div>
            <div class="strategy-card">
              <h4>Growth (15% annual return)</h4>
              <p class="projected-value">$${(
                this.currentProduct.price * 1.15
              ).toFixed(2)}</p>
              <p class="strategy-desc">After 1 year</p>
            </div>
          </div>
        </div>
        
        <div class="action-buttons">
          <button id="skip-purchase-btn" class="success-btn">✅ Skip Purchase & Save</button>
          <button id="not-now-btn" class="tertiary-btn">❌ Not Now</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        .fallback-modal {
        padding: 30px;
        text-align: center;
        width: 400px;
        height: auto;
        border-radius: 15px;
        }

        .strategy-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin: 20px 0;
        }

        .strategy-card {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        border: 2px solid #dee2e6;
        }

        .projected-value {
        font-size: 18px;
        font-weight: bold;
        color: #28a745;
        margin: 10px 0;
        }

        .action-buttons {
        display: flex;
        justify-content: space-around;
        margin-top: 20px;
        }

        .success-btn, .tertiary-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
        }

        .success-btn {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        color: white;
        }

        .tertiary-btn {
        background: #6c757d;
        color: white;
        }

        .success-btn:hover, .tertiary-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
    `;
    document.head.appendChild(style); 

    const closeBtn = popupContainer.querySelector('.close');
    const notNowBtn = popupContainer.querySelector('#not-now-btn');
    
    [closeBtn, notNowBtn].forEach(btn => {
        if (btn) {
        btn.addEventListener('click', () => {
            popupContainer.innerHTML = ''; // Clear the popup content
        });
        }
    });
  }

  showInvestmentModal(analysis) {
    const popupContainer = document.getElementById('stockswap-popup');
    if (!modal) return;

    // Check if we have real portfolio data or fallback data
    const hasPortfolios =
      analysis.portfolios && Array.isArray(analysis.portfolios);
    const apiSource = analysis.api_source || "fallback";

    let strategyCardsHTML = "";

    if (hasPortfolios) {
      // Use real RBC API portfolio data
      strategyCardsHTML = analysis.portfolios
        .map((portfolio) => {
          const strategyName =
            portfolio.strategy.charAt(0).toUpperCase() +
            portfolio.strategy.slice(1);
          const sourceIndicator =
            portfolio.source === "rbc_api" ? "🔗 RBC API" : "📊 Estimated";

          return `
          <div class="strategy-card ${
            portfolio.source === "rbc_api" ? "api-powered" : "estimated"
          }">
            <h4>${strategyName}</h4>
            <p class="projected-value">$${portfolio.projected_value.toFixed(
              2
            )}</p>
            <p class="strategy-desc">${portfolio.time_period}</p>
            <small class="data-source">${sourceIndicator}</small>
          </div>
        `;
        })
        .join("");
    } else {
      // Fallback to hardcoded calculations
      strategyCardsHTML = `
        <div class="strategy-card estimated">
          <h4>Conservative</h4>
          <p class="projected-value">$${(
            this.currentProduct.price * 1.07
          ).toFixed(2)}</p>
          <p class="strategy-desc">1 year</p>
          <small class="data-source">📊 Estimated</small>
        </div>
        <div class="strategy-card estimated">
          <h4>Balanced</h4>
          <p class="projected-value">$${(
            this.currentProduct.price * 1.1
          ).toFixed(2)}</p>
          <p class="strategy-desc">1 year</p>
          <small class="data-source">📊 Estimated</small>
        </div>
        <div class="strategy-card estimated">
          <h4>Growth</h4>
          <p class="projected-value">$${(
            this.currentProduct.price * 1.15
          ).toFixed(2)}</p>
          <p class="strategy-desc">1 year</p>
          <small class="data-source">📊 Estimated</small>
        </div>
      `;
    }

    popupContainer.innerHTML = `
      <div class="stockswap-modal-content">
        <div class="modal-header">
          <h2>🛍️ Shopping for ${this.currentProduct.name}?</h2>
          <span class="close">&times;</span>
        </div>
        
        <div class="product-info">
          <p><strong>Price:</strong> $${this.currentProduct.price}</p>
          ${
            apiSource === "rbc_api"
              ? '<p class="api-badge">🔗 Powered by RBC InvestEase API</p>'
              : ""
          }
        </div>
        
        <div class="investment-suggestion">
          <h3>💡 Investment Alternative:</h3>
          <p>${
            analysis.explanation ||
            `Instead of spending $${this.currentProduct.price}, see how investing could grow your money:`
          }</p>
          
          ${
            analysis.stocks
              ? `
            <div class="stocks-suggestion">
              <h4>Recommended Stocks:</h4>
              <ul>
                ${analysis.stocks.map((stock) => `<li>${stock}</li>`).join("")}
              </ul>
            </div>
          `
              : ""
          }
          
          ${
            analysis.education
              ? `
            <div class="education-content">
              <h4>📚 Learn More:</h4>
              <p>${analysis.education}</p>
            </div>
          `
              : ""
          }
        </div>
        
        <div class="simulation-section">
          <h3>📊 Portfolio Strategy Comparison</h3>
          <div class="strategy-grid">
            ${strategyCardsHTML}
          </div>
        </div>
        
        <div class="action-buttons">
          <button id="skip-purchase-btn" class="success-btn">✅ Skip Purchase & Invest</button>
          <button id="not-now-btn" class="tertiary-btn">❌ Not Now</button>
        </div>
      </div>
    `;

    const closeBtn = popupContainer.querySelector('.close');
    const notNowBtn = popupContainer.querySelector('#not-now-btn');
    
    [closeBtn, notNowBtn].forEach(btn => {
        if (btn) {
        btn.addEventListener('click', () => {
            popupContainer.innerHTML = ''; // Clear the popup content
        });
        }
    });
  }

  createModal() {
    // Remove existing modal
    const existingModal = document.getElementById("stockswap-modal");
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "stockswap-modal";
    modal.style.cssText = `
      position: fixed;
      z-index: 1000000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
      backdrop-filter: blur(5px);
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Add modal styles
    if (!document.getElementById("stockswap-modal-styles")) {
      const style = document.createElement("style");
      style.id = "stockswap-modal-styles";
      style.textContent = `
        .stockswap-modal-content {
          background: white;
          padding: 30px;
          border-radius: 15px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          position: relative;
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from { transform: translateY(-50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 15px;
        }
        
        .close {
          font-size: 28px;
          cursor: pointer;
          color: #aaa;
        }
        
        .close:hover {
          color: #000;
        }
        
        .strategy-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        
        .strategy-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          border: 2px solid #dee2e6;
        }
        
        .strategy-card.api-powered {
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          border: 2px solid #2196f3;
        }
        
        .strategy-card.estimated {
          background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
          border: 2px solid #ff9800;
        }
        
        .data-source {
          font-size: 12px;
          color: #666;
          font-weight: normal;
          margin-top: 5px;
          display: block;
        }
        
        .api-badge {
          background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          display: inline-block;
          margin-top: 5px;
        }
        
        .projected-value {
          font-size: 24px;
          font-weight: bold;
          color: #28a745;
          margin: 10px 0;
        }
        
        .action-buttons {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 30px;
        }
        
        .primary-btn, .secondary-btn, .success-btn, .tertiary-btn {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .primary-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .secondary-btn {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }
        
        .success-btn {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
        }
        
        .tertiary-btn {
          background: #6c757d;
          color: white;
        }
        
        .primary-btn:hover, .secondary-btn:hover, .success-btn:hover, .tertiary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);
    return modal;
  }

  addModalEventListeners(modal) {
    // Close modal
    const closeBtn = modal.querySelector(".close");
    const notNowBtn = modal.querySelector("#not-now-btn");

    [closeBtn, notNowBtn].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => {
          modal.remove();
        });
      }
    });

    // Try simulation
    const simulationBtn = modal.querySelector("#try-simulation-btn");
    if (simulationBtn) {
      simulationBtn.addEventListener("click", () => {
        this.openRBCSimulation();
      });
    }

    // Learn more
    const learnBtn = modal.querySelector("#learn-more-btn");
    if (learnBtn) {
      learnBtn.addEventListener("click", () => {
        this.showEducationalContent();
      });
    }

    // Skip purchase
    const skipBtn = modal.querySelector("#skip-purchase-btn");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        this.trackAvoidedPurchase();
        modal.remove();
      });
    }

    // Close on background click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  hideModal() {
    const existingModal = document.getElementById("stockswap-modal");
    if (existingModal) {
      existingModal.remove();
    }
  }

  async trackAvoidedPurchase() {
    try {
      const response = await this.sendMessageWithTimeout(
        {
          action: "trackAvoidedPurchase",
          productData: this.currentProduct,
        },
        5000
      );

      if (response.success) {
        this.showNotification(
          `Great choice! You've saved ${
            this.currentProduct.price
          }. Total savings: ${response.totalSavings.toFixed(2)}`,
          "success"
        );
      }
    } catch (error) {
      console.error("Failed to track avoided purchase:", error);
      this.showNotification("Savings tracked locally!", "success");
    }
  }

  openRBCSimulation() {
    this.showNotification(
      "Opening RBC InvestEase portfolio simulation...",
      "info"
    );
    // window.open('https://rbc-investease.com/simulate', '_blank');
  }

  showEducationalContent() {
    this.showNotification("Opening investment education content...", "info");
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 1000001;
      background: ${
        type === "success"
          ? "#28a745"
          : type === "error"
          ? "#dc3545"
          : "#17a2b8"
      };
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: slideInRight 0.3s ease-out;
      max-width: 300px;
    `;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 5000);
  }

  observePageChanges() {
    // Monitor for page changes to re-detect products
    const observer = new MutationObserver(() => {
      // Debounce the detection
      clearTimeout(this.detectionTimeout);
      this.detectionTimeout = setTimeout(() => {
        this.detectProduct();
      }, 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// Initialize the product detector
const productDetector = new ProductDetector();

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);

  switch (message.action) {
    case "showInvestmentSuggestion":
      productDetector.currentProduct = {
        name: "Selected Item",
        price: message.price,
        brand: "Unknown",
        category: "General",
        url: window.location.href,
      };
      productDetector.showInvestmentAlternative();
      sendResponse({ success: true });
      break;

    case "getCurrentProduct":
      console.log(
        "Popup requested current product:",
        productDetector.currentProduct
      );
      sendResponse({ product: productDetector.currentProduct });
      break;

    case "showInvestmentAlternative":
      console.log("Popup triggered investment alternative");
      productDetector.showInvestmentAlternative();
      sendResponse({ success: true });
      break;

    default:
      console.log("Unknown action:", message.action);
      sendResponse({ error: "Unknown action" });
  }

  return true; // Keep message channel open for async response
});

console.log("StockSwap Shopping Advisor content script loaded!");
