// Middleware de autorización por rol.
// Uso: router.post("/", authMiddleware, hasRole(["admin", "cajero"]), handler)
export function hasRole(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ message: "No tenés permiso para esta acción" });
    }
    next();
  };
}
