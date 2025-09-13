// Configuration file - This will be generated from .env
// DO NOT EDIT MANUALLY - Edit .env instead and run build script

const CONFIG = {
  COHERE_API_KEY: "PLACEHOLDER_WILL_BE_REPLACED",
  RBC_TEAM_NAME: "PLACEHOLDER_WILL_BE_REPLACED", 
  RBC_CONTACT_EMAIL: "PLACEHOLDER_WILL_BE_REPLACED",
  DEMO_MODE: true
};

// Make config available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
} else if (typeof self !== 'undefined') {
  self.CONFIG = CONFIG;
}
