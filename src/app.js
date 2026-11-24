const express = require('express');
const { createWalletController } = require('./controllers/walletController');
const { DomainError } = require('./domain/errors');

function createApp({ service, logger = console }) {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(createWalletController(service));

  app.use((error, req, res, next) => {
    if (error instanceof DomainError) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON invalido' });
    }
    logger.error(error);
    return res.status(500).json({ error: 'Erro interno' });
  });

  return app;
}

module.exports = { createApp };
