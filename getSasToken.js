import CryptoJS from 'crypto-js';

function createSharedAccessToken(uri, saName, saKey) {
  if (!uri || !saName || !saKey) {
    throw "Missing required parameter";
  }
  
  const encodedUri = encodeURIComponent(uri);
  const now = Math.floor(Date.now() / 1000);  // Current time in seconds
  const week = 2592000;  // 30 days in seconds
  const expiry = now + week;
  const stringToSign = encodedUri + '\n' + expiry;
  
  // Create the HMAC-SHA256 hash from the string to sign and the shared key
  const hash = CryptoJS.HmacSHA256(stringToSign, saKey);
  const hashInBase64 = CryptoJS.enc.Base64.stringify(hash);

  // Construct the final SAS token
  const token = `SharedAccessSignature sr=${encodedUri}&sig=${encodeURIComponent(hashInBase64)}&se=${expiry}&skn=${saName}`;
  
  return token;
}

export default createSharedAccessToken;
