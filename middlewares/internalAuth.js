module.exports = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(403).json({ success: false, msg: 'Forbidden' });
  }
  next();
};
