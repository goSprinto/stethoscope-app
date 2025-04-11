// List of trusted domains
const trustedDomains = ["https://*.sprinto.com"];

// Function to check if a URL is trusted
function isTrustedUrl(url) {
  return trustedDomains.some((domain) => {
    const regex = new RegExp(`^${domain.replace(/\*/g, ".*")}$`);
    return regex.test(url);
  });
}

// Function to check if a URL is trusted
export default isTrustedUrl;
