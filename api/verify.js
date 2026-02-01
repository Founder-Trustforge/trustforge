// api/verify.js
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;
  
  // Validate address parameter
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Invalid address parameter' });
  }

  // Normalize and validate Ethereum address format
  const normalized = address.toLowerCase().trim();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    return res.status(400).json({ error: 'Invalid Ethereum address format (must be 42 chars, start with 0x)' });
  }

  // Get API key from Vercel environment variable (NEVER expose in frontend)
  const apiKey = process.env.BASESCAN_API_KEY;
  if (!apiKey) {
    console.error('BASESCAN_API_KEY not configured in Vercel environment variables');
    return res.status(500).json({ error: 'Verification service unavailable - contact support' });
  }

  try {
    // Fetch contract bytecode from Basescan API (CORS-friendly)
    const apiUrl = `https://api.basescan.org/api?module=proxy&action=eth_getCode&address=${normalized}&apikey=${apiKey}`;
    const response = await fetch(apiUrl);
    
    // Handle HTTP errors
    if (!response.ok) {
      throw new Error(`Basescan API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle Basescan API errors
    if (data.status !== "1" || data.message !== "OK") {
      if (data.result === "Invalid API Key") {
        console.error('Invalid Basescan API key - check Vercel environment variables');
        return res.status(500).json({ error: 'Verification service error' });
      }
      if (data.message === "NOTOK") {
        return res.status(400).json({ 
          error: "Address not found on Base Mainnet - verify this is a Base chain address" 
        });
      }
      return res.status(400).json({ error: data.message || "Verification failed" });
    }

    // Return bytecode to frontend
    res.status(200).json({ 
      address: normalized,
      bytecode: data.result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: error.message.includes('network') || error.message.includes('fetch')
        ? 'Network error - check internet connection and try again in 30 seconds'
        : 'Verification service unavailable - please try again later'
    });
  }
}
