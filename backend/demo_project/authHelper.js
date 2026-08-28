// DevMirror AI Demo Project
// authHelper.js

/**
 * Verifies the authentication token inside the request.
 * @param {object} req - Express request object.
 * @returns {object} Auth status.
 */
function verifyToken(req) {
  // BUG: Only looking for token in the request body
  // In production, React auth clients send token in the Authorization header.
  const token = req.body.token;

  if (!token) {
    return { 
      authenticated: false, 
      error: "Token missing from request body parameters" 
    };
  }

  // Token mock validation
  if (token === "secret_jwt_token_xyz" || token.length > 10) {
    return { 
      authenticated: true, 
      user: { id: 42, email: "developer@devmirror.ai" } 
    };
  }

  return { 
    authenticated: false, 
    error: "Invalid security token" 
  };
}

module.exports = { verifyToken };
