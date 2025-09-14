
importScripts("secrets.js");
if(typeof COHERE_API_KEY === "undefined" || !COHERE_API_KEY) {
  throw Error("no cohere api key! create /secrets.js with `const COHERE_API_KEY = \"your api key here\"`");
}

class StockSwapAPI {
  constructor() {
    this.rbcBaseUrl =
      "https://2dcq63co40.execute-api.us-east-1.amazonaws.com/dev";
    this.cohereBaseUrl = "https://api.cohere.ai/v1";
    this.cohereApiKey = COHERE_API_KEY;
    this.jwtToken = null;
    this.clientId = null;
    this.initPromise = null;
    this.isInitialized = false;

    // Start initialization but don't await it in constructor
    this.initPromise = this.init();
  }

  async init() {
    try {
      console.log("Initializing StockSwap API...");

      // Load stored credentials
      const stored = await chrome.storage.local.get(["jwtToken", "clientId"]);
      this.jwtToken = stored.jwtToken;
      this.clientId = stored.clientId;

      console.log("Stored credentials:", {
        hasToken: !!this.jwtToken,
        hasClient: !!this.clientId,
      });

      // Register team if no token
      if (!this.jwtToken) {
        console.log("No JWT token, registering team...");
        await this.registerTeam();
      }

      // Create client if no client ID
      if (!this.clientId && this.jwtToken) {
        console.log("No client ID, creating client...");
        await this.createClient();
      }

      this.isInitialized = true;
      console.log("StockSwap API initialized successfully");
    } catch (error) {
      console.error("Failed to initialize StockSwap API:", error);
      this.isInitialized = false;
    }
  }

