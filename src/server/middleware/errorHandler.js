import multer from 'multer';
import path from 'path';

export function jsonSyntaxErrorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload'
    });
  }
  next(err);
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload'
    });
  }

  if (err && err.name === 'ZodError') {
    const errorMessages = (err.errors || []).map(e => `${e.path ? e.path.join('.') + ': ' : ''}${e.message}`).join(', ');
    return res.status(400).json({
      success: false,
      error: `Validation error: ${errorMessages || err.message}`,
      details: err.errors
    });
  }

  if (err instanceof multer.MulterError || (err.message && err.message.includes('Invalid file type'))) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  if (err && typeof err === 'object') {
    const status = err.status || err.statusCode || 500;
    const message = err.message || err.error || (status === 500 ? 'Internal server error' : 'Request failed');
    
    if (status >= 500 && process.env.NODE_ENV !== 'test') {
      console.error('Unhandled Error:', err);
    }

    return res.status(status).json({
      success: false,
      error: message,
      ...(err.details ? { details: err.details } : {})
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
}

export function spaFallback(publicDir) {
  return (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found'
      });
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  };
}
