/* eslint-disable no-console */

const path = require('path');
const url = require('url');

const { set } = require('lodash');
const express = require('express'); // eslint-disable-line import/no-unresolved
const helmet = require('helmet');

const Provider = require('../lib'); // require('oidc-provider');

const Account = require('./support/account');
const { provider: providerConfiguration, clients, keys } = require('./support/configuration');
const routes = require('./routes/express');

const { PORT = 3000, ISSUER = `http://localhost:${PORT}`, TIMEOUT } = process.env;
providerConfiguration.findById = Account.findById;

const app = express();
app.use(helmet());

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const bodyParser = require('body-parser');

const mongoAdapter = require('./adapters/mongodb');

const redisAdapter = require('./adapters/redis');

const provider = new Provider(ISSUER, providerConfiguration);

if (TIMEOUT) {
  provider.defaultHttpOptions = { timeout: parseInt(TIMEOUT, 10) };
}

let server;
console.log('1');
(async () => {
  console.log('2');
  await provider.initialize({
    adapter: redisAdapter, // eslint-disable-line global-require
    clients,
    keystore: { keys },
  });
  console.log('3');
  const parse = bodyParser.urlencoded({ extended: false });

  app.post('/interaction/:grant/login', parse, (req, res, next) => {
    Account.authenticate(req.body.login, req.body.password)
      .then(account => provider.interactionFinished(req, res, {
        login: {
          account: account.accountId,
          remember: !!req.body.remember,
          ts: Math.floor(Date.now() / 1000),
        },
        consent: {
          rejectedScopes: req.body.remember ? ['offline_access'] : [],
        },
        meta: {
          // object structure up-to-you
          bankId: '1234567890',
        },
      })).catch(next);
  });

  if (process.env.NODE_ENV === 'production') {
    app.enable('trust proxy');
    provider.proxy = true;
    set(providerConfiguration, 'cookies.short.secure', true);
    set(providerConfiguration, 'cookies.long.secure', true);

    app.use((req, res, next) => {
      if (req.secure) {
        next();
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        res.redirect(url.format({
          protocol: 'https',
          host: req.get('host'),
          pathname: req.originalUrl,
        }));
      } else {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'do yourself a favor and only use https',
        });
      }
    });
  }

  routes(app, provider);
  app.use(provider.callback);
  server = app.listen(PORT, () => {
    console.log(`application is listening on port ${PORT}, check it's /.well-known/openid-configuration`);
  });
})().catch((err) => {
  if (server && server.listening) server.close();
  console.error(err);
  process.exitCode = 1;
});