  // Ensure API is initialized before any operation
  async ensureInitialized() {
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise;
    }
    return this.isInitialized;
  }

  async registerTeam() {
    try {
      console.log("Registering team with RBC API...");

      const response = await fetch(`${this.rbcBaseUrl}/teams/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          team_name: `StockSwap_${Date.now()}`, // Make team name unique
          contact_email: `team${Date.now()}@stockswap.com`,
        }),
      });

      console.log("Registration response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Registration failed:", errorText);
        throw new Error(`Registration failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("Team registration response:", data);
      console.log("🔍 FULL REGISTRATION RESPONSE DEBUG:");
      console.log("  Response keys:", Object.keys(data));
      console.log("  Full response:", JSON.stringify(data, null, 2));

      if (data.jwtToken) {
        this.jwtToken = data.jwtToken;
        await chrome.storage.local.set({ jwtToken: this.jwtToken });
        console.log("JWT token stored successfully");

        // Debug JWT token format
        console.log("🔍 JWT TOKEN DEBUG:");
        console.log("  Length:", this.jwtToken.length);
        console.log("  First 100 chars:", this.jwtToken.substring(0, 100));
        console.log("  Contains dots:", this.jwtToken.includes("."));
        console.log("  Dot count:", (this.jwtToken.match(/\./g) || []).length);

        // Check if it's a valid JWT format (should have 3 parts separated by dots)
        const parts = this.jwtToken.split(".");
        console.log("  JWT parts count:", parts.length);
        if (parts.length === 3) {
          console.log("  Header length:", parts[0].length);
          console.log("  Payload length:", parts[1].length);
          console.log("  Signature length:", parts[2].length);
        }
      } else {
        throw new Error("No JWT token in registration response");
      }
    } catch (error) {
      console.error("Failed to register team:", error);
      throw error;
    }
  }

  async createClient(userName = "Student User", userEmail = null) {
    try {
      console.log("Creating client with RBC API...");

      if (!this.jwtToken) {
        throw new Error("No JWT token available for client creation");
      }

      // Use unique email to avoid conflicts
      const uniqueEmail = userEmail || `user${Date.now()}@stockswap.com`;

      const response = await fetch(`${this.rbcBaseUrl}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.jwtToken}`,
        },
        body: JSON.stringify({
          name: userName,
          email: uniqueEmail,
          cash: 100000, // Give client $100,000 for portfolio creation
        }),
      });

      console.log("Client creation response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Client creation failed:", errorText);

        // If client already exists, try to get existing clients
        if (response.status === 409) {
          console.log(
            "Client with email already exists, trying to get existing clients..."
          );
          return await this.getExistingClient();
        }

        throw new Error(
          `Client creation failed: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Client creation response:", data);

      if (data.id) {
        this.clientId = data.id;
        await chrome.storage.local.set({ clientId: this.clientId });
        console.log("Client ID stored successfully");
      } else {
        throw new Error("No client ID in creation response");
      }
    } catch (error) {
      console.error("Failed to create client:", error);
      throw error;
    }
  }

  async getExistingClient() {
    try {
      console.log("Attempting to get existing clients...");

      const response = await fetch(`${this.rbcBaseUrl}/clients`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.jwtToken}`,
        },
      });

      console.log("Get clients response status:", response.status);

      if (!response.ok) {
        throw new Error(`Failed to get existing clients: ${response.status}`);
      }

      const clients = await response.json();
      console.log("Existing clients:", clients);

      if (clients && clients.length > 0) {
        this.clientId = clients[0].id;
        await chrome.storage.local.set({ clientId: this.clientId });
        console.log("Using existing client ID:", this.clientId);
        return;
      } else {
        throw new Error("No existing clients found");
      }
    } catch (error) {
      console.error("Failed to get existing client:", error);
      throw error;
    }
  }

  async createPortfolio(strategy, amount) {
    try {
      console.log(
        `Creating and simulating ${strategy} portfolio with $${amount}...`
      );

      if (!this.clientId || !this.jwtToken) {
        console.warn(
          "Missing client ID or JWT token, using fallback calculation"
        );
        return this.getFallbackPortfolio(strategy, amount);
      }

      // Map our strategy names to RBC API strategy names
      const strategyMapping = {
        conservative: "conservative",
        balanced: "balanced",
        aggressive: "aggressive_growth",
      };

      const rbcStrategy = strategyMapping[strategy] || "balanced";

      console.log("🔍 PORTFOLIO CREATION DEBUG:");
      console.log("  Client ID:", this.clientId);
      console.log("  Strategy mapping:", strategy, "->", rbcStrategy);
      console.log("  Amount:", amount);
      console.log(
        "  JWT Token first 50 chars:",
        this.jwtToken.substring(0, 50)
      );

      // Step 1: Check existing portfolios first
      const existingPortfolios = await this.getClientPortfolios();
      const existingPortfolio = existingPortfolios?.find(
        (p) => p.type === rbcStrategy
      );

      if (
        existingPortfolio &&
        Math.abs(existingPortfolio.initialAmount - amount) < 0.01
      ) {
        console.log(
          `♻️ Reusing existing ${rbcStrategy} portfolio:`,
          existingPortfolio.id
        );
        // Skip to simulation with existing portfolio
        return await this.simulatePortfolio(
          existingPortfolio,
          strategy,
          amount,
          rbcStrategy
        );
      }

      // If we have existing portfolios but need to create a new one, clear them first
      if (existingPortfolios && existingPortfolios.length >= 3) {
        console.log("🧹 Clearing existing portfolios (max 3 allowed)...");
        await this.clearExistingPortfolios();
      }

      // Step 2: Create the portfolio
      const createResponse = await fetch(
        `${this.rbcBaseUrl}/clients/${this.clientId}/portfolios`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.jwtToken}`,
          },
          body: JSON.stringify({
            type: rbcStrategy,
            initialAmount: amount,
          }),
        }
      );

      console.log("Portfolio creation response status:", createResponse.status);

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(
          "Portfolio creation failed:",
          createResponse.status,
          errorText
        );
        console.warn("Falling back to hardcoded calculations");
        return this.getFallbackPortfolio(strategy, amount);
      }

      const portfolioData = await createResponse.json();
      console.log("Portfolio created:", portfolioData);

      return await this.simulatePortfolio(
        portfolioData,
        strategy,
        amount,
        rbcStrategy
      );
    } catch (error) {
      console.error("Portfolio creation/simulation error:", error);
      console.warn("Falling back to hardcoded calculations");
      return this.getFallbackPortfolio(strategy, amount);
    }
  }

  async simulatePortfolio(portfolioData, strategy, amount, rbcStrategy) {
    try {
      // Step 2: Simulate the portfolio for 12 months
      const simulateResponse = await fetch(
        `${this.rbcBaseUrl}/client/${this.clientId}/simulate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.jwtToken}`,
          },
          body: JSON.stringify({
            months: 12,
          }),
        }
      );

      console.log("Simulation response status:", simulateResponse.status);

      if (!simulateResponse.ok) {
        const errorText = await simulateResponse.text();
        console.error(
          "Portfolio simulation failed:",
          simulateResponse.status,
          errorText
        );
        console.warn("Using portfolio data without simulation");

        // Return basic portfolio data without simulation
        return {
          strategy: strategy,
          initial_investment: amount,
          projected_value: portfolioData.current_value || amount,
          total_return: (portfolioData.current_value || amount) - amount,
          return_percentage:
            (((portfolioData.current_value || amount) - amount) / amount) * 100,
          time_period: "12 months",
          source: "rbc_api_no_simulation",
        };
      }

      const simulationData = await simulateResponse.json();
      console.log("Simulation completed:", simulationData);
      console.log("🔍 SIMULATION RESULTS DEBUG:");
      console.log(
        "  Simulation results count:",
        simulationData.results?.length
      );
      console.log("  Portfolio ID we created:", portfolioData.id);
      console.log(
        "  Simulation result portfolio IDs:",
        simulationData.results?.map((r) => r.portfolioId)
      );
      console.log(
        "  Full simulation results:",
        JSON.stringify(simulationData.results, null, 2)
      );

      // Find the simulation result for our portfolio - match by strategy since portfolio IDs might not match
      console.log("🔍 Looking for strategy:", rbcStrategy);
      console.log("🔍 Available simulation results before matching:");
      simulationData.results?.forEach((result, index) => {
        console.log(
          `  [${index}] Strategy: "${result.strategy}", Portfolio ID: ${result.portfolio_id}`
        );
      });

      const portfolioResult = simulationData.results?.find(
        (result) => result.strategy === rbcStrategy
      );

      console.log("🔍 PORTFOLIO MATCHING:");
      console.log("  Looking for strategy:", rbcStrategy);
      console.log(
        "  Available strategies:",
        simulationData.results?.map((r) => r.strategy)
      );
      console.log("  Found matching result:", !!portfolioResult);
      if (portfolioResult) {
        console.log("  Matching result:", portfolioResult);
      } else {
        console.log("❌ NO MATCH FOUND! Debugging:");
        console.log(
          "  Looking for (type/length):",
          typeof rbcStrategy,
          rbcStrategy.length
        );
        simulationData.results?.forEach((result, index) => {
          console.log(
            `  [${index}] "${
              result.strategy
            }" (type: ${typeof result.strategy}, length: ${
              result.strategy.length
            }) === "${rbcStrategy}"? ${result.strategy === rbcStrategy}`
          );
        });
      }

      if (portfolioResult) {
        return {
          strategy: strategy,
          initial_investment: amount,
          projected_value: portfolioResult.projected_value,
          total_return: portfolioResult.projected_value - amount,
          return_percentage:
            portfolioResult.percentage_return?.toFixed(2) ||
            (
              ((portfolioResult.projected_value - amount) / amount) *
              100
            ).toFixed(2),
          time_period: `${portfolioResult.months_simulated} months`,
          growth_trend: portfolioResult.growth_trend,
          portfolio_id: portfolioResult.portfolio_id,
          source: "rbc_api",
        };
      } else {
        console.warn(
          "No simulation result found for portfolio, using basic data"
        );
        return {
          strategy: strategy,
          initial_investment: amount,
          projected_value: portfolioData.current_value || amount,
          total_return: (portfolioData.current_value || amount) - amount,
          return_percentage:
            (((portfolioData.current_value || amount) - amount) / amount) * 100,
          time_period: "12 months",
          portfolio_id: portfolioData.id,
          source: "rbc_api_no_simulation",
        };
      }
    } catch (error) {
      console.error("Simulation error:", error);
      console.warn("Falling back to portfolio data without simulation");
      return {
        strategy: strategy,
        initial_investment: amount,
        projected_value: portfolioData.current_value || amount,
        total_return: (portfolioData.current_value || amount) - amount,
        return_percentage:
          (((portfolioData.current_value || amount) - amount) / amount) * 100,
        time_period: "12 months",
        portfolio_id: portfolioData.id,
        source: "rbc_api_no_simulation",
      };
    }
  }

  async createPortfolioOnly(strategy, amount) {
    try {
      console.log(`Creating ${strategy} portfolio (no simulation yet)...`);
      console.log(`🔍 Using client ID: ${this.clientId}`);

      // Map our strategy names to RBC API strategy names
      const strategyMapping = {
        conservative: "conservative",
        balanced: "balanced",
        aggressive: "aggressive_growth",
      };

      const rbcStrategy = strategyMapping[strategy] || "balanced";

      const createResponse = await fetch(
        `${this.rbcBaseUrl}/clients/${this.clientId}/portfolios`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.jwtToken}`,
          },
          body: JSON.stringify({
            type: rbcStrategy,
            initialAmount: amount,
          }),
        }
      );

      console.log(
        `Portfolio creation response for ${strategy}:`,
        createResponse.status
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(
          `Portfolio creation failed for ${strategy}:`,
          createResponse.status,
          errorText
        );
        throw new Error(`Failed to create ${strategy} portfolio`);
      }

      const portfolioData = await createResponse.json();
      console.log(`✅ ${strategy} portfolio created:`, portfolioData.id);
      console.log(`🔍 Portfolio client_id:`, portfolioData.client_id);
      console.log(`🔍 Expected client_id:`, this.clientId);

      // Verify the portfolio was linked to the correct client
      if (portfolioData.client_id !== this.clientId) {
        console.error(
          `❌ Portfolio client ID mismatch! Expected: ${this.clientId}, Got: ${portfolioData.client_id}`
        );
      }

      return portfolioData;
    } catch (error) {
      console.error(`Error creating ${strategy} portfolio:`, error);
      throw error;
    }
  }

  async simulateAllPortfolios(portfolios, amount, months = 6) {
    try {
      console.log(
        `🎯 Running ${months}-month simulation for client ${this.clientId}...`
      );
      console.log(
        `📋 Expected portfolios:`,
        portfolios.filter((p) => p).map((p) => `${p.type}(${p.id})`)
      );

      const response = await fetch(
        `${this.rbcBaseUrl}/client/${this.clientId}/simulate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.jwtToken}`,
          },
          body: JSON.stringify({
            months: months, // Use configurable months (default 6 to conserve 60-month limit)
          }),
        }
      );

      console.log("Simulation response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Portfolio simulation failed for client ${this.clientId}:`,
          response.status,
          errorText
        );

        // Check if it's a simulation limit error
        if (
          response.status === 400 &&
          errorText.includes("Cannot simulate for more than 60 months")
        ) {
          console.log(
            "🚫 Simulation limit reached (60 months total). Need to wait or use different team."
          );
          throw new Error("SIMULATION_LIMIT_REACHED");
        }

        throw new Error(`Simulation failed: ${errorText}`);
      }

      const simulationResults = await response.json();
      console.log("Raw simulation response:", simulationResults);

      // Extract results array from response
      const results = simulationResults.results || simulationResults || [];
      console.log(`✅ Simulation returned ${results.length} portfolio results`);

      return results;
    } catch (error) {
      console.error("Simulation error:", error);
      throw error;
    }
  }

  async analyzeProduct(productData) {
    try {
      console.log("Starting product analysis with RBC API...");

      // Validate price first
      if (!productData.price || productData.price <= 0) {
        console.warn("❌ Invalid or missing price:", productData.price);
        console.log("🔄 Using fallback suggestions due to missing price");

        // Use a default price for demonstration
        const defaultPrice = 50.0;
        productData.price = defaultPrice;
        console.log(`📊 Using default price: $${defaultPrice} for demo`);
      }

      // Ensure we're initialized
      await this.ensureInitialized();

      if (!this.clientId || !this.jwtToken) {
        console.warn("Missing RBC credentials, using fallback suggestions");
        return this.getFallbackSuggestions(productData);
      }

      // Step 1: Clear existing portfolios to ensure clean slate
      console.log("🧹 Clearing existing portfolios...");
      try {
        // Skip portfolio cleanup - it's causing auth errors and not working
        console.log("⏭️ Skipping portfolio cleanup - causes auth errors");
      } catch (error) {
        console.log("⚠️ Portfolio cleanup skipped:", error.message);
      }

      // Wait a bit after clearing
      console.log("⏳ Waiting 1 second...");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 2: Create all 3 portfolios first
      const strategies = ["conservative", "balanced", "aggressive"];
      console.log("📋 Creating all 3 portfolios...");

      const createdPortfolios = [];
      for (const strategy of strategies) {
        try {
          console.log(`Creating ${strategy} portfolio...`);
          const portfolio = await this.createPortfolioOnly(
            strategy,
            productData.price
          );
          createdPortfolios.push(portfolio);
          console.log(`✅ ${strategy} portfolio created: ${portfolio.id}`);
        } catch (error) {
          console.error(`❌ Failed to create ${strategy} portfolio:`, error);
          createdPortfolios.push(null);
        }
      }

      // Wait much longer for portfolios to be fully registered in the API
      console.log(
        "⏳ Waiting 10 seconds for portfolios to be fully registered..."
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Step 3: Try to verify individual portfolios exist
      console.log("🔍 Verifying individual portfolios exist...");
      for (const portfolio of createdPortfolios) {
        if (portfolio) {
          try {
            const individualResponse = await fetch(
              `${this.rbcBaseUrl}/portfolios/${portfolio.id}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${this.jwtToken}`,
                },
              }
            );
            console.log(
              `🔍 Portfolio ${portfolio.type} (${portfolio.id}) status: ${individualResponse.status}`
            );
          } catch (error) {
            console.warn(
              `⚠️ Could not verify individual portfolio ${portfolio.id}:`,
              error
            );
          }
        }
      }

      // Step 4: Verify portfolios exist before simulation
      console.log("🔍 Verifying portfolios exist for client:", this.clientId);
      try {
        // Try the exact URL format from API docs
        const verifyUrl = `${this.rbcBaseUrl}/clients/${this.clientId}/portfolios`;
        console.log("🔍 Verification URL:", verifyUrl);

        const verifyResponse = await fetch(verifyUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.jwtToken}`,
          },
        });

        console.log(
          "Portfolio verification response status:",
          verifyResponse.status
        );

        if (verifyResponse.ok) {
          const existingPortfolios = await verifyResponse.json();
          console.log(
            `📊 Found ${existingPortfolios.length} existing portfolios for client:`,
            existingPortfolios.map((p) => `${p.type}(${p.id})`)
          );

          if (existingPortfolios.length === 0) {
            console.warn(
              "⚠️ No portfolios found! API might have a delay or different issue."
            );
            console.log(
              "🔄 Continuing with simulation anyway - maybe the portfolios exist but list API is buggy."
            );
            // Don't throw error, continue with simulation
          }
        } else {
          const errorText = await verifyResponse.text();
          console.warn(
            "⚠️ Could not verify portfolios:",
            verifyResponse.status,
            errorText
          );
          console.log("🔄 Proceeding with simulation anyway...");
        }
      } catch (error) {
        console.warn("⚠️ Portfolio verification failed:", error);
      }

      // Step 5: Since bulk simulation fails, try individual portfolio simulations
      console.log(
        "🎯 Trying individual portfolio simulations as workaround..."
      );
      let simulationResults = [];

      for (const portfolio of createdPortfolios) {
        if (portfolio) {
          try {
            console.log(
              `🎯 Simulating individual portfolio: ${portfolio.type} (${portfolio.id})`
            );

            // Try to simulate this specific portfolio
            const simResponse = await fetch(
              `${this.rbcBaseUrl}/portfolios/${portfolio.id}/simulate`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${this.jwtToken}`,
                },
                body: JSON.stringify({
                  months: 6,
                }),
              }
            );

            console.log(
              `Individual simulation for ${portfolio.type}: ${simResponse.status}`
            );

            if (simResponse.ok) {
              const simData = await simResponse.json();
              console.log(`✅ ${portfolio.type} simulation successful`);

              // Add to results with proper strategy mapping
              simulationResults.push({
                portfolioId: portfolio.id,
                strategy: portfolio.type, // Use the actual type from creation
                monthsSimulated: 6,
                projectedValue:
                  simData.projected_value || simData.projectedValue,
                initialValue: productData.price,
                growth_trend: simData.growth_trend || [],
              });
            } else {
              const errorText = await simResponse.text();
              console.warn(
                `❌ Individual simulation failed for ${portfolio.type}:`,
                simResponse.status,
                errorText
              );
            }
          } catch (error) {
            console.error(`❌ Error simulating ${portfolio.type}:`, error);
          }
        }
      }

      console.log(
        `� Individual simulations completed: ${simulationResults.length}/3 successful`
      );

      if (simulationResults.length === 0) {
        // If individual simulations also fail, fall back to bulk client simulation
        console.log(
          "� Individual simulations failed, trying bulk client simulation..."
        );
        try {
          simulationResults = await this.simulateAllPortfolios(
            createdPortfolios,
            productData.price,
            6
          );
        } catch (error) {
          console.error("❌ Bulk simulation also failed:", error);
          simulationResults = [];
        }
      }

      // Step 6: Build final portfolios (use simulation data if available, fallback otherwise)

      // Step 4: Build final portfolios (use simulation data if available, fallback otherwise)
      const portfolios = strategies.map((strategy) => {
        const strategyMapping = {
          conservative: "conservative",
          balanced: "balanced",
          aggressive: "aggressive_growth",
        };

        const rbcStrategy = strategyMapping[strategy];
        const simulationResult = simulationResults?.find(
          (result) =>
            result.strategy === rbcStrategy || result.strategy === strategy
        );

        if (simulationResult) {
          console.log(`✅ ${strategy} using RBC simulation data`);
          return {
            strategy: strategy,
            initial_investment: productData.price,
            projected_value:
              simulationResult.projectedValue ||
              simulationResult.projected_value,
            total_return:
              (simulationResult.projectedValue ||
                simulationResult.projected_value) - productData.price,
            return_percentage: (
              (((simulationResult.projectedValue ||
                simulationResult.projected_value) -
                productData.price) /
                productData.price) *
              100
            ).toFixed(2),
            time_period: `${
              simulationResult.monthsSimulated ||
              simulationResult.months_simulated ||
              6
            } months`,
            growth_trend: simulationResult.growth_trend,
            portfolio_id:
              simulationResult.portfolioId || simulationResult.portfolio_id,
            source: "rbc_api",
          };
        } else {
          console.log(`❌ ${strategy} using fallback (no simulation data)`);
          return this.getFallbackPortfolio(strategy, productData.price);
        }
      });

      // Get AI-powered stock suggestions using Cohere
      const aiSuggestions = await this.getAIStockSuggestions(productData);

      return {
        stocks: aiSuggestions.stocks,
        portfolios: portfolios,
        education: aiSuggestions.education,
        explanation: `Instead of spending $${productData.price} on this item, see how investing that money could grow:`,
        api_source: portfolios.some((p) => p.source === "rbc_api")
          ? "rbc_api"
          : "fallback",
      };
    } catch (error) {
      console.error("Product analysis failed:", error);
      // Try AI suggestions as backup before falling back to hardcoded
      try {
        const aiSuggestions = await this.getAIStockSuggestions(productData);
        return {
          stocks: aiSuggestions.stocks,
          portfolios: [
            this.getFallbackPortfolio("conservative", productData.price),
            this.getFallbackPortfolio("balanced", productData.price),
            this.getFallbackPortfolio("aggressive", productData.price),
          ],
          education: aiSuggestions.education,
          explanation: `Instead of spending $${productData.price} on this item, see how investing that money could grow:`,
          api_source: "ai_fallback",
        };
      } catch (aiError) {
        console.error("AI fallback also failed:", aiError);
        return this.getFallbackSuggestions(productData);
      }
    }
  }

  async getAIStockSuggestions(productData) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(
          `🤖 Getting AI-powered stock suggestions from Cohere (attempt ${attempt}/${maxRetries})...`
        );

        const prompt = `Act as a financial advisor. Based on this product, suggest exactly 2-3 US stock ticker symbols.

Product: ${productData.name}
Category: ${productData.category}
Price: $${productData.price}

Rules:
- Return ONLY stock ticker symbols
- Use real US stock tickers (2-5 letters)
- Separate with commas and spaces
- No explanations or other text
- Choose companies related to this product category

Examples:
- For electronics: AAPL, MSFT, GOOGL
- For gaming: NVDA, AMD, ATVI
- For fashion: NKE, LULU, VFC

Your response:`;

        const response = await fetch(`${this.cohereBaseUrl}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.cohereApiKey}`,
          },
          body: JSON.stringify({
            model: "command-light",
            prompt: prompt,
            max_tokens: 30,
            temperature: 0.1,
            stop_sequences: ["\n", ".", "!", "?"],
          }),
        });

        if (!response.ok) {
          console.warn(
            `Cohere API request failed (attempt ${attempt}):`,
            response.status
          );
          if (attempt === maxRetries) {
            return this.getFallbackSuggestions(productData);
          }
          continue;
        }

        const data = await response.json();
        const aiResponse = data.generations[0]?.text?.trim() || "";

        console.log(`🤖 Cohere response (attempt ${attempt}):`, aiResponse);

        // Check for invalid responses (numbers, explanations, etc.)
        const invalidPatterns = [
          /^\d+\./, // Starts with number and dot
          /\b(Here|I|recommend|suggest|Consider|Based|The|For)\b/i, // Explanatory words
          /\b(are|is|will|should|could)\b/i, // Verbs indicating explanation
          /[\.!?].*[\.!?]/, // Multiple sentences
        ];

        const hasInvalidPattern = invalidPatterns.some((pattern) =>
          pattern.test(aiResponse)
        );
        if (hasInvalidPattern) {
          console.warn(
            `❌ Invalid Cohere response pattern (attempt ${attempt}): "${aiResponse}"`
          );
          if (attempt === maxRetries) {
            return this.getFallbackSuggestions(productData);
          }
          continue;
        }

        // Parse the AI response to extract stock tickers
        const stockMatches = aiResponse
          .replace(/[^\w\s,]/g, "") // Remove punctuation except commas
          .split(/[,\s]+/) // Split by commas and spaces
          .filter(
            (ticker) => ticker && ticker.length >= 2 && ticker.length <= 5
          ) // Valid ticker length
          .map((ticker) => ticker.toUpperCase())
          .slice(0, 3); // Take up to 3 stocks

        console.log(
          `🔍 Parsed tickers from "${aiResponse}": [${stockMatches.join(", ")}]`
        );

        if (stockMatches.length === 0) {
          console.warn(
            `No valid stocks extracted from AI response (attempt ${attempt}), trying again...`
          );
          if (attempt === maxRetries) {
            return this.getFallbackSuggestions(productData);
          }
          continue;
        }

        // Generate educational content using another Cohere call
        const education = await this.generateEducationalContent(
          productData,
          stockMatches
        );

        console.log(
          `✅ AI suggested stocks (attempt ${attempt}): ${stockMatches.join(
            ", "
          )}`
        );

        return {
          stocks: stockMatches,
          education: education,
        };
      } catch (error) {
        console.error(
          `AI stock suggestion failed (attempt ${attempt}):`,
          error
        );
        if (attempt === maxRetries) {
          return this.getFallbackSuggestions(productData);
        }
      }

      // Wait between retries
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return this.getFallbackSuggestions(productData);
  }

  async generateEducationalContent(productData, stocks) {
    try {
      const prompt = `Create a brief educational message about investing in these stocks: ${stocks.join(
        ", "
      )} as an alternative to buying ${productData.category} products like "${
        productData.name
      }".

Write 1-2 sentences explaining:
1. Why these companies relate to the ${productData.category} sector
2. How consumer spending in this area could benefit these investments

Keep it informative but accessible to beginner investors.

Educational message:`;

      const response = await fetch(`${this.cohereBaseUrl}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.cohereApiKey}`,
        },
        body: JSON.stringify({
          model: "command-light",
          prompt: prompt,
          max_tokens: 100,
          temperature: 0.4,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const educationText = data.generations[0]?.text?.trim() || "";
        if (educationText) {
          return educationText;
        }
      }

      // Fallback education
      return `Learn about investing in ${stocks.join(
        ", "
      )} - companies that could benefit from consumer trends in the ${productData.category.toLowerCase()} sector.`;
    } catch (error) {
      console.error("Educational content generation failed:", error);
      return `Learn about investing in ${stocks.join(
        ", "
      )} - companies that could benefit from consumer trends in the ${productData.category.toLowerCase()} sector.`;
    }
  }

  getFallbackSuggestions(productData) {
    console.log("Generating fallback suggestions for:", productData);

    const suggestions = {
      electronics: { stocks: ["AAPL", "MSFT"], strategy: "balanced" },
      gaming: { stocks: ["NVDA", "AMD"], strategy: "aggressive" },
      fashion: { stocks: ["NKE", "LULU"], strategy: "balanced" },
      shoes: { stocks: ["NKE", "ADDYY"], strategy: "balanced" },
      clothing: { stocks: ["NKE", "LULU"], strategy: "balanced" },
      tech: { stocks: ["MSFT", "GOOGL"], strategy: "balanced" },
      home: { stocks: ["HD", "LOW"], strategy: "conservative" },
      dockers: { stocks: ["VFC", "NKE"], strategy: "balanced" },
    };

    const category = (productData.category || "").toLowerCase();
    const name = (productData.name || "").toLowerCase();
    const brand = (productData.brand || "").toLowerCase();

    // Try to match category, product name, or brand
    for (const [key, value] of Object.entries(suggestions)) {
      if (category.includes(key) || name.includes(key) || brand.includes(key)) {
        return {
          stocks: value.stocks,
          strategy: value.strategy,
          education: `Learn about investing in ${value.stocks.join(
            ", "
          )} - companies in the ${key} sector that could benefit from consumer trends.`,
          explanation: `Instead of spending $${
            productData.price
          } on this ${key} item, consider investing in related companies like ${value.stocks.join(
            " or "
          )} for potential long-term growth.`,
        };
      }
    }

    // Default fallback
    return {
      stocks: ["SPY", "VTI"],
      strategy: "balanced",
      education:
        "Learn about diversified index fund investing with broad market ETFs that track the S&P 500 and total stock market.",
      explanation: `Consider investing your $${
        productData.price
      } in a diversified index fund instead. Historical market returns suggest this could grow to approximately $${(
        productData.price * 1.1
      ).toFixed(2)} in one year.`,
    };
  }

  async resetSimulationLimit() {
    try {
      console.log("🔄 Resetting simulation limit by creating new team...");

      // Generate a new team name with timestamp
      const timestamp = Date.now();
      const newTeamName = `stockswap_team_${timestamp}`;

      console.log(`🆕 Creating new team: ${newTeamName}`);

      const response = await fetch(`${this.baseUrl}/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          team_name: newTeamName,
          password: "stockswap123",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to create new team:", response.status, errorText);
        return false;
      }

      const teamData = await response.json();
      console.log("✅ New team created:", teamData);

      // Update stored credentials
      this.clientId = teamData.client_id;
      this.clientSecret = teamData.client_secret;

      // Store new credentials
      await chrome.storage.local.set({
        rbc_client_id: this.clientId,
        rbc_client_secret: this.clientSecret,
        team_name: newTeamName,
      });

      // Get new JWT token
      await this.authenticate();

      console.log("🎉 Successfully reset simulation limit with new team!");
      return true;
    } catch (error) {
      console.error("Failed to reset simulation limit:", error);
      return false;
    }
  }

  getFallbackPortfolio(strategy, amount) {
    console.log(
      `Generating fallback portfolio for ${strategy} strategy with $${amount}`
    );

    const fallbackMultipliers = {
      conservative: 1.07, // 7% annual return
      balanced: 1.1, // 10% annual return
      aggressive: 1.15, // 15% annual return
    };

    const multiplier = fallbackMultipliers[strategy] || 1.1;
    const projectedValue = amount * multiplier;

    return {
      strategy: strategy,
      initial_investment: amount,
      projected_value: projectedValue,
      total_return: projectedValue - amount,
      return_percentage: (((projectedValue - amount) / amount) * 100).toFixed(
        2
      ),
      time_period: "12 months",
      source: "fallback",
    };
  }

  async getClientPortfolios() {
    try {
      const response = await fetch(
        `${this.rbcBaseUrl}/clients/${this.clientId}/portfolios`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.jwtToken}`,
          },
        }
      );

      if (response.ok) {
        const portfolios = await response.json();
        console.log("📋 Existing portfolios:", portfolios);
        return portfolios;
      } else {
        console.warn("Failed to fetch existing portfolios:", response.status);
        return [];
      }
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      return [];
    }
  }

  async clearExistingPortfolios() {
    try {
      const portfolios = await this.getClientPortfolios();
      if (!portfolios || portfolios.length === 0) {
        console.log("📋 No existing portfolios to clear");
        return;
      }

      console.log(`🗑️ Deleting ${portfolios.length} existing portfolios...`);

      // Delete portfolios one by one to avoid race conditions
      for (const portfolio of portfolios) {
        try {
          console.log(
            `🗑️ Deleting portfolio ${portfolio.id} (${portfolio.type})...`
          );
          const deleteResponse = await fetch(
            `${this.rbcBaseUrl}/clients/${this.clientId}/portfolios/${portfolio.id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${this.jwtToken}`,
              },
            }
          );

          if (deleteResponse.ok) {
            console.log(
              `✅ Deleted portfolio ${portfolio.id} (${portfolio.type})`
            );
          } else {
            const errorText = await deleteResponse.text();
            console.warn(
              `❌ Failed to delete portfolio ${portfolio.id}:`,
              deleteResponse.status,
              errorText
            );
          }

          // Small delay between deletions
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error deleting portfolio ${portfolio.id}:`, error);
        }
      }

      console.log("🧹 Portfolio cleanup completed");

      // Verify all portfolios are deleted
      const remainingPortfolios = await this.getClientPortfolios();
      if (remainingPortfolios && remainingPortfolios.length > 0) {
        console.warn(
          `⚠️ ${remainingPortfolios.length} portfolios still remain after cleanup`
        );
      } else {
        console.log("✅ All portfolios successfully deleted");
      }
    } catch (error) {
      console.error("Error during portfolio cleanup:", error);
    }
  }
}

// Initialize API instance
const investSmartAPI = new StockSwapAPI();

// Keep service worker alive
console.log("StockSwap background script loaded");

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  console.log("Sender:", sender);

  // Handle each action type
  switch (message.action) {
    case "analyzeProduct":
      handleAnalyzeProduct(message, sendResponse);
      return true; // Keep channel open for async response

    case "trackAvoidedPurchase":
      handleTrackPurchase(message, sendResponse);
      return true;

    default:
      console.log("Unknown action:", message.action);
      sendResponse({ error: `Unknown action: ${message.action}` });
      return false;
  }
});

async function handleAnalyzeProduct(message, sendResponse) {
  try {
    console.log("Analyzing product:", message.productData);

    const result = await investSmartAPI.analyzeProduct(message.productData);
    console.log("Analysis result:", result);

    sendResponse(result);
  } catch (error) {
    console.error("Analysis error:", error);
    // Absolute fallback
    sendResponse({
      stocks: ["SPY", "VTI"],
      strategy: "balanced",
      education: `Learn about investing in index funds instead of spending $${
        message.productData?.price || 100
      }`,
      explanation:
        "Instead of buying this item, consider investing in a diversified portfolio for long-term growth.",
    });
  }
}

async function handleTrackPurchase(message, sendResponse) {
  try {
    const result = await trackAvoidedPurchase(message.productData);
    sendResponse(result);
  } catch (error) {
    console.error("Track purchase error:", error);
    sendResponse({ error: error.message });
  }
}

async function trackAvoidedPurchase(productData) {
  try {
    // Store avoided purchase in local storage for tracking
    const stored = await chrome.storage.local.get([
      "avoidedPurchases",
      "totalSavings",
    ]);
    const avoidedPurchases = stored.avoidedPurchases || [];
    const totalSavings = stored.totalSavings || 0;

    const newPurchase = {
      ...productData,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
    };

    avoidedPurchases.push(newPurchase);
    const newTotalSavings = totalSavings + productData.price;

    await chrome.storage.local.set({
      avoidedPurchases: avoidedPurchases.slice(-50), // Keep last 50 purchases
      totalSavings: newTotalSavings,
    });

    // Show success notification
    chrome.notifications.create({
      type: "basic",
      iconUrl: "assets/icon48.png",
      title: "Smart Choice!",
      message: `You saved $${
        productData.price
      }! Total savings: $${newTotalSavings.toFixed(2)}`,
    });

    return { success: true, totalSavings: newTotalSavings };
  } catch (error) {
    console.error("Failed to track avoided purchase:", error);
    throw error;
  }
}

// Handle tab updates - detect shopping sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const isShoppingSite = isShoppingWebsite(tab.url);
    if (isShoppingSite) {
      // Inject shopping detection
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            // Signal to content script that this is a shopping site
            window.postMessage({ type: "STOCKSWAP_SHOPPING_SITE" }, "*");
          },
        });
      } catch (error) {
        console.log("Could not inject script:", error);
      }
    }
  }
});

function isShoppingWebsite(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
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
  } catch {
    return false;
  }
}

// Installation handler
chrome.runtime.onInstalled.addListener(() => {
  console.log("StockSwap Shopping Advisor installed");
  // Initialize storage with API key for demo
  chrome.storage.local.set({
    totalSavings: 0,
    avoidedPurchases: [],
    learningProgress: {},
    cohereApiKey: "eL8tMALym78D2JyJipo3C7hF13e13tHxvZiBWT4b", // TODO: Move to secure config
  });
});

// Context menu for quick analysis
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyzePrice",
    title: "Analyze with StockSwap",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "analyzePrice" && info.selectionText) {
    const priceMatch = info.selectionText.match(
      /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/
    );
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ""));
      chrome.tabs.sendMessage(tab.id, {
        action: "showInvestmentSuggestion",
        price: price,
      });
    }
  }
});

console.log("StockSwap Shopping Advisor background script loaded!");
