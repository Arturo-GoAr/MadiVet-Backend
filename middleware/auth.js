const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            codigo: 'TOKEN_REQUIRED',
            mensaje: 'No se proporcionó un token'
        });
    }

    const [scheme, token, ...extra] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token || extra.length > 0) {
        return res.status(401).json({
            codigo: 'INVALID_TOKEN_FORMAT',
            mensaje: 'Formato de token incorrecto'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (error, datos) => {
        if (error) {
            return res.status(403).json({
                codigo: 'INVALID_TOKEN',
                mensaje: 'Token inválido o expirado'
            });
        }

        req.usuario = datos;
        next();
    });
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            return res.status(403).json({
                codigo: 'FORBIDDEN',
                mensaje: 'No tienes permiso para realizar esta acción.'
            });
        }

        return next();
    };
}

module.exports = verificarToken;
module.exports.requireRole = requireRole;