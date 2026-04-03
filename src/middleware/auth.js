/**
 * Authentication Middleware
 * 
 * TODO: Replace with Keycloak JWT validation later
 * For now: Simple header-based authentication
 */

function authMiddleware(req, res, next) {
  // TODO: Later validate JWT token from Keycloak
  // const token = req.headers.authorization?.split(' ')[1];
  // const decoded = jwt.verify(token, KEYCLOAK_PUBLIC_KEY);
  // req.user_id = decoded.sub;

  // For now: Simple X-User-ID header
  const userId = req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing X-User-ID header'
    });
  }

  req.user_id = userId;
  next();
}

module.exports = authMiddleware;
