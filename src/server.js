require('dotenv').config({ quiet: true });
const { createApp } = require('./app');
const { createDatabase } = require('./repositories/database');
const { createWalletService } = require('./services/walletService');
const { createFraudNotifier } = require('./services/fraudNotifier');
const { createDocumentValidator } = require('./services/documentValidator');

const port = Number(process.env.PORT || 3000);

const service = createWalletService({
  db: createDatabase(process.env.DB_FILE || ':memory:'),
  fraudNotifier: createFraudNotifier({ url: process.env.FRAUD_WEBHOOK_URL }),
  documentValidator: createDocumentValidator({ url: process.env.DOCUMENT_VALIDATION_URL }),
});

createApp({ service }).listen(port, () => {
  console.log(`Wallet API rodando na porta ${port}`);
});
