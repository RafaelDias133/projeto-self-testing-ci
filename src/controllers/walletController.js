const express = require('express');

function createWalletController(service) {
  const router = express.Router();

  router.post('/accounts', async (req, res) => {
    const account = await service.createAccount(req.body ?? {});
    res.status(201).json(account);
  });

  router.get('/accounts/:id', (req, res) => {
    res.json(service.getAccount(req.params.id));
  });

  router.get('/accounts/:id/statement', (req, res) => {
    const { from, to, type } = req.query;
    res.json(service.getStatement(req.params.id, { from, to, type }));
  });

  router.post('/transfers', async (req, res) => {
    const { fromAccountId, toAccountId, amount } = req.body ?? {};
    const transfer = await service.transfer({
      fromAccountId,
      toAccountId,
      amount,
      idempotencyKey: req.get('Idempotency-Key'),
    });
    res.status(transfer.replayed ? 200 : 201).json(transfer);
  });

  return router;
}

module.exports = { createWalletController };
