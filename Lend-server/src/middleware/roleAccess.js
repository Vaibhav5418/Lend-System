/**
 * Role-Based Access Control middleware skeleton.
 *
 * Roles hierarchy:
 *   Super Admin  – full access
 *   Admin        – manage all modules
 *   Finance      – investments, loans, payments, collections, profit
 *   Operations   – inquiries, proposals, loans
 *   Viewer       – read-only access
 *
 * NOTE: Role field is NOT yet added to User model.
 *       This middleware is a placeholder — enable once User.role is implemented.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  FINANCE: 'Finance',
  OPERATIONS: 'Operations',
  VIEWER: 'Viewer',
});

/**
 * Middleware factory: restrict route to specified roles.
 * @param  {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 *
 * Usage:
 *   router.get('/secret', requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), handler);
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Until User model has a `role` field, allow all authenticated users.
    const userRole = req.user?.role;

    if (!userRole) {
      // Role not yet assigned — skip enforcement (remove this block once roles are live)
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    next();
  };
}

/**
 * Read-only guard — blocks POST/PUT/PATCH/DELETE for Viewer role.
 * @returns {import('express').RequestHandler}
 */
export function readOnlyGuard(req, res, next) {
  const userRole = req.user?.role;
  if (userRole === ROLES.VIEWER && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(403).json({ error: 'Forbidden: read-only access' });
  }
  next();
}
